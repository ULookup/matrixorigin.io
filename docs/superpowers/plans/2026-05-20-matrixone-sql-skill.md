# MatrixOne SQL AI Skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a superpowers-compatible `matrixone-sql-guide` skill that teaches AI agents to write correct MatrixOne SQL and avoid MySQL-incompatible syntax.

**Architecture:** A single SKILL.md file with YAML frontmatter, organized as: core principle → pre-generation checklist → categorized pitfalls (~30 items) → doc navigation rules → quick reference table. The skill is self-contained so AI can avoid 80%+ common mistakes without fetching additional pages. Data is distilled from 3 sources: `differs_from_mysql` frontmatter (301 entries across 66 pages), the curated `mysql-unsupported-features.md` (132 entries), and the `agent_delivery.py` hints (12 entries).

**Tech Stack:** Markdown with YAML frontmatter (agentskills.io spec). No code — purely documentation artifact.

---

## File Structure

| File | Responsibility |
|---|---|
| `docs/superpowers/skills/matrixone-sql-guide/SKILL.md` (create) | Self-contained AI-readable skill: pitfalls, rules, navigation, quick reference |
| `docs/hooks/agent_delivery.py` (modify) | Add `llms.txt` reference to the new skill file |

---

### Task 1: Create skill directory and gather source data

**Files:**
- Create: `docs/superpowers/skills/matrixone-sql-guide/` (directory)

- [ ] **Step 1: Create directory**

```bash
mkdir -p docs/superpowers/skills/matrixone-sql-guide
```

- [ ] **Step 2: Extract all `differs_from_mysql` entries from frontmatter into a working summary**

Run:
```bash
find docs/MatrixOne/Reference -name "*.md" \
  -exec grep -l "differs_from_mysql:" {} \; | while read f; do
    title=$(sed -n '/^title:/s/^title: *//p' "$f" | head -1)
    compat=$(sed -n '/^mysql_compat:/s/^mysql_compat: *//p' "$f" | head -1)
    echo "=== $title [$compat] ==="
    sed -n '/^differs_from_mysql:/,/^[a-z]/p' "$f" | grep '^  - ' | sed 's/^  - //'
    echo ""
done > /tmp/mo-differs-all.txt
```

Expected: `/tmp/mo-differs-all.txt` created with all 301 entries, grouped by page.

- [ ] **Step 3: Extract curated "Completely Missing" entries**

Run:
```bash
sed -n '/^## Completely Missing/,/^## Partial Support/p' \
  docs/MatrixOne/Reference/mysql-unsupported-features.md \
  | grep '^| ' | grep -v '^| Feature' | grep -v '^|---' \
  > /tmp/mo-completely-missing.txt
```

Expected: `/tmp/mo-completely-missing.txt` with ~132 curated entries.

- [ ] **Step 4: Verify data counts**

Run:
```bash
echo "differs_from_mysql entries: $(grep -c '^=== ' /tmp/mo-differs-all.txt 2>/dev/null || echo 0) groups"
echo "completely missing entries: $(wc -l < /tmp/mo-completely-missing.txt)"
```

Expected: `66 groups` and `~132 lines`.

---

### Task 2: Prioritize and categorize pitfalls for the skill

**Files:**
- Create: (none — analysis task)

- [ ] **Step 1: Review the 301 `differs_from_mysql` entries and classify by AI impact**

For each entry, assign a priority:

- **P0 (Critical — ~15 items):** AI will almost certainly generate this MySQL syntax; using it causes an ERROR or silent data corruption
- **P1 (Important — ~10 items):** AI may generate this; causes behavioral difference or degraded functionality
- **P2 (Reference):** Included in quick-reference table only; unlikely without explicit user request

P0 criteria (choose ~15 from):
```
DDL:
1. ENGINE=InnoDB in CREATE TABLE → error (omit clause, TAE is the only engine)
2. FOREIGN KEY ... ON DELETE CASCADE → error (use RESTRICT/SET NULL/NO ACTION)
3. ALTER TABLE combining CHANGE/MODIFY/RENAME COLUMN with other clauses → error (split into separate statements)
4. CREATE TABLE with GENERATED columns → error (not supported)
5. CREATE TABLE with CHECK constraints → inert (syntax accepted but not enforced)
6. Spatial types (GEOMETRY, POINT, etc.) → error (not supported)
7. MEDIUMINT type → error (use INT or SMALLINT)
8. CREATE TABLE ... TABLESPACE → error (not supported)
9. ALTER TABLE ... PARTITION → error (not supported; partition at CREATE time)
10. CREATE VIEW ... WITH CHECK OPTION → error (not supported)

DML:
11. INSERT LOW_PRIORITY/DELAYED/HIGH_PRIORITY modifiers → error (not supported)
12. DELETE LOW_PRIORITY/QUICK/IGNORE modifiers → error (not supported)

DCL:
13. CREATE USER 'user'@'host' → works but '@'host' part ignored (MO uses bare username)
14. GRANT ... ON *.* TO 'user'@'host' → use bare username, account-scoped privileges
15. RENAME USER → error (use ALTER USER instead)
16. SET PASSWORD → error (use ALTER USER instead)

Functions/Data Types:
17. ST_* spatial functions → error (spatial types not supported)
18. JSON_OBJECT, JSON_ARRAY, JSON_MERGE, JSON_SEARCH etc. → error (only ~8 JSON functions supported)
19. MATCH ... AGAINST (MySQL fulltext) → error (use MatrixOne fulltext index syntax)
20. GET_LOCK()/RELEASE_LOCK() → error (advisory locks not supported)

Transactions/Administration:
21. SAVEPOINT/ROLLBACK TO SAVEPOINT → error (use DATA BRANCH)
22. LOCK TABLES/UNLOCK TABLES → error (not supported)
23. FLUSH PRIVILEGES → error (not needed; privilege changes take effect immediately)
24. SHOW ENGINES → empty result (MO uses TAE exclusively)
25. CALL procedure_name() → error (stored procedures not supported)
26. CREATE TRIGGER → error (triggers not supported)
27. CREATE EVENT → error (event scheduler not supported)
```

Select the final ~25 P0 items — these go into the skill's categorized pitfalls section.

- [ ] **Step 2: Select P1 items (~10 items)**

P1 candidates:
```
- BOOL is native boolean, not INT alias → different semantics
- AUTO_INCREMENT increment/offset variables are inert → silently ignored
- Partitioning RANGE/LIST syntax accepted but only HASH/KEY prune → silent performance degradation
- ENCRYPTION clause in CREATE DATABASE accepted but inert → silently ignored
- Secondary indexes syntactically accepted but don't accelerate queries → silent performance issue
- DECIMAL max precision 38 vs MySQL 65 → error for high-precision values
- LOAD DATA INFILE expects absolute path or stage URL → error with relative paths
- SELECT ... FOR UPDATE only single-table → error for multi-table
- Multi-level correlated subqueries in IN() → error
- PREPARE SET statements → error (PREPARE only works for SELECT/INSERT/etc.)
```

- [ ] **Step 3: Document selection in a working note (not committed)**

```bash
cat > /tmp/mo-skill-selection.md << 'EOF'
# MatrixOne Skill — Pitfall Selection

## P0 — Critical (included as named entries)
[list final selections with exact MySQL → MO mapping]

## P1 — Important (included in quick reference table)
[list final selections]

## P2 — Reference only (deferred to external doc links)
All remaining differs_from_mysql entries — covered by "see mysql-unsupported-features" rule
EOF
```

This working file is reference-only, used during Task 3.

---

### Task 3: Write the SKILL.md file

**Files:**
- Create: `docs/superpowers/skills/matrixone-sql-guide/SKILL.md`

- [ ] **Step 1: Write the complete SKILL.md**

Write file `docs/superpowers/skills/matrixone-sql-guide/SKILL.md`:

```markdown
---
name: matrixone-sql-guide
description: Use when generating SQL statements for MatrixOne database, writing DDL/DML/DCL for MatrixOne, converting MySQL syntax to MatrixOne-compatible syntax, debugging "not supported" or "syntax error" from MatrixOne, or using MatrixOne-specific features like CLUSTER BY, DATA BRANCH, PITR, SNAPSHOT, vector indexes, or stages
---

# MatrixOne SQL Guide

## Overview

**MatrixOne is NOT MySQL.** It speaks the MySQL wire protocol and accepts many MySQL SQL statements, but it is a different database engine (TAE) with its own feature surface. Treating MatrixOne as MySQL will produce errors, silently ignored syntax, or semantically different results. Always verify before assuming MySQL syntax works.

## Before Generating Any SQL

```
digraph checklist {
    "User asks for SQL" [shape=doublecircle];
    "Statement type?" [shape=diamond];
    "Consult MO-specific syntax" [shape=box];
    "mysql_compat=[full]?" [shape=diamond];
    "Proceed — safe to use MySQL syntax" [shape=box];
    "Check differs_from_mysql" [shape=box];
    "Find MO alternative or reject" [shape=box];
    "Use MySQL syntax?" [shape=diamond];
    "Reject: use llms-sql.txt" [shape=box];

    "User asks for SQL" -> "Statement type?";
    "Statement type?" -> "Consult MO-specific syntax" [label="MO-only\nfeature"];
    "Statement type?" -> "Use MySQL syntax?" [label="standard\nSQL"];
    "Use MySQL syntax?" -> "mysql_compat=[full]?" [label="yes"];
    "mysql_compat=[full]?" -> "Proceed — safe to use MySQL syntax" [label="yes"];
    "mysql_compat=[full]?" -> "Check differs_from_mysql" [label="no / unknown"];
    "Check differs_from_mysql" -> "Find MO alternative or reject" [label="no"];
    "Use MySQL syntax?" -> "Reject: use llms-sql.txt" [label="no"];
}
```

**Rule:** Never assume a MySQL feature works. The list below covers the most common traps, but if a statement isn't in this list and isn't explicitly `[full]` compat, pull `llms-sql.txt` and verify.

## High-Frequency Pitfalls

These are MySQL patterns AI agents generate most often — and they WILL fail on MatrixOne. Each entry shows the wrong MySQL pattern, what happens, and the correct MatrixOne alternative.

### DDL — Table Creation & Alteration

| # | MySQL Pattern (WRONG) | What Happens | MatrixOne Correct |
|---|---|---|---|
| 1 | `CREATE TABLE t (...) ENGINE=InnoDB` | ERROR | Omit `ENGINE=` clause. TAE is the only engine. |
| 2 | `FOREIGN KEY (id) REF t(id) ON DELETE CASCADE` | ERROR | Use `ON DELETE RESTRICT`, `SET NULL`, or `NO ACTION`. CASCADE not supported. |
| 3 | `ALTER TABLE t ADD COLUMN c INT, DROP COLUMN d` | ERROR | Split: `ALTER TABLE t ADD COLUMN c INT; ALTER TABLE t DROP COLUMN d`. Cannot combine clause types. |
| 4 | `CREATE TABLE t (c INT GENERATED ALWAYS AS ...)` | ERROR | Generated/computed columns not supported. |
| 5 | `CREATE TABLE t (c INT, CHECK (c > 0))` | INERT (silently ignored) | CHECK constraints are accepted but NOT enforced. Enforce in application. |
| 6 | `CREATE TABLE t (geo GEOMETRY)` | ERROR | Spatial types (GEOMETRY, POINT, LINESTRING, POLYGON) not supported. |
| 7 | `CREATE TABLE t (count MEDIUMINT)` | ERROR | Use `INT` or `SMALLINT`. MEDIUMINT not supported. |
| 8 | `CREATE TABLE t (...) TABLESPACE=innodb_file_per_table` | ERROR | Tablespace assignment not supported. Omit the clause. |
| 9 | `ALTER TABLE t ADD PARTITION (PARTITION p VALUES ...)` | ERROR | Partition management via ALTER TABLE not supported. Define partitions at CREATE TABLE time. |
| 10 | `CREATE TABLE t (c BOOL)` — treating BOOL as INT | DIFFERENT | BOOL is a native boolean type in MO, NOT an INT(1) alias as in MySQL. |
| 11 | `CREATE VIEW v AS SELECT ... WITH CHECK OPTION` | ERROR | WITH CHECK OPTION not supported for views. |
| 12 | `CREATE TABLE t (...) AUTO_INCREMENT=100` with `@@auto_increment_increment=5` | INERT | `auto_increment_increment`/`auto_increment_offset` accepted but ignored. AUTO_INCREMENT step is always 1. |
| 13 | `CREATE TABLE t (ts TIMESTAMP)` — expecting 1970-2038 range | DIFFERENT | MO TIMESTAMP range is 0001-01-01 to 9999-12-31 (wider than MySQL). |
| 14 | `CREATE DATABASE d ENCRYPTION='Y'` | INERT | ENCRYPTION clause accepted but silently ignored. |
| 15 | `CREATE TABLE t (id INT, FULLTEXT INDEX ft (id))` | ERROR | MatrixOne fulltext uses its own syntax: `CREATE FULLTEXT INDEX ft ON t(id)`. |
| 16 | `CREATE TABLE t (d DECIMAL(65, 30))` | ERROR | Max DECIMAL precision is 38 (MySQL: 65). |
| 17 | `ALTER TABLE t_temp ADD COLUMN ...` (on temp table) | ERROR | Temporary tables cannot be altered. |
| 18 | `ALTER TABLE t_cluster ADD COLUMN ...` (on CLUSTER BY table) | ERROR | Tables created with CLUSTER BY cannot be altered. Plan schema upfront. |
| 19 | `CREATE TABLE t (...) PARTITION BY RANGE (...)` | INERT | RANGE/LIST/RANGE COLUMNS/LIST COLUMNS partitioning is syntax-only. Only HASH and KEY participate in partition pruning. |

### DML — Data Manipulation

| # | MySQL Pattern (WRONG) | What Happens | MatrixOne Correct |
|---|---|---|---|
| 20 | `INSERT LOW_PRIORITY INTO t VALUES (1)` | ERROR | Remove modifier. `INSERT INTO t VALUES (1)`. |
| 21 | `DELETE LOW_PRIORITY FROM t WHERE id=1` | ERROR | Remove modifier. `DELETE FROM t WHERE id=1`. |
| 22 | `LOAD DATA INFILE 'relative/path.csv' INTO TABLE t` | ERROR | Use absolute path: `LOAD DATA INFILE '/abs/path.csv'`. Or use stage URL: `stage://my_stage/path.csv`. |
| 23 | `SELECT ... FOR UPDATE` (multi-table query) | ERROR | `SELECT ... FOR UPDATE` only supports single-table queries. |
| 24 | `SELECT ... FROM t WHERE col IN (SELECT ... WHERE col IN (SELECT ...))` | ERROR | Multi-level correlated subqueries inside IN() are not supported. Flatten or use JOINs. |

### DCL — User & Privilege Management

| # | MySQL Pattern (WRONG) | What Happens | MatrixOne Correct |
|---|---|---|---|
| 25 | `CREATE USER 'bob'@'10.0.0.1' IDENTIFIED BY 'pwd'` | DIFFERENT | `CREATE USER bob IDENTIFIED BY 'pwd'`. Bare username, no host part. MO is account-scoped. |
| 26 | `SET PASSWORD FOR 'bob' = 'newpwd'` | ERROR | `ALTER USER bob IDENTIFIED BY 'newpwd'`. |
| 27 | `RENAME USER bob TO alice` | ERROR | Create new user `alice`, then drop `bob`. |
| 28 | `GRANT ALL ON *.* TO 'bob'@'%'` | DIFFERENT | `GRANT ... ON DATABASE * TO bob` or `GRANT ... ON ACCOUNT * TO bob`. MO privilege model is account-scoped, not server-global. |
| 29 | `FLUSH PRIVILEGES` | ERROR | Not needed. Privilege changes take effect immediately. |

### Transactions & Administration

| # | MySQL Pattern (WRONG) | What Happens | MatrixOne Correct |
|---|---|---|---|
| 30 | `SAVEPOINT sp; ... ROLLBACK TO SAVEPOINT sp` | ERROR | Use `DATA BRANCH CREATE` → test → `DATA BRANCH DIFF` → `DATA BRANCH MERGE` for experimental workflows. Savepoints not supported. |
| 31 | `LOCK TABLES t READ; ... UNLOCK TABLES` | ERROR | Table-level locking not supported. Use transactions for isolation. |
| 32 | `XA START 'xid'; ... XA COMMIT 'xid'` | ERROR | Distributed transactions not supported. Use MO's built-in distributed transaction model. |
| 33 | `CALL my_stored_proc(1, 2)` | ERROR | Stored procedures not supported. Use client-side scripting or UDFs (`CREATE FUNCTION ... LANGUAGE PYTHON AS`). |
| 34 | `CREATE TRIGGER trg BEFORE INSERT ON t ...` | ERROR | Triggers not supported. Handle logic in application layer. |
| 35 | `CREATE EVENT evt ON SCHEDULE EVERY 1 HOUR DO ...` | ERROR | Event scheduler not supported. Use external cron/task scheduling. |

### Functions & Operators

| # | MySQL Pattern (WRONG) | What Happens | MatrixOne Correct |
|---|---|---|---|
| 36 | `ST_Distance(point1, point2)` | ERROR | Spatial functions (ST_*) not supported — no spatial types in MO. |
| 37 | `JSON_OBJECT('key', 'val')`, `JSON_ARRAY(...)` | ERROR | Only ~8 JSON functions supported. Check `llms-sql.txt` for the exact list. Use `JSON_ROW()` or construct JSON in application. |
| 38 | `MATCH(col) AGAINST('query' IN NATURAL LANGUAGE MODE)` | ERROR | Use MO fulltext syntax: `CREATE FULLTEXT INDEX ...` then query with MO-specific operators. |
| 39 | `GET_LOCK('name', 10)`, `RELEASE_LOCK('name')` | ERROR | Advisory locks not supported. Use application-level locking or `SELECT ... FOR UPDATE`. |
| 40 | `SELECT BENCHMARK(1000000, expr)` | ERROR | BENCHMARK() function not supported. |

### SHOW Statements

| # | MySQL Pattern (WRONG) | What Happens | MatrixOne Correct |
|---|---|---|---|
| 41 | `SHOW ENGINES` | EMPTY result | Accepted syntactically but returns empty. MO uses TAE exclusively. |
| 42 | `SHOW CHARACTER SET` | EMPTY result | Accepted syntactically but returns empty. Only utf8mb4/utf8mb4_bin exist. |
| 43 | `SHOW CREATE USER` | ERROR | Returns parser error. Not supported. |
| 44 | `SHOW PROCEDURE STATUS` | ERROR | Not supported — no stored procedures. |
| 45 | `SHOW TRIGGER` | ERROR | Not supported — no triggers. |
| 46 | `SHOW EVENTS` | ERROR | Not supported — no event scheduler. |
| 47 | `SHOW STATUS` | EMPTY result | Accepted syntactically but produces empty output. |
| 48 | `SHOW PRIVILEGES` | EMPTY result | Accepted syntactically but produces empty output. |

## Documentation Navigation

When you need more detail than this skill provides:

| Problem | Read This | Location |
|---|---|---|
| Statement-level compat status | `llms-sql.txt` | `[base]/llms-sql.txt` — flat index, every statement tagged `[full]`/`[partial]`/`[mo-only]`/`[none]` |
| Detailed per-feature differences | MySQL Unsupported Features | `[base]/MatrixOne/Reference/mysql-unsupported-features/` |
| Grouped compat table | MySQL Compatibility Matrix | `[base]/MatrixOne/Reference/mysql-compatibility-matrix/` |
| Full docs corpus | `llms-full.txt` | `[base]/llms-full.txt` |
| Per-page markdown | Append `.md` to any doc URL | e.g., `[base]/MatrixOne/Reference/SQL-Reference/Data-Definition-Language/create-table.md` |

## Quick Reference: MySQL → MatrixOne

MatrixOne-native features that replace MySQL equivalents:

| MySQL Feature | MatrixOne Replacement | Notes |
|---|---|---|
| `ENGINE=InnoDB` | _(omit clause)_ | TAE is the only engine |
| Binlog replication | CDC (`mo_cdc`) or Publish/Subscribe | Not binlog-compatible |
| `SAVEPOINT / ROLLBACK TO` | `DATA BRANCH CREATE / DIFF / MERGE` | Git-for-data workflow |
| `mysqldump` | `mo_dump` | Different tool, different format |
| `xtrabackup` | `mo_br` | Physical backup tool |
| `FLUSH PRIVILEGES` | _(not needed)_ | Privilege changes are immediate |
| `mysql.*` system DB | `mo_catalog` | Different system metadata tables |
| `information_schema.*` | `mo_catalog` or stubs | Most information_schema tables return empty |
| `PERFORMANCE_SCHEMA` | _(not available)_ | No equivalent |
| `CALL procedure()` | `CREATE FUNCTION ... LANGUAGE PYTHON AS` | UDFs instead of stored procedures |
| `MATCH ... AGAINST` | `CREATE FULLTEXT INDEX` (MO syntax) | Different fulltext search API |
| JSON functions (30+) | Only ~8 JSON functions | Use app-layer JSON processing |
| Spatial / GIS | _(not available)_ | No spatial type support |
| `mysql_config_editor` | _(not available)_ | — |
| `mysqlbinlog` | _(not available)_ | — |

## Core Principles for MO-Safe SQL

1. **Default to MO-skeptical, not MySQL-compatible.** If you don't know, don't guess MySQL — check.
2. **Read `differs_from_mysql` on every `[partial]` page you use.** Partial = has known differences.
3. **Prefer MO-native features for MO-only operations.** `CLUSTER BY` over partition tricks, `PITR`/`SNAPSHOT` over binlog, `DATA BRANCH` over savepoints.
4. **Test with `SHOW CREATE TABLE` after DDL.** MO emits its own DDL dialect that may differ from what you sent.
5. **System tables differ from MySQL.** Use `SHOW CREATE TABLE mo_catalog.*` to inspect, don't assume MySQL schema.
```

Expected: File created at `docs/superpowers/skills/matrixone-sql-guide/SKILL.md`.

- [ ] **Step 2: Verify SKILL.md frontmatter format**

Run:
```bash
head -4 docs/superpowers/skills/matrixone-sql-guide/SKILL.md
```

Expected output:
```
---
name: matrixone-sql-guide
description: Use when generating SQL statements for MatrixOne database, writing DDL/DML/DCL for MatrixOne...
---
```

- [ ] **Step 3: Count word count for token budget check**

Run:
```bash
wc -w docs/superpowers/skills/matrixone-sql-guide/SKILL.md
```

Expected: ~1500-1800 words. The skill is a reference type, so this is acceptable.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/skills/matrixone-sql-guide/SKILL.md
git commit -m "$(cat <<'EOF'
docs: add matrixone-sql-guide skill — AI-readable anti-MySQL pitfalls and navigation rules

Covers 48 high-frequency MySQL patterns that fail on MatrixOne, organized by
DDL/DML/DCL/Transactions/Functions/SHOW. Each entry shows the wrong MySQL
pattern, what happens on MO, and the correct MO alternative. Includes
documentation navigation rules and a MySQL→MO feature mapping table.
EOF
)"
```

---

### Task 4: Cross-reference the skill from llms.txt

**Files:**
- Modify: `docs/hooks/agent_delivery.py:146-155` (AGENT_ROUTING and AGENT_HINTS sections)

- [ ] **Step 1: Add skill reference to llms.txt header**

Edit `docs/hooks/agent_delivery.py`, find the section where URL bullet points are generated (around line 218-225), add a reference to the skill file after the existing bullets:

```python
# In the llms.txt generation section, after the existing bullets:
llms.append(f"- **AI SQL Writing Guide (skill)**: {base}/llms-sql-guide.txt")
llms.append(f"- **Per-page markdown mirror**: append `.md` to any doc URL under {base}/")
```

Then add the skill file copy logic in the `on_post_build` function (around line 244, before the write), to copy the SKILL.md to `site/llms-sql-guide.txt`:

```python
# After the llms-sql.txt generation, before llms-full.txt:
skill_src = docs_dir / "superpowers/skills/matrixone-sql-guide/SKILL.md"
if skill_src.exists():
    skill_text = skill_src.read_text(encoding="utf-8")
    # Strip frontmatter for plain-text delivery
    import re
    fm_re = re.compile(r"^---\n.*?\n---\s*\n", re.DOTALL)
    skill_clean = fm_re.sub("", skill_text).lstrip()
    (site_dir / "llms-sql-guide.txt").write_text(skill_clean, encoding="utf-8")
```

- [ ] **Step 2: Verify the change builds correctly**

Run:
```bash
python3 -c "
import sys; sys.path.insert(0, 'docs/hooks')
# Dry-run: verify the script parses without error
exec(open('docs/hooks/agent_delivery.py').read())
print('Script parses OK')
"
```

Or better, run a test build:
```bash
cd /Users/yanghaoyang/repo/matrixorigin.io && mkdocs build 2>&1 | tail -20
```

Expected: Build succeeds. Verify `site/llms-sql-guide.txt` exists and contains the skill content without frontmatter.

- [ ] **Step 3: Verify the generated file**

Run:
```bash
head -5 site/llms-sql-guide.txt
```

Expected: First line should be `# MatrixOne SQL Guide` (the H1 from SKILL.md, not the YAML frontmatter).

- [ ] **Step 4: Commit**

```bash
git add docs/hooks/agent_delivery.py
git commit -m "$(cat <<'EOF'
feat: expose matrixone-sql-guide skill as llms-sql-guide.txt for AI consumption

Copies SKILL.md (with frontmatter stripped) to site/llms-sql-guide.txt during
build, so AI agents can pull the skill directly without reading the full
llms.txt or llms-sql.txt.
EOF
)"
```

---

### Task 5: Install skill locally and validate

**Files:**
- Create: `~/.claude/skills/matrixone-sql-guide/SKILL.md` (symlink or copy)

- [ ] **Step 1: Create symlink to make skill available to Claude Code**

```bash
mkdir -p ~/.claude/skills/matrixone-sql-guide
ln -sf /Users/yanghaoyang/repo/matrixorigin.io/docs/superpowers/skills/matrixone-sql-guide/SKILL.md \
  ~/.claude/skills/matrixone-sql-guide/SKILL.md
```

- [ ] **Step 2: Verify skill is discoverable**

Run:
```bash
ls -la ~/.claude/skills/matrixone-sql-guide/SKILL.md
```

Expected: Symlink resolves to the repo file.

- [ ] **Step 3: Check skill file against agentskills.io spec**

Manual check:
```bash
# Frontmatter has required fields
grep -c "^name:" docs/superpowers/skills/matrixone-sql-guide/SKILL.md
grep -c "^description:" docs/superpowers/skills/matrixone-sql-guide/SKILL.md

# Description is under 1024 chars
sed -n '/^description:/s/^description: *//p' docs/superpowers/skills/matrixone-sql-guide/SKILL.md | wc -c

# Name uses only allowed characters
sed -n '/^name:/s/^name: *//p' docs/superpowers/skills/matrixone-sql-guide/SKILL.md
```

Expected: `1`, `1`, `<1024`, `matrixone-sql-guide`.

- [ ] **Step 4: Commit the installation (optional, for tracking)**

No commit needed — symlink is local-only setup.

---

### Task 6: End-to-end validation

- [ ] **Step 1: Verify all 48 pitfall entries have correct MySQL → MO mappings**

For each entry in the pitfalls table, cross-reference:
1. The MySQL syntax is real MySQL syntax (not fabricated)
2. The "What Happens" column matches the documented behavior in `differs_from_mysql` or unsupported features page
3. The "MatrixOne Correct" column gives a working MO alternative

Manual spot-check 10 entries:
- Entry 1 (ENGINE=InnoDB): → unsupported features page, "Storage engine selection is not supported"
- Entry 2 (ON DELETE CASCADE): → unsupported features page, "Foreign keys do not support ON CASCADE DELETE"
- Entry 3 (ALTER TABLE combining): → alter-table.md frontmatter, "cannot be combined with other clauses"
- Entry 5 (CHECK constraints): → unsupported features page, "CHECK constraints are not enforced"
- Entry 7 (MEDIUMINT): → unsupported features page, "MEDIUMINT integer type is not supported"
- Entry 19 (partition RANGE): → create-table.md frontmatter, "RANGE/LIST are syntax-only"
- Entry 25 (user@host): → create-user.md frontmatter, "bare username scoped to the current account"
- Entry 30 (SAVEPOINT): → unsupported features page, "Savepoints within transactions are not supported"
- Entry 34 (TRIGGER): → unsupported features page, "Triggers are not supported"
- Entry 38 (MATCH AGAINST): → unsupported features page, "MatrixOne full-text search uses different syntax"

If any mapping is incorrect, fix in SKILL.md and recommit.

- [ ] **Step 2: Verify no contradiction with existing documentation**

For each entry, check the corresponding source page or unsupported features list. If the skill says "ERROR" and the source says "INERT" (or vice versa), correct the skill.

- [ ] **Step 3: Run mkdocs build to verify no regressions**

```bash
cd /Users/yanghaoyang/repo/matrixorigin.io && mkdocs build 2>&1 | tail -5
```

Expected: Build completes without errors.

```
git add docs/superpowers/plans/2026-05-20-matrixone-sql-skill.md
git commit -m "docs: add matrixone-sql-guide skill implementation plan"
```

---

## Summary

| Task | What | Files |
|---|---|---|
| 1 | Gather source data | `/tmp/mo-*` (temp, not committed) |
| 2 | Prioritize pitfalls | (analysis, selection saved to temp note) |
| 3 | Write SKILL.md | `docs/superpowers/skills/matrixone-sql-guide/SKILL.md` (create) |
| 4 | Wire into llms.txt build | `docs/hooks/agent_delivery.py` (modify) |
| 5 | Install locally | `~/.claude/skills/matrixone-sql-guide/SKILL.md` (symlink) |
| 6 | Validate | Cross-reference, contradiction check, build check |
