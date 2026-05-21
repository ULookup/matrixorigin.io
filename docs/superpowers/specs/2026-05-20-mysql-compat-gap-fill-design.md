# MySQL Compatibility Documentation — Gap Fill Design

> 2026-05-20 Design spec for Phase 1 of the MySQL compatibility gap-fill initiative.

## Background

A comprehensive audit compared ~400 MatrixOne Reference pages against the full MySQL 8.0 SQL statement catalog (Chapter 15, ~207 statements). The audit identified:

- **~81** statements documented in MO's compatibility matrix (including MO-only statements)
- **~137** MySQL statements missing from MO documentation
- **94** curated entries in the unsupported features list (pre-audit)
- **62** Partial-compat pages needing frontmatter review

## Scope: Phase 1 (this design)

### 1. Expand CURATED list

Add ~35 confirmed-unsupported MySQL features to `scripts/generate-unsupported-features.js` CURATED array.

**DDL (17 new entries):**
ALTER INSTANCE, ALTER EVENT, ALTER FUNCTION (MySQL stored), ALTER PROCEDURE, ALTER RESOURCE GROUP, ALTER SERVER, ALTER TABLESPACE, CREATE RESOURCE GROUP, CREATE SERVER, CREATE SPATIAL REFERENCE SYSTEM, CREATE TABLESPACE, DROP EVENT, DROP PROCEDURE, DROP RESOURCE GROUP, DROP SERVER, DROP SPATIAL REFERENCE SYSTEM, DROP TABLESPACE

**DML (4):**
IMPORT TABLE, Parenthesized Query Expressions, TABLE statement, VALUES statement (DML form)

**Transactions (2):**
RELEASE SAVEPOINT, LOCK INSTANCE FOR BACKUP / UNLOCK INSTANCE

**Replication (9):**
All replication management statements: SHOW BINARY LOGS, SHOW BINLOG EVENTS, SHOW MASTER STATUS, SHOW REPLICA STATUS, SHOW REPLICAS, SHOW RELAYLOG EVENTS, PURGE BINARY LOGS, CLONE LOCAL DATA DIRECTORY, CLONE INSTANCE

**SHOW (5):**
SHOW CREATE EVENT, SHOW CREATE PROCEDURE, SHOW CREATE TRIGGER, SHOW FUNCTION CODE, SHOW PROCEDURE CODE (all unsupported because underlying features don't exist)

**Administration (2):**
BINLOG statement, HELP statement

After expansion: **~130 curated entries** total.

### 2. Frontmatter review doc (deferred to manual review)

Created `docs/superpowers/specs/2026-05-20-mysql-compat-frontmatter-review.md` listing:
- 43 priority-1 pages with empty/missing `differs_from_mysql`
- 17 priority-2 function pages with existing diffs to verify
- 2 priority-3 data type pages

### 3. Uncertain items (deferred to live MO verification)

8 statements need verification against a running MO instance:
DESCRIBE, SHOW CREATE DATABASE, SHOW CREATE USER, SHOW CHARACTER SET, SHOW ENGINES, SHOW TABLE STATUS, SET CHARACTER SET, SET NAMES

## Explicit non-goals (Phase 2)

- Creating new Reference pages for undocumented-but-supported statements
- Adding new entries to the compatibility matrix
- Validating uncertain items against live MO
- Auditing function/operator compatibility beyond what's already documented

## Architecture

No new files. Modifications to existing:

```
scripts/generate-unsupported-features.js  ← expand CURATED array (~35 new entries)
docs/MatrixOne/Reference/mysql-unsupported-features.md  ← regenerated output
```

## How to verify

1. `node scripts/generate-unsupported-features.js` — runs without error
2. Check output: curated count increases from 94 to ~130
3. `git diff docs/MatrixOne/Reference/mysql-unsupported-features.md` — new entries appear in correct categories
4. Visual inspection of generated page: new entries render correctly in markdown

## Risks

- **Duplicate entries**: Some new items may overlap with existing curated entries. Mitigation: review existing CURATED list before inserting.
- **Category mismatch**: Some entries could fit multiple categories. Mitigation: follow existing category conventions.
- **generated file already exists**: The script overwrites on each run; existing auto-extracted content is preserved.
