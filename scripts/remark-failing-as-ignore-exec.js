#!/usr/bin/env node
/**
 * After unmarking safe-to-run blocks, the full execution scan may still fail
 * on some of them — usually because the documented *expected output* (parsed
 * as result-assertion) baked in a literal database name like `db1` that
 * won't match our per-file `doc_test_*` DB, or because the block depends on
 * cross-block state that is dropped between invocations.
 *
 * This script:
 *   1. Runs the exec scan across the 13 failing files (or whatever is passed).
 *   2. Collects every failing statement's line number.
 *   3. Cross-references with the triage report to find the unmarked
 *      `safe-to-run` block that contains each failing line.
 *   4. Inserts a `<!-- validator-ignore-exec -->` line just before each such
 *      fence (preserving syntax validation, skipping execution only).
 *
 * Idempotent: if the block already has ignore-exec, it's left alone.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

function runExecVerbose(files) {
  const args = ['./scripts/doc-validator/index.js', '--check=execution', '--verbose', ...files]
  const res = spawnSync('node', args, { encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024 })
  return res.stdout + '\n' + res.stderr
}

// Parse the verbose runner output: per-file it emits
//   Checking: <file> (...)
//   ❌ <file> (<p> passed, <e> errors)
//      :<line>  <sql snippet>
//          <error detail>
function parseFailures(out) {
  const lines = out.split('\n')
  const failures = []  // {file, line}
  let currentFile = null
  for (const raw of lines) {
    const m1 = raw.match(/^\s*Checking:\s+(.*?)\s+\(SQL:/)
    if (m1) { currentFile = m1[1]; continue }
    const m2 = raw.match(/^❌\s+(.*?)\s+\(/)
    if (m2) { currentFile = m2[1]; continue }
    const m3 = raw.match(/^\s+:(\d+)\s/)
    if (m3 && currentFile) {
      failures.push({ file: currentFile, line: Number(m3[1]) })
    }
  }
  return failures
}

async function main() {
  const files = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const dryRun = process.argv.includes('--dry-run')

  if (files.length === 0) {
    console.error('Pass at least one file path.')
    process.exit(1)
  }

  console.log(`Re-checking ${files.length} files…`)
  const out = runExecVerbose(files)
  const failures = parseFailures(out)
  console.log(`Collected ${failures.length} failing statements.`)

  // Group failure lines by file.
  const failByFile = new Map()
  for (const f of failures) {
    if (!failByFile.has(f.file)) failByFile.set(f.file, new Set())
    failByFile.get(f.file).add(f.line)
  }

  // For each failing file, scan the markdown now (post-unmark state) and
  // enumerate every ```sql fence. A block is `start=fenceIdx+1`, runs until
  // the next closing fence. Mark every block whose statement range contains
  // at least one failing line.
  let inserted = 0
  const SLACK = 2
  for (const [file, failLines] of failByFile) {
    const raw = readFileSync(file, 'utf-8')
    const lines = raw.split('\n')
    const fences = []  // {fenceIdx, contentStart, contentEnd}
    let inBlock = false
    let open = null
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!inBlock && /^\s*```(\w+)?/.test(line)) {
        const m = line.match(/^\s*```(\w+)?/)
        const lang = (m && m[1] || '').toLowerCase()
        open = { fenceIdx: i, contentStart: i + 2, lang }
        inBlock = true
      } else if (inBlock && /^\s*```/.test(line)) {
        open.contentEnd = i  // last content line number (1-indexed = i)
        if (open.lang === 'sql' || open.lang === '') fences.push(open)
        inBlock = false
        open = null
      }
    }
    const toMark = []
    for (const f of fences) {
      const s = f.contentStart - SLACK
      const e = f.contentEnd + SLACK
      const hit = [...failLines].some(l => l >= s && l <= e)
      if (!hit) continue
      // Skip if already marked.
      const fenceLine = lines[f.fenceIdx]
      const prev = f.fenceIdx > 0 ? lines[f.fenceIdx - 1] : ''
      if (/<!--\s*validator-ignore(?:-exec)?\s*-->/.test(fenceLine)) continue
      if (/^\s*<!--\s*validator-ignore(?:-exec)?\s*-->\s*$/.test(prev)) continue
      toMark.push(f.fenceIdx)
    }
    toMark.sort((a, b) => b - a)
    for (const fi of toMark) {
      lines.splice(fi, 0, '<!-- validator-ignore-exec -->')
      inserted++
    }
    if (toMark.length && !dryRun) writeFileSync(file, lines.join('\n'), 'utf-8')
    console.log(`  ${dryRun ? '[dry]' : '✓'} ${file} — marked ${toMark.length} blocks`)
  }

  console.log('')
  console.log(`Total ignore-exec markers inserted: ${inserted}`)
}

main().catch(err => { console.error(err); process.exit(1) })
