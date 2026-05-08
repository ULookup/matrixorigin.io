#!/usr/bin/env node
/**
 * Upgrade Reference pages to the Agent-friendly FULL frontmatter shape:
 *
 *   ---
 *   title: "..."              (derived from H1 if missing)
 *   doc_type: reference       (added if missing)
 *   mysql_compat: ...         (kept; derived from classification table when absent)
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
 * Idempotent: re-running skips files that already carry `llms_summary`
 * unless --restyle is set.
 *
 * --target selects the corpus / classification profile:
 *   --target=sql-reference (default)  existing pages already have mysql_compat
 *   --target=functions-operators      pages may lack frontmatter entirely; pull
 *                                     mysql_compat from fo-compat-classification.js
 *
 * Usage:
 *   node scripts/upgrade-sql-reference-frontmatter.js                            # SQL-Reference
 *   node scripts/upgrade-sql-reference-frontmatter.js --dry                      # report only
 *   node scripts/upgrade-sql-reference-frontmatter.js --target=functions-operators
 *   node scripts/upgrade-sql-reference-frontmatter.js path/*.md                  # specific files
 */

import glob from 'fast-glob'
import { readFileSync, writeFileSync } from 'node:fs'
import { classify as classifyFO } from './fo-compat-classification.js'

const LAST_UPDATED = '2026-05-08'
const SINCE = 'unknown'
const PATTERNS = {
  'sql-reference':        'docs/MatrixOne/Reference/SQL-Reference/**/*.md',
  'functions-operators':  'docs/MatrixOne/Reference/Functions-and-Operators/**/*.md',
}
const TARGET_ROOTS = {
  'sql-reference':        'docs/MatrixOne/Reference/SQL-Reference/',
  'functions-operators':  'docs/MatrixOne/Reference/Functions-and-Operators/',
}
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
  if (t.startsWith('"') && t.endsWith('"')) {
    // YAML double-quoted scalar: unescape \" and \\ when round-tripping.
    return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1)
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
// NOTE: underscore emphasis is only stripped when flanked by word boundaries
// on the outside — otherwise identifiers like `JSON_SET` would lose their
// underscores ("_SET_" matches naive /_(.+)_/).
function stripInlineMarkdown(s) {
  return s
    // Double-backtick code spans (``OCT(N)``) before single-backtick ones to
    // avoid leaving a trailing backtick.
    .replace(/``([^`]+)``/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(?<![\*\w])\*([^*\s][^*]*?[^*\s])\*(?!\w)/g, '$1')
    .replace(/(?<![_\w])__([^_\s][^_]*?[^_\s])__(?!\w)/g, '$1')
    .replace(/(?<![_\w])_([^_\s][^_]*?[^_\s])_(?!\w)/g, '$1')
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

  // A paragraph counts as "useful" if it's non-trivial prose — not a heading,
  // not a blockquote, not HTML/admonition/table, and carries at least a short
  // sentence. The aggregate-function pages frequently open with a one-word
  // lead like "Aggregate function." so we keep collecting until we have at
  // least ~30 chars of prose or hit a non-prose boundary.
  function isProse(p) {
    if (/^#{1,6}\s/.test(p)) return false
    if (/^>\s/.test(p)) return false
    if (/^!{3}\s/.test(p)) return false
    if (p.startsWith('<!--') || p.startsWith('|') || p.startsWith('<')) return false
    return true
  }

  // Gather prose paragraphs starting from fromIdx (inclusive) up to endIdx
  // (exclusive, default: end of body), joining them with a space. Stops at
  // the next heading once we have any content.
  function collectLead(fromIdx, endIdx) {
    const end = endIdx === undefined ? paragraphs.length : endIdx
    const pieces = []
    for (let i = fromIdx; i < end; i++) {
      const p = paragraphs[i]
      if (/^#{1,6}\s/.test(p)) {
        if (pieces.length) break          // stop at next heading once we have something
        else continue                     // skip leading headings
      }
      if (!isProse(p)) {
        if (pieces.length) break
        else continue
      }
      pieces.push(p)
      const joined = pieces.join(' ')
      if (joined.length >= 50) break      // enough to build a sentence
    }
    return pieces.join(' ')
  }

  // If the page opens with prose BEFORE any H2, that's the intro — use it.
  // This matches pages like Vector/arithmetic.md that start with an
  // overview paragraph rather than a "## Description" section.
  let firstH2Idx = paragraphs.findIndex(p => /^##\s/.test(p))
  if (firstH2Idx === -1) firstH2Idx = paragraphs.length
  const introLead = collectLead(0, firstH2Idx)

  let summary = introLead || null
  if (!summary) {
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i]
      if (/^#{1,6}\s/.test(p)) {
        const heading = p.replace(/^#+\s*/, '').toLowerCase()
        if (/description|overview|summary|introduction/.test(heading)) {
          summary = collectLead(i + 1)
          if (summary) break
        }
      }
    }
  }
  if (!summary) summary = collectLead(0)
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

// Replace the existing `> …` blockquote immediately under the H1 with a fresh
// one-line summary. If there isn't one, fall back to inject.
function rewriteBlockquote(body, summary) {
  const lines = body.split(/\r?\n/)
  let h1Idx = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^#\s+\S/.test(lines[i])) { h1Idx = i; break }
  }
  if (h1Idx === -1) return body
  let j = h1Idx + 1
  while (j < lines.length && lines[j].trim() === '') j++
  if (j >= lines.length || !lines[j].startsWith('>')) {
    return injectBlockquote(body, summary)
  }
  // drop consecutive blockquote lines (in case the summary was multi-line)
  let k = j
  while (k < lines.length && lines[k].startsWith('>')) k++
  const head = lines.slice(0, h1Idx + 1)
  const tail = lines.slice(k)
  while (tail.length && tail[0].trim() === '') tail.shift()
  return [...head, '', `> ${summary}`, '', ...tail].join('\n')
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

// Extract a title from the first H1 by stripping markdown emphasis and any
// backslash-escapes that mkdocs-material uses to prevent underscores from
// being interpreted as italics (`# **STR\_TO\_DATE()**` -> `STR_TO_DATE()`).
function extractTitleFromH1(body) {
  const lines = body.split(/\r?\n/)
  for (const line of lines) {
    const m = line.match(/^#\s+(.+?)\s*$/)
    if (m) {
      return m[1]
        .replace(/^\*\*|\*\*$/g, '')
        .replace(/^\*|\*$/g, '')
        .replace(/\\(_|\*|`|\[|\])/g, '$1')
        .trim()
    }
  }
  return null
}

function upgradeOne(filePath, { restyle = false, regenSummary = false, target = 'sql-reference' } = {}) {
  const raw = readFileSync(filePath, 'utf-8')
  const parsed = parseFrontmatter(raw)
  const bodyFull = parsed.data ? parsed.body : raw
  const data = parsed.data || {}
  const alreadyFull = 'llms_summary' in data
  if (alreadyFull && !restyle && !regenSummary) {
    return { path: filePath, skipped: true, reason: 'already FULL' }
  }

  // Resolve title: existing frontmatter > first H1 > filename fallback.
  const h1Title = extractTitleFromH1(bodyFull)
  const title = data.title || h1Title || filePath.split('/').pop().replace(/\.md$/, '')

  // Resolve mysql_compat. If the page already declares one, keep it. Otherwise
  // look up the classification table for the active target.
  let mysqlCompat = data.mysql_compat
  let extraDiffers = []
  let extraMoOnly = []
  let classifyReason = null
  if (!mysqlCompat) {
    if (target === 'functions-operators') {
      const root = TARGET_ROOTS[target]
      const rel = filePath.startsWith(root) ? filePath.slice(root.length) : filePath
      const cls = classifyFO(rel)
      mysqlCompat = cls.compat
      if (Array.isArray(cls.differs)) extraDiffers = cls.differs
      if (Array.isArray(cls.mo_only_notes)) extraMoOnly = cls.mo_only_notes
      classifyReason = cls.note || null
    } else {
      return { path: filePath, skipped: true, reason: 'missing mysql_compat (no classifier for target)' }
    }
  }

  // Normalize fields — preserve existing list entries, append any classifier
  // hints that aren't already covered. Even when re-styling an already-FULL
  // page, a freshly-updated DIR_DEFAULTS entry should flow through so matrix
  // consumers see the rationale.
  const existingDiffers = Array.isArray(data.differs_from_mysql) ? data.differs_from_mysql : []
  const existingMoOnly = Array.isArray(data.mo_only) ? data.mo_only : []
  if (target === 'functions-operators' && !existingDiffers.length && !extraDiffers.length && data.mysql_compat) {
    // If the page already declared a compat value but no differs and the
    // classifier has something to contribute, pull it in.
    const root = TARGET_ROOTS[target]
    const rel = filePath.startsWith(root) ? filePath.slice(root.length) : filePath
    const cls = classifyFO(rel)
    if (Array.isArray(cls.differs)) extraDiffers = cls.differs
    if (Array.isArray(cls.mo_only_notes) && !existingMoOnly.length) extraMoOnly = cls.mo_only_notes
  }
  const mergedDiffers = dedupe([...existingDiffers, ...extraDiffers])
  const mergedMoOnly = dedupe([...existingMoOnly, ...extraMoOnly])

  const newData = {}
  newData.title = title
  newData.doc_type = data.doc_type || 'reference'
  newData.mysql_compat = mysqlCompat
  newData.differs_from_mysql = mergedDiffers
  newData.mo_only = mergedMoOnly
  newData.since = data.since || SINCE
  newData.last_updated = data.last_updated || LAST_UPDATED

  // When re-styling an already-FULL page, keep the existing summary verbatim
  // rather than regenerating it (it may have been hand-tuned). --regen-summary
  // forces regeneration, e.g. after fixing a bug in the markdown stripper.
  const summary = (alreadyFull && !regenSummary)
    ? data.llms_summary
    : deriveSummary(bodyFull, title)
  newData.llms_summary = summary

  const order = ['title', 'doc_type', 'mysql_compat', 'differs_from_mysql', 'mo_only', 'since', 'last_updated', 'llms_summary']

  const newFm = emitFrontmatter(newData, order)
  // Decide how to handle the blockquote line under H1:
  //   - first upgrade → inject fresh
  //   - restyle only (summary unchanged) → leave body alone
  //   - regen-summary with a changed summary → rewrite the blockquote
  let newBody
  if (!alreadyFull) {
    newBody = injectBlockquote(bodyFull, summary)
  } else if (regenSummary && summary !== data.llms_summary) {
    newBody = rewriteBlockquote(bodyFull, summary)
  } else {
    newBody = bodyFull
  }
  const out = newFm + newBody

  if (out === raw) {
    return { path: filePath, skipped: true, reason: 'no changes needed' }
  }

  return { path: filePath, skipped: false, summary, out, compat: mysqlCompat, classifyReason }
}

function dedupe(arr) {
  const seen = new Set()
  const out = []
  for (const v of arr) {
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

function parseTarget(argv) {
  const t = argv.find(a => a.startsWith('--target='))
  if (!t) return 'sql-reference'
  const v = t.slice('--target='.length)
  if (!PATTERNS[v]) throw new Error(`Unknown --target=${v} (allowed: ${Object.keys(PATTERNS).join(', ')})`)
  return v
}

async function main() {
  const argv = process.argv.slice(2)
  const dry = argv.includes('--dry')
  const restyle = argv.includes('--restyle')
  const regenSummary = argv.includes('--regen-summary')
  const target = parseTarget(argv)
  const files = argv.filter(a => !a.startsWith('--'))
  const targets = files.length > 0 ? files : await glob(PATTERNS[target])

  let upgraded = 0, skipped = 0
  const dist = { full: 0, partial: 0, none: 0, mo_only: 0, unknown: 0 }
  for (const f of targets) {
    const res = upgradeOne(f, { restyle, regenSummary, target })
    if (res.skipped) {
      skipped++
      if (dry) console.log(`SKIP  ${f}  (${res.reason})`)
      continue
    }
    upgraded++
    if (res.compat && dist[res.compat] !== undefined) dist[res.compat]++
    if (dry) {
      console.log(`UPGRADE ${f}  [${res.compat || '?'}]`)
      console.log(`   summary: ${res.summary}`)
      if (res.classifyReason) console.log(`   note:    ${res.classifyReason}`)
    } else {
      writeFileSync(f, res.out, 'utf-8')
      console.log(`✓ ${f}  [${res.compat || '?'}]`)
    }
  }
  console.log(`\nTarget: ${target}`)
  console.log(`Upgraded: ${upgraded}  Skipped: ${skipped}  Total: ${targets.length}`)
  console.log(`compat distribution (this run): full=${dist.full} partial=${dist.partial} none=${dist.none} mo_only=${dist.mo_only} unknown=${dist.unknown}`)
}

main().catch(err => { console.error(err); process.exit(1) })
