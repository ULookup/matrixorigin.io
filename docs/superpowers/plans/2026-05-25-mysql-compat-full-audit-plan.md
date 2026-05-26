# MySQL Compatibility Full Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dispatch 5 parallel agents to scan all 133 SQL-Reference docs, test against Docker MO 3.0.12 + MySQL 8.0, fix frontmatter compatibility labels, and annotate body issues.

**Architecture:** Start Docker containers for MO 3.0.12 and MySQL 8.0, dispatch 5 agents in parallel (one-shot, no batching), wait for completion, regenerate matrix artifacts, commit.

**Tech Stack:** Docker (matrixorigin/matrixone:3.0.12, mysql:8.0), mysql client, bash, sub-agents

**Spec:** `docs/superpowers/specs/2026-05-25-mysql-compat-full-audit-design.md`

---

### Agent File Assignments

| Agent | Scope | Count |
|-------|-------|-------|
| A | DDL (CREATE/ALTER/DROP series) | 50 |
| B | DML + DCL | 27 |
| C | DQL (SELECT/JOIN/CTE/subqueries/set ops) | 24 |
| D | Other — SHOW statements (21) + EXPLAIN (4) | 25 |
| E | Other — Prepared (3) + describe/kill/use/set-role (4) + SQL-Type.md (1) | 8 |

Note: DDL has 50 files (more than the spec's ~38 estimate) because drop-*, create-*, alter-* each have many variants. Many DDL files are short (drop-* typically 1-2 pages). Agent-E is lightweight (8 files) and can assist with cross-review after finishing.

---

### Task 1: Start Docker containers

- [ ] **Step 1: Remove old containers**

```bash
docker rm -f mo-audit 2>/dev/null; docker rm -f mysql-audit 2>/dev/null; echo "Cleaned"
```

Expected: "Cleaned" (containers may not exist, that's fine)

- [ ] **Step 2: Pull MySQL 8.0 image**

```bash
docker pull mysql:8.0
```

- [ ] **Step 3: Start MO 3.0.12 container**

```bash
docker run -d --name mo-audit -p 6001:6001 matrixorigin/matrixone:3.0.12
```

- [ ] **Step 4: Start MySQL 8.0 container**

```bash
docker run -d --name mysql-audit -p 3306:3306 -e MYSQL_ROOT_PASSWORD=111 mysql:8.0
```

- [ ] **Step 5: Wait for MO healthy**

```bash
for i in $(seq 1 10); do mysql -h127.0.0.1 -P6001 -uroot -p111 -e 'SELECT 1 AS mo_ok' 2>/dev/null && echo "MO HEALTHY" && break; echo "MO retry $i/10..."; sleep 3; done
```

Expected: `mo_ok` + "MO HEALTHY"

- [ ] **Step 6: Wait for MySQL healthy**

```bash
for i in $(seq 1 15); do mysql -h127.0.0.1 -P3306 -uroot -p111 -e 'SELECT 1 AS mysql_ok' 2>/dev/null && echo "MYSQL HEALTHY" && break; echo "MySQL retry $i/15..."; sleep 3; done
```

Expected: `mysql_ok` + "MYSQL HEALTHY"

- [ ] **Step 7: Create output directory**

```bash
mkdir -p /Users/yanghaoyang/repo/matrixorigin.io/audit-reports
```

- [ ] **Step 8: Commit**

```bash
# No commit needed — just environment setup
```

---

### Task 2: Dispatch all 5 agents in parallel (background)

All agents share these common instructions:

```
CONNECTIONS:
- MO 3.0.12: mysql -h127.0.0.1 -P6001 -uroot -p111
- MySQL 8.0: mysql -h127.0.0.1 -P3306 -uroot -p111
- Create your own database: CREATE DATABASE IF NOT EXISTS audit_X; USE audit_X;
- Cleanup at end: DROP DATABASE IF EXISTS audit_X;

MANDATORY METHODOLOGY:
For EACH file, you MUST work in this order:

STEP 1 — CLASSIFICATION REVIEW (fast pass):
- Read the file's frontmatter (mysql_compat, differs_from_mysql, mo_only)
- For mysql_compat: full → test edge cases to verify it's truly FULL
- For mysql_compat: mo_only → check if MySQL 8.0 actually supports it (e.g., INTERSECT was added in 8.0.31)
- For mysql_compat: partial → check if differs_from_mysql list is EXHAUSTIVE (any missing differences?)
- For mysql_compat: none → verify MO truly doesn't support it

STEP 2 — CROSS-DATABASE TESTING (for each behavioral claim):
- Extract every claim from the body: syntax support, constraints, return types, edge cases
- Design minimal SQL test cases for each claim
- Run EACH test on BOTH MO and MySQL, compare results
- Record: SQL executed, MO output, MySQL output, match/fail

STEP 3 — FRONTMATTER FIX:
- If mysql_compat is wrong → Edit the file to correct it
- If differs_from_mysql is incomplete → Add missing entries in the format: "MO behavior differs from MySQL: ..."
- If mo_only is incorrect (exists in MySQL 8.0) → Remove from mo_only, reclassify

STEP 4 — BODY ANNOTATION:
- Do NOT rewrite body content
- For each inaccurate claim, insert an HTML comment marker near the claim:
  `<!-- audit: [severity] [issue description] -->`
- Severity levels: CRITICAL (wrong claim), HIGH (misleading), MEDIUM (incomplete), LOW (minor)

STEP 5 — REPORT:
Write your findings to audit-reports/agent-X-report.md at the repo root.

REPORT FORMAT:

# Agent-X Report: [Category]
Date: 2026-05-25
MO Version: 3.0.12 (Docker)
MySQL Version: 8.0 (Docker)

## Summary
- Files checked: N
- mysql_compat corrections: X
- differs_from_mysql additions: Y
- Body annotations: Z
- CRITICAL: C / HIGH: H / MEDIUM: M / LOW: L

## Corrections Made

### file-name.md
- mysql_compat: full → partial
- Added differs_from_mysql:
  - "[NEW] specific difference description"
- Body annotations:
  - [line ~N] <!-- audit: CRITICAL claim "fully compatible" — ENGINE clause silently ignored -->
- Test log:
  - `CREATE TABLE t(id INT) ENGINE=InnoDB` → MO: ok(ignored), MySQL: ok → MISMATCH
  - `SELECT 1` → MO: 1, MySQL: 1 → MATCH

## Files With Issues (sorted by severity)

### CRITICAL:
### file.md — one-line description

### HIGH:
### file.md — one-line description

... etc.
```

- [ ] **Step 1: Dispatch Agent-A (DDL, 50 files) in background**

Use Agent tool with `run_in_background: true`, `subagent_type: "general-purpose"`, `description: "Agent-A DDL audit"`.

```
You are Agent-A auditing DDL files for MySQL compatibility. Your task: read every file,
test every behavioral claim against BOTH MO 3.0.12 and MySQL 8.0, fix frontmatter,
annotate body issues, and produce a report.

CONNECTIONS:
- MO 3.0.12: mysql -h127.0.0.1 -P6001 -uroot -p111
- MySQL 8.0: mysql -h127.0.0.1 -P3306 -uroot -p111
- Your database: CREATE DATABASE IF NOT EXISTS audit_A; USE audit_A;
- Cleanup at end: DROP DATABASE IF EXISTS audit_A;

YOUR FILES (50 files — process full/mo_only first, then partial):

alter-pitr.md
alter-publication.md
alter-reindex.md
alter-sequence.md
alter-stage.md
alter-table.md
alter-view.md
branch-protect-snapshots.md
create-clone.md
create-cluster-table.md
create-database.md
create-dynamic-table.md
create-external-table.md
create-fulltext-index.md
create-function-python.md
create-function-sql.md
create-index.md
create-index-hnsw.md
create-index-ivfflat.md
create-pitr.md
create-publication.md
create-sequence.md
create-snapshot.md
create-source.md
create-stage.md
create-subscription.md
create-table.md
create-table-as-select.md
create-table-like.md
create-view.md
data-branch-create-en.md
data-branch-delete-en.md
data-branch-diff-en.md
data-branch-merge-en.md
data-branch-pick.md
drop-database.md
drop-function.md
drop-index.md
drop-pitr.md
drop-publication.md
drop-sequence.md
drop-snapshot.md
drop-stage.md
drop-table.md
drop-view.md
rename-table.md
restore-pitr.md
restore-snapshot.md
sql-task.md
truncate-table.md

All files are in: docs/MatrixOne/Reference/SQL-Reference/Data-Definition-Language/

MANDATORY METHODOLOGY — for EACH file:

STEP 1 — CLASSIFICATION REVIEW:
- Read frontmatter (mysql_compat, differs_from_mysql, mo_only)
- full: test edge cases (NULL handling, edge values, type coercion) to verify truly FULL
- mo_only: check if MySQL 8.0 actually supports it
- partial: check if differs_from_mysql list is EXHAUSTIVE — any missing differences?
- none: verify MO truly doesn't support the feature

STEP 2 — CROSS-DATABASE TESTING:
- Extract every behavioral claim from body text
- For each claim, design a minimal SQL test, run on BOTH MO and MySQL
- Compare results: MATCH (compatible) or MISMATCH (difference found)
- Record: SQL, MO output, MySQL output, verdict

STEP 3 — FRONTMATTER FIX:
- If mysql_compat is wrong → use Edit tool to correct it
- If differs_from_mysql is incomplete → use Edit tool to add missing entries:
  "MO behavior differs from MySQL 8.0: ..."
- If mo_only entry actually exists in MySQL → remove from mo_only array

STEP 4 — BODY ANNOTATION:
- Use Edit tool to insert comment markers near inaccurate claims:
  <!-- audit: CRITICAL|HIGH|MEDIUM|LOW — description -->
- Do NOT rewrite body content — only annotate

STEP 5 — REPORT:
Write audit-reports/agent-A-report.md (use Write tool, full path: /Users/yanghaoyang/repo/matrixorigin.io/audit-reports/agent-A-report.md)

REPORT STRUCTURE:
# Agent-A Report: DDL
Date: 2026-05-25
MO: 3.0.12 | MySQL: 8.0

## Summary: N files, X corrections, Y annotations

## Corrections Made (per file, with test evidence)

## Files With Issues (CRITICAL/HIGH/MEDIUM/LOW)

IMPORTANT:
- Test BOTH positive claims ("X works") AND negative claims ("X not supported")
- Edge cases are where hidden incompatibilities hide: NULL, empty strings, zero, large values, boundary conditions
- Many DDL files are short (drop-*). Don't skip them — they can have wrong mysql_compat labels.
- After finishing your report, read it back to verify completeness.
```

Expected: Agent-A starts in background.

- [ ] **Step 2: Dispatch Agent-B (DML + DCL, 27 files) in background**

Use Agent tool with `run_in_background: true`, `subagent_type: "general-purpose"`, `description: "Agent-B DML+DCL audit"`.

```
You are Agent-B auditing DML and DCL files for MySQL compatibility. Your task: read every file,
test every behavioral claim against BOTH MO 3.0.12 and MySQL 8.0, fix frontmatter,
annotate body issues, and produce a report.

CONNECTIONS:
- MO 3.0.12: mysql -h127.0.0.1 -P6001 -uroot -p111
- MySQL 8.0: mysql -h127.0.0.1 -P3306 -uroot -p111
- Your database: CREATE DATABASE IF NOT EXISTS audit_B; USE audit_B;
- Cleanup at end: DROP DATABASE IF EXISTS audit_B;

YOUR FILES (27 files — process full/mo_only first, then partial):

Data-Control-Language/ (11 files):
alter-account.md
alter-user.md
create-account.md
create-role.md
create-user.md
drop-account.md
drop-role.md
drop-user.md
grant.md
revoke.md
role-rule.md

Data-Manipulation-Language/ (16 files):
case.md
delete.md
insert.md
insert-into-select.md
load-data-infile.md
load-data-inline.md
replace.md
update.md
information-functions/current_role.md
information-functions/last-insert-id.md
information-functions/last-query-id.md
upsert/insert-ignore.md
upsert/insert-on-duplicate.md
upsert/replace.md
upsert/upsert.md

All files are in: docs/MatrixOne/Reference/SQL-Reference/

MANDATORY METHODOLOGY — for EACH file:

STEP 1 — CLASSIFICATION REVIEW:
- Read frontmatter (mysql_compat, differs_from_mysql, mo_only)
- full: test edge cases to verify truly FULL
- mo_only: check if MySQL 8.0 actually supports it
- partial: verify differs_from_mysql list is EXHAUSTIVE

STEP 2 — CROSS-DATABASE TESTING:
- Extract every behavioral claim from body text
- Design minimal SQL test for each claim, run on BOTH MO and MySQL
- Compare: MATCH or MISMATCH
- Record: SQL, MO output, MySQL output, verdict

STEP 3 — FRONTMATTER FIX:
- Use Edit tool to correct mysql_compat if wrong
- Use Edit tool to add missing differs_from_mysql entries
- Use Edit tool to remove incorrect mo_only entries

STEP 4 — BODY ANNOTATION:
- Use Edit tool to insert: <!-- audit: CRITICAL|HIGH|MEDIUM|LOW — description -->
- Do NOT rewrite body content

STEP 5 — REPORT:
Write audit-reports/agent-B-report.md at /Users/yanghaoyang/repo/matrixorigin.io/audit-reports/agent-B-report.md

REPORT STRUCTURE:
# Agent-B Report: DML + DCL
Date: 2026-05-25
MO: 3.0.12 | MySQL: 8.0

## Summary: N files, X corrections, Y annotations

## Corrections Made (per file, with test evidence)

## Files With Issues (CRITICAL/HIGH/MEDIUM/LOW)

IMPORTANT:
- DML files test actual data manipulation — create tables with test data first
- INSERT ON DUPLICATE KEY UPDATE: test both PK and UNIQUE index conflicts
- GRANT/REVOKE: test with actual users/roles you create
- LOAD DATA: test with actual files (use LOAD DATA INLINE if file access is limited)
- DCL files (ACCOUNT/USER/ROLE): MO has a different security model than MySQL — pay special attention
- Test negative claims: if doc says "X not supported", try to do X and verify it fails
```

Expected: Agent-B starts in background.

- [ ] **Step 3: Dispatch Agent-C (DQL, 23 files) in background**

Use Agent tool with `run_in_background: true`, `subagent_type: "general-purpose"`, `description: "Agent-C DQL audit"`.

```
You are Agent-C auditing DQL files for MySQL compatibility. Your task: read every file,
test every behavioral claim against BOTH MO 3.0.12 and MySQL 8.0, fix frontmatter,
annotate body issues, and produce a report.

CONNECTIONS:
- MO 3.0.12: mysql -h127.0.0.1 -P6001 -uroot -p111
- MySQL 8.0: mysql -h127.0.0.1 -P3306 -uroot -p111
- Your database: CREATE DATABASE IF NOT EXISTS audit_C; USE audit_C;
- Cleanup at end: DROP DATABASE IF EXISTS audit_C;

YOUR FILES (24 files — process full/mo_only first, then partial):

apply/cross-apply.md
apply/outer-apply.md
by-rank-with-option.md
intersect.md
minus.md
select.md
union.md
union-intersect-minus-overview.md
with-cte.md
join/cross-join.md
join/full-join.md
join/inner-join.md
join/join.md
join/left-join.md
join/natural-join.md
join/outer-join.md
join/right-join.md
subqueries/comparisons-using-subqueries.md
subqueries/derived-tables.md
subqueries/subquery.md
subqueries/subquery-with-all.md
subqueries/subquery-with-any-some.md
subqueries/subquery-with-exists.md
subqueries/subquery-with-in.md

All files are in: docs/MatrixOne/Reference/SQL-Reference/Data-Query-Language/

MANDATORY METHODOLOGY — for EACH file:

STEP 1 — CLASSIFICATION REVIEW:
- Read frontmatter (mysql_compat, differs_from_mysql, mo_only)
- full: test edge cases (NULL handling, empty result sets, type coercion)
- mo_only: check if MySQL 8.0 actually supports it — NOTE: INTERSECT was added in MySQL 8.0.31!
- partial: verify differs_from_mysql list is EXHAUSTIVE
- none: verify MO truly doesn't support (FULL JOIN is the only `none` currently)

STEP 2 — CROSS-DATABASE TESTING:
- Create test tables with sample data on BOTH databases before testing queries
- Extract every behavioral claim, design minimal SQL, run on BOTH MO and MySQL
- Compare: MATCH or MISMATCH
- Record: SQL, MO output, MySQL output, verdict

STEP 3 — FRONTMATTER FIX:
- Use Edit tool to correct mysql_compat, differs_from_mysql, mo_only

STEP 4 — BODY ANNOTATION:
- Use Edit tool to insert: <!-- audit: CRITICAL|HIGH|MEDIUM|LOW — description -->

STEP 5 — REPORT:
Write audit-reports/agent-C-report.md at /Users/yanghaoyang/repo/matrixorigin.io/audit-reports/agent-C-report.md

REPORT STRUCTURE:
# Agent-C Report: DQL
Date: 2026-05-25
MO: 3.0.12 | MySQL: 8.0

## Summary: N files, X corrections, Y annotations

## Corrections Made (per file, with test evidence)

## Files With Issues (CRITICAL/HIGH/MEDIUM/LOW)

IMPORTANT:
- SELECT is the largest and most complex file — spend extra time on it
- JOIN behavior (especially OUTER JOIN with NULL columns) often differs subtly
- CTE recursive member restrictions — test outer joins in recursive CTEs (MO may forbid them)
- Subquery correlation and scoping rules can differ
- INTERSECT exists in MySQL 8.0.31+ — check if files claim it's MO-only
```

Expected: Agent-C starts in background.

- [ ] **Step 4: Dispatch Agent-D (Other — SHOW + EXPLAIN, 25 files) in background**

Use Agent tool with `run_in_background: true`, `subagent_type: "general-purpose"`, `description: "Agent-D SHOW+EXPLAIN audit"`.

```
You are Agent-D auditing SHOW statements and EXPLAIN for MySQL compatibility. Your task:
read every file, test every behavioral claim against BOTH MO 3.0.12 and MySQL 8.0,
fix frontmatter, annotate body issues, and produce a report.

CONNECTIONS:
- MO 3.0.12: mysql -h127.0.0.1 -P6001 -uroot -p111
- MySQL 8.0: mysql -h127.0.0.1 -P3306 -uroot -p111
- Your database: CREATE DATABASE IF NOT EXISTS audit_D; USE audit_D;
- Cleanup at end: DROP DATABASE IF EXISTS audit_D;

YOUR FILES (25 files):

SHOW-Statements/ (21 files):
show-account.md
show-collation.md
show-columns.md
show-create-database.md
show-create-publication.md
show-create-table.md
show-create-view.md
show-databases.md
show-function-status.md
show-grants.md
show-index.md
show-pitrs.md
show-processlist.md
show-publications.md
show-roles.md
show-sequences.md
show-stage.md
show-subscriptions.md
show-table-status.md
show-tables.md
show-variables.md

Explain/ (4 files):
explain.md
explain-analyze.md
explain-prepared.md
explain-workflow.md

All files are in: docs/MatrixOne/Reference/SQL-Reference/Other/

MANDATORY METHODOLOGY — for EACH file:

STEP 1 — CLASSIFICATION REVIEW:
- Read frontmatter (mysql_compat, differs_from_mysql, mo_only)
- full: test edge cases to verify truly FULL
- mo_only: check if MySQL 8.0 actually supports it (many SHOW variants exist in MySQL)
- partial: verify differs_from_mysql list is EXHAUSTIVE — SHOW output columns and formats often differ

STEP 2 — CROSS-DATABASE TESTING:
- SHOW commands don't need explicit table setup — can run directly on both databases
- For SHOW output: compare column names, column count, output format
- For EXPLAIN: create test tables and run EXPLAIN on same queries on both DBs
- Compare: MATCH or MISMATCH
- Record: SQL, MO output (abbreviated), MySQL output (abbreviated), verdict

STEP 3 — FRONTMATTER FIX:
- Use Edit tool to correct mysql_compat, differs_from_mysql, mo_only

STEP 4 — BODY ANNOTATION:
- Use Edit tool to insert: <!-- audit: CRITICAL|HIGH|MEDIUM|LOW — description -->

STEP 5 — REPORT:
Write audit-reports/agent-D-report.md at /Users/yanghaoyang/repo/matrixorigin.io/audit-reports/agent-D-report.md

REPORT STRUCTURE:
# Agent-D Report: SHOW + EXPLAIN
Date: 2026-05-25
MO: 3.0.12 | MySQL: 8.0

## Summary: N files, X corrections, Y annotations

## Corrections Made (per file, with test evidence)

## Files With Issues (CRITICAL/HIGH/MEDIUM/LOW)

IMPORTANT:
- SHOW output is THE most common area for subtle MySQL incompatibilities (column names, ordering, extra fields)
- show-columns.md: MySQL supports FIELDS synonym and EXTENDED keyword — verify MO claims
- show-create-table.md: output format differences are very common
- show-variables.md: MO has different system variables than MySQL
- EXPLAIN output format differs significantly between MO and MySQL — this is expected
- Many SHOW files are currently marked mo_only — verify each against MySQL 8.0
```

Expected: Agent-D starts in background.

- [ ] **Step 5: Dispatch Agent-E (Other — Prepared + remaining, 8 files) in background**

Use Agent tool with `run_in_background: true`, `subagent_type: "general-purpose"`, `description: "Agent-E Other audit"`.

```
You are Agent-E auditing Prepared Statements and Other SQL files for MySQL compatibility.
Your task: read every file, test every behavioral claim against BOTH MO 3.0.12 and MySQL 8.0,
fix frontmatter, annotate body issues, and produce a report.

You have the lightest load (8 files). After finishing your audit, do a CROSS-REVIEW PASS:
scan the other agents' reports for patterns or issues they may have missed.

CONNECTIONS:
- MO 3.0.12: mysql -h127.0.0.1 -P6001 -uroot -p111
- MySQL 8.0: mysql -h127.0.0.1 -P3306 -uroot -p111
- Your database: CREATE DATABASE IF NOT EXISTS audit_E; USE audit_E;
- Cleanup at end: DROP DATABASE IF EXISTS audit_E;

YOUR FILES (8 files):

Prepared-Statements/ (3 files):
deallocate.md
execute.md
prepare.md

Other flat files (4 files):
describe.md
kill.md
use-database.md
Set/set-role.md

Root (1 file):
SQL-Type.md

All files are in: docs/MatrixOne/Reference/SQL-Reference/Other/ (except SQL-Type.md which is at docs/MatrixOne/Reference/SQL-Reference/SQL-Type.md)

MANDATORY METHODOLOGY — for EACH file:

STEP 1 — CLASSIFICATION REVIEW:
- Read frontmatter (mysql_compat, differs_from_mysql, mo_only)
- full: test edge cases to verify truly FULL
- mo_only: check if MySQL 8.0 actually supports it
- partial: verify differs_from_mysql list is EXHAUSTIVE

STEP 2 — CROSS-DATABASE TESTING:
- For PREPARE/EXECUTE/DEALLOCATE: create a prepared statement on both DBs, execute, compare
- For DESCRIBE: create a test table, run DESCRIBE on both, compare output format
- For KILL: test KILL CONNECTION syntax
- For USE: test database switching
- For SET ROLE: test with created roles
- For SQL-Type.md: review for accuracy of type mapping claims
- Compare: MATCH or MISMATCH
- Record: SQL, MO output, MySQL output, verdict

STEP 3 — FRONTMATTER FIX:
- Use Edit tool to correct mysql_compat, differs_from_mysql, mo_only

STEP 4 — BODY ANNOTATION:
- Use Edit tool to insert: <!-- audit: CRITICAL|HIGH|MEDIUM|LOW — description -->

STEP 5 — REPORT:
Write audit-reports/agent-E-report.md at /Users/yanghaoyang/repo/matrixorigin.io/audit-reports/agent-E-report.md

STEP 6 — CROSS-REVIEW (after your 8 files are done):
- Read audit-reports/agent-A-report.md, agent-B-report.md, agent-C-report.md, agent-D-report.md
- Look for: common patterns, inconsistent classifications between agents, missed edge cases
- If you find cross-agent issues, add a "Cross-Review Notes" section to your report

REPORT STRUCTURE:
# Agent-E Report: Prepared + Other SQL
Date: 2026-05-25
MO: 3.0.12 | MySQL: 8.0

## Summary: N files, X corrections, Y annotations

## Corrections Made (per file, with test evidence)

## Files With Issues (CRITICAL/HIGH/MEDIUM/LOW)

## Cross-Review Notes (if applicable)
```

Expected: Agent-E starts in background.

---

### Task 3: Wait for all agents to complete

- [ ] **Step 1: Check for completion**

Wait for background notifications from all 5 agents. If any agent is taking too long (>20 min), check progress by reading its partial report.

```bash
ls -la /Users/yanghaoyang/repo/matrixorigin.io/audit-reports/agent-*-report.md 2>/dev/null | wc -l
```

Expected: 5 reports.

- [ ] **Step 2: Verify reports are non-empty**

```bash
for f in /Users/yanghaoyang/repo/matrixorigin.io/audit-reports/agent-*-report.md; do echo "$f: $(wc -l < "$f") lines"; done
```

Expected: Each report has >50 lines.

---

### Task 4: Regenerate compatibility artifacts

- [ ] **Step 1: Run compat-matrix generator**

```bash
cd /Users/yanghaoyang/repo/matrixorigin.io && node scripts/generate-compat-matrix.js
```

Expected: Generates or updates `docs/MatrixOne/Reference/mysql-compatibility-matrix.md`

- [ ] **Step 2: Run unsupported-features generator**

```bash
cd /Users/yanghaoyang/repo/matrixorigin.io && node scripts/generate-unsupported-features.js
```

Expected: Generates or updates `docs/MatrixOne/Reference/mysql-unsupported-features.md`

- [ ] **Step 3: Check git diff for changed docs**

```bash
cd /Users/yanghaoyang/repo/matrixorigin.io && git diff --stat docs/MatrixOne/Reference/
```

Expected: List of changed files in SQL-Reference and compatibility matrix.

---

### Task 5: Stop Docker containers and commit

- [ ] **Step 1: Stop and remove containers**

```bash
docker rm -f mo-audit mysql-audit 2>/dev/null && echo "Containers removed"
```

- [ ] **Step 2: Commit all changes**

```bash
cd /Users/yanghaoyang/repo/matrixorigin.io && git add docs/MatrixOne/Reference/SQL-Reference/ docs/MatrixOne/Reference/mysql-compatibility-matrix.md docs/MatrixOne/Reference/mysql-unsupported-features.md audit-reports/ && git commit -m "$(cat <<'EOF'
docs: full MySQL compatibility audit — 5-agent parallel scan with live MO/MySQL testing

- 133 SQL-Reference files audited across 5 agents (DDL/DML+DCL/DQL/SHOW+EXPLAIN/Other)
- mysql_compat corrections, differs_from_mysql additions, body annotations
- Regenerated compatibility matrix and unsupported features list
EOF
)"
```

Expected: Clean commit with all audit changes.

- [ ] **Step 3: Show final stats**

```bash
cd /Users/yanghaoyang/repo/matrixorigin.io && echo "=== Commit ===" && git log -1 --oneline && echo "=== Files changed ===" && git diff --stat HEAD~1 HEAD && echo "=== Matrix stats ===" && head -15 docs/MatrixOne/Reference/mysql-compatibility-matrix.md
```

Expected: Summary of all changes.
