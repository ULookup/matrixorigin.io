#!/usr/bin/env node
/**
 * Apply `mysql_compat` decisions to every SQL-Reference page based on the
 * canonical compatibility overview in
 * `docs/MatrixOne/Overview/feature/mysql-compatibility.md`. Writes the
 * chosen status plus any `differs_from_mysql` / `mo_only` lists into the
 * page's frontmatter.
 *
 * Decisions are grouped by filename, not by path, because the filename is
 * a stable handle (the Reference/SQL-Reference subtree uses unique
 * basenames per statement). Pages not matched in the decision table keep
 * their existing frontmatter (typically `unknown`).
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import glob from 'fast-glob'

const PATTERN = 'docs/MatrixOne/Reference/SQL-Reference/**/*.md'

// -----------------------------------------------------------------------------
// Decision table.
//
// Keys are filenames (basename only). Values:
//   compat  : 'full' | 'partial' | 'none' | 'mo_only' | 'unknown'
//   differs : string[] — concrete differences vs MySQL 8.0 (required when
//             compat='partial')
//   mo_only : string[] — MatrixOne-only clauses/keywords worth surfacing
//             (required when compat='mo_only'; optional on 'partial')
//
// Sources: docs/MatrixOne/Overview/feature/mysql-compatibility.md
//          docs/MatrixOne/Reference/Limitations/mo-partition-support.md
//          in-page syntax descriptions cross-checked against MySQL 8.0 docs.
// -----------------------------------------------------------------------------

const DECISIONS = {
  // ==== index / taxonomy pages ====
  'SQL-Type.md':                      { compat: 'full' },

  // ================== DDL ==================
  'create-database.md':               { compat: 'partial', differs: [
    'Chinese database names not supported',
    'Only utf8mb4 / utf8mb4_bin are supported and cannot be changed',
    'ENCRYPTION clause accepted but inert',
  ]},
  'drop-database.md':                 { compat: 'full' },
  'create-table.md':                  { compat: 'partial', differs: [
    'ENGINE= clause in table definition not supported (MatrixOne has a single TAE engine)',
    'Spatial and SET types not supported; MEDIUMINT not supported',
    'BOOL is a native boolean type, not an INT alias as in MySQL',
  ], mo_only: [
    'CLUSTER BY (col, …) — pre-sort columns to accelerate queries',
  ]},
  'create-table-as-select.md':        { compat: 'full' },
  'create-table-like.md':             { compat: 'full' },
  'create-cluster-table.md':          { compat: 'mo_only', mo_only: ['CREATE CLUSTER TABLE'] },
  'create-external-table.md':        { compat: 'mo_only', mo_only: ['CREATE EXTERNAL TABLE'] },
  'create-dynamic-table.md':          { compat: 'mo_only', mo_only: ['CREATE DYNAMIC TABLE'] },
  'alter-table.md':                   { compat: 'partial', differs: [
    'CHANGE [COLUMN], MODIFY [COLUMN], RENAME COLUMN, ADD/DROP PRIMARY KEY, ALTER COLUMN ORDER BY cannot be combined with other clauses in the same ALTER TABLE',
    'Temporary tables cannot be altered',
    'Tables created with CLUSTER BY cannot be altered',
    'ALTER TABLE does not support PARTITION operations',
  ]},
  'rename-table.md':                  { compat: 'full' },
  'truncate-table.md':                { compat: 'full' },
  'drop-table.md':                    { compat: 'full' },
  'create-view.md':                   { compat: 'partial', differs: [
    'WITH CHECK OPTION clause not supported',
    'DEFINER and SQL SECURITY clauses not supported',
  ]},
  'alter-view.md':                    { compat: 'partial', differs: [
    'Inherits CREATE VIEW limitations: no WITH CHECK OPTION, DEFINER, SQL SECURITY',
  ]},
  'drop-view.md':                     { compat: 'full' },
  'create-index.md':                  { compat: 'partial', differs: [
    'Secondary indexes are syntactically accepted but do not yet provide query speed-up',
    'Foreign keys do not support ON CASCADE DELETE',
  ], mo_only: [
    'USING IVFFLAT — vector index for approximate nearest neighbour',
    'USING HNSW — vector index for approximate nearest neighbour',
    'USING MASTER — composite master index',
  ]},
  'create-index-ivfflat.md':         { compat: 'mo_only', mo_only: ['CREATE INDEX … USING IVFFLAT'] },
  'create-index-hnsw.md':             { compat: 'mo_only', mo_only: ['CREATE INDEX … USING HNSW'] },
  'create-fulltext-index.md':         { compat: 'full' },
  'drop-index.md':                    { compat: 'full' },
  'alter-reindex.md':                 { compat: 'mo_only', mo_only: ['ALTER … REINDEX (rebuild vector index)'] },
  'create-sequence.md':              { compat: 'mo_only', mo_only: ['CREATE SEQUENCE (PostgreSQL-style)'] },
  'alter-sequence.md':                { compat: 'mo_only', mo_only: ['ALTER SEQUENCE'] },
  'drop-sequence.md':                 { compat: 'mo_only', mo_only: ['DROP SEQUENCE'] },
  'create-function-sql.md':           { compat: 'partial', differs: [
    'Only LANGUAGE SQL and LANGUAGE PYTHON are supported; usage differs significantly from MySQL stored functions',
  ]},
  'create-function-python.md':       { compat: 'mo_only', mo_only: ['CREATE FUNCTION … LANGUAGE PYTHON AS …'] },
  'drop-function.md':                 { compat: 'partial', differs: [
    'Drops MatrixOne-style SQL / Python functions, not MySQL stored procedures/functions',
  ]},
  // Snapshot / PITR / Publication / Stage / Clone — all MatrixOne-only
  'create-snapshot.md':               { compat: 'mo_only', mo_only: ['CREATE SNAPSHOT FOR {ACCOUNT|DATABASE|TABLE|CLUSTER}'] },
  'restore-snapshot.md':              { compat: 'mo_only', mo_only: ['RESTORE … FROM SNAPSHOT'] },
  'drop-snapshot.md':                 { compat: 'mo_only', mo_only: ['DROP SNAPSHOT'] },
  'create-pitr.md':                   { compat: 'mo_only', mo_only: ['CREATE PITR … RANGE N {h|d|mo|y}'] },
  'alter-pitr.md':                    { compat: 'mo_only', mo_only: ['ALTER PITR'] },
  'drop-pitr.md':                     { compat: 'mo_only', mo_only: ['DROP PITR'] },
  'restore-pitr.md':                  { compat: 'mo_only', mo_only: ['RESTORE … FROM PITR'] },
  'create-publication.md':            { compat: 'mo_only', mo_only: ['CREATE PUBLICATION'] },
  'alter-publication.md':             { compat: 'mo_only', mo_only: ['ALTER PUBLICATION'] },
  'drop-publication.md':              { compat: 'mo_only', mo_only: ['DROP PUBLICATION'] },
  'create-subscription.md':           { compat: 'mo_only', mo_only: ['CREATE DATABASE … FROM … PUBLICATION …'] },
  'create-stage.md':                  { compat: 'mo_only', mo_only: ['CREATE STAGE (external file-system binding)'] },
  'alter-stage.md':                   { compat: 'mo_only', mo_only: ['ALTER STAGE'] },
  'drop-stage.md':                    { compat: 'mo_only', mo_only: ['DROP STAGE'] },
  'create-source.md':                 { compat: 'mo_only', mo_only: ['CREATE SOURCE (stream/Kafka connector)'] },
  'create-clone.md':                  { compat: 'mo_only', mo_only: ['CREATE TABLE … CLONE db.table [TO ACCOUNT …]'] },
  'data-branch-create-en.md':         { compat: 'mo_only', mo_only: ['DATA BRANCH CREATE (Git-for-Data)'] },
  'data-branch-delete-en.md':         { compat: 'mo_only', mo_only: ['DATA BRANCH DELETE'] },
  'data-branch-diff-en.md':           { compat: 'mo_only', mo_only: ['DATA BRANCH DIFF'] },
  'data-branch-merge-en.md':          { compat: 'mo_only', mo_only: ['DATA BRANCH MERGE'] },

  // ================== DCL ==================
  'create-account.md':                { compat: 'mo_only', mo_only: ['CREATE ACCOUNT … ADMIN_NAME …'] },
  'alter-account.md':                 { compat: 'mo_only', mo_only: ['ALTER ACCOUNT'] },
  'drop-account.md':                  { compat: 'mo_only', mo_only: ['DROP ACCOUNT'] },
  'create-role.md':                   { compat: 'mo_only', mo_only: ['CREATE ROLE (multi-account RBAC)'] },
  'drop-role.md':                     { compat: 'mo_only', mo_only: ['DROP ROLE'] },
  'create-user.md':                   { compat: 'partial', differs: [
    'IDENTIFIED BY is the only supported password form; IDENTIFIED WITH plugins not supported',
    'Connection-IP whitelists and connection-limit clauses not supported',
  ]},
  'alter-user.md':                    { compat: 'partial', differs: [
    'Only ALTER USER can change passwords; account-limit clauses not honoured',
  ]},
  'drop-user.md':                     { compat: 'full' },
  'grant.md':                         { compat: 'partial', differs: [
    'Authorization logic differs from MySQL — MatrixOne evaluates via its role/account model',
  ]},
  'revoke.md':                        { compat: 'partial', differs: [
    'Recovery logic differs from MySQL — privileges return to the role/account graph',
  ]},

  // ================== DML ==================
  'insert.md':                        { compat: 'partial', differs: [
    'Modifiers LOW_PRIORITY / DELAYED / HIGH_PRIORITY not supported',
  ]},
  'insert-into-select.md':            { compat: 'full' },
  'insert-ignore.md':                 { compat: 'partial', differs: [
    'LOW_PRIORITY / DELAYED / HIGH_PRIORITY modifiers not supported',
  ]},
  'insert-on-duplicate.md':           { compat: 'full' },
  'upsert.md':                        { compat: 'mo_only', mo_only: ['UPSERT (convenience alias over INSERT … ON DUPLICATE KEY UPDATE)'] },
  'replace.md':                       { compat: 'partial', differs: [
    'REPLACE does not support VALUES row_constructor_list',
    'node-sql-parser rejects REPLACE … WHERE (parser bug, not MatrixOne)',
  ]},
  'update.md':                        { compat: 'partial', differs: [
    'LOW_PRIORITY and IGNORE modifiers not supported',
  ]},
  'delete.md':                        { compat: 'partial', differs: [
    'LOW_PRIORITY, QUICK, IGNORE modifiers not supported',
  ]},
  'load-data-infile.md':              { compat: 'partial', differs: [
    'LOAD DATA LOCAL requires --local-infile on the client',
    'SET clause only accepts columns_name = nullif(expr1, expr2)',
    'JSONLines import uses MatrixOne-specific syntax',
    'Object-storage import (S3/URL) uses MatrixOne-specific syntax',
  ]},
  'load-data-inline.md':              { compat: 'mo_only', mo_only: ['LOAD DATA INLINE (stage-sourced import)'] },
  'case.md':                          { compat: 'full' },
  'current_role.md':                  { compat: 'mo_only', mo_only: ['CURRENT_ROLE() / CURRENT_ROLE_NAME()'] },
  'last-insert-id.md':                { compat: 'full' },
  'last-query-id.md':                 { compat: 'mo_only', mo_only: ['LAST_QUERY_ID()'] },

  // ================== DQL ==================
  'select.md':                        { compat: 'partial', differs: [
    'SELECT … FOR UPDATE only supports single-table queries',
    'Window functions limited to RANK, DENSE_RANK, ROW_NUMBER',
  ], mo_only: [
    'AS OF TIMESTAMP — time-travel query against snapshot/PITR',
  ]},
  'with-cte.md':                      { compat: 'full' },
  'union.md':                         { compat: 'full' },
  'intersect.md':                     { compat: 'full' },
  'minus.md':                         { compat: 'mo_only', mo_only: ['MINUS (set-difference query, not in MySQL)'] },
  'union-intersect-minus-overview.md':{ compat: 'mo_only', mo_only: ['MINUS, INTERSECT set operators'] },
  'by-rank-with-option.md':           { compat: 'mo_only', mo_only: ['BY RANK WITH OPTION (IVF vector ranking)'] },
  'subquery.md':                      { compat: 'partial', differs: [
    'Multi-level correlated subqueries inside IN() are not supported',
  ]},
  'comparisons-using-subqueries.md':  { compat: 'full' },
  'derived-tables.md':                { compat: 'full' },
  'subquery-with-all.md':             { compat: 'full' },
  'subquery-with-any-some.md':        { compat: 'full' },
  'subquery-with-exists.md':          { compat: 'full' },
  'subquery-with-in.md':              { compat: 'partial', differs: [
    'Multi-level correlated subqueries inside IN() are not supported',
  ]},
  'join.md':                          { compat: 'full' },
  'inner-join.md':                    { compat: 'full' },
  'left-join.md':                     { compat: 'full' },
  'right-join.md':                    { compat: 'full' },
  'full-join.md':                     { compat: 'full' },
  'outer-join.md':                    { compat: 'full' },
  'cross-join.md':                    { compat: 'full' },
  'natural-join.md':                  { compat: 'full' },
  'cross-apply.md':                   { compat: 'mo_only', mo_only: ['CROSS APPLY (SQL Server-style, not in MySQL)'] },
  'outer-apply.md':                   { compat: 'mo_only', mo_only: ['OUTER APPLY (SQL Server-style, not in MySQL)'] },

  // ================== Other / SHOW / EXPLAIN / Prepared / Set ==================
  'explain.md':                       { compat: 'partial', differs: [
    'Output format mirrors PostgreSQL, not MySQL',
    'JSON output not supported',
  ]},
  'explain-analyze.md':               { compat: 'partial', differs: [
    'Output format mirrors PostgreSQL; JSON output not supported',
  ]},
  'explain-prepared.md':              { compat: 'partial', differs: [
    'Output format mirrors PostgreSQL; JSON output not supported',
  ]},
  'explain-workflow.md':              { compat: 'partial', differs: [
    'Output format mirrors PostgreSQL; JSON output not supported',
  ]},
  'prepare.md':                       { compat: 'partial', differs: [
    'MatrixOne cannot PREPARE SET statements',
  ]},
  'execute.md':                       { compat: 'full' },
  'deallocate.md':                    { compat: 'full' },
  'set-role.md':                      { compat: 'mo_only', mo_only: ['SET ROLE (multi-account RBAC)'] },
  'kill.md':                          { compat: 'full' },
  'use-database.md':                  { compat: 'full' },
  // ---- SHOW ----
  'show-databases.md':                { compat: 'full' },
  'show-tables.md':                   { compat: 'full' },
  'show-columns.md':                  { compat: 'full' },
  'show-index.md':                    { compat: 'partial', differs: [
    'Reflects MatrixOne index model — secondary index rows appear but may not accelerate queries',
  ]},
  'show-create-table.md':             { compat: 'partial', differs: [
    'Output reflects MatrixOne-specific extensions (CLUSTER BY, USING IVFFLAT/HNSW, etc.)',
  ]},
  'show-create-view.md':              { compat: 'partial', differs: [
    'DEFINER / SQL SECURITY clauses absent from output',
  ]},
  'show-create-publication.md':       { compat: 'mo_only', mo_only: ['SHOW CREATE PUBLICATION'] },
  'show-grants.md':                   { compat: 'partial', differs: [
    'Results reflect MatrixOne role/account graph and differ from MySQL significantly',
  ]},
  'show-variables.md':                { compat: 'partial', differs: [
    'System variables are mostly syntactic stubs; actual behaviour differs from MySQL',
  ]},
  'show-processlist.md':              { compat: 'partial', differs: [
    'Output differs significantly from MySQL due to different implementation',
  ]},
  'show-collation.md':                { compat: 'partial', differs: [
    'Only utf8mb4_bin is effective; other collations appear but are inert',
  ]},
  'show-function-status.md':          { compat: 'partial', differs: [
    'Lists MatrixOne SQL/Python functions, not MySQL stored routines',
  ]},
  'show-account.md':                  { compat: 'mo_only', mo_only: ['SHOW ACCOUNTS'] },
  'show-roles.md':                    { compat: 'mo_only', mo_only: ['SHOW ROLES'] },
  'show-publications.md':             { compat: 'mo_only', mo_only: ['SHOW PUBLICATIONS'] },
  'show-subscriptions.md':            { compat: 'mo_only', mo_only: ['SHOW SUBSCRIPTIONS'] },
  'show-sequences.md':                { compat: 'mo_only', mo_only: ['SHOW SEQUENCES'] },
  'show-stage.md':                    { compat: 'mo_only', mo_only: ['SHOW STAGES'] },
  'show-pitrs.md':                    { compat: 'mo_only', mo_only: ['SHOW PITR'] },
}

// -----------------------------------------------------------------------------
// Frontmatter serialisation. Keeps format consistent with backfill script —
// scalar fields go first, list fields follow.
// -----------------------------------------------------------------------------

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/

function readFrontmatterRaw(text) {
  const m = text.match(FRONTMATTER_RE)
  if (!m) return { head: null, rest: text }
  return { head: m[0], rest: text.slice(m[0].length) }
}

function renderFrontmatter({ title, compat, differs, moOnly }) {
  const lines = ['---']
  lines.push(`title: "${(title || '').replace(/"/g, '\\"')}"`)
  lines.push(`mysql_compat: ${compat}`)
  if (differs && differs.length) {
    lines.push('differs_from_mysql:')
    for (const d of differs) lines.push(`  - "${d.replace(/"/g, '\\"')}"`)
  }
  if (moOnly && moOnly.length) {
    lines.push('mo_only:')
    for (const m of moOnly) lines.push(`  - "${m.replace(/"/g, '\\"')}"`)
  }
  lines.push('---', '')
  return lines.join('\n')
}

function extractTitleFromBody(body) {
  const m = body.match(/^#\s+(.+?)\s*$/m)
  if (!m) return ''
  return m[1].replace(/\*\*/g, '').replace(/`/g, '').trim()
}

function extractExistingTitle(frontmatterText) {
  if (!frontmatterText) return null
  const m = frontmatterText.match(/^title:\s*"?([^"\n]*?)"?\s*$/m)
  return m ? m[1] : null
}

async function main() {
  const files = await glob(PATTERN)
  const updated = []
  const unchanged = []
  const missing = []

  for (const file of files) {
    const key = basename(file)
    const decision = DECISIONS[key]
    if (!decision) {
      missing.push(file)
      continue
    }
    const raw = readFileSync(file, 'utf-8')
    const { head, rest } = readFrontmatterRaw(raw)
    const existingTitle = extractExistingTitle(head) || extractTitleFromBody(rest)
    const newHead = renderFrontmatter({
      title: existingTitle,
      compat: decision.compat,
      differs: decision.differs,
      moOnly: decision.mo_only,
    })
    const next = newHead + rest
    if (next === raw) {
      unchanged.push(file)
      continue
    }
    writeFileSync(file, next, 'utf-8')
    updated.push(file)
  }

  console.log(`Updated:   ${updated.length}`)
  console.log(`Unchanged: ${unchanged.length}`)
  console.log(`No decision (left as-is): ${missing.length}`)
  if (missing.length) {
    for (const f of missing) console.log(`  - ${f}`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
