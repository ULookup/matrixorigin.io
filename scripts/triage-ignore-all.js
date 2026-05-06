#!/usr/bin/env node
/**
 * Triage every `<!-- validator-ignore -->` SQL block.
 *
 * For each block:
 *   1. Extract the raw SQL (honours the standard extractor's ignore flag so
 *      we re-read the file manually).
 *   2. Send to the MatrixOne native SQL parser to see whether it is even
 *      syntactically valid today.
 *   3. Optionally try to execute it against the running MatrixOne container
 *      in an isolated per-block database.
 *
 * Produces a per-block verdict plus an aggregated recommendation:
 *   - keep-ignore     still needs a fixture / external data; stay ignored
 *   - downgrade-exec  syntactically valid; can move to `ignore-exec`
 *   - safe-to-run     parses AND runs clean; strip the ignore marker
 *   - syntax-error    parser rejects — likely stale doc, needs a fix
 *   - runtime-error   parses but MO errors out — likely stale doc
 *
 * Results saved to `tmp/ignore-all-triage.{json,md}` for follow-up.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname } from 'node:path'
import mysql from 'mysql2/promise'
import { extractSqlFromContent, splitSqlStatements } from './doc-validator/utils/sql-extractor.js'

const COV_JSON = 'tmp/sql-coverage.json'
const OUTPUT_JSON = 'tmp/ignore-all-triage.json'
const OUTPUT_MD = 'tmp/ignore-all-triage.md'
const NATIVE_CHECKER = 'scripts/doc-validator/syntax-checker/syntax-checker'

const DB = {
  host: '127.0.0.1', port: 6001, user: 'root', password: '111',
}

// --- external-dependency heuristic (same as coverage report) ---
const EXTERNAL_PATTERNS = [
  { name: 's3-url',         re: /['"]\s*s3:\/\//i },
  { name: 'minio-url',      re: /['"]\s*minio:\/\//i },
  { name: 'oss-url',        re: /['"]\s*oss:\/\//i },
  { name: 'https-url',      re: /['"]\s*https?:\/\//i },
  { name: 'stage',          re: /\bCREATE\s+STAGE\b/i },
  { name: 'stage-ref',      re: /\bURL\s*=\s*['"]stage:\/\//i },
  { name: 'load-infile-external', re: /LOAD\s+DATA\s+(?:LOCAL\s+)?INFILE\s+['"](?:s3:|oss:|https?:|minio:|stage:)/i },
  { name: 'load-infile-abs',re: /LOAD\s+DATA\s+(?:LOCAL\s+)?INFILE\s+['"]\//i },
  { name: 'external-table', re: /\bCREATE\s+EXTERNAL\s+TABLE\b/i },
  { name: 'infile',         re: /\bINFILE\s+['"]/i },
  { name: 'kafka',          re: /\bKAFKA\b/i },
  { name: 'credentials',    re: /\bCREDENTIALS\s*\{/i },
  { name: 'mobr-command',   re: /\bmobr\b/i },
  { name: 'modump-command', re: /\bmo-dump\b/i },
]

function externalReason(sql) {
  for (const { name, re } of EXTERNAL_PATTERNS) if (re.test(sql)) return name
  return null
}

// --- native MatrixOne syntax parser ---
// The Go checker accepts one statement per entry of `statements[]`. Spawning
// it once per block is expensive (~100ms startup × 200+ blocks), so batch
// every block's statements in a single call and split the results back
// apart afterwards.
function parseBatch(allStatements) {
  if (!allStatements.length) return Promise.resolve([])
  return new Promise((resolve, reject) => {
    const child = spawn(NATIVE_CHECKER, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    child.stdout.on('data', d => { stdout += d.toString() })
    child.stderr.on('data', d => { stderr += d.toString() })
    child.on('close', (code) => {
      try {
        const parsed = JSON.parse(stdout)
        resolve(parsed.results || [])
      } catch (err) {
        reject(new Error(`parser I/O: ${err.message} (stderr=${stderr})`))
      }
    })
    child.on('error', reject)
    child.stdin.write(JSON.stringify({ statements: allStatements }))
    child.stdin.end()
  })
}

// --- extract raw SQL text for every ignore-all block, re-parsing source files ---
function rawIgnoreBlocks(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const fences = []
  let inBlock = false
  let current = null
  const FENCE_RE = /^(\s*)```(\w+)?/
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(FENCE_RE)
    if (!inBlock && m) {
      const language = (m[2] || '').toLowerCase()
      const prev = i > 0 ? lines[i - 1].trim() : ''
      const ignoreAll = /<!--\s*validator-ignore\s*-->/.test(line) ||
                       /^<!--\s*validator-ignore\s*-->$/.test(prev)
      current = {
        filePath,
        startLine: i + 2,
        language,
        ignoreAll,
        content: '',
      }
      inBlock = true
      continue
    }
    if (inBlock && /^\s*```/.test(line)) {
      current.endLine = i
      if (current.ignoreAll && (current.language === 'sql' || current.language === '')) {
        fences.push(current)
      }
      current = null
      inBlock = false
      continue
    }
    if (inBlock) current.content += line + '\n'
  }
  return fences
}

function trimmedFirstStatement(sql) {
  // Return the first non-comment line (for summary display).
  for (const raw of sql.split('\n')) {
    const s = raw.trim()
    if (!s) continue
    if (s.startsWith('--') || s.startsWith('#') || s.startsWith('/*')) continue
    return s.length > 100 ? s.slice(0, 97) + '...' : s
  }
  return ''
}

// Extract just the SQL statements from a mysql-style transcript block.
// Lines starting with `mysql>` or `-> ` (continuation) contribute; any other
// line is treated as query output and dropped. Handles both `mysql>` and the
// bare `> ` / `>` prompt style used in several MatrixOne pages. Returns the
// cleaned SQL source (newline-joined). If the block doesn't look like a
// transcript, returns the input unchanged.
function stripMysqlTranscript(sql) {
  const lines = sql.split('\n')
  const hasPrompt = lines.some(l => /^\s*(mysql>|>\s)/.test(l))
  if (!hasPrompt) return { sql, wasTranscript: false }
  const out = []
  let inStatement = false
  for (const raw of lines) {
    const m = raw.match(/^\s*(?:mysql>|>)\s?(.*)$/)
    if (m) {
      out.push(m[1])
      inStatement = true
    } else if (inStatement && /^\s*->\s?(.*)$/.test(raw)) {
      out.push(raw.replace(/^\s*->\s?/, ''))
    } else {
      inStatement = false
    }
  }
  return { sql: out.join('\n'), wasTranscript: true }
}

// Heuristic: is this block a bare syntax template (e.g. CREATE …
// `<snapshot_name>`, `{elements}`, `column_list`) rather than a runnable
// example? If so we should not treat parse errors as stale documentation.
function looksLikeSyntaxTemplate(sql) {
  const stripped = sql.replace(/\s+/g, ' ').trim()
  if (!stripped) return false
  const placeholderHits = (stripped.match(/<[a-z_][a-z0-9_ ]*>|\{[a-z_][a-z0-9_ ]*\}|\[[A-Z][^\]]*\]/gi) || []).length
  // If >=2 placeholders it's almost certainly a syntax template.
  if (placeholderHits >= 2) return true
  // Single-line bare identifiers like "column_list" or "table_name" as whole SQL.
  if (/^[a-z_][a-z0-9_]*\s*;?\s*$/i.test(stripped)) return true
  // Lines that start with "> CREATE" / "> ALTER" — doc syntax convention.
  if (/^>\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT)\b/i.test(sql.trim())) return true
  return false
}

// Some ignore-all blocks contain shell transcripts — extract just the SQL
// portion by dropping lines that look like prompts or command output.
function looksLikeShellTranscript(sql) {
  const lines = sql.split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return false
  const shell = lines.filter(l =>
    /^\$\s/.test(l) ||
    /^#\s/.test(l) ||
    /^[a-z0-9_-]+@[a-z0-9_.-]+/i.test(l) ||
    /^mysql\s+-/i.test(l) ||
    /^bash\s+/i.test(l) ||
    /^cat\s+</i.test(l) ||
    /^mobr\b/i.test(l) ||
    /^mo-dump\b/i.test(l) ||
    /^mo-ctl\b/i.test(l) ||
    /^mysqldump\b/i.test(l)
  ).length
  return shell / lines.length > 0.3
}

const EXEC_TIMEOUT_MS = 5000

/**
 * Drop every non-system global resource so consecutive triage runs start
 * from a clean baseline. The triage pipeline creates tons of ACCOUNT /
 * PITR / SNAPSHOT / PUBLICATION / STAGE objects; they live outside the
 * per-block `doc_test_*` database so they pile up across runs and produce
 * spurious `already exists` errors on re-runs.
 *
 * We keep MO's built-in system resources (currently: sys account, and any
 * pitr/snapshot belonging to the sys account only). Everything else is
 * fair game.
 */
async function baselineClean(conn) {
  const log = []
  // Drop snapshots (table-valued, list shape: SNAPSHOT_NAME TIMESTAMP LEVEL …)
  try {
    const [snaps] = await conn.query('SHOW SNAPSHOTS')
    for (const s of snaps) {
      const name = s.SNAPSHOT_NAME || s.snapshot_name
      if (!name) continue
      try { await conn.query(`DROP SNAPSHOT \`${name}\``); log.push(`snapshot:${name}`) } catch (_) {}
    }
  } catch (_) {}
  // Drop pitrs
  try {
    const [pitrs] = await conn.query('SHOW PITR')
    for (const p of pitrs) {
      const name = p.PITR_NAME || p.pitr_name
      if (!name) continue
      try { await conn.query(`DROP PITR \`${name}\``); log.push(`pitr:${name}`) } catch (_) {}
    }
  } catch (_) {}
  // Drop publications
  try {
    const [pubs] = await conn.query('SHOW PUBLICATIONS')
    for (const p of pubs) {
      const name = p.publication || p.PUBLICATION || p.pub_name
      if (!name) continue
      try { await conn.query(`DROP PUBLICATION \`${name}\``); log.push(`publication:${name}`) } catch (_) {}
    }
  } catch (_) {}
  // Drop stages
  try {
    const [stages] = await conn.query('SHOW STAGES')
    for (const s of stages) {
      const name = s.STAGE_NAME || s.stage_name
      if (!name) continue
      try { await conn.query(`DROP STAGE \`${name}\``); log.push(`stage:${name}`) } catch (_) {}
    }
  } catch (_) {}
  // Drop non-system accounts last (drops their snapshots/pitrs cascade)
  try {
    const [accounts] = await conn.query('SHOW ACCOUNTS')
    for (const a of accounts) {
      const name = a.account_name || a.ACCOUNT_NAME
      if (!name || name === 'sys') continue
      try { await conn.query(`DROP ACCOUNT IF EXISTS \`${name}\``); log.push(`account:${name}`) } catch (_) {}
    }
  } catch (_) {}
  // Drop residual triage_* databases
  try {
    const [dbs] = await conn.query("SHOW DATABASES LIKE 'triage_%'")
    for (const row of dbs) {
      const name = Object.values(row)[0]
      if (!name) continue
      try { await conn.query(`DROP DATABASE IF EXISTS \`${name}\``); log.push(`db:${name}`) } catch (_) {}
    }
  } catch (_) {}
  // Drop other residual databases created by the docs (non-system)
  try {
    const [dbs] = await conn.query('SHOW DATABASES')
    const SYSTEM = new Set(['information_schema','mysql','mo_catalog','mo_debug','mo_task','system','system_metrics'])
    for (const row of dbs) {
      const name = Object.values(row)[0]
      if (!name || SYSTEM.has(name) || /^triage_/.test(name) || /^doc_test_/.test(name)) continue
      try { await conn.query(`DROP DATABASE IF EXISTS \`${name}\``); log.push(`db:${name}`) } catch (_) {}
    }
  } catch (_) {}
  return log
}

async function tryExecute(conn, sql) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('triage-timeout'), { code: 'TIMEOUT' })), EXEC_TIMEOUT_MS)
  })
  try {
    await Promise.race([conn.query(sql), timeout])
    clearTimeout(timer)
    return { ok: true }
  } catch (err) {
    clearTimeout(timer)
    return { ok: false, message: err.message, code: err.code, sqlState: err.sqlState }
  }
}

async function main() {
  if (!process.argv.includes('--skip-exec')) {
    try {
      const probe = await mysql.createConnection(DB).then(c => c.end())
    } catch (err) {
      console.error('Could not connect to MatrixOne at 127.0.0.1:6001:', err.message)
      console.error('Pass --skip-exec to run the parse stage only.')
      process.exit(1)
    }
  }

  const cov = JSON.parse(readFileSync(COV_JSON, 'utf-8'))
  const ignoreAllRows = cov.rows.filter(r => r.bucket === 'ignore-all')
  const files = [...new Set(ignoreAllRows.map(r => r.file))]

  // Re-extract raw ignore blocks from files (we need the SQL body).
  const blocks = []
  for (const f of files) {
    for (const b of rawIgnoreBlocks(f)) blocks.push(b)
  }
  console.log(`Found ${blocks.length} ignore-all blocks across ${files.length} files.`)
  if (blocks.length !== ignoreAllRows.length) {
    console.log(`(coverage-report counted ${ignoreAllRows.length}; mismatches are usually non-sql fences adjacent to an ignore comment)`)
  }

  let conn = process.argv.includes('--skip-exec') ? null : await mysql.createConnection(DB)
  async function recycleConn() {
    if (!conn) return
    try { conn.destroy() } catch (_) {}
    conn = await mysql.createConnection(DB)
  }

  if (conn) {
    const dropped = await baselineClean(conn)
    if (dropped.length) console.log(`baseline-clean dropped ${dropped.length} global objects (${dropped.slice(0, 6).join(', ')}${dropped.length > 6 ? ', …' : ''})`)
  }

  // Stage 1: batched parse for every block's cleaned SQL.
  const perBlock = blocks.map((b) => {
    const sql = b.content.trim()
    if (!sql) return { block: b, sql: '', sqlForParse: '', classified: 'empty', first: '', transcript: null }
    const transcript = stripMysqlTranscript(sql)
    const sqlForParse = transcript.sql
    const statements = splitSqlStatements(sqlForParse).filter(s => s.trim())
    return {
      block: b,
      sql,
      sqlForParse,
      transcript,
      first: trimmedFirstStatement(sql),
      statements,
      shellTx: looksLikeShellTranscript(sql),
      tpl: looksLikeSyntaxTemplate(sql),
      ext: externalReason(sql),
    }
  })

  // Flatten all statements for one parser call, then re-group results.
  const flatStatements = []
  const ranges = []
  for (const p of perBlock) {
    if (!p.statements || !p.statements.length) {
      ranges.push([0, 0])
      continue
    }
    const start = flatStatements.length
    flatStatements.push(...p.statements)
    ranges.push([start, flatStatements.length])
  }
  console.log(`Batched ${flatStatements.length} statements across ${perBlock.length} blocks — parsing once.`)
  const parseResults = await parseBatch(flatStatements)

  const results = []
  let idx = 0
  for (const p of perBlock) {
    idx++
    const b = p.block
    const notes = []
    if (p.classified === 'empty') {
      results.push({ file: b.filePath, startLine: b.startLine, endLine: b.endLine, verdict: 'empty', first: '', notes: ['empty block'] })
      continue
    }
    let verdict = null

    if (p.shellTx) {
      verdict = 'non-sql-shell'
      notes.push('looks like shell transcript')
    } else if (p.tpl) {
      verdict = 'syntax-template'
      notes.push('bare syntax template, not a runnable example')
    } else {
      const [rs, re] = ranges[idx - 1]
      const slice = parseResults.slice(rs, re)
      const bad = slice.find(r => !r.valid)
      if (bad) {
        verdict = 'syntax-error'
        notes.push(`parser: ${bad.error}`)
        if (p.transcript && p.transcript.wasTranscript) notes.push('(block contained mysql> transcript)')
      } else if (p.ext) {
        verdict = 'external-needed'
        notes.push(`external: ${p.ext}`)
      }
    }

    // Stage 2: execute (skip if we already have a terminal verdict or no conn)
    if (!verdict && conn) {
      // Each block runs in its own isolated database so state leak is contained.
      const dbName = `triage_${Date.now()}_${idx}`
      const setupCreate = await tryExecute(conn, `CREATE DATABASE IF NOT EXISTS \`${dbName}\``)
      if (!setupCreate.ok) {
        verdict = 'setup-error'
        notes.push(`setup failed (create): ${setupCreate.message}`)
        if (setupCreate.code === 'TIMEOUT') await recycleConn()
      } else {
        const setupUse = await tryExecute(conn, `USE \`${dbName}\``)
        if (!setupUse.ok) {
          verdict = 'setup-error'
          notes.push(`setup failed (use): ${setupUse.message}`)
          if (setupUse.code === 'TIMEOUT') await recycleConn()
        }
      }
      if (!verdict) {
        // Run statement-by-statement using the transcript-cleaned SQL so the
        // executor doesn't choke on `mysql>` prompts or multi-statement soup.
        let firstErr = null
        for (const stmt of p.statements || []) {
          const res = await tryExecute(conn, stmt)
          if (!res.ok) {
            firstErr = res
            if (res.code === 'TIMEOUT') {
              // The TCP connection is still holding the runaway query — drop it.
              await recycleConn()
            }
            break
          }
        }
        if (!firstErr) {
          verdict = 'safe-to-run'
        } else {
          const msg = (firstErr.message || '').toLowerCase()
          if (firstErr.code === 'TIMEOUT') {
            verdict = 'exec-timeout'
            notes.push(`triage timeout after ${EXEC_TIMEOUT_MS}ms`)
          } else if (/not support|not yet support|not implemented|unsupported/.test(msg)) {
            verdict = 'feature-gap'
            notes.push(firstErr.message)
          } else if (/access denied|permission|privilege|admin|only the/.test(msg)) {
            verdict = 'privileged'
            notes.push(firstErr.message)
          } else if (/no such|unknown|does not exist|not exist|unknown table|unknown column/.test(msg)) {
            verdict = 'runtime-error-missing-state'
            notes.push(firstErr.message)
          } else if (/syntax error|sql syntax|near\s+/.test(msg)) {
            verdict = 'syntax-error-exec'
            notes.push(firstErr.message)
          } else {
            verdict = 'runtime-error'
            notes.push(firstErr.message)
          }
        }
      }
      const cleanup = await tryExecute(conn, `DROP DATABASE IF EXISTS \`${dbName}\``)
      if (!cleanup.ok && cleanup.code === 'TIMEOUT') await recycleConn()
      // Also clean up any global objects the block may have created. We
      // conservatively grep the SQL for known `CREATE X name` patterns and
      // issue matching DROPs — errors ignored.
      for (const stmt of p.statements || []) {
        const drops = []
        const m1 = stmt.match(/CREATE\s+ACCOUNT\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?/i)
        if (m1 && m1[1].toLowerCase() !== 'sys') drops.push(`DROP ACCOUNT IF EXISTS \`${m1[1]}\``)
        const m2 = stmt.match(/CREATE\s+PITR\s+[`"]?(\w+)[`"]?/i)
        if (m2) drops.push(`DROP PITR IF EXISTS \`${m2[1]}\``)
        const m3 = stmt.match(/CREATE\s+SNAPSHOT\s+[`"]?(\w+)[`"]?/i)
        if (m3) drops.push(`DROP SNAPSHOT IF EXISTS \`${m3[1]}\``)
        const m4 = stmt.match(/CREATE\s+PUBLICATION\s+[`"]?(\w+)[`"]?/i)
        if (m4) drops.push(`DROP PUBLICATION IF EXISTS \`${m4[1]}\``)
        const m5 = stmt.match(/CREATE\s+STAGE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?/i)
        if (m5) drops.push(`DROP STAGE IF EXISTS \`${m5[1]}\``)
        for (const d of drops) {
          const res = await tryExecute(conn, d)
          if (!res.ok && res.code === 'TIMEOUT') { await recycleConn(); break }
        }
      }
    }

    if (!verdict) verdict = 'parsed-only'

    results.push({
      file: b.filePath,
      startLine: b.startLine,
      endLine: b.endLine,
      verdict,
      first: p.first,
      notes,
    })

    if (idx % 50 === 0) console.log(`  [${idx}/${perBlock.length}] processed`)
  }

  if (conn) await conn.end()

  mkdirSync(dirname(OUTPUT_JSON), { recursive: true })
  const byVerdict = {}
  for (const r of results) byVerdict[r.verdict] = (byVerdict[r.verdict] || 0) + 1

  writeFileSync(OUTPUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(),
    total: results.length,
    byVerdict,
    results,
  }, null, 2))

  const lines = []
  lines.push('# `<!-- validator-ignore -->` triage report')
  lines.push('')
  lines.push(`- Generated: ${new Date().toISOString()}`)
  lines.push(`- Blocks triaged: ${results.length}`)
  lines.push('')
  lines.push('## Verdict distribution')
  lines.push('')
  lines.push('| Verdict | Count | Meaning |')
  lines.push('|---|---:|---|')
  const legend = {
    'safe-to-run':                'Parses and executes cleanly — strip the `ignore` marker',
    'external-needed':            'Needs S3/STAGE/INFILE/Kafka/etc. — candidate for a fixture',
    'feature-gap':                'MatrixOne explicitly says "not supported" — doc is ahead of product; fine as ignore',
    'privileged':                 'Requires sysadmin/mo_ctl-style privilege — fine as ignore',
    'runtime-error-missing-state':'Depends on prior-setup state missing in triage env — fixable with fixture or ignore-exec',
    'runtime-error':              'Failed at runtime for reasons other than above — likely stale',
    'syntax-error':               'Native parser rejected — likely stale SQL',
    'syntax-error-exec':          'Parser ok but MO executor rejects syntax — stale or version drift',
    'syntax-template':            'Bare syntax template (placeholders); keep as `ignore-all`',
    'non-sql-shell':              'Block is a shell transcript inside a `sql` fence — should be retagged or deleted',
    'parsed-only':                'Parsed but execution skipped (`--skip-exec`)',
    'empty':                      'Block has no SQL',
    'setup-error':                'Could not create the isolated DB for this block',
    'exec-timeout':               'Statement exceeded the triage timeout — likely needs state/fixtures',
  }
  const order = ['safe-to-run','external-needed','feature-gap','privileged','runtime-error-missing-state','runtime-error','syntax-error','syntax-error-exec','syntax-template','non-sql-shell','exec-timeout','parsed-only','empty','setup-error']
  for (const k of order) {
    if (!byVerdict[k]) continue
    lines.push(`| ${k} | ${byVerdict[k]} | ${legend[k] || ''} |`)
  }
  lines.push('')

  for (const verdict of order) {
    const subset = results.filter(r => r.verdict === verdict)
    if (!subset.length) continue
    lines.push(`### ${verdict} (${subset.length})`)
    lines.push('')
    for (const r of subset.slice(0, 60)) {
      const note = r.notes.length ? ` — ${r.notes[0].toString().replace(/\n/g, ' ').slice(0, 120)}` : ''
      lines.push(`- \`${r.file}:${r.startLine}\` — \`${r.first.replace(/`/g, "'")}\`${note}`)
    }
    if (subset.length > 60) lines.push(`  …and ${subset.length - 60} more (see JSON)`)
    lines.push('')
  }

  writeFileSync(OUTPUT_MD, lines.join('\n'))
  console.log('')
  console.log(`✓ ${OUTPUT_JSON}`)
  console.log(`✓ ${OUTPUT_MD}`)
  for (const k of order) {
    if (!byVerdict[k]) continue
    console.log(`${k.padEnd(30)} ${byVerdict[k]}`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
