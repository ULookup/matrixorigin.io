#!/usr/bin/env node
/**
 * SQL coverage diagnostic.
 *
 * For every markdown file under `docs/MatrixOne/**`, enumerate every
 * ```{lang}``` fence and classify how the doc-validator pipeline would
 * treat it. Produces a flat JSON + a human summary so we can see which
 * blocks are actually executed vs. only syntax-checked vs. silently
 * skipped — and why.
 *
 * Buckets (in decision order, most specific first):
 *   non-sql-language          fence is not in sqlCodeBlockLanguages
 *   ignore-all                `<!-- validator-ignore -->`
 *   ignore-exec               `<!-- validator-ignore-exec -->`
 *   impure-block              `isPureSqlBlock()` rejects (shell prompt, table,
 *                             connection banner, etc.)
 *   external-dependency       SQL references S3/URL/STAGE/external files or
 *                             similar runtime-only resources — would run
 *                             under the current harness but almost certainly
 *                             fail; flagged so we can design fixtures for it
 *   admin                     Top-level ADMIN command (SET GLOBAL VARIABLES
 *                             etc.) — runner marks SKIP today
 *   executed                  Will reach sql-runner and actually execute
 *
 * The classification is intentionally conservative — every block counted as
 * `executed` is one that `sql-runner.js` would hand to `mysql2.query()`.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import glob from 'fast-glob'
import { extractSqlFromContent } from './doc-validator/utils/sql-extractor.js'

const DOC_PATTERN = 'docs/MatrixOne/**/*.md'
const OUTPUT_JSON = 'tmp/sql-coverage.json'
const OUTPUT_MD = 'tmp/sql-coverage.md'

const FENCE_RE = /^(\s*)```(\w+)?(?::(\w+(?:-\w+)*))?\s*(<!--[^>]*-->)?/

const SQL_LANGS = new Set(['sql', 'SQL'])

// Heuristics for "external dependency" — matches the substance of the SQL,
// not the fence. If any of these patterns appear in a block that would
// otherwise execute, we mark it `external-dependency` so the report surfaces
// it separately. These are real patterns pulled from the MatrixOne docs.
const EXTERNAL_PATTERNS = [
  { name: 's3-url',         re: /['"]\s*s3:\/\//i },
  { name: 'minio-url',      re: /['"]\s*minio:\/\//i },
  { name: 'stage-url',      re: /\bURL\s*=\s*['"](?!file|memory)/i },
  { name: 'load-data-infile-external', re: /LOAD\s+DATA\s+INFILE\s+['"](s3:|https?:|minio:|oss:)/i },
  { name: 'create-stage',   re: /\bCREATE\s+STAGE\b/i },
  { name: 'create-source',  re: /\bCREATE\s+SOURCE\b.*KAFKA/is },
  { name: 'external-table', re: /\bCREATE\s+EXTERNAL\s+TABLE\b/i },
  { name: 'credentials',    re: /\bCREDENTIALS\s*\{/i },
  { name: 'datalink',       re: /\bDATALINK\b/i },
]

// Admin-ish statements the runner currently marks SKIP. Keep this list in
// lockstep with sql-runner's detectSqlType() so the report reflects reality.
// See `detectSqlType` in checkers/sql-runner.js — reproduced conservatively.
const ADMIN_PATTERNS = [
  /^\s*SHOW\s+(STATUS|PRIVILEGES|PROCESSLIST|ERRORS|WARNINGS)\b/i,
  /^\s*KILL\b/i,
  /^\s*USE\s+\w+\s*;?\s*$/i,
  /^\s*FLUSH\b/i,
  /^\s*RESET\b/i,
]

const SESSION_PATTERNS = [
  /^\s*SET\b/i,
]

function classifyExternal(sql) {
  for (const { name, re } of EXTERNAL_PATTERNS) {
    if (re.test(sql)) return name
  }
  return null
}

function firstNonCommentLine(sql) {
  for (const raw of sql.split('\n')) {
    const s = raw.trim()
    if (!s || s.startsWith('--') || s.startsWith('/*') || s.startsWith('#')) continue
    return s
  }
  return ''
}

function classifyAdmin(sql) {
  const head = firstNonCommentLine(sql)
  for (const re of ADMIN_PATTERNS) if (re.test(head)) return 'admin'
  for (const re of SESSION_PATTERNS) if (re.test(head)) return 'session'
  return null
}

/**
 * Re-parse the raw code fences (we can't just consume extractSqlFromContent
 * because it already filters non-SQL and impure blocks). We mirror the
 * minimum state machine used by `collectAllCodeBlocks()`.
 */
function enumerateFences(content, filePath) {
  const lines = content.split('\n')
  const fences = []
  let inBlock = false
  let current = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(FENCE_RE)
    if (!inBlock && m) {
      const language = (m[2] || '').toLowerCase()
      const prev = i > 0 ? lines[i - 1].trim() : ''
      const ignoreAll = /<!--\s*validator-ignore\s*-->/.test(line) ||
                       /^<!--\s*validator-ignore\s*-->$/.test(prev)
      const ignoreExec = /<!--\s*validator-ignore-exec\s*-->/.test(line) ||
                         /^<!--\s*validator-ignore-exec\s*-->$/.test(prev)
      current = {
        filePath,
        startLine: i + 2,
        language,
        content: '',
        ignoreAll,
        ignoreExec,
      }
      inBlock = true
      continue
    }
    if (inBlock && /^\s*```/.test(line)) {
      current.endLine = i
      fences.push(current)
      current = null
      inBlock = false
      continue
    }
    if (inBlock) current.content += line + '\n'
  }
  return fences
}

function classifyFence(fence, purifiedBlocksByStartLine) {
  if (!SQL_LANGS.has(fence.language) && fence.language !== 'sql') {
    return { bucket: 'non-sql-language', reason: `language="${fence.language || '(none)'}"` }
  }
  if (fence.ignoreAll) return { bucket: 'ignore-all', reason: '<!-- validator-ignore -->' }

  // Cross-check with extractSqlFromContent's view — if the extractor dropped
  // the block as impure, flag that here.
  const purified = purifiedBlocksByStartLine.get(fence.startLine)
  if (!purified) return { bucket: 'impure-block', reason: 'isPureSqlBlock() rejected' }

  if (fence.ignoreExec) return { bucket: 'ignore-exec', reason: '<!-- validator-ignore-exec -->' }

  const external = classifyExternal(fence.content)
  if (external) return { bucket: 'external-dependency', reason: external }

  const admin = classifyAdmin(fence.content)
  if (admin === 'admin') return { bucket: 'admin', reason: 'admin command — SKIP in runner' }
  if (admin === 'session') return { bucket: 'executed', reason: 'SESSION (SET) — executed directly' }

  return { bucket: 'executed', reason: 'goes to mysql2.query()' }
}

async function main() {
  const files = await glob(DOC_PATTERN)
  const rows = []
  const byBucket = {}
  const byFile = new Map()

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8')
    const fences = enumerateFences(content, filePath)
    const purified = extractSqlFromContent(content, filePath)
    const purifiedByStart = new Map()
    for (const p of purified) purifiedByStart.set(p.startLine, p)

    let fileExecuted = 0
    let fileOther = 0
    for (const fence of fences) {
      const verdict = classifyFence(fence, purifiedByStart)
      const row = {
        file: filePath,
        startLine: fence.startLine,
        language: fence.language || '(none)',
        bucket: verdict.bucket,
        reason: verdict.reason,
      }
      rows.push(row)
      byBucket[verdict.bucket] = (byBucket[verdict.bucket] || 0) + 1
      if (verdict.bucket === 'executed') fileExecuted++
      else fileOther++
    }
    if (fences.length) byFile.set(filePath, { executed: fileExecuted, other: fileOther, total: fences.length })
  }

  mkdirSync(dirname(OUTPUT_JSON), { recursive: true })
  writeFileSync(OUTPUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalFencesScanned: rows.length,
    byBucket,
    rows,
  }, null, 2))

  // Human summary.
  const lines = []
  lines.push('# SQL coverage report')
  lines.push('')
  lines.push(`- Generated: ${new Date().toISOString()}`)
  lines.push(`- Files scanned: ${files.length}`)
  lines.push(`- Files with any fence: ${byFile.size}`)
  lines.push(`- Total fences scanned: ${rows.length}`)
  lines.push('')
  lines.push('## Bucket distribution')
  lines.push('')
  lines.push('| Bucket | Count | Share | Meaning |')
  lines.push('|---|---:|---:|---|')
  const meaning = {
    'executed':             'Reaches `mysql2.query()` — real execution check',
    'ignore-exec':          'Syntax-only via `<!-- validator-ignore-exec -->`',
    'ignore-all':           'Skipped entirely via `<!-- validator-ignore -->`',
    'impure-block':         'Dropped by `isPureSqlBlock()` heuristic (shell output, banner, big table, etc.)',
    'non-sql-language':     'Fence is not `sql` — never entered the SQL pipeline',
    'admin':                'Top-level admin command — runner marks SKIP',
    'external-dependency':  'SQL references S3/STAGE/EXTERNAL TABLE/Kafka — needs a fixture to actually run',
  }
  const order = ['executed', 'ignore-exec', 'ignore-all', 'impure-block', 'non-sql-language', 'admin', 'external-dependency']
  for (const k of order) {
    const v = byBucket[k] || 0
    const pct = rows.length ? ((v / rows.length) * 100).toFixed(1) : '0.0'
    lines.push(`| ${k} | ${v} | ${pct}% | ${meaning[k] || ''} |`)
  }
  lines.push('')

  // Top reasons inside each non-executed bucket.
  lines.push('## Top reasons, per non-executed bucket')
  lines.push('')
  for (const bucket of ['impure-block', 'non-sql-language', 'ignore-exec', 'ignore-all', 'external-dependency', 'admin']) {
    const items = rows.filter(r => r.bucket === bucket)
    if (!items.length) continue
    const counts = new Map()
    for (const r of items) counts.set(r.reason, (counts.get(r.reason) || 0) + 1)
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    lines.push(`### ${bucket} (${items.length})`)
    lines.push('')
    for (const [reason, c] of top) {
      lines.push(`- ${c} × \`${reason}\``)
    }
    lines.push('')
  }

  // Files where nothing is executed but fences exist.
  lines.push('## Files with SQL fences but zero executed blocks')
  lines.push('')
  const silentFiles = [...byFile.entries()].filter(([, s]) => s.total > 0 && s.executed === 0)
  lines.push(`Count: ${silentFiles.length}`)
  lines.push('')
  for (const [f, s] of silentFiles.slice(0, 40)) {
    lines.push(`- \`${f}\` — ${s.total} fences, 0 executed`)
  }
  if (silentFiles.length > 40) lines.push(`- … and ${silentFiles.length - 40} more (see JSON)`)
  lines.push('')

  // Top external-dependency hits.
  const extByPattern = new Map()
  for (const r of rows) if (r.bucket === 'external-dependency') {
    extByPattern.set(r.reason, (extByPattern.get(r.reason) || 0) + 1)
  }
  if (extByPattern.size) {
    lines.push('## External-dependency fingerprints (fixture candidates)')
    lines.push('')
    lines.push('| Pattern | Blocks |')
    lines.push('|---|---:|')
    for (const [k, v] of [...extByPattern.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${k} | ${v} |`)
    }
    lines.push('')
  }

  writeFileSync(OUTPUT_MD, lines.join('\n'))
  console.log(`✓ ${OUTPUT_JSON}`)
  console.log(`✓ ${OUTPUT_MD}`)
  console.log('')
  for (const k of order) {
    console.log(`${k.padEnd(22)} ${(byBucket[k] || 0).toString().padStart(6)}`)
  }
  console.log(`${'TOTAL'.padEnd(22)} ${rows.length.toString().padStart(6)}`)
}

main().catch(err => { console.error(err); process.exit(1) })
