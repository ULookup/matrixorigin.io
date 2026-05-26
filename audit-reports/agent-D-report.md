# Agent-D Report: SHOW + EXPLAIN
Date: 2026-05-25
MO: 3.0.12 (Docker) | MySQL: 8.0 (Docker)

## Summary
- Files checked: 25
- mysql_compat corrections: 0 (no classification changes needed; all mo_only/partial/full labels confirmed correct)
- differs_from_mysql additions: 14 files updated with expanded/refined entries
- Body annotations: 8 annotations inserted
- By severity: CRITICAL=1, HIGH=3, MEDIUM=2, LOW=2

## Corrections Made

### show-tables.md
- mysql_compat: partial (unchanged, but differs_from_mysql was wrong)
- Replaced differs_from_mysql: OLD `"FROM/IN clause semantics differ — MySQL uses FROM/IN to specify a database name, not a pattern"` -> NEW entries about column header naming differences
- Body annotation at: [~23] HIGH -- doc syntax incorrectly labels FROM/IN as taking 'pattern'; they take db_name, same as MySQL
- Test evidence:
  - `SHOW TABLES FROM 'audit%'` -> BOTH MO and MySQL: ERROR 1064. Both use FROM/IN for database names identically.

### show-variables.md
- Replaced differs_from_mysql: OLD claim "GLOBAL/SESSION scope for SHOW VARIABLES return identical results" -> NEW: they return DIFFERENT values after SET SESSION overrides (confirmed with autocommit test)
- Test evidence:
  - `SET SESSION autocommit=0; SHOW VARIABLES LIKE 'autocommit'` -> MO: off
  - `SHOW GLOBAL VARIABLES LIKE 'autocommit'` -> MO: on
  - Same behavior as MySQL. The old claim was FALSE.

### show-collation.md
- Expanded differs_from_mysql: added that MO 3.0.12 returns 11 collations (not 1), with Default and Pad_attribute columns
- Body annotation at: [~30] MEDIUM -- doc example shows 5 columns and only 1 row; actual MO 3.0.12 shows 7 columns with Default and Pad_attribute and 11 rows
- Test evidence:
  - MO: 7 cols (Collation, Charset, Id, Default, Compiled, Sortlen, Pad_attribute), 11 rows
  - MySQL: 7 cols (same names), 116 rows. MO shows fewer collations but output format is identical.

### show-columns.md
- Previously empty differs_from_mysql -> Added 4 entries documenting that MO includes Comment in non-FULL mode, accepts EXTENDED/FIELDS, Type column shows display width
- Body annotation at: [~20] HIGH -- doc says SHOW [FULL] {COLUMNS} but doesn't explain MO always includes Comment; omits SHOW EXTENDED COLUMNS and SHOW FIELDS synonym support
- Test evidence:
  - MO SHOW COLUMNS (no FULL): Field, Type, Null, Key, Default, Extra, Comment (7 cols, including Comment)
  - MySQL SHOW COLUMNS (no FULL): Field, Type, Null, Key, Default, Extra (6 cols, no Comment)
  - MO SHOW FULL COLUMNS: 9 cols (Field, Type, Collation, Null, Key, Default, Extra, Privileges, Comment) -- Collation is NULL
  - MySQL SHOW FULL COLUMNS: 9 cols, same names -- Collation has actual values
  - MO SHOW EXTENDED COLUMNS: 7 cols (same as non-FULL); MySQL SHOW EXTENDED COLUMNS: 5 cols + hidden DB_ROW_ID/DB_TRX_ID/DB_ROLL_PTR
  - MO SHOW FIELDS: 7 cols (synonym, works); MySQL SHOW FIELDS: 6 cols (synonym, works)

### show-create-table.md
- Expanded differs_from_mysql: added "MO output omits ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci appended by MySQL"
- Test evidence:
  - MO: `CREATE TABLE t1 (...) ` (plain, no ENGINE/CHARSET/COLLATE)
  - MySQL: `CREATE TABLE t1 (...) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`

### show-create-view.md
- Expanded differs_from_mysql: added 3 new entries for missing ALGORITHM clause, fully-qualified column references, and unquoted identifiers
- Test evidence:
  - MO: `CREATE SQL SECURITY DEFINER VIEW audit_D.v1 AS SELECT col1 FROM audit_D.t1`
  - MySQL: `CREATE ALGORITHM=UNDEFINED DEFINER=root@% SQL SECURITY DEFINER VIEW audit_D.v1 AS select audit_D.t1.col1 AS col1 from audit_D.t1`

### show-processlist.md
- Replaced differs_from_mysql with detailed column comparison (19 MO cols vs 8 MySQL cols, with all differences enumerated)
- Test evidence:
  - MO: 19 cols (node_id, conn_id, session_id, account, user, host, db, session_start, command, info, txn_id, statement_id, statement_type, query_type, sql_source_type, query_start, client_host, role, proxy_host)
  - MySQL: 8 cols (Id, User, Host, db, Command, Time, State, Info)
  - MO SHOW FULL PROCESSLIST: same 19 cols (FULL silently accepted, no behavioral change)

### show-index.md
- Expanded differs_from_mysql: corrected Index_comment claim (MySQL 8.0 also has it), added Expression column difference, specified 16 MO cols vs 15 MySQL cols
- Test evidence:
  - MO: 16 cols including Index_params extra; Expression shows column name for non-functional keys; Index_type empty
  - MySQL: 15 cols; Expression shows NULL for non-functional keys; Index_type = BTREE

### show-grants.md
- Expanded differs_from_mysql: added detail about completely different grant syntax format, added that MO does not support SHOW GRANTS FOR CURRENT_USER shorthand
- Test evidence:
  - MO: `GRANT create account ON account root@localhost`; MySQL: `GRANT SELECT, INSERT, ... ON *.* TO root@% WITH GRANT OPTION`
  - `SHOW GRANTS FOR CURRENT_USER` / `SHOW GRANTS FOR CURRENT_USER()` -> MO: ERROR 1064 (unsupported)

### show-function-status.md
- Expanded differs_from_mysql: added that MySQL shows built-in sys schema functions while MO only shows user-defined functions
- Test evidence:
  - MO: empty set (no UDFs in test DB)
  - MySQL: shows sys schema functions (extract_schema_from_file_name, format_bytes, etc.)

### show-table-status.md
- Expanded differs_from_mysql: added specific column differences (19 MO cols with Role_id/Role_name vs 18 MySQL cols with Version), added Auto_increment default difference, added views in output
- Test evidence:
  - MO: 19 cols including Role_id, Role_name; Auto_increment=0; Engine=Tae
  - MySQL: 18 cols including Version; Auto_increment=NULL; Engine=InnoDB

### explain.md
- Expanded differs_from_mysql: specified MySQL tabular columns, FINAL FORMAT=TEXT also unsupported, corrected that FORMAT=TEXT bare keyword errors
- CRITICAL body annotation at: [~27] doc claims "parenthesized option syntax is not yet supported" but EXPLAIN (ANALYZE TRUE/FALSE) and EXPLAIN (VERBOSE TRUE/FALSE) ALL WORK on MO 3.0.12. Only FORMAT parenthesized syntax is unsupported.
- Test evidence:
  - `EXPLAIN (ANALYZE TRUE) SELECT ...` -> WORKS (returns tree with Analyze sub-lines)
  - `EXPLAIN (ANALYZE FALSE) SELECT ...` -> WORKS (returns tree without Analyze)
  - `EXPLAIN (VERBOSE TRUE) SELECT ...` -> WORKS (returns cost estimates)
  - `EXPLAIN (VERBOSE FALSE) SELECT ...` -> WORKS (returns basic tree)
  - `EXPLAIN FORMAT=TEXT SELECT ...` -> ERROR 1064
  - `EXPLAIN (FORMAT=TEXT) SELECT ...` -> ERROR 1064
  - `EXPLAIN FORMAT=JSON SELECT ...` -> ERROR 1064

### explain-analyze.md
- Expanded differs_from_mysql: added detail about row-per-line vs single-row output format difference
- Test evidence:
  - MO: multiple output rows (one per plan tree line) with QUERY PLAN header
  - MySQL: single row with TREE-format plan

### explain-workflow.md
- Expanded differs_from_mysql: added that MO node types (Sink, PreInsert, Fuzzy Filter etc.) have no MySQL equivalents

### Other files (no changes needed, confirmed correct):
- show-account.md: mo_only -- MySQL: ERROR 1064 (no SHOW ACCOUNTS). Confirmed.
- show-create-publication.md: mo_only -- MySQL has no publications. Confirmed.
- show-pitrs.md: mo_only -- MySQL: ERROR 1064 (no SHOW PITR). Confirmed.
- show-publications.md: mo_only -- MySQL has no publications. Confirmed.
- show-roles.md: mo_only -- MySQL: ERROR 1064 (no SHOW ROLES). Confirmed.
- show-sequences.md: mo_only -- MySQL: ERROR 1064 (no SHOW SEQUENCES). Confirmed. Body annotation for typo `SHOW SQUENCES`.
- show-stage.md: mo_only -- MySQL: ERROR 1064 (no SHOW STAGES). Confirmed.
- show-subscriptions.md: mo_only -- MySQL: ERROR 1064 (no SHOW SUBSCRIPTIONS). Confirmed.
- explain-prepared.md: mo_only -- MySQL has no EXPLAIN FORCE EXECUTE. Confirmed.
- show-create-database.md: partial -- diff correctly documented. LOW annotation about lowercase output added.
- show-databases.md: full -- correct. LOW annotation about different system databases.

## All Issues (sorted by severity)

| File | Issue | Fix Applied |
|------|-------|-------------|
| explain.md | Doc claims parenthesized option syntax not supported, but EXPLAIN (ANALYZE TRUE/FALSE) and EXPLAIN (VERBOSE TRUE/FALSE) work on MO 3.0.12 | CRITICAL body annotation; updated differs_from_mysql |
| show-tables.md | differs_from_mysql claimed FROM/IN semantics differ, but BOTH MO and MySQL use FROM/IN for database names identically | Replaced differs_from_mysql; HIGH body annotation |
| show-columns.md | SHOW [FULL] {COLUMNS} syntax incomplete; MO always includes Comment without FULL; EXTENDED keyword and FIELDS synonym not documented | Added 4 differs_from_mysql entries; HIGH body annotation |
| show-variables.md | differs_from_mysql claimed GLOBAL/SESSION scope for SHOW VARIABLES return identical results -- they DO differ after SET SESSION | Replaced differs_from_mysql entry |
| show-collation.md | Doc example shows 5 columns and 1 row; MO 3.0.12 shows 7 columns and 11 rows | MEDIUM body annotation; updated differs_from_mysql |
| show-sequences.md | Syntax typo `SHOW SQUENCES` (missing H) | MEDIUM body annotation |
| show-create-database.md | MO lowercases database name in output; behavior not documented | LOW body annotation |
| show-databases.md | MO shows different system databases than MySQL | LOW body annotation |

## SHOW Output Format Summary

| SHOW Command | MO Cols | MySQL Cols | Verdict |
|-------------|---------|------------|---------|
| SHOW ACCOUNTS | 10 | N/A (mo_only) | mo_only |
| SHOW COLLATION | 7 | 7 | partial (fewer rows) |
| SHOW COLUMNS | 7 (no FULL) / 9 (FULL) | 6 (no FULL) / 9 (FULL) | partial (Comment in non-FULL) |
| SHOW CREATE DATABASE | 2 | 2 | partial (omits CHARSET/COLLATE/ENCRYPTION) |
| SHOW CREATE PUBLICATION | 2 | N/A | mo_only |
| SHOW CREATE TABLE | 2 | 2 | partial (omits ENGINE/CHARSET/COLLATE) |
| SHOW CREATE VIEW | 4 | 4 | partial (omits ALGORITHM/DEFINER/qualification) |
| SHOW DATABASES | 1 | 1 | full (different system DBs) |
| SHOW FUNCTION STATUS | 11 | 11 | partial (MO: UDF only; MySQL: all functions) |
| SHOW GRANTS | 1 | 1 | partial (completely different grant syntax) |
| SHOW INDEX | 16 | 15 | partial (Index_params extra; Expression diff; Index_type empty) |
| SHOW PITR | 10 | N/A | mo_only |
| SHOW PROCESSLIST | 19 | 8 | partial (completely different column set) |
| SHOW PUBLICATIONS | 9 | N/A | mo_only |
| SHOW ROLES | 4 | N/A | mo_only |
| SHOW SEQUENCES | 2 | N/A | mo_only |
| SHOW STAGES | 4 | N/A | mo_only |
| SHOW SUBSCRIPTIONS | 9 | N/A | mo_only |
| SHOW TABLE STATUS | 19 | 18 | partial (Role_id/Role_name vs Version; Engine=Tae vs InnoDB) |
| SHOW TABLES | 1 | 1 | partial (column header case/naming) |
| SHOW VARIABLES | 2 | 2 | partial (different variable sets) |

## EXPLAIN Output Format Summary

| Command | MO Format | MySQL Format | Verdict |
|---------|-----------|-------------|---------|
| EXPLAIN | Single QUERY PLAN column, tree output | Multi-column tabular (id, select_type, table, partitions, type, possible_keys, key, key_len, ref, rows, filtered, Extra) | partial |
| EXPLAIN ANALYZE | QUERY PLAN tree with Analyze sub-lines (timeConsumed, waitTime, inputRows, outputRows, etc.) | TREE format with cost/actual time | partial |
| EXPLAIN PREPARED | QUERY PLAN tree via FORCE EXECUTE | N/A (MySQL uses EXPLAIN FOR CONNECTION) | mo_only |
| EXPLAIN Workflow | QUERY PLAN tree with MO-specific node types | N/A | partial |
