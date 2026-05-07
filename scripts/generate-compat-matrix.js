#!/usr/bin/env node
/**
 * Build `docs/MatrixOne/Reference/mysql-compatibility-matrix.md` from the
 * `mysql_compat` frontmatter across every SQL-Reference page.
 *
 * The output page groups SQL-Reference pages by their top-level category
 * (DDL/DML/DCL/DQL/Other) and shows their compatibility status plus any
 * declared differences. Regenerated deterministically from source — do not
 * edit the output file by hand.
 */

import glob from 'fast-glob'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseFrontmatter } from './doc-validator/checkers/compat-frontmatter.js'

const ROOT = 'docs/MatrixOne/Reference/SQL-Reference'
const OUTPUT = 'docs/MatrixOne/Reference/mysql-compatibility-matrix.md'

const CATEGORY_ORDER = [
  ['Data-Definition-Language', 'Data Definition Language (DDL)'],
  ['Data-Manipulation-Language', 'Data Manipulation Language (DML)'],
  ['Data-Query-Language', 'Data Query Language (DQL)'],
  ['Data-Control-Language', 'Data Control Language (DCL)'],
  ['Other', 'Other'],
  ['__root__', 'Uncategorized'],
]

const COMPAT_LABEL = {
  full: '✅ Full',
  partial: '⚠️ Partial',
  none: '❌ None',
  mo_only: '🟣 MatrixOne-only',
  unknown: '❓ Unknown',
}

function categoryOf(relPath) {
  const parts = relPath.split('/')
  if (parts.length <= 1) return '__root__'
  return parts[0]
}

async function main() {
  const files = await glob(`${ROOT}/**/*.md`)
  const rows = []
  for (const file of files) {
    const rel = path.relative(ROOT, file)
    const raw = readFileSync(file, 'utf-8')
    const fm = parseFrontmatter(raw) || {}
    rows.push({
      file,
      rel,
      category: categoryOf(rel),
      title: fm.title || rel.replace(/\.md$/, ''),
      compat: fm.mysql_compat || 'unknown',
      differs: Array.isArray(fm.differs_from_mysql) ? fm.differs_from_mysql : [],
      mo_only: Array.isArray(fm.mo_only) ? fm.mo_only : [],
    })
  }

  const totals = rows.reduce((acc, r) => {
    acc[r.compat] = (acc[r.compat] || 0) + 1
    return acc
  }, {})

  const out = []
  out.push('---')
  out.push('title: "MySQL Compatibility Matrix"')
  out.push('mysql_compat: full')
  out.push('---')
  out.push('')
  out.push('# MySQL Compatibility Matrix')
  out.push('')
  out.push('> Auto-generated from `mysql_compat` frontmatter across')
  out.push('> `docs/MatrixOne/Reference/SQL-Reference/**`. Do not edit by hand —')
  out.push('> re-run `node scripts/generate-compat-matrix.js` after updating any')
  out.push('> source page.')
  out.push('')
  out.push('## Summary')
  out.push('')
  out.push('| Status | Count |')
  out.push('|---|---|')
  for (const key of ['full', 'partial', 'none', 'mo_only', 'unknown']) {
    out.push(`| ${COMPAT_LABEL[key]} | ${totals[key] || 0} |`)
  }
  out.push(`| **Total** | **${rows.length}** |`)
  out.push('')

  for (const [key, label] of CATEGORY_ORDER) {
    const catRows = rows.filter(r => r.category === key)
    if (catRows.length === 0) continue
    out.push(`## ${label}`)
    out.push('')
    out.push('| Statement | MySQL Compat | Differences from MySQL | MatrixOne-only |')
    out.push('|---|---|---|---|')
    catRows.sort((a, b) => a.title.localeCompare(b.title))
    for (const r of catRows) {
      const link = `[${escapeCell(r.title)}](./SQL-Reference/${r.rel.replace(/\\/g, '/')})`
      const compat = COMPAT_LABEL[r.compat] || r.compat
      const differs = r.differs.length ? r.differs.map(escapeCell).join('<br/>') : '—'
      const moOnly = r.mo_only.length ? r.mo_only.map(escapeCell).join('<br/>') : '—'
      out.push(`| ${link} | ${compat} | ${differs} | ${moOnly} |`)
    }
    out.push('')
  }

  writeFileSync(OUTPUT, out.join('\n'), 'utf-8')
  console.log(`✓ Wrote ${OUTPUT}`)
  console.log(`  ${rows.length} rows, distribution: ${Object.entries(totals).map(([k, v]) => `${k}=${v}`).join(', ')}`)
}

function escapeCell(s) {
  return String(s).replace(/\|/g, '\\|')
}

main().catch(err => { console.error(err); process.exit(1) })
