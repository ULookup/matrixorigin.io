#!/usr/bin/env node
/**
 * Upgrade SQL-Reference pages to the Agent-friendly FULL frontmatter shape:
 *
 *   ---
 *   title: "..."              (kept)
 *   doc_type: reference       (added if missing)
 *   mysql_compat: ...         (kept)
 *   differs_from_mysql: []    (normalized to list, [] when absent)
 *   mo_only: []               (normalized to list, [] when absent)
 *   since: unknown            (added if missing — per rollout policy)
 *   last_updated: YYYY-MM-DD  (added if missing, today's date)
 *   llms_summary: "..."       (generated from page body if missing)
 *   ---
 *
 * Also injects a short `> ...` blockquote line immediately under the H1
 * so the summary is visible in the rendered page and in raw markdown.
 *
 * Idempotent: re-running skips files that already carry `llms_summary`.
 *
 * Usage:
 *   node scripts/upgrade-sql-reference-frontmatter.js            # in-place, all
 *   node scripts/upgrade-sql-reference-frontmatter.js --dry      # report only
 *   node scripts/upgrade-sql-reference-frontmatter.js path/*.md  # specific files
 */

import glob from 'fast-glob'
import { readFileSync, writeFileSync } from 'node:fs'

const LAST_UPDATED = '2026-05-08'
const SINCE = 'unknown'
const PATTERN = 'docs/MatrixOne/Reference/SQL-Reference/**/*.md'
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/

function parseFrontmatter(content) {
  const m = content.match(FRONTMATTER_RE)
  if (!m) return { data: null, rawBlock: '', body: content }
  const body = content.slice(m[0].length)
  const fm = m[1]
  const lines = fm.split(/\r?\n/)
  const data = {}
  const order = []
  let currentKey = null
  for (const line of lines) {
    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/)
    if (kv) {
      currentKey = kv[1]
      const rawVal = kv[2].trim()
      if (!order.includes(currentKey)) order.push(currentKey)
      if (rawVal === '') {
        data[currentKey] = []
      } else if (rawVal === '[]') {
        data[currentKey] = []
      } else {
        data[currentKey] = stripQuotes(rawVal)
      }
      continue
    }
    const listItem = line.match(/^\s+-\s+(.*)$/)
    if (listItem && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = []
      data[currentKey].push(stripQuotes(listItem[1]))
    }
  }
  return { data, rawBlock: m[0], body, order }
}

function stripQuotes(s) {
  const t = s.trim()
  if ((t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1)
  return t
}

function yamlString(s) {
  // Wrap in double quotes, escape embedded backslashes and quotes
  return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function emitFrontmatter(data, order) {
  const lines = ['---']
  for (const key of order) {
    const v = data[key]
    if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(`${key}: []`)
      } else {
        lines.push(`${key}:`)
        for (const item of v) lines.push(`  - ${yamlString(item)}`)
      }
    } else if (typeof v === 'boolean') {
      lines.push(`${key}: ${v}`)
    } else {
      // scalar string — always quote `title` and `llms_summary` for stylistic
      // consistency with existing FULL pages (e.g. addtime.md); quote others
      // only when YAML would otherwise interpret them as something else.
      const alwaysQuote = key === 'title' || key === 'llms_summary'
      const needsQuote = alwaysQuote || /[:#"'\[\]{}&*!|>%@`,]/.test(v) || /^\s|\s$/.test(v) || v === '' || /^(true|false|null|yes|no)$/i.test(v)
      lines.push(`${key}: ${needsQuote ? yamlString(v) : v}`)
    }
  }
  lines.push('---')
  lines.push('')
  return lines.join('\n')
}

// Strip inline markdown (bold, italic, code, backticks, links) to plain text.
function stripInlineMarkdown(s) {
  return s
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .trim()
}

// Derive a one-line llms_summary from the page body.
// Strategy:
//   1) find the body (after the H1)
//   2) prefer the first non-empty paragraph under "## Description" / "## **Description**"
//      (or "Syntax Description" / first H2 that looks like a description)
//   3) fall back to the first plaintext paragraph
//   4) trim to ~240 chars, end on a sentence boundary, strip inline md
function deriveSummary(body, title) {
  const lines = body.split(/\r?\n/)
  const paragraphs = []
  let current = []
  let inCode = false
  for (const raw of lines) {
    const line = raw
    if (/^```/.test(line)) { inCode = !inCode; continue }
    if (inCode) continue
    if (line.trim() === '') {
      if (current.length) { paragraphs.push(current.join(' ')); current = [] }
    } else {
      current.push(line.trim())
    }
  }
  if (current.length) paragraphs.push(current.join(' '))

  // Find the first paragraph after a "description" H2; if absent, pick the first real paragraph.
  let summary = null
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    if (/^#{1,6}\s/.test(p)) {
      const heading = p.replace(/^#+\s*/, '').toLowerCase()
      if (/description|overview|summary|introduction/.test(heading)) {
        // find next non-heading paragraph
        for (let j = i + 1; j < paragraphs.length; j++) {
          if (!/^#{1,6}\s/.test(paragraphs[j])) { summary = paragraphs[j]; break }
        }
        if (summary) break
      }
    }
  }
  if (!summary) {
    for (const p of paragraphs) {
      if (/^#{1,6}\s/.test(p)) continue
      if (/^>\s/.test(p)) continue // skip existing blockquotes
      if (/^!{3}\s/.test(p)) continue // mkdocs admonitions
      if (p.startsWith('<!--') || p.startsWith('|')) continue
      summary = p
      break
    }
  }
  if (!summary) summary = `${title} reference.`

  summary = stripInlineMarkdown(summary)
  // Remove leading "The function / statement / clause" verbosity? Keep as-is for accuracy.
  // Collapse whitespace
  summary = summary.replace(/\s+/g, ' ').trim()
  // Trim to first sentence if the first sentence already says enough, else ~240 chars.
  const firstSentence = summary.match(/^[^.!?\n]{30,}?[.!?](?=\s|$)/)
  if (firstSentence && firstSentence[0].length <= 280) {
    return firstSentence[0].trim()
  }
  if (summary.length <= 280) return summary
  // truncate on word boundary
  const truncated = summary.slice(0, 277).replace(/\s+\S*$/, '')
  return truncated + '...'
}

// Insert a `> summary` blockquote line immediately under the H1, unless one already exists.
function injectBlockquote(body, summary) {
  const lines = body.split(/\r?\n/)
  let h1Idx = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^#\s+\S/.test(lines[i])) { h1Idx = i; break }
  }
  if (h1Idx === -1) return body
  // find next non-blank line after H1
  let j = h1Idx + 1
  while (j < lines.length && lines[j].trim() === '') j++
  if (j < lines.length && lines[j].startsWith('>')) {
    // already has a blockquote under the H1 — leave it
    return body
  }
  const bqLine = `> ${summary}`
  const head = lines.slice(0, h1Idx + 1)
  const tail = lines.slice(h1Idx + 1)
  // ensure exactly one blank line between H1 and blockquote, and one blank line after
  // drop leading blanks from tail
  while (tail.length && tail[0].trim() === '') tail.shift()
  return [...head, '', bqLine, '', ...tail].join('\n')
}

function upgradeOne(filePath, { restyle = false } = {}) {
  const raw = readFileSync(filePath, 'utf-8')
  const { data, rawBlock, body } = parseFrontmatter(raw)
  if (!data) {
    return { path: filePath, skipped: true, reason: 'no frontmatter' }
  }
  const alreadyFull = 'llms_summary' in data
  if (alreadyFull && !restyle) {
    return { path: filePath, skipped: true, reason: 'already FULL' }
  }
  if (!('mysql_compat' in data)) {
    return { path: filePath, skipped: true, reason: 'missing mysql_compat' }
  }

  const title = data.title || filePath.split('/').pop().replace(/\.md$/, '')

  // Normalize fields
  const newData = {}
  newData.title = title
  newData.doc_type = data.doc_type || 'reference'
  newData.mysql_compat = data.mysql_compat
  newData.differs_from_mysql = Array.isArray(data.differs_from_mysql) ? data.differs_from_mysql : []
  newData.mo_only = Array.isArray(data.mo_only) ? data.mo_only : []
  newData.since = data.since || SINCE
  newData.last_updated = data.last_updated || LAST_UPDATED

  // When re-styling an already-FULL page, keep the existing summary verbatim
  // rather than regenerating it (it may have been hand-tuned).
  const summary = alreadyFull ? data.llms_summary : deriveSummary(body, title)
  newData.llms_summary = summary

  const order = ['title', 'doc_type', 'mysql_compat', 'differs_from_mysql', 'mo_only', 'since', 'last_updated', 'llms_summary']

  const newFm = emitFrontmatter(newData, order)
  // Only inject the blockquote if we generated a fresh summary — respect the
  // page's existing layout when re-styling.
  const newBody = alreadyFull ? body : injectBlockquote(body, summary)
  const out = newFm + newBody

  // Skip write if content is identical (avoid spurious mtime churn)
  if (out === raw) {
    return { path: filePath, skipped: true, reason: 'no changes needed' }
  }

  return { path: filePath, skipped: false, summary, out }
}

async function main() {
  const argv = process.argv.slice(2)
  const dry = argv.includes('--dry')
  const restyle = argv.includes('--restyle')
  const files = argv.filter(a => !a.startsWith('--'))
  const targets = files.length > 0 ? files : await glob(PATTERN)

  let upgraded = 0, skipped = 0
  for (const f of targets) {
    const res = upgradeOne(f, { restyle })
    if (res.skipped) {
      skipped++
      if (dry) console.log(`SKIP  ${f}  (${res.reason})`)
      continue
    }
    upgraded++
    if (dry) {
      console.log(`UPGRADE ${f}`)
      console.log(`   summary: ${res.summary}`)
    } else {
      writeFileSync(f, res.out, 'utf-8')
      console.log(`✓ ${f}`)
    }
  }
  console.log(`\nUpgraded: ${upgraded}  Skipped: ${skipped}  Total: ${targets.length}`)
}

main().catch(err => { console.error(err); process.exit(1) })
