#!/usr/bin/env node
/**
 * Downgrade `<!-- validator-ignore -->` to `<!-- validator-ignore-exec -->`
 * for every block that the triage report (tmp/ignore-all-triage.json)
 * classified as safe-to-parse (verdicts: `parsed-only` or `external-needed`).
 *
 * Blocks in those buckets parse cleanly against the MatrixOne native parser
 * but can't run in the generic execution sandbox (missing state, external
 * files, etc.). Keeping them under `validator-ignore` silently skips the
 * syntax checker too; downgrading to `validator-ignore-exec` keeps syntax
 * coverage while still skipping execution.
 *
 * Untouched:
 *   syntax-error / syntax-template / non-sql-shell  — still require ignore-all
 *
 * Two forms handled, mirroring unmark-safe-ignore.js:
 *   Form A (inline on fence):  ```sql <!-- validator-ignore -->
 *   Form B (bare preceding):   <!-- validator-ignore -->
 *                              ```sql
 *
 * Usage:
 *   node scripts/downgrade-ignore-to-exec.js [--dry-run] [--file <path>]
 */

import { readFileSync, writeFileSync } from 'node:fs'

const TRIAGE = 'tmp/ignore-all-triage.json'
const DOWNGRADE_VERDICTS = new Set(['parsed-only', 'external-needed'])

function isBarePrecedingIgnore(line) {
  return /^\s*<!--\s*validator-ignore\s*-->\s*$/.test(line)
}

function rewriteInlineIgnore(line) {
  return line.replace(/<!--\s*validator-ignore\s*-->/, '<!-- validator-ignore-exec -->')
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const onlyFile = process.argv.includes('--file')
    ? process.argv[process.argv.indexOf('--file') + 1]
    : null

  const triage = JSON.parse(readFileSync(TRIAGE, 'utf-8'))
  const blocks = triage.results.filter(r =>
    DOWNGRADE_VERDICTS.has(r.verdict) && (!onlyFile || r.file === onlyFile)
  )
  console.log(`Targeting ${blocks.length} blocks (dryRun=${dryRun}, onlyFile=${onlyFile || 'all'})`)

  const byFile = new Map()
  for (const b of blocks) {
    if (!byFile.has(b.file)) byFile.set(b.file, [])
    byFile.get(b.file).push(b)
  }

  let touched = 0, skipped = 0, warned = 0
  for (const [file, list] of byFile) {
    const raw = readFileSync(file, 'utf-8')
    const lines = raw.split('\n')
    const rewrite = new Map()
    const replaceBare = new Map()  // idx -> new text

    list.sort((a, b) => b.startLine - a.startLine)

    for (const b of list) {
      // fence line = startLine - 1 (1-indexed) -> array idx startLine - 2
      const fenceIdx = b.startLine - 2
      if (fenceIdx < 0 || fenceIdx >= lines.length) {
        console.warn(`  ! ${file}:${b.startLine} fence out of range`)
        warned++; continue
      }
      const fenceLine = lines[fenceIdx]
      if (!/^\s*```/.test(fenceLine)) {
        console.warn(`  ! ${file}:${b.startLine} expected fence, got: ${fenceLine.slice(0, 80)}`)
        warned++; continue
      }
      const hasInline = /<!--\s*validator-ignore(?:-exec)?\s*-->/.test(fenceLine)
      const prevIdx = fenceIdx - 1
      const prevIsBare = prevIdx >= 0 && isBarePrecedingIgnore(lines[prevIdx])

      // If already downgraded, skip.
      const hasInlineExec = /<!--\s*validator-ignore-exec\s*-->/.test(fenceLine)
      const prevIsBareExec = prevIdx >= 0 && /^\s*<!--\s*validator-ignore-exec\s*-->\s*$/.test(lines[prevIdx])
      if (!hasInline && !prevIsBare) {
        if (hasInlineExec || prevIsBareExec) { skipped++; continue }
        console.warn(`  ! ${file}:${b.startLine} no validator-ignore marker found`)
        warned++; continue
      }

      if (hasInline && /<!--\s*validator-ignore\s*-->/.test(fenceLine)) {
        rewrite.set(fenceIdx, rewriteInlineIgnore(fenceLine))
      }
      if (prevIsBare) {
        // Preserve indentation, swap marker text.
        const indentMatch = lines[prevIdx].match(/^(\s*)/)
        replaceBare.set(prevIdx, `${indentMatch ? indentMatch[1] : ''}<!-- validator-ignore-exec -->`)
      }
      touched++
    }

    if (!rewrite.size && !replaceBare.size) continue

    const next = lines.slice()
    for (const [i, v] of rewrite) next[i] = v
    for (const [i, v] of replaceBare) next[i] = v
    const out = next.join('\n')
    if (!dryRun && out !== raw) writeFileSync(file, out, 'utf-8')
    console.log(`  ${dryRun ? '[dry]' : '✓'} ${file} — inline:${rewrite.size} bare:${replaceBare.size}`)
  }

  console.log('')
  console.log(`Touched blocks: ${touched}`)
  console.log(`Already downgraded: ${skipped}`)
  console.log(`Warnings: ${warned}`)
  if (dryRun) console.log('(--dry-run: no files written)')
}

main().catch(err => { console.error(err); process.exit(1) })
