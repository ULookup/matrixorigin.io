#!/usr/bin/env node
/**
 * Lint entry point: enforce `mysql_compat` frontmatter on every SQL-Reference page.
 * Usage:
 *   node scripts/check-compat-frontmatter.js                 # all SQL-Reference pages
 *   node scripts/check-compat-frontmatter.js path/to/file.md [...]
 */

import glob from 'fast-glob'
import { checkFile, ALLOWED_VALUES } from './doc-validator/checkers/compat-frontmatter.js'

const PATTERN = 'docs/MatrixOne/Reference/SQL-Reference/**/*.md'

async function main() {
  const argv = process.argv.slice(2)
  const files = argv.length > 0 ? argv : await glob(PATTERN)
  let failed = 0
  const counts = Object.fromEntries(ALLOWED_VALUES.map(v => [v, 0]))
  for (const file of files) {
    const res = checkFile(file)
    if (!res.passed) {
      failed++
      console.log(`❌ ${file}`)
      for (const e of res.errors) console.log(`   - ${e}`)
      continue
    }
    const val = res.data.mysql_compat
    counts[val] = (counts[val] || 0) + 1
  }
  console.log('')
  console.log('📊 mysql_compat distribution:')
  for (const v of ALLOWED_VALUES) {
    console.log(`   ${v.padEnd(8)} ${counts[v] || 0}`)
  }
  console.log(`\nTotal files:   ${files.length}`)
  console.log(`Failed:        ${failed}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => { console.error(err); process.exit(1) })
