# MySQL Compat Frontmatter Review — Pages Needing Manual Review

> Generated 2026-05-20 from MySQL 8.0 gap analysis.
> 62 Partial-compat pages found. Review each and update `differs_from_mysql` frontmatter.

## Priority 1: Missing `differs_from_mysql` (empty frontmatter)

These pages are marked `mysql_compat: partial` in the matrix but have NO differences listed. Review each and add specific differences.

| # | File | Notes |
|---|---|---|
| 1 | `SQL-Reference/Data-Query-Language/select.md` | Matrix shows: SELECT...FOR UPDATE single-table only, SELECT INTO OUTFILE partial, DUAL requires db name. Verify these are in frontmatter. Also check: SQL_CALC_FOUND_ROWS, STRAIGHT_JOIN, SQL_BUFFER_RESULT, SQL_BIG_RESULT, SQL_SMALL_RESULT, HIGH_PRIORITY, PROCEDURE clause |
| 2 | `SQL-Reference/Data-Definition-Language/create-function-sql.md` | Matrix shows: Only LANGUAGE SQL/PYTHON supported, differs from MySQL stored functions. Verify frontmatter completeness. |
| 3 | `SQL-Reference/Data-Definition-Language/create-view.md` | Matrix shows: no WITH CHECK OPTION, no DEFINER, no ALGORITHM, SQL SECURITY supported. |
| 4 | `SQL-Reference/Data-Definition-Language/create-database.md` | Matrix shows: Chinese names unsupported, only utf8mb4/utf8mb4_bin, ENCRYPTION inert. |
| 5 | `SQL-Reference/Data-Definition-Language/alter-view.md` | Matrix shows: inherits CREATE VIEW limitations. |
| 6 | `SQL-Reference/Data-Definition-Language/create-index.md` | Matrix shows: secondary indexes syntax-only, FK no CASCADE, MO-specific USING IVFFLAT/HNSW/MASTER. |
| 7 | `SQL-Reference/Data-Definition-Language/alter-table.md` | Matrix shows: multiple ALTER clauses not combinable, temp/cluster tables not alterable, no PARTITION ops. Also check: ALGORITHM/LOCK clauses, DISCARD/IMPORT TABLESPACE, FORCE, RENAME INDEX, ALTER INDEX VISIBLE/INVISIBLE |
| 8 | `SQL-Reference/Data-Definition-Language/create-table.md` | Matrix shows: no ENGINE=, no spatial/SET/MEDIUMINT, BOOL is native, AUTO_INCREMENT semantics differ, PARTITION syntax partial, CLUSTER BY MO-only. Also check: CHECK constraints, GENERATED columns, TABLESPACE clause, ROW_FORMAT, KEY_BLOCK_SIZE |
| 9 | `SQL-Reference/Data-Definition-Language/drop-function.md` | Matrix shows: drops MO-style functions not MySQL stored routines. |
| 10 | `SQL-Reference/Data-Definition-Language/create-fulltext-index.md` | Matrix shows: different storage/paser semantics from MySQL. |
| 11 | `SQL-Reference/Data-Manipulation-Language/insert.md` | Matrix shows: LOW_PRIORITY/DELAYED/HIGH_PRIORITY not supported. |
| 12 | `SQL-Reference/Data-Manipulation-Language/load-data-infile.md` | Matrix shows: SET clause limited, JSONLines/S3 need MO-specific syntax. |
| 13 | `SQL-Reference/Data-Manipulation-Language/replace.md` | Matrix shows: no VALUES row_constructor_list, parser rejects WHERE. |
| 14 | `SQL-Reference/Data-Manipulation-Language/delete.md` | Matrix shows: LOW_PRIORITY/QUICK/IGNORE not supported. |
| 15 | `SQL-Reference/Data-Manipulation-Language/update.md` | Matrix shows: LOW_PRIORITY/IGNORE not supported. |
| 16 | `SQL-Reference/Data-Control-Language/revoke.md` | Matrix shows: recovery logic differs, user identifier format differs. |
| 17 | `SQL-Reference/Data-Control-Language/grant.md` | Matrix shows: authorization logic differs, user identifier format differs. |
| 18 | `SQL-Reference/Data-Control-Language/create-role.md` | Matrix shows: roles are account-scoped, not server-global. |
| 19 | `SQL-Reference/Data-Control-Language/drop-role.md` | Matrix shows: same account-scoping difference as create-role. |
| 20 | `SQL-Reference/Data-Control-Language/create-user.md` | Matrix shows: only IDENTIFIED BY, no IP whitelist/connection limits, COMMENT/ATTRIBUTE inert, bare username vs 'user'@'host'. |
| 21 | `SQL-Reference/Data-Control-Language/drop-user.md` | Matrix shows: bare username scoped to account vs MySQL 'user'@'host'. |
| 22 | `SQL-Reference/Data-Control-Language/alter-user.md` | Matrix shows: only password changes, account-limit clauses not honoured. Also check: account lock/unlock, password expire, DEFAULT ROLE via ALTER USER, COMMENT/ATTRIBUTE |
| 23 | `SQL-Reference/Other/Explain/explain.md` | Matrix shows: PostgreSQL-style output, no JSON output. |
| 24 | `SQL-Reference/Other/Explain/explain-analyze.md` | Matrix shows: PostgreSQL-style output, no JSON output. |
| 25 | `SQL-Reference/Other/Explain/explain-workflow.md` | Matrix shows: PostgreSQL-style output, no JSON output. |
| 26 | `SQL-Reference/Other/SHOW-Statements/show-function-status.md` | Matrix shows: lists MO functions not MySQL stored routines. |
| 27 | `SQL-Reference/Other/SHOW-Statements/show-variables.md` | Matrix shows: mostly syntax stubs, actual behaviour differs. |
| 28 | `SQL-Reference/Other/SHOW-Statements/show-grants.md` | Matrix shows: results reflect MO role/account graph, differ significantly. |
| 29 | `SQL-Reference/Other/SHOW-Statements/show-index.md` | Matrix shows: reflects MO index model, secondary indexes may not accelerate. |
| 30 | `SQL-Reference/Other/SHOW-Statements/show-collation.md` | Matrix shows: only utf8mb4_bin effective, others inert. |
| 31 | `SQL-Reference/Other/SHOW-Statements/show-create-view.md` | Matrix shows: DEFINER absent, SQL SECURITY emitted. |
| 32 | `SQL-Reference/Other/SHOW-Statements/show-tables.md` | Matrix shows: result column named 'name' not 'Tables_in_<db>'. |
| 33 | `SQL-Reference/Other/SHOW-Statements/show-processlist.md` | Matrix shows: output differs significantly from MySQL. |
| 34 | `SQL-Reference/Other/SHOW-Statements/show-create-table.md` | Matrix shows: output reflects MO-specific extensions. |
| 35 | `SQL-Reference/Other/Prepared-Statements/prepare.md` | Matrix shows: cannot PREPARE SET statements. |
| 36 | `SQL-Reference/Other/Set/set-role.md` | Matrix shows: single role only (vs MySQL NONE/DEFAULT/ALL/ALL EXCEPT). Also MO-specific SET SECONDARY ROLE. |
| 37 | `SQL-Reference/Data-Query-Language/subqueries/subquery.md` | Matrix shows: multi-level correlated IN subqueries not supported. |
| 38 | `SQL-Reference/Data-Query-Language/subqueries/subquery-with-in.md` | Matrix shows: same as subquery.md. |
| 39 | `SQL-Reference/Data-Query-Language/join/outer-join.md` | Matrix shows: overview page includes FULL OUTER JOIN (not in MySQL). |
| 40 | `SQL-Reference/Data-Manipulation-Language/upsert/replace.md` | Matrix shows: same as replace.md (dup page). |
| 41 | `SQL-Reference/Data-Manipulation-Language/upsert/insert-ignore.md` | Matrix shows: various differences from MySQL INSERT IGNORE behaviour. |
| 42 | `SQL-Reference/Data-Manipulation-Language/information-functions/current_role.md` | Matrix shows: single role vs MySQL's comma-separated list. |
| 43 | `SQL-Reference/Data-Manipulation-Language/information-functions/last-insert-id.md` | Matrix shows: multi-row INSERT returns last vs MySQL's first. |

## Priority 2: Function pages with existing differs

These function pages have `differs_from_mysql` set. Review for accuracy but lower priority.

| # | File | Current Diff |
|---|---|---|
| 44 | `Functions-and-Operators/Datetime/date-add.md` | Review |
| 45 | `Functions-and-Operators/Datetime/extract.md` | Review |
| 46 | `Functions-and-Operators/Datetime/date.md` | Review |
| 47 | `Functions-and-Operators/Datetime/timestamp.md` | Review |
| 48 | `Functions-and-Operators/Datetime/year.md` | Review |
| 49 | `Functions-and-Operators/Datetime/dayofyear.md` | Review |
| 50 | `Functions-and-Operators/Datetime/curdate.md` | Review |
| 51 | `Functions-and-Operators/Datetime/to-days.md` | Review |
| 52 | `Functions-and-Operators/Datetime/date-sub.md` | Review |
| 53 | `Functions-and-Operators/Datetime/date-format.md` | Review |
| 54 | `Functions-and-Operators/Datetime/from-unixtime.md` | Review |
| 55 | `Functions-and-Operators/Datetime/to-seconds.md` | Review |
| 56 | `Functions-and-Operators/Datetime/unix-timestamp.md` | Review |
| 57 | `Functions-and-Operators/system-ops/current_user.md` | Review |
| 58 | `Functions-and-Operators/system-ops/current_role.md` | Review |
| 59 | `Functions-and-Operators/String/aes_decrypt.md` | Review |
| 60 | `Functions-and-Operators/String/aes_encrypt.md` | Review |

## Priority 3: Data type pages

| # | File | Current Diff |
|---|---|---|
| 61 | `Data-Types/enum-type.md` | ENUM values can only be compared with strings in WHERE, filtering/sorting not supported |
| 62 | `Data-Types/set-type.md` | ALTER MODIFY shrink member list is rejected |

## Uncertain Items (need live MO verification)

These MySQL statements may or may not be supported by MO.
Verify against a running MO instance, then:
- Supported → create Reference page, add to compat matrix
- Unsupported → add to CURATED list in `scripts/generate-unsupported-features.js`

| # | Statement | Action |
|---|---|---|
| 1 | DESCRIBE / DESC | Verify support and output format |
| 2 | SHOW CREATE DATABASE | Verify support |
| 3 | SHOW CREATE USER | Verify support |
| 4 | SHOW CHARACTER SET / CHARSET | Verify support and result set |
| 5 | SHOW ENGINES / STORAGE ENGINES | Verify support |
| 6 | SHOW TABLE STATUS | Verify support and result columns |
| 7 | SET CHARACTER SET | Verify support and effective charsets |
| 8 | SET NAMES | Verify support and effective charsets |
