# MySQL Compat Reference Pages Needed

> 2026-05-20 — Verified against live MO 3.0.12 (Docker).

## New Reference Pages Needed

These statements are supported by MatrixOne but have no Reference page. Create a page for each.

| # | Statement | Compat Level | Notes |
|---|---|---|---|
| 1 | **DESCRIBE / DESC** | Partial | Parses and returns column info. Output format differs from MySQL (MO uses PostgreSQL-style output). DESC is shorthand. |
| 2 | **SHOW CREATE DATABASE** | Partial | Returns CREATE DATABASE statement for a given database. Output format may differ from MySQL. |
| 3 | **SHOW TABLE STATUS** | Partial | Returns table metadata rows. Result columns differ from MySQL — MO uses its own storage model. |

### Per-page template

```
File: docs/MatrixOne/Reference/SQL-Reference/Other/SHOW-Statements/show-create-database.md  (for SHOW variant)
File: docs/MatrixOne/Reference/SQL-Reference/Utility/describe.md  (for DESCRIBE)
```

Each page needs:
- `mysql_compat: partial` in frontmatter
- `differs_from_mysql` array listing specific differences
- Syntax section
- Examples section
- Entry added to `docs/MatrixOne/Reference/mysql-compatibility-matrix.md` (regenerated)

---

## CURATED Corrections Needed

### Remove from CURATED (incorrectly listed as unsupported)

| Statement | Reason |
|---|---|
| **SET NAMES** | Parses and executes successfully in MO 3.0.12. No-op because only utf8mb4 exists, but the statement IS supported. |
| **SET CHARACTER SET** | Same as above — parses and executes, just a no-op in practice. |

### Add to CURATED (confirmed unsupported)

| Statement | Reason |
|---|---|
| **SHOW CREATE USER** | Returns parser error in MO 3.0.12. |
| **SHOW CHARACTER SET** | Returns empty result set in MO 3.0.12. |
| **SHOW ENGINES** | Returns empty result set in MO 3.0.12. |

---

## File Changes Summary

```
Modify: scripts/generate-unsupported-features.js
  - Remove 2 entries: SET NAMES, SET CHARACTER SET
  - Add 3 entries: SHOW CREATE USER, SHOW CHARACTER SET, SHOW ENGINES

Create: docs/MatrixOne/Reference/SQL-Reference/Utility/describe.md
Create: docs/MatrixOne/Reference/SQL-Reference/Other/SHOW-Statements/show-create-database.md
Create: docs/MatrixOne/Reference/SQL-Reference/Other/SHOW-Statements/show-table-status.md

Regenerate: docs/MatrixOne/Reference/mysql-unsupported-features.md
Regenerate: docs/MatrixOne/Reference/mysql-compatibility-matrix.md  (if needed)
```
