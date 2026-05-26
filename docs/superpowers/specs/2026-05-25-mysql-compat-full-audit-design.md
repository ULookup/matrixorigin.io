# Full MySQL Compatibility Audit Design

**Date:** 2026-05-25
**Status:** Approved

## Goal

Scan all 133 SQL-Reference .md files with 5 parallel agents, verify MySQL 8.0 compatibility via live behavior testing (Docker), and fix frontmatter + mark body issues.

## Agent Split

5 agents split by directory, each tasked with both fast-path review (full/mo_only misclassifications) and deep review (partial completeness):

| Agent | Scope | Files |
|-------|-------|-------|
| A | DDL (CREATE/ALTER/DROP series) | ~38 |
| B | DML + DCL | ~26 |
| C | DQL (SELECT/JOIN/CTE/subqueries/set operations) | ~31 |
| D | Other — SHOW statements (20) + EXPLAIN/Prepared | ~27 |
| E | Other — describe/kill/use/set + SQL-Type.md | ~11 |

Agents A and C have heavier loads. Agent E finishes early and can assist with cross-review.

## Per-Agent Workflow

1. **Setup environment** — Pull MySQL 8.0 Docker image, start container
2. **Read docs** — Parse each .md frontmatter (`mysql_compat`, `differs_from_mysql`, `mo_only`) and body claims
3. **Prioritize** — Process `full` and `mo_only` first (find misclassifications), then deep-review `partial` for completeness
4. **Live test** — Execute each claimed behavior on both MO 3.0.12 and MySQL 8.0, compare results
5. **Output fix** — Correct frontmatter + annotate body issues with `<!-- audit: ... -->` markers

## Test Methodology

For each .md file:

1. **Extract claims** — SQL syntax, examples, and constraint/limitation statements from body
2. **Construct test cases** — For each claim, design a minimal SQL case, run on both MO and MySQL
3. **Classify compatibility**:

| Result | Classification |
|--------|----------------|
| Syntax & behavior identical | `full` |
| Syntax works, behavior differs | `partial` + record difference |
| MO does not support | `none` |
| MySQL does not have this feature | `mo_only` |

4. **Difference format** — Each `differs_from_mysql` entry one line: `"MO behavior description"`

### High-Risk Coverage

- `full` files: test edge cases (NULL handling, empty result sets, type coercion)
- `mo_only` files: verify against latest MySQL 8.0 (e.g., INTERSECT added in 8.0.31+)
- `partial` files: verify `differs_from_mysql` list is exhaustive, no missing differences

## Agent Output Format

Each agent produces `audit-reports/agent-{A-E}-report-{timestamp}.md`:

```markdown
# Agent-X Category Audit Report

## Stats
- Files checked: N
- mysql_compat corrected: X
- differs_from_mysql additions: Y
- Body issues flagged: Z

## Per-File Reports

### file-name.md
- **Current**: full
- **Corrected**: partial
- **Differences**:
  - "existing difference"
  - "[NEW] newly discovered difference"
- **Body issues**:
  - [line ~N] claim text ✱ (inaccurate)
  - [line ~M] claim text ✓ (verified correct)
- **Test log**:
  - SQL1 → MO: result, MySQL: result ✓/✱
```

### Body Annotation Standard

Do not edit body content directly. Use comment markers:

```
> **Compatibility claim**: "fully MySQL compatible". <!-- audit: partial — ENGINE clause ignored -->
```

```
!!! note
    This syntax currently does not support Unique keys.
    <!-- audit: add info — MySQL 8.0 detects duplicates on both PK and UNIQUE indexes -->
```

## Regeneration

After all agents finish, run:

- `scripts/generate-compat-matrix.js` — regenerate `mysql-compatibility-matrix.md`
- `scripts/generate-unsupported-features.js` — regenerate `mysql-unsupported-features.md`

## Deliverables

1. 5 agent audit reports in `audit-reports/`
2. Updated frontmatter across SQL-Reference .md files
3. Body annotations in source files (ready for manual follow-up)
4. Regenerated compatibility matrix and unsupported features list
