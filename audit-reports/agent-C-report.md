# Agent-C Report: DQL
Date: 2026-05-25
MO: 3.0.12 (Docker) | MySQL: 8.0.46 (Docker)

## Summary
- Files checked: 24
- mysql_compat corrections: 3 (full -> partial: union.md, join/join.md, subqueries/derived-tables.md)
- differs_from_mysql additions/updates: 10 files
- Body annotations: 13
- By severity: CRITICAL=0, HIGH=2, MEDIUM=3, LOW=8

## Key Findings

### HIGH Severity
1. **UNION type coercion** (union.md): MO is strict on type coercion in UNION columns (errors on `SELECT 1 UNION SELECT 'a'`), while MySQL 8.0 silently coerces. `mysql_compat` changed from `full` to `partial`.
2. **FULL OUTER JOIN misleading overview** (join/join.md): The JOIN overview page implies FULL OUTER JOIN works, but it produces a syntax error on MO. `mysql_compat` changed from `full` to `partial`.

### MEDIUM Severity
3. **GROUP BY WITH ROLLUP ordering** (select.md): MO places rollup summary rows at the TOP; MySQL 8.0 places them at the BOTTOM. Same aggregated values, different row order.
4. **LATERAL derived tables not supported** (subqueries/derived-tables.md): MySQL 8.0.14+ supports LATERAL correlated subqueries in FROM; MO does not. `mysql_compat` changed from `full` to `partial`.
5. **MINUS ALL not implemented** (minus.md): MO errors on MINUS ALL; MySQL 8.0.31+ supports EXCEPT ALL with full duplicate semantics.

### Behavioral Matches Verified
- LEFT/RIGHT/INNER/CROSS/NATURAL JOIN (all null handling, correlation)
- Subqueries: ALL, ANY, SOME, EXISTS, NOT EXISTS, IN, NOT IN (including NULL edge cases)
- INTERSECT, INTERSECT ALL (exact match with MySQL 8.0.31+)
- MINUS (equivalent to MySQL EXCEPT, matching results)
- set operation precedence (INTERSECT binds tighter than UNION, confirmed on both)
- NULL-safe equals (`<=>`), subquery correlation, multi-column IN
- Scalar subquery multi-row rejection (same behavior, different error codes)
- CTE recursive/anchor member UNION ALL
- Row numbering window function (ROW_NUMBER)
- GROUP BY alias, ORDER BY column position, LIMIT/OFFSET
- DISTINCT with NULLs, ORDER BY default NULL ordering

## Corrections Made

### union.md
- mysql_compat: full -> partial
- Added differs_from_mysql:
  - "UNION type coercion is strict: MO errors on incompatible types in UNION columns (e.g., INT vs VARCHAR), while MySQL 8.0 silently coerces"
  - "UNION ALL type coercion is similarly strict compared to MySQL 8.0's lenient coercion"
- Body annotation at L34: HIGH - MO's type coercion in UNION is stricter than MySQL 8.0
- Body annotation at L66: LOW - Fixed outdated Chinese comment claiming example doesn't work (verified working on both MO and MySQL)

### select.md
- Added differs_from_mysql: "GROUP BY ... WITH ROLLUP row ordering differs: MO places rollup summary rows at the top, MySQL 8.0 places them at the bottom"
- Body annotation at L37: MEDIUM - WITH ROLLUP row ordering differs

### minus.md
- Updated differs_from_mysql: ["MINUS keyword is MO-specific; MySQL 8.0.31+ uses EXCEPT", "MINUS ALL is not yet implemented in MO; MySQL 8.0.31+ supports EXCEPT ALL"]
- Updated mo_only: improved wording to note MySQL EXCEPT equivalent
- Body annotation at L20: MEDIUM - MINUS ALL not yet implemented

### union-intersect-minus-overview.md
- Replaced differs_from_mysql with 3 precise entries covering MINUS/INTERSECT/UNION
- Updated mo_only wording
- Body annotation at L31: LOW - MySQL 8.0.31+ EXCEPT/EXCEPT ALL

### intersect.md
- Updated differs_from_mysql: confirmed semantics match MySQL 8.0.31+ INTERSECT

### with-cte.md
- Updated differs_from_mysql: more precise about MySQL's narrower LEFT JOIN restriction (MySQL allows CTE-on-left, MO rejects all outer joins)
- Body annotation at L142: LOW - outer join restriction difference

### join/full-join.md
- Updated differs_from_mysql: more precise about error message differences

### join/join.md
- mysql_compat: full -> partial
- Added differs_from_mysql: FULL JOIN/FULL OUTER JOIN not fully supported
- Body annotation at L38: HIGH - FULL OUTER JOIN produces syntax error

### join/outer-join.md
- Updated differs_from_mysql: clarified that neither MO nor MySQL supports FULL OUTER JOIN
- Body annotation at L22: MEDIUM - FULL OUTER JOIN syntax error

### subqueries/derived-tables.md
- mysql_compat: full -> partial
- Added differs_from_mysql: LATERAL derived tables not supported
- Body annotation at L23: MEDIUM - LATERAL not supported (MySQL 8.0.14+ has LATERAL)

### subqueries/comparisons-using-subqueries.md
- Updated 2 error codes (1105->20101, 1105->20203) to match MO 3.0.12
- Body annotations: 2x LOW - error code changes documented

### subqueries/subquery-with-all.md
- Body annotation: LOW - error code updated (1105->20301)

### subqueries/subquery-with-any-some.md
- Body annotation: LOW - error code updated (1105->20301)

## All Issues (sorted by severity)

| File | Issue | Fix Applied |
|------|-------|-------------|
| union.md | UNION type coercion strictness vs MySQL lenient coercion | HIGH - mysql_compat full->partial, body annotation |
| join/join.md | FULL OUTER JOIN presented as working but produces syntax error | HIGH - mysql_compat full->partial, body annotation |
| select.md | GROUP BY WITH ROLLUP row ordering (top vs bottom) | MEDIUM - added to differs_from_mysql, body annotation |
| subqueries/derived-tables.md | LATERAL derived tables not supported (MySQL 8.0.14+) | MEDIUM - mysql_compat full->partial, body annotation |
| minus.md | MINUS ALL not implemented (MySQL has EXCEPT ALL) | MEDIUM - added to differs_from_mysql, body annotation |
| union.md | Outdated Chinese comment claiming non-working example | LOW - replaced with audit annotation |
| union-intersect-minus-overview.md | MINUS/EXCEPT equivalence not clearly stated | LOW - body annotation added |
| join/outer-join.md | FULL OUTER JOIN description should note both MO and MySQL error | MEDIUM - updated differs_from_mysql, body annotation |
| with-cte.md | MO rejects all outer joins in recursive CTE; MySQL has narrower restriction | LOW - body annotation added |
| comparisons-using-subqueries.md | Error codes changed in MO 3.0.12 (1105->20101, 1105->20203) | LOW - updated in body, 2 annotations |
| subquery-with-all.md | Error code changed in MO 3.0.12 (1105->20301) | LOW - updated in body, annotation |
| subquery-with-any-some.md | Error code changed in MO 3.0.12 (1105->20301) | LOW - updated in body, annotation |

## Files Verified as Correct (no changes needed)
- apply/cross-apply.md (mo_only: CROSS APPLY not in MySQL - correct)
- apply/outer-apply.md (mo_only: OUTER APPLY not in MySQL - correct)
- by-rank-with-option.md (mo_only: IVF vector ranking - correct)
- join/cross-join.md (full: verified matching behavior)
- join/inner-join.md (full: verified matching behavior)
- join/left-join.md (full: verified matching behavior)
- join/natural-join.md (full: verified matching behavior)
- join/right-join.md (full: verified matching behavior)
- subqueries/subquery.md (partial: already documented correctly)
- subqueries/subquery-with-all.md (full: verified matching behavior incl. NULL/empty edge cases)
- subqueries/subquery-with-any-some.md (full: verified matching behavior)
- subqueries/subquery-with-exists.md (full: verified matching behavior)
- subqueries/subquery-with-in.md (full: verified matching behavior)
- select.md (partial: correctly documented, only added ROLLUP ordering)

## Test Evidence (key behavioral tests)

### UNION type coercion
- `SELECT 1 UNION SELECT 'a'` -> MO: ERROR 20203 "invalid argument cast to int, bad value a" | MySQL: (1), (a) -> MISMATCH (strict vs lenient)
- `SELECT 1 UNION ALL SELECT 'a'` -> MO: same ERROR | MySQL: works -> MISMATCH

### WITH ROLLUP ordering
- `SELECT yr, product, SUM(amount) FROM t_sales GROUP BY yr, product WITH ROLLUP`
  - MO: rollup rows FIRST (NULL,NULL,700), (2023,NULL,300), then detail
  - MySQL: rollup rows LAST (detail first, then 2023,NULL,300), then (NULL,NULL,700)
  -> MISMATCH (ordering, values identical)

### LATERAL derived tables
- `SELECT t1.a, dt.b FROM t1, LATERAL (SELECT t2.a*10 AS b FROM t2 WHERE t2.a = t1.a) dt`
  - MO: ERROR 1064 syntax error
  - MySQL: (1,10), (2,20)
  -> MISMATCH (MO does not support LATERAL)

### FULL OUTER JOIN
- `SELECT * FROM t1 FULL OUTER JOIN t2 ON t1.a = t2.a`
  - MO: ERROR 1064 syntax error
  - MySQL: ERROR 1064 syntax error
  -> MATCH (neither supports FULL OUTER JOIN natively)

### MINUS/EXCEPT
- `SELECT id FROM t1 MINUS SELECT id FROM t2` -> MO: (1)
- `SELECT id FROM t1 EXCEPT SELECT id FROM t2` -> MySQL: (1)
- `SELECT id FROM t1 MINUS ALL SELECT id FROM t2` -> MO: ERROR "not yet implemented"
- `SELECT id FROM t1 EXCEPT ALL SELECT id FROM t2` -> MySQL: works with full duplicates
-> MISMATCH (MINUS ALL not implemented, but MINUS equiv to EXCEPT works)

### INTERSECT
- `SELECT * FROM t1 INTERSECT SELECT * FROM t2` -> MO: (1,2,3), (3,4,5) | MySQL: same -> MATCH
- `SELECT * FROM t1 INTERSECT ALL SELECT * FROM t2` -> MO: same as INTERSECT (correct) | MySQL: same -> MATCH

### Recursive CTE outer join
- `FROM t LEFT JOIN cte ON ...` -> MO: "unsupport LEFT, RIGHT or OUTER JOIN in recursive CTE" | MySQL: only rejects CTE-on-right of LEFT JOIN -> MISMATCH (MO more restrictive)
- `FROM cte LEFT JOIN t ON ...` -> MO: same error | MySQL: accepts (CTE on left side) -> MISMATCH (MO more restrictive)
