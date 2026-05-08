#!/usr/bin/env node
// Given the output of `node scripts/doc-validator/index.js --check=execution`,
// locate each failing fence in the (already-stripped) docs and re-add
// `<!-- validator-ignore-exec -->` above it. This recovers ignore-exec on
// fences whose dry-run PASS verdict does not hold in the accumulated
// per-file execution context.

import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2).filter(a => !a.startsWith('--'))
const INPUT = args[0] || 'tmp/dry-run/verify-stdout.log'
const DRY = process.argv.includes('--dry-run')

function parseFailures(text) {
    const out = {}
    const lines = text.split('\n')
    let cur = null
    for (const l of lines) {
        const m = l.match(/^❌\s+(\S+)/)
        if (m) { cur = m[1]; out[cur] = new Set(); continue }
        const e = l.match(/^\s+:(\d+)\s+/)
        if (e && cur) out[cur].add(+e[1])
    }
    return out
}

// For each failing line in a file, find the enclosing sql fence (```sql ... ```)
// and return its start line (the fence opener line number, 1-indexed).
function findFencesContaining(fileText, failingLines) {
    const lines = fileText.split('\n')
    const fences = [] // {fenceOpen: 1-based, fenceClose: 1-based}
    let openAt = -1
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*```sql\b/i.test(lines[i]) && openAt === -1) {
            openAt = i
        } else if (/^\s*```\s*$/.test(lines[i]) && openAt !== -1) {
            fences.push({ open: openAt + 1, close: i + 1 })
            openAt = -1
        }
    }
    const targetOpens = new Set()
    for (const ln of failingLines) {
        const f = fences.find(f => f.open <= ln && ln <= f.close)
        if (f) targetOpens.add(f.open)
    }
    return [...targetOpens].sort((a, b) => a - b)
}

function addIgnoreAbove(text, fenceOpen) {
    const lines = text.split('\n')
    const idx = fenceOpen - 1
    if (idx < 0 || idx >= lines.length) return { text, changed: false, reason: 'oob' }
    // Already inline-marked?
    if (/<!--\s*validator-ignore-exec\s*-->/.test(lines[idx])) return { text, changed: false, reason: 'already_inline' }
    // Already marked above (walk past blanks)?
    let up = idx - 1
    while (up >= 0 && lines[up].trim() === '') up--
    if (up >= 0 && /^\s*<!--\s*validator-ignore-exec\s*-->\s*$/.test(lines[up])) {
        return { text, changed: false, reason: 'already_above' }
    }
    // Preserve indentation of the fence.
    const indentMatch = lines[idx].match(/^(\s*)/)
    const indent = indentMatch ? indentMatch[1] : ''
    lines.splice(idx, 0, `${indent}<!-- validator-ignore-exec -->`)
    return { text: lines.join('\n'), changed: true }
}

function main() {
    const failures = parseFailures(readFileSync(INPUT, 'utf-8'))
    let filesChanged = 0, fencesReAdded = 0, skipped = 0
    const misses = []
    for (const [file, setLines] of Object.entries(failures)) {
        if (!setLines.size) continue
        let text = readFileSync(file, 'utf-8')
        const opens = findFencesContaining(text, setLines)
        if (!opens.length) {
            misses.push({ file, lines: [...setLines], reason: 'no_fence_found' })
            continue
        }
        // Add from largest to smallest to keep earlier line numbers stable.
        opens.sort((a, b) => b - a)
        let fileChanged = false
        for (const open of opens) {
            const res = addIgnoreAbove(text, open)
            if (res.changed) {
                text = res.text
                fileChanged = true
                fencesReAdded++
            } else {
                skipped++
            }
        }
        if (fileChanged) {
            if (!DRY) writeFileSync(file, text)
            filesChanged++
        }
    }
    console.log(JSON.stringify({
        mode: DRY ? 'dry-run' : 'apply',
        files_changed: filesChanged,
        fences_re_added: fencesReAdded,
        skipped,
        misses: misses.length,
    }, null, 2))
    if (misses.length) { console.log('misses:'); for (const m of misses) console.log(' ', m) }
}

main()
