#!/usr/bin/env node
// Dry-run harness: bypass validator-ignore-exec and actually execute every
// currently-ignored block. Produces a per-block PASS/FAIL report so we can tell
// which ignore-exec labels are now obsolete.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { extractSqlFromContent } from './utils/sql-extractor.js'
import { SqlRunner } from './checkers/sql-runner.js'
import { config } from './config.js'

const ROOT = 'docs/MatrixOne'
const OUT = 'tmp/dry-run/report.json'

function walk(dir) {
    const out = []
    for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        const s = statSync(p)
        if (s.isDirectory()) out.push(...walk(p))
        else if (name.endsWith('.md')) out.push(p)
    }
    return out
}

function blocksWithIgnore(filePath) {
    const content = readFileSync(filePath, 'utf-8')
    // Extract with original semantics first, then flip flag.
    const all = extractSqlFromContent(content, filePath)
    return all.filter(b => b.executionIgnored)
}

async function main() {
    const runner = new SqlRunner()
    runner.enable()
    const ok = await runner.connect()
    if (!ok) {
        console.error('db connect failed')
        process.exit(1)
    }

    const files = walk(ROOT)
    const report = {
        started: new Date().toISOString(),
        dbImage: process.env.MO_IMAGE || 'unknown',
        totalFiles: files.length,
        results: [],
    }

    let filesWithIgnored = 0
    let blocksTotal = 0

    for (const file of files) {
        let ignored
        try { ignored = blocksWithIgnore(file) } catch (e) {
            report.results.push({ file: relative('.', file), error: 'extract_failed', message: e.message })
            continue
        }
        if (ignored.length === 0) continue
        filesWithIgnored++
        process.stderr.write(`[${filesWithIgnored}] ${relative('.', file)} (${ignored.length} blocks)\n`)

        // Each file gets its own test database to keep state isolated.
        const baseName = file.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
        let testDb
        try {
            testDb = await runner.dbManager.createTestDatabase(baseName)
            runner.currentTestDb = testDb
            runner.userCreatedDatabases = new Set()
        } catch (e) {
            report.results.push({ file: relative('.', file), error: 'db_setup_failed', message: e.message })
            continue
        }

        for (const block of ignored) {
            blocksTotal++
            // Bypass the skip flag.
            const forced = { ...block, executionIgnored: false }
            // Pre-filter: the SLEEP() / long-running / KILL examples will wedge or kill
            // the MO connection. Skip them in dry-run harness; they need a multi-session
            // test environment we don't have here. Record as SKIP_HARNESS.
            const sqlUpper = (block.sql || '').toUpperCase()
            const hang = /\bSLEEP\s*\(|\bKILL\s+\d|\bCREATE\s+PROCEDURE|\bWAITFOR\b/.test(sqlUpper)
            if (hang) {
                report.results.push({
                    file: relative('.', file),
                    startLine: block.startLine,
                    endLine: block.endLine,
                    format: block.format,
                    sqlPreview: (block.sql || '').split('\n').slice(0, 2).join(' ⏎ ').slice(0, 160),
                    verdict: 'SKIP_HARNESS',
                    reason: 'hang-risk',
                })
                continue
            }

            let blockResults = []
            let thrown = null
            const timeoutMs = 20000
            try {
                blockResults = await Promise.race([
                    runner.checkSqlBlock(forced),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('harness-timeout')), timeoutMs)),
                ])
            } catch (e) {
                thrown = e.message || String(e)
            }
            const errors = blockResults.filter(r => r.status === 'ERROR')
            const successes = blockResults.filter(r => r.status === 'SUCCESS' || r.status === 'SKIP')
            let verdict
            if (thrown) verdict = 'THROWN'
            else if (blockResults.length === 0) verdict = 'NO_STATEMENTS'
            else if (errors.length === 0) verdict = 'PASS'
            else if (successes.length === 0) verdict = 'FAIL_ALL'
            else verdict = 'FAIL_PARTIAL'

            report.results.push({
                file: relative('.', file),
                startLine: block.startLine,
                endLine: block.endLine,
                format: block.format,
                sqlPreview: (block.sql || '').split('\n').slice(0, 2).join(' ⏎ ').slice(0, 160),
                statements: blockResults.length,
                passed: successes.length,
                failed: errors.length,
                verdict,
                firstError: errors[0]?.message || thrown || null,
            })
        }

        // Teardown
        for (const dbName of runner.userCreatedDatabases || []) {
            try { await runner.dbManager.query(`DROP DATABASE IF EXISTS \`${dbName}\``) } catch {}
        }
        if (testDb) {
            try { await runner.dbManager.dropTestDatabase(testDb) } catch {}
        }
        runner.currentTestDb = null
        runner.userCreatedDatabases = null
    }

    await runner.disconnect()

    report.finished = new Date().toISOString()
    report.filesWithIgnored = filesWithIgnored
    report.blocksTotal = blocksTotal
    const tally = {}
    for (const r of report.results) {
        if (!r.verdict) continue
        tally[r.verdict] = (tally[r.verdict] || 0) + 1
    }
    report.tally = tally

    writeFileSync(OUT, JSON.stringify(report, null, 2))
    console.log(JSON.stringify(tally, null, 2))
    console.log(`files_with_ignored=${filesWithIgnored} blocks_total=${blocksTotal}`)
    console.log(`report: ${OUT}`)
}

main().catch(e => { console.error(e); process.exit(1) })
