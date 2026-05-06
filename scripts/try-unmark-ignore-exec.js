#!/usr/bin/env node
/**
 * Try to remove every `<!-- validator-ignore-exec -->` marker in the docs and
 * see whether the execution checker now passes for the block.
 *
 * Enabled by the two recent fixes in this session:
 *   - sql-runner volatile-column handling (`Db`, `created_time`, …)
 *   - test database names forced to lowercase
 *
 * Strategy per file:
 *   1. Record original content.
 *   2. Strip every ignore-exec marker (inline + bare preceding comment).
 *   3. Run the execution checker against that file.
 *   4. For every statement that still fails, locate the enclosing fence
 *      and re-apply a bare `<!-- validator-ignore-exec -->` marker above it.
 *   5. Write back.
 *
 * Net effect: every block that no longer needs ignore-exec is freed; the
 * rest keeps its marker.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import glob from 'fast-glob'

const DOC_PATTERN = 'docs/MatrixOne/**/*.md'

function allMarkedFiles() {
  const files = []
  for (const f of globSync(DOC_PATTERN)) {
    const raw = readFileSync(f, 'utf-8')
    if (/<!--\s*validator-ignore-exec\s*-->/.test(raw)) files.push(f)
  }
  return files
}

function globSync(pattern) {
  return spawnSync('node', ['-e', `
    import('fast-glob').then(m => m.default('${pattern}').then(arr => console.log(arr.join('\\n'))))
  `], { encoding: 'utf-8' }).stdout.split('\n').filter(Boolean)
}

function stripIgnoreExec(content) {
  // Remove inline `<!-- validator-ignore-exec -->` from fence lines.
  let out = content.replace(/^(\s*```\w*)\s*<!--\s*validator-ignore-exec\s*-->\s*$/gm, '$1')
  // Remove bare `<!-- validator-ignore-exec -->` lines that precede a fence.
  out = out.replace(/^\s*<!--\s*validator-ignore-exec\s*-->\s*\n(?=\s*```)/gm, '')
  return out
}

function runExecVerbose(files) {
  const args = ['./scripts/doc-validator/index.js', '--check=execution', '--verbose', ...files]
  const res = spawnSync('node', args, { encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 })
  return res.stdout + '\n' + res.stderr
}

function parseFailureLines(out) {
  const failures = []
  let currentFile = null
  for (const raw of out.split('\n')) {
    const m1 = raw.match(/^\s*Checking:\s+(.*?)\s+\(SQL:/)
    if (m1) { currentFile = m1[1]; continue }
    const m2 = raw.match(/^❌\s+(.*?)\s+\(/)
    if (m2) { currentFile = m2[1]; continue }
    const m3 = raw.match(/^\s+:(\d+)\s/)
    if (m3 && currentFile) failures.push({ file: currentFile, line: Number(m3[1]) })
  }
  return failures
}

function remarkFailures(file, failLines) {
  const lines = readFileSync(file, 'utf-8').split('\n')
  const fences = []
  let inBlock = false
  let open = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!inBlock && /^\s*```\w*/.test(line)) {
      const m = line.match(/^(\s*)```(\w+)?/)
      const lang = (m && m[2] || '').toLowerCase()
      open = { fenceIdx: i, contentStart: i + 2, lang }
      inBlock = true
    } else if (inBlock && /^\s*```/.test(line)) {
      open.contentEnd = i
      if (open.lang === 'sql' || open.lang === '') fences.push(open)
      inBlock = false
      open = null
    }
  }
  const SLACK = 2
  const toMark = []
  for (const f of fences) {
    const s = f.contentStart - SLACK
    const e = f.contentEnd + SLACK
    const hit = failLines.some(l => l >= s && l <= e)
    if (!hit) continue
    const prev = f.fenceIdx > 0 ? lines[f.fenceIdx - 1] : ''
    if (/^\s*<!--\s*validator-ignore(?:-exec)?\s*-->\s*$/.test(prev)) continue
    if (/<!--\s*validator-ignore(?:-exec)?\s*-->/.test(lines[f.fenceIdx])) continue
    toMark.push(f.fenceIdx)
  }
  toMark.sort((a, b) => b - a)
  for (const i of toMark) lines.splice(i, 0, '<!-- validator-ignore-exec -->')
  return lines.join('\n')
}

async function main() {
  const files = allMarkedFiles()
  console.log(`Scanning ${files.length} files with ignore-exec markers…`)

  const originals = new Map()
  for (const f of files) originals.set(f, readFileSync(f, 'utf-8'))

  let stripped = 0
  for (const f of files) {
    const next = stripIgnoreExec(originals.get(f))
    writeFileSync(f, next, 'utf-8')
    stripped++
  }
  console.log(`Stripped markers in ${stripped} files; running exec checker…`)

  const out = runExecVerbose(files)
  const failures = parseFailureLines(out)
  console.log(`Exec scan produced ${failures.length} failing statements.`)

  const failByFile = new Map()
  for (const { file, line } of failures) {
    const key = file.startsWith('./') ? file.slice(2) : file
    if (!failByFile.has(key)) failByFile.set(key, [])
    failByFile.get(key).push(line)
  }

  let remarked = 0
  let freed = 0
  for (const f of files) {
    const failLines = failByFile.get(f) || []
    if (failLines.length === 0) {
      // File is fully clean; strip already applied stays.
      const before = (originals.get(f).match(/<!--\s*validator-ignore-exec\s*-->/g) || []).length
      freed += before
      continue
    }
    const next = remarkFailures(f, failLines)
    writeFileSync(f, next, 'utf-8')
    const afterCount = (next.match(/<!--\s*validator-ignore-exec\s*-->/g) || []).length
    const beforeCount = (originals.get(f).match(/<!--\s*validator-ignore-exec\s*-->/g) || []).length
    remarked += afterCount
    if (beforeCount > afterCount) freed += (beforeCount - afterCount)
  }

  console.log('')
  console.log(`ignore-exec markers removed net: ${freed}`)
  console.log(`ignore-exec markers re-applied: ${remarked}`)
}

main().catch(err => { console.error(err); process.exit(1) })
