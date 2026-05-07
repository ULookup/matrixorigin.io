#!/usr/bin/env node
/**
 * Backfill default `mysql_compat: unknown` frontmatter into every
 * SQL-Reference page that does not already declare it. The first H1 (`# **X**`
 * or `# X`) is used to seed the `title` field. Idempotent — running twice is a
 * no-op.
 */

import glob from 'fast-glob'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseFrontmatter } from './doc-validator/checkers/compat-frontmatter.js'

const PATTERN = 'docs/MatrixOne/Reference/SQL-Reference/**/*.md'

function extractTitle(body) {
  const m = body.match(/^#\s+(.+?)\s*$/m)
  if (!m) return null
  return m[1].replace(/\*\*/g, '').replace(/`/g, '').trim()
}

async function main() {
  const files = await glob(PATTERN)
  let added = 0
  let skipped = 0
  for (const file of files) {
    const raw = readFileSync(file, 'utf-8')
    const fm = parseFrontmatter(raw)
    if (fm && 'mysql_compat' in fm) {
      skipped++
      continue
    }
    const title = extractTitle(raw) || ''
    let prefix
    if (fm) {
      // File already has frontmatter but no mysql_compat; inject the field.
      prefix = raw.replace(
        /^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n)/,
        (_, open, body, close) => `${open}${body}\nmysql_compat: unknown${close}`
      )
      writeFileSync(file, prefix, 'utf-8')
      added++
      continue
    }
    const header = [
      '---',
      title ? `title: "${title.replace(/"/g, '\\"')}"` : 'title: ""',
      'mysql_compat: unknown',
      '---',
      '',
    ].join('\n')
    writeFileSync(file, header + raw, 'utf-8')
    added++
  }
  console.log(`Backfilled: ${added}`)
  console.log(`Already had: ${skipped}`)
  console.log(`Total: ${files.length}`)
}

main().catch(err => { console.error(err); process.exit(1) })
