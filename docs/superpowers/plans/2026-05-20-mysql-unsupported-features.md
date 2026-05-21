# MySQL Unsupported Features Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an auto-generated page listing every MySQL feature that MatrixOne does not (fully) support, combining auto-extracted frontmatter data with a hand-curated list of completely missing features.

**Architecture:** New Node.js script scans `docs/MatrixOne/Reference/**/*.md` for `differs_from_mysql` entries on partial-compat pages, plus a curated constant for MySQL features MO completely lacks. Output written to `docs/MatrixOne/Reference/mysql-unsupported-features.md`. Hooked into the existing `on_pre_build` MkDocs hook alongside the compat matrix generator.

**Tech Stack:** Node.js (fast-glob, fs), same frontmatter parser as existing compat matrix

---

### Task 1: Create the generator script

**Files:**
- Create: `scripts/generate-unsupported-features.js`

- [ ] **Step 1: Write the generator script**

```javascript
#!/usr/bin/env node
/**
 * Build `docs/MatrixOne/Reference/mysql-unsupported-features.md` listing
 * every MySQL feature that MatrixOne does not (fully) support.
 *
 * Two data sources:
 * 1. Auto-generated: every `differs_from_mysql` entry across
 *    `docs/MatrixOne/Reference/**` pages tagged `mysql_compat: partial`.
 * 2. Curated: a hand-maintained list of MySQL features that have no
 *    corresponding MatrixOne documentation page (triggers, stored procs,
 *    events, etc.).
 */

import glob from 'fast-glob'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseFrontmatter } from './doc-validator/checkers/compat-frontmatter.js'

const ROOT = 'docs/MatrixOne/Reference'
const OUTPUT = 'docs/MatrixOne/Reference/mysql-unsupported-features.md'

// Curated list of MySQL features that MatrixOne does NOT support at all.
// These have no corresponding MatrixOne documentation page, so they cannot
// be auto-discovered from frontmatter. Each entry: { category, feature, note }
const CURATED = [
  // DDL
  { category: 'DDL', feature: 'ALTER DATABASE', note: 'No ALTER DATABASE support' },
  { category: 'DDL', feature: 'CREATE / DROP TRIGGER', note: 'Triggers are not supported' },
  { category: 'DDL', feature: 'CREATE / DROP EVENT', note: 'Event scheduler is not supported' },
  { category: 'DDL', feature: 'CREATE / DROP PROCEDURE', note: 'Stored procedures are not supported' },
  { category: 'DDL', feature: 'CREATE FUNCTION (SQL body)', note: 'Only Python UDFs and simple SQL functions are supported; MySQL-style compound-statement function bodies are not' },
  { category: 'DDL', feature: 'ALTER TABLE ... PARTITION', note: 'Partition management via ALTER TABLE is not supported' },
  { category: 'DDL', feature: 'ALTER TABLE ... ALGORITHM / LOCK', note: 'ALTER TABLE algorithm/lock hints are not supported' },
  { category: 'DDL', feature: 'ENGINE= clause in CREATE TABLE', note: 'Storage engine selection is not supported; MatrixOne uses TAE exclusively' },
  { category: 'DDL', feature: 'CREATE TABLE ... TABLESPACE', note: 'Tablespace assignment is not supported' },
  { category: 'DDL', feature: 'CREATE TABLE with GENERATED columns', note: 'Generated (computed) columns are not supported' },
  { category: 'DDL', feature: 'CREATE TABLE with CHECK constraints', note: 'CHECK constraints are not enforced' },
  { category: 'DDL', feature: 'CREATE VIEW ... WITH CHECK OPTION', note: 'WITH CHECK OPTION is not supported for views' },
  { category: 'DDL', feature: 'CREATE VIEW ... DEFINER / SQL SECURITY', note: 'DEFINER and SQL SECURITY clauses are not supported' },

  // DML
  { category: 'DML', feature: 'HANDLER statements', note: 'HANDLER OPEN / READ / CLOSE are not supported' },
  { category: 'DML', feature: 'LOAD XML', note: 'LOAD XML INFILE is not supported; use LOAD DATA for CSV/JSONL' },
  { category: 'DML', feature: 'CALL procedure_name()', note: 'Stored procedure execution is not supported' },
  { category: 'DML', feature: 'DO statement', note: 'DO expr [, expr] ... is not supported' },

  // DCL
  { category: 'DCL', feature: 'GRANT with PROXY', note: 'PROXY user grants are not supported' },
  { category: 'DCL', feature: 'RENAME USER', note: 'RENAME USER is not supported; use ALTER USER instead' },
  { category: 'DCL', feature: 'SET PASSWORD', note: 'SET PASSWORD syntax is not supported; use ALTER USER instead' },

  // Data Types
  { category: 'Data Types', feature: 'Spatial types (GEOMETRY, POINT, LINESTRING, POLYGON, etc.)', note: 'Spatial data types and GIS functions are not supported' },
  { category: 'Data Types', feature: 'MEDIUMINT', note: 'MEDIUMINT integer type is not supported; use INT or SMALLINT' },
  { category: 'Data Types', feature: 'Year type (with 2-digit format)', note: 'YEAR(2) is not supported; only YEAR(4) / YEAR is available' },
  { category: 'Data Types', feature: 'BIT(M) with M > 64', note: 'BIT type is supported but length limits may differ' },
  { category: 'Data Types', feature: 'ENUM sorting and filtering', note: 'ENUM values can only be compared with strings in WHERE conditions; ENUM filtering and sorting are not supported' },

  // Indexes and Constraints
  { category: 'Indexes & Constraints', feature: 'SPATIAL INDEX', note: 'Spatial indexes are not supported' },
  { category: 'Indexes & Constraints', feature: 'FULLTEXT INDEX (MySQL native syntax)', note: 'MatrixOne has its own full-text index syntax (CREATE FULLTEXT INDEX) that differs from MySQL' },
  { category: 'Indexes & Constraints', feature: 'FOREIGN KEY ... ON DELETE CASCADE', note: 'Foreign keys do not support ON CASCADE DELETE' },
  { category: 'Indexes & Constraints', feature: 'FOREIGN KEY ... ON UPDATE CASCADE', note: 'Foreign keys do not support ON CASCADE UPDATE' },
  { category: 'Indexes & Constraints', feature: 'FOREIGN KEY ... SET NULL / SET DEFAULT', note: 'Referential actions SET NULL and SET DEFAULT are not supported' },
  { category: 'Indexes & Constraints', feature: 'Index hints (USE INDEX, FORCE INDEX, IGNORE INDEX)', note: 'Index hints in SELECT statements are not supported' },
  { category: 'Indexes & Constraints', feature: 'Descending indexes', note: 'DESC in index column definitions is not supported' },
  { category: 'Indexes & Constraints', feature: 'Functional / expression indexes', note: 'Indexes on expressions are not supported' },
  { category: 'Indexes & Constraints', feature: 'Invisible indexes', note: 'ALTER INDEX ... INVISIBLE is not supported' },

  // Storage Engine
  { category: 'Storage Engine', feature: 'InnoDB storage engine', note: 'MatrixOne uses TAE (Transactional Analytical Engine) instead of InnoDB; ENGINE= clause is ignored' },
  { category: 'Storage Engine', feature: 'MyISAM / MEMORY / ARCHIVE / CSV engines', note: 'Only the TAE engine is available; alternative storage engines are not supported' },

  // Partitioning
  { category: 'Partitioning', feature: 'RANGE / LIST / HASH / KEY partitioning (MySQL syntax)', note: 'MatrixOne uses its own partition syntax and semantics; MySQL-style PARTITION BY is not available' },
  { category: 'Partitioning', feature: 'Subpartitioning', note: 'Subpartitioning is not supported' },
  { category: 'Partitioning', feature: 'Partition management (REORGANIZE, COALESCE, EXCHANGE, etc.)', note: 'MySQL partition management operations are not supported' },

  // Transactions
  { category: 'Transactions', feature: 'SAVEPOINT / ROLLBACK TO SAVEPOINT', note: 'Savepoints within transactions are not supported' },
  { category: 'Transactions', feature: 'XA transactions (distributed transactions)', note: 'XA START / XA END / XA PREPARE / XA COMMIT are not supported; MatrixOne uses its own distributed transaction model' },
  { category: 'Transactions', feature: 'LOCK TABLES / UNLOCK TABLES', note: 'Explicit table-level locking is not supported' },
  { category: 'Transactions', feature: 'FLUSH TABLES WITH READ LOCK', note: 'Global read locks are not supported' },

  // Replication & Binary Log
  { category: 'Replication', feature: 'Binary log (binlog)', note: 'MySQL binary log and related statements (SHOW BINARY LOGS, SHOW MASTER STATUS, PURGE BINARY LOGS, etc.) are not supported; MatrixOne uses its own CDC mechanism' },
  { category: 'Replication', feature: 'CHANGE MASTER / START SLAVE / STOP SLAVE', note: 'MySQL replication protocol is not supported; MatrixOne has mo_cdc and pub/sub instead' },
  { category: 'Replication', feature: 'RESET MASTER / RESET SLAVE', note: 'MySQL replication management is not supported' },

  // SHOW Statements
  { category: 'SHOW Statements', feature: 'SHOW TRIGGER', note: 'Not supported (no triggers in MatrixOne)' },
  { category: 'SHOW Statements', feature: 'SHOW EVENTS', note: 'Not supported (no event scheduler)' },
  { category: 'SHOW Statements', feature: 'SHOW PROCEDURE STATUS', note: 'Not supported (no stored procedures)' },
  { category: 'SHOW Statements', feature: 'SHOW FUNCTION STATUS', note: 'Partially supported — only shows Python UDFs, not traditional MySQL functions' },
  { category: 'SHOW Statements', feature: 'SHOW ENGINE', note: 'Not supported; MatrixOne does not expose storage engine internals' },
  { category: 'SHOW Statements', feature: 'SHOW STATUS', note: 'Accepted syntactically but produces empty output' },
  { category: 'SHOW Statements', feature: 'SHOW PRIVILEGES', note: 'Accepted syntactically but produces empty output' },
  { category: 'SHOW Statements', feature: 'SHOW PROFILE / SHOW PROFILES', note: 'Query profiling via SHOW PROFILE is not supported' },
  { category: 'SHOW Statements', feature: 'SHOW OPEN TABLES', note: 'Not supported' },
  { category: 'SHOW Statements', feature: 'SHOW PLUGINS', note: 'Not supported' },
  { category: 'SHOW Statements', feature: 'SHOW ERRORS / SHOW WARNINGS', note: 'Results differ significantly from MySQL due to different implementation' },

  // System & Administration
  { category: 'Administration', feature: 'FLUSH statements (FLUSH LOGS, FLUSH TABLES, FLUSH PRIVILEGES, etc.)', note: 'FLUSH operations are not supported' },
  { category: 'Administration', feature: 'FLUSH PRIVILEGES', note: 'Not supported; privilege changes take effect immediately' },
  { category: 'Administration', feature: 'CACHE INDEX / LOAD INDEX INTO CACHE', note: 'Key cache management is not supported' },
  { category: 'Administration', feature: 'ANALYZE TABLE', note: 'ANALYZE TABLE is accepted but behavior differs from MySQL' },
  { category: 'Administration', feature: 'CHECKSUM TABLE', note: 'Not supported' },
  { category: 'Administration', feature: 'OPTIMIZE TABLE', note: 'Not supported; MatrixOne handles storage optimization automatically' },
  { category: 'Administration', feature: 'REPAIR TABLE', note: 'Not supported' },
  { category: 'Administration', feature: 'CHECK TABLE', note: 'Not supported' },
  { category: 'Administration', feature: 'mysql.* system database', note: 'The mysql system database is not accessible; MatrixOne has its own system metadata tables (mo_catalog)' },
  { category: 'Administration', feature: 'INFORMATION_SCHEMA (full)', note: 'INFORMATION_SCHEMA tables are present but most return empty result sets' },
  { category: 'Administration', feature: 'PERFORMANCE_SCHEMA', note: 'Performance Schema is not available' },
  { category: 'Administration', feature: 'INSTALL PLUGIN / UNINSTALL PLUGIN', note: 'Plugin system is not supported' },
  { category: 'Administration', feature: 'INSTALL COMPONENT / UNINSTALL COMPONENT', note: 'Component system is not supported' },
  { category: 'Administration', feature: 'KILL THREAD', note: 'KILL is supported but with different semantics from MySQL' },
  { category: 'Administration', feature: 'RESET / RESET PERSIST', note: 'System variable persistence management is not supported' },
  { category: 'Administration', feature: 'RESTART', note: 'RESTART server statement is not supported' },
  { category: 'Administration', feature: 'SHUTDOWN', note: 'Server shutdown statement is not supported' },

  // Functions & Operators
  { category: 'Functions', feature: 'MySQL native full-text search functions (MATCH ... AGAINST)', note: 'MatrixOne full-text search uses different syntax; MySQL MATCH AGAINST is not available' },
  { category: 'Functions', feature: 'Window functions: NTILE, FIRST_VALUE, LAST_VALUE, NTH_VALUE, LEAD, LAG', note: 'Some MySQL window functions are not yet supported in MatrixOne' },
  { category: 'Functions', feature: 'GIS / spatial functions', note: 'ST_* spatial functions are not supported (no spatial data types)' },
  { category: 'Functions', feature: 'XML functions (ExtractValue, UpdateXML)', note: 'XML processing functions are not supported' },
  { category: 'Functions', feature: 'Performance Schema functions', note: 'FORMAT_BYTES, FORMAT_PICO_TIME, PS_THREAD_ID, etc. are not available' },
  { category: 'Functions', feature: 'VERSION()', note: 'Returns MatrixOne version string, not MySQL-compatible format' },
  { category: 'Functions', feature: 'CONNECTION_ID()', note: 'Behavior may differ from MySQL due to different connection handling' },
  { category: 'Functions', feature: 'GROUPING()', note: 'GROUPING function for ROLLUP identification may behave differently' },

  // Tools
  { category: 'Tools', feature: 'mysql_upgrade', note: 'Database upgrade tool is not available; MatrixOne has its own upgrade procedure' },
  { category: 'Tools', feature: 'mysqlcheck', note: 'Table checking/repair tool is not available' },
  { category: 'Tools', feature: 'mysqlbinlog', note: 'Binary log utility is not available' },
  { category: 'Tools', feature: 'mysqlpump / mysqldump', note: 'Use mo_dump for MatrixOne logical backups' },
  { category: 'Tools', feature: 'mysqlslap', note: 'Load testing client is not available' },
  { category: 'Tools', feature: 'mysql_config_editor', note: 'Login path configuration is not available' },
  { category: 'Tools', feature: 'xtrabackup', note: 'Physical backup uses mo_br instead; xtrabackup / mariabackup are not compatible' },
]

const CATEGORY_LABEL = {
  'DDL': 'DDL — Data Definition Language',
  'DML': 'DML — Data Manipulation Language',
  'DCL': 'DCL — Data Control Language',
  'Data Types': 'Data Types',
  'Indexes & Constraints': 'Indexes & Constraints',
  'Storage Engine': 'Storage Engine',
  'Partitioning': 'Partitioning',
  'Transactions': 'Transactions',
  'Replication': 'Replication & Binary Log',
  'SHOW Statements': 'SHOW Statements',
  'Administration': 'System & Administration',
  'Functions': 'Functions & Operators',
  'Tools': 'Peripheral Tools',
}

function categoryOf(relPath) {
  const parts = relPath.split('/')
  if (parts.length <= 1) return null
  // Map source directories to display categories
  const dir = parts[0]
  const map = {
    'SQL-Reference': null, // decompose further below
    'Data-Types': 'Data Types',
    'Functions-and-Operators': 'Functions',
    'Operators': 'Operators',
    'Variable': 'System Variables',
    'System-Parameters': 'System Parameters',
    'Language-Structure': 'Language Structure',
    'Limitations': 'Limitations',
    'mo-tools': 'Tools',
  }
  if (dir in map) return map[dir]
  return null
}

function sqlCategoryOf(relPath) {
  // relPath is relative to SQL-Reference/, e.g. "Data-Definition-Language/create-table.md"
  const parts = relPath.split('/')
  if (parts.length <= 1) return '__root__'
  const dir = parts[0]
  const map = {
    'Data-Definition-Language': 'DDL',
    'Data-Manipulation-Language': 'DML',
    'Data-Query-Language': 'DQL',
    'Data-Control-Language': 'DCL',
    'Other': 'Other',
  }
  return map[dir] || 'Other'
}

async function main() {
  // 1. Collect auto-generated data from frontmatter
  const files = await glob(`${ROOT}/**/*.md`)
  const autoRows = []

  for (const file of files) {
    if (file.includes('mysql-compatibility-matrix.md')) continue
    if (file.includes('mysql-unsupported-features.md')) continue
    const raw = readFileSync(file, 'utf-8')
    const fm = parseFrontmatter(raw) || {}
    if (fm.mysql_compat !== 'partial' && fm.mysql_compat !== 'none') continue

    const differs = Array.isArray(fm.differs_from_mysql) ? fm.differs_from_mysql : []
    if (differs.length === 0 && fm.mysql_compat !== 'none') continue

    const rel = path.relative(ROOT, file)
    const title = fm.title || rel.replace(/\.md$/, '')

    // Determine category
    let cat
    if (rel.startsWith('SQL-Reference/')) {
      const sqlRel = rel.replace('SQL-Reference/', '')
      cat = sqlCategoryOf(sqlRel)
    } else {
      cat = categoryOf(rel)
    }
    if (!cat) cat = 'Other'

    for (const d of differs) {
      autoRows.push({
        category: cat,
        feature: title,
        note: d,
        sourcePage: rel,
        curated: false,
      })
    }

    // Handle `mysql_compat: none` pages (none today, but future-proof)
    if (fm.mysql_compat === 'none' && differs.length === 0) {
      autoRows.push({
        category: cat,
        feature: title,
        note: 'Not supported (mysql_compat: none)',
        sourcePage: rel,
        curated: false,
      })
    }
  }

  // Build groups: { category label -> rows[] }
  const groups = new Map()
  for (const row of autoRows) {
    const key = row.category
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }

  // 2. Write output file
  const out = []
  out.push('---')
  out.push('title: "MySQL Features Not Supported by MatrixOne"')
  out.push('description: "Comprehensive list of MySQL features and syntax that MatrixOne does not (fully) support, combining auto-extracted frontmatter data with a curated list of completely missing features."')
  out.push('---')
  out.push('')
  out.push('# MySQL Features Not Supported by MatrixOne')
  out.push('')
  out.push('> This page lists MySQL features and SQL syntax that MatrixOne either')
  out.push('> does not support at all (**Completely Missing**) or supports with')
  out.push('> documented differences (**Partial Support**).')
  out.push('>')
  out.push('> - **Completely Missing** entries are curated manually for MySQL features')
  out.push('>   that have no corresponding MatrixOne documentation page.')
  out.push('> - **Partial Support** entries are auto-extracted from `differs_from_mysql`')
  out.push('>   frontmatter on `mysql_compat: partial` pages under `docs/MatrixOne/Reference/**`.')
  out.push('>')
  out.push('> Auto-generated by `scripts/generate-unsupported-features.js`. Do not edit')
  out.push('> the auto-extracted entries by hand — update the corresponding source page')
  out.push('> frontmatter instead. Curated entries can be edited in the generator script.')
  out.push('')

  // Summary
  const curatedCount = CURATED.length
  const autoCount = autoRows.length
  out.push('## Summary')
  out.push('')
  out.push(`| Source | Count |`)
  out.push(`|---|---|`)
  out.push(`| Completely Missing (curated) | ${curatedCount} |`)
  out.push(`| Partial Support (auto-extracted) | ${autoCount} |`)
  out.push(`| **Total** | **${curatedCount + autoCount}** |`)
  out.push('')

  // Curated section: Completely Missing
  out.push('## Completely Missing')
  out.push('')
  out.push('These MySQL features have no MatrixOne counterpart and are not available in any form.')
  out.push('')

  // Group curated by category
  const curatedGroups = new Map()
  for (const item of CURATED) {
    const key = item.category
    if (!curatedGroups.has(key)) curatedGroups.set(key, [])
    curatedGroups.get(key).push(item)
  }

  const curatedCategoryOrder = [
    'DDL', 'DML', 'DCL', 'Data Types', 'Indexes & Constraints',
    'Storage Engine', 'Partitioning', 'Transactions', 'Replication',
    'SHOW Statements', 'Administration', 'Functions', 'Tools',
  ]

  for (const cat of curatedCategoryOrder) {
    const items = curatedGroups.get(cat)
    if (!items || items.length === 0) continue
    const label = CATEGORY_LABEL[cat] || cat
    out.push(`### ${label}`)
    out.push('')
    out.push('| Feature | Note |')
    out.push('|---|---|')
    for (const item of items) {
      out.push(`| ${escapeCell(item.feature)} | ${escapeCell(item.note)} |`)
    }
    out.push('')
  }

  // Curated categories not in the explicit order
  for (const [cat, items] of curatedGroups) {
    if (curatedCategoryOrder.includes(cat)) continue
    const label = CATEGORY_LABEL[cat] || cat
    out.push(`### ${label}`)
    out.push('')
    out.push('| Feature | Note |')
    out.push('|---|---|')
    for (const item of items) {
      out.push(`| ${escapeCell(item.feature)} | ${escapeCell(item.note)} |`)
    }
    out.push('')
  }

  // Auto-generated section: Partial Support
  out.push('## Partial Support')
  out.push('')
  out.push('These MySQL features are partially supported by MatrixOne with documented differences.')
  out.push('Each row links to the relevant MatrixOne documentation page for full details.')
  out.push('')

  const autoCategoryOrder = ['DDL', 'DML', 'DQL', 'DCL', 'Other']

  for (const cat of autoCategoryOrder) {
    const rows = groups.get(cat)
    if (!rows || rows.length === 0) continue
    const label = CATEGORY_LABEL[cat] || cat
    out.push(`### ${label}`)
    out.push('')
    out.push('| Statement | Difference from MySQL |')
    out.push('|---|---|')
    rows.sort((a, b) => a.feature.localeCompare(b.feature))
    for (const r of rows) {
      const link = `[${escapeCell(r.feature)}](./${r.sourcePage.replace(/\\/g, '/')})`
      out.push(`| ${link} | ${escapeCell(r.note)} |`)
    }
    out.push('')
  }

  // Remaining auto categories
  for (const [cat, rows] of groups) {
    if (autoCategoryOrder.includes(cat)) continue
    const label = CATEGORY_LABEL[cat] || cat
    out.push(`### ${label}`)
    out.push('')
    out.push('| Statement | Difference from MySQL |')
    out.push('|---|---|')
    rows.sort((a, b) => a.feature.localeCompare(b.feature))
    for (const r of rows) {
      const link = `[${escapeCell(r.feature)}](./${r.sourcePage.replace(/\\/g, '/')})`
      out.push(`| ${link} | ${escapeCell(r.note)} |`)
    }
    out.push('')
  }

  writeFileSync(OUTPUT, out.join('\n'), 'utf-8')
  console.log(`✓ Wrote ${OUTPUT}`)
  console.log(`  Curated: ${curatedCount} entries across ${curatedGroups.size} categories`)
  console.log(`  Auto-extracted: ${autoCount} entries across ${groups.size} categories`)
}

function escapeCell(s) {
  return String(s).replace(/\|/g, '\\|')
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Run the script manually to verify it works**

```bash
node scripts/generate-unsupported-features.js
```

Expected: Output shows curated count (70+) and auto-extracted count (62+), file written to `docs/MatrixOne/Reference/mysql-unsupported-features.md`.

- [ ] **Step 3: Verify the generated file looks correct**

```bash
head -50 docs/MatrixOne/Reference/mysql-unsupported-features.md
```

Check that the frontmatter, description, and first few entries render correctly.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-unsupported-features.js docs/MatrixOne/Reference/mysql-unsupported-features.md
git commit -m "feat: add script to generate MySQL unsupported features page"
```

### Task 2: Hook the generator into MkDocs build

**Files:**
- Modify: `docs/hooks/generate_compat_matrix.py:17-31`

- [ ] **Step 1: Update the hook to also run the new script**

Replace the hook body to run both scripts:

```python
"""MkDocs hook: regenerate MySQL compatibility artifacts before building.

Runs two Node scripts during `on_pre_build`:
1. `scripts/generate-compat-matrix.js` — the MySQL compatibility matrix table
2. `scripts/generate-unsupported-features.js` — the unsupported features list

Both output files are written into `docs/MatrixOne/Reference/` and must stay
in lock-step with `mysql_compat` frontmatter on source pages.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

_SCRIPTS = [
    "scripts/generate-compat-matrix.js",
    "scripts/generate-unsupported-features.js",
]


def on_pre_build(config, **_kwargs):
    repo_root = Path(config["config_file_path"]).resolve().parent
    node = shutil.which("node")
    if node is None:
        print("[compat-matrix] node not found on PATH; skipping regeneration")
        return
    for script_rel in _SCRIPTS:
        script = repo_root / script_rel
        if not script.exists():
            print(f"[compat-matrix] {script_rel} not found; skipping")
            continue
        try:
            subprocess.run([node, str(script)], cwd=repo_root, check=True)
        except subprocess.CalledProcessError as exc:
            raise SystemExit(
                f"[compat-matrix] {script_rel} failed with exit code {exc.returncode}"
            )
```

- [ ] **Step 2: Verify the hook works by building docs**

```bash
python -c "
import sys; sys.path.insert(0, 'docs/hooks')
from generate_compat_matrix import on_pre_build
on_pre_build({'config_file_path': 'mkdocs.yml'}, None)
"
```

Alternative: Trigger a full mkdocs build:
```bash
mkdocs build 2>&1 | head -20
```

Expected: Both `generate-compat-matrix.js` and `generate-unsupported-features.js` run, output files regenerated.

- [ ] **Step 3: Commit**

```bash
git add docs/hooks/generate_compat_matrix.py docs/MatrixOne/Reference/mysql-unsupported-features.md
git commit -m "feat: auto-generate MySQL unsupported features page during build"
```

### Task 3: Register the new page in mkdocs.yml navigation

**Files:**
- Modify: `mkdocs.yml` (near line 347)

- [ ] **Step 1: Add nav entry**

Find the existing compatibility matrix nav entry and add the new page next to it:

```yaml
              - MySQL Compatibility Matrix: MatrixOne/Reference/mysql-compatibility-matrix.md
              - MySQL Unsupported Features: MatrixOne/Reference/mysql-unsupported-features.md
```

The line to find is `- MySQL Compatibility Matrix: MatrixOne/Reference/mysql-compatibility-matrix.md`. Add the new entry immediately after it.

- [ ] **Step 2: Verify the nav renders correctly**

```bash
mkdocs build 2>&1 | tail -5
grep -n "unsupported\|Unsupported" site/sitemap.xml 2>/dev/null || echo "Check nav manually when serving"
```

- [ ] **Step 3: Commit**

```bash
git add mkdocs.yml
git commit -m "feat: add MySQL unsupported features page to navigation"
```
