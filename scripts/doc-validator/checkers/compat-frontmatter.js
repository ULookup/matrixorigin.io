/**
 * MySQL Compatibility Frontmatter Checker
 *
 * Every page under `docs/MatrixOne/Reference/SQL-Reference/**` must declare a
 * `mysql_compat` field in YAML frontmatter. Allowed values:
 *   - full      : behaves exactly like MySQL 8.0
 *   - partial   : supported with documented differences (populate `differs_from_mysql`)
 *   - none      : not supported, or semantics differ significantly
 *   - mo_only   : MatrixOne extension with no MySQL analog (populate `mo_only`)
 *   - unknown   : not yet triaged (allowed to unblock the rollout; CI tracks % over time)
 *
 * Optional fields:
 *   - title               : override page title for the compatibility matrix
 *   - differs_from_mysql  : list of strings describing divergences
 *   - mo_only             : list of MatrixOne-only clauses/keywords on this page
 */

import { readFileSync } from 'node:fs'

export const ALLOWED_VALUES = ['full', 'partial', 'none', 'mo_only', 'unknown']

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/

export function parseFrontmatter(content) {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return null
  const body = match[1]
  const data = {}
  const lines = body.split(/\r?\n/)
  let currentKey = null
  for (const line of lines) {
    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/)
    if (kv) {
      currentKey = kv[1]
      const rawVal = kv[2].trim()
      if (rawVal === '') {
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
  return data
}

function stripQuotes(s) {
  const trimmed = s.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

export function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const fm = parseFrontmatter(content)
  if (!fm) {
    return {
      passed: false,
      errors: [`Missing YAML frontmatter (expected \`mysql_compat\` field).`],
      data: null
    }
  }
  const errors = []
  if (!('mysql_compat' in fm)) {
    errors.push('Missing required field `mysql_compat` in frontmatter.')
  } else if (!ALLOWED_VALUES.includes(fm.mysql_compat)) {
    errors.push(`Invalid \`mysql_compat\` value: "${fm.mysql_compat}". Allowed: ${ALLOWED_VALUES.join(', ')}.`)
  }
  return {
    passed: errors.length === 0,
    errors,
    data: fm
  }
}
