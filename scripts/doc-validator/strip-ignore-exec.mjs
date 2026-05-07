#!/usr/bin/env node
// Remove `<!-- validator-ignore-exec -->` markers from fences that already pass
// execution in the dry-run harness. Only touches fences where every sub-block
// reported verdict=PASS — mixed-outcome fences stay untouched.

import { readFileSync, writeFileSync } from 'node:fs'

const REPORT = 'tmp/dry-run/report.json'
const DRY = process.argv.includes('--dry-run')

function rollup(report) {
    const fences = new Map()
    for (const row of report.results) {
        if (!row.verdict) continue
        const key = `${row.file}::${row.startLine}-${row.endLine}`
        const f = fences.get(key) || { file: row.file, start: row.startLine, end: row.endLine, verdicts: [] }
        f.verdicts.push(row.verdict)
        fences.set(key, f)
    }
    const allPass = []
    for (const f of fences.values()) {
        const s = new Set(f.verdicts)
        if (s.size === 1 && s.has('PASS')) allPass.push(f)
    }
    return allPass
}

function stripFence(text, fenceLine) {
    // fenceLine is 1-indexed and points at the ```sql line.
    const lines = text.split('\n')
    const idx = fenceLine - 1
    if (idx < 0 || idx >= lines.length) return { text, changed: false, reason: 'oob' }
    const fence = lines[idx]
    if (!/^\s*```sql/i.test(fence)) return { text, changed: false, reason: 'not_sql_fence', got: fence }

    let changed = false
    // Case 1: marker inline on the fence line itself.
    const inlineMarker = /\s*<!--\s*validator-ignore-exec\s*-->/
    if (inlineMarker.test(fence)) {
        lines[idx] = fence.replace(inlineMarker, '')
        changed = true
    }

    // Case 2: marker on its own line immediately above. Walk upwards past
    // blank lines, since some pages leave a blank between the comment and
    // the fence.
    let up = idx - 1
    while (up >= 0 && lines[up].trim() === '') up--
    if (up >= 0 && /^\s*<!--\s*validator-ignore-exec\s*-->\s*$/.test(lines[up])) {
        lines.splice(up, 1)
        changed = true
    }

    return { text: lines.join('\n'), changed, reason: changed ? 'ok' : 'no_marker' }
}

function main() {
    const report = JSON.parse(readFileSync(REPORT, 'utf-8'))
    const fences = rollup(report)

    // Group by file, then strip highest-line first so earlier line numbers
    // are not invalidated by earlier edits.
    const byFile = new Map()
    for (const f of fences) {
        if (!byFile.has(f.file)) byFile.set(f.file, [])
        byFile.get(f.file).push(f)
    }

    let filesChanged = 0
    let fencesTouched = 0
    let fencesMissed = 0
    const missed = []

    for (const [file, list] of byFile) {
        list.sort((a, b) => b.start - a.start)
        let text = readFileSync(file, 'utf-8')
        let fileChanged = false
        for (const f of list) {
            // fence line = startLine - 1 (extractor uses lineNumber+1)
            const res = stripFence(text, f.start - 1)
            if (res.changed) {
                text = res.text
                fileChanged = true
                fencesTouched++
            } else {
                fencesMissed++
                missed.push({ file, start: f.start, reason: res.reason, got: res.got })
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
        fences_touched: fencesTouched,
        fences_missed: fencesMissed,
    }, null, 2))
    if (missed.length) {
        console.log('\nmissed fences (first 20):')
        for (const m of missed.slice(0, 20)) console.log(' ', m)
    }
}

main()
