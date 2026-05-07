#!/usr/bin/env node
/**
 * Strip `<!-- validator-ignore -->` from every SQL block that the
 * `triage-ignore-all` report classified as `safe-to-run`. Two forms are
 * recognised:
 *
 *   Form A (inline on the fence):
 *     ```sql <!-- validator-ignore -->
 *     SELECT 1;
 *     ```
 *
 *   Form B (preceding line):
 *     <!-- validator-ignore -->
 *     ```sql
 *     SELECT 1;
 *     ```
 *
 * For each block we use the `startLine` recorded in the triage report
 * (the first line of SQL content, i.e. the line immediately AFTER the
 * opening fence). We walk back one line to find the fence, strip the
 * inline marker, and if there's a bare `<!-- validator-ignore -->` on
 * the preceding line, remove that too.
 *
 * Conservative by design: only touches the exact fences listed in the
 * triage report. Does not guess.
 *
 * Usage:
 *   node scripts/unmark-safe-ignore.js [--dry-run] [--file <path>]
 */

import { readFileSync, writeFileSync } from 'node:fs'

const TRIAGE = 'tmp/ignore-all-triage.json'

// Blocks the triage classifier would call "safe", but whose SQL is actually
// a syntax-example (block is part of the language tutorial) and must stay
// ignore-all. Keyed by "<file>:<startLine>" from the triage JSON.
const HOLD_IGNORE = new Set([
  'docs/MatrixOne/Reference/Language-Structure/comment.md:77',  // `//` comment syntax example, not a runnable query
])

function stripInlineIgnore(line) {
  // Remove `<!-- validator-ignore -->` and/or `<!-- validator-ignore-exec -->`
  // markers from a fence line, trimming trailing whitespace. Preserves
  // everything else on the line.
  const out = line
    .replace(/\s*<!--\s*validator-ignore-exec\s*-->/, '')
    .replace(/\s*<!--\s*validator-ignore\s*-->/, '')
  return out.replace(/\s+$/, '')
}

function isBarePrecedingIgnore(line) {
  return /^\s*<!--\s*validator-ignore\s*-->\s*$/.test(line)
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const onlyFile = process.argv.includes('--file')
    ? process.argv[process.argv.indexOf('--file') + 1]
    : null

  const triage = JSON.parse(readFileSync(TRIAGE, 'utf-8'))
  const safeBlocks = triage.results.filter(r =>
    r.verdict === 'safe-to-run' && (!onlyFile || r.file === onlyFile) &&
    !HOLD_IGNORE.has(`${r.file}:${r.startLine}`)
  )
  console.log(`Targeting ${safeBlocks.length} safe-to-run blocks (dryRun=${dryRun}, onlyFile=${onlyFile || 'all'})`)

  // Group by file to edit each once.
  const byFile = new Map()
  for (const b of safeBlocks) {
    if (!byFile.has(b.file)) byFile.set(b.file, [])
    byFile.get(b.file).push(b)
  }

  let touched = 0
  let deletedBareLines = 0
  for (const [file, blocks] of byFile) {
    const raw = readFileSync(file, 'utf-8')
    const lines = raw.split('\n')

    // Build a set of line indices to skip (bare comment lines we remove).
    const toRemove = new Set()
    // Map fence-line index -> new line content.
    const rewrite = new Map()

    // Process blocks in descending order so indices stay valid as we
    // collect edits (we apply them in one pass at the end).
    blocks.sort((a, b) => b.startLine - a.startLine)

    for (const b of blocks) {
      // `startLine` in triage is the line of first SQL content (1-indexed).
      // Fence line = startLine - 1 (1-indexed). Array index = fenceLine - 1.
      const fenceIdx = (b.startLine - 1) - 1
      if (fenceIdx < 0 || fenceIdx >= lines.length) {
        console.warn(`  ! ${file}:${b.startLine} fence out of range`)
        continue
      }
      const fenceLine = lines[fenceIdx]
      if (!/^\s*```/.test(fenceLine)) {
        console.warn(`  ! ${file}:${b.startLine} expected fence at line ${fenceIdx + 1}, got: ${fenceLine.slice(0, 80)}`)
        continue
      }
      const inlineMatches = /<!--\s*validator-ignore(?:-exec)?\s*-->/.test(fenceLine)
      const prevIdx = fenceIdx - 1
      const prevIsBare = prevIdx >= 0 && isBarePrecedingIgnore(lines[prevIdx])

      if (!inlineMatches && !prevIsBare) {
        // Block already carries no ignore marker (maybe cleaned by a previous
        // run). Still worth counting so we know the file is consistent.
        continue
      }

      if (inlineMatches) {
        const cleaned = stripInlineIgnore(fenceLine)
        rewrite.set(fenceIdx, cleaned)
      }
      if (prevIsBare) {
        toRemove.add(prevIdx)
        deletedBareLines++
      }
      touched++
    }

    if (!rewrite.size && !toRemove.size) continue

    const next = []
    for (let i = 0; i < lines.length; i++) {
      if (toRemove.has(i)) continue
      next.push(rewrite.has(i) ? rewrite.get(i) : lines[i])
    }
    const out = next.join('\n')
    if (!dryRun && out !== raw) writeFileSync(file, out, 'utf-8')
    console.log(`  ${dryRun ? '[dry]' : '✓'} ${file} — cleaned ${rewrite.size} inline, ${[...toRemove].length} bare`)
  }

  console.log('')
  console.log(`Touched blocks: ${touched}`)
  console.log(`Bare comment lines removed: ${deletedBareLines}`)
  if (dryRun) console.log('(--dry-run: no files written)')
}

main().catch(err => { console.error(err); process.exit(1) })
