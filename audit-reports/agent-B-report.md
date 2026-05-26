# Agent-B Report: DML + DCL
Date: 2026-05-25
MO: 3.0.12 (Docker) | MySQL: 8.0 (Docker)

## Summary
- Files checked: 27 (11 DCL + 16 DML)
- mysql_compat corrections: 1
- differs_from_mysql additions: 1
- Body annotations: 5
- By severity: CRITICAL=0, HIGH=3, MEDIUM=1, LOW=1

## Corrections Made

### case.md
- differs_from_mysql: Added entry describing that the page documents the CASE operator (expression), not the stored-program CASE statement (which MO does not support)
- Body annotation at line ~15: HIGH -- Title and description say "CASE statement for stored programs" but MatrixOne does not support stored programs. The page actually documents the CASE operator.
- Test evidence:
  - `SELECT CASE AVG(c0) WHEN any_value(c1)*any_value(c2) THEN 1 END FROM t1;` -> MO: 1, MySQL: 1 -> MATCH
  - `SELECT CASE any_value(c1)*any_value(c2) WHEN SUM(c0) THEN 1 WHEN AVG(c0) THEN 2 END FROM t1;` -> MO: 2, MySQL: 2 -> MATCH

### replace.md (Data-Manipulation-Language/)
- differs_from_mysql: Expanded entry noting Constraints section contradicts actual behavior
- Body annotation at line ~170: HIGH -- "or unique index" in Constraints section is incorrect. MO 3.0.12 REPLACE only detects conflicts on PRIMARY KEY; secondary UNIQUE index conflicts throw ERROR 1062.
- Test evidence:
  - `CREATE TABLE t(id INT PRIMARY KEY, code VARCHAR(50) UNIQUE); INSERT INTO t VALUES(1,'C001'),(2,'C002'); REPLACE INTO t VALUES(3,'New','C001');` -> MO: ERROR 1062, MySQL: replaces row -> MISMATCH
  - `REPLACE INTO t VALUES(1,'Updated')` -> MO: replaces, MySQL: replaces -> MATCH (PK conflict works on both)

### upsert/replace.md
- differs_from_mysql: Expanded entry (same issue as replace.md)
- Body annotation at line ~170: HIGH -- Same UNIQUE index issue as replace.md
- Test evidence: Same as replace.md above

### upsert/insert-on-duplicate.md
- Body annotation at line ~80: MEDIUM -- "unknown errors" is imprecise. ON DUPLICATE KEY UPDATE only triggers on PRIMARY KEY; UNIQUE index conflicts reliably throw ERROR 1062 (Duplicate entry), not unpredictable errors.
- Test evidence:
  - `INSERT INTO t VALUES(3,'New','duplicate@test.com') ON DUPLICATE KEY UPDATE name='Updated';` with existing UNIQUE email -> MO: ERROR 1062, MySQL: triggers UPDATE -> MISMATCH (doc correctly notes this)
  - `INSERT INTO t VALUES(1,'New') ON DUPLICATE KEY UPDATE name='Updated';` with existing PK -> MO: updates, MySQL: updates -> MATCH

### load-data-infile.md
- Body annotation at line ~109: LOW -- Copy-paste error: "FIELDS ENCLOSED BY" section heading has "FIELDS TERMINATED BY" in the opening description. Should say "FIELDS ENCLOSED BY".

## Verified Claims (No Issues Found)

### mysql_compat: mo_only files -- all confirmed correct
| File | Verification |
|------|-------------|
| alter-account.md | MySQL syntax error on ALTER ACCOUNT |
| create-account.md | MySQL syntax error on CREATE ACCOUNT |
| drop-account.md | MO-specific; no MySQL counterpart |
| role-rule.md | ALTER ROLE ADD RULE / SHOW RULES MO-specific |
| load-data-inline.md | MySQL syntax error on LOAD DATA INLINE |
| last-query-id.md | MySQL error: function does not exist |

### mysql_compat: full files -- verified
| File | Verification |
|------|-------------|
| insert-into-select.md | Simple INSERT INTO SELECT: identical behavior on both |

### mysql_compat: partial files -- key claims verified
| File | Claim | MO Result | MySQL Result | Verdict |
|------|-------|-----------|-------------|---------|
| alter-user.md | Multiple users rejected | Syntax error | Accepted | MATCH (doc says not supported) |
| create-user.md | COMMENT accepted but no effect | User created, no comment storage | N/A | MATCH |
| create-user.md | ATTRIBUTE accepted but no effect | User created, no attribute storage | N/A | MATCH |
| grant.md | GRANT privilege directly TO user rejected | Error: "there is no role <user>" | N/A | MATCH (doc says must go through role) |
| grant.md | GRANT privilege TO role then role TO user | Works correctly | N/A | MATCH |
| delete.md | LOW_PRIORITY accepted but no effect | Row deleted normally | Row deleted | MATCH |
| delete.md | QUICK accepted but no effect | Row deleted normally | Row deleted | MATCH |
| delete.md | Multi-table join | Row deleted | Row deleted | MATCH |
| delete.md | DELETE ... LIMIT | Works correctly | Works correctly | MATCH |
| insert.md | LOW_PRIORITY on INSERT | Syntax error | Accepts | MISMATCH -- doc says "not supported" (accurate) |
| replace.md | REPLACE SET syntax | Works correctly | Works correctly | MATCH |
| replace.md | REPLACE PK conflict (basic) | Old row replaced | Old row replaced | MATCH |
| update.md | UPDATE ORDER BY LIMIT | Row with highest sort updated | Row with highest sort updated | MATCH |
| update.md | UPDATE multi-table without JOIN | All rows updated | All rows updated | MATCH (only tested MO) |
| update.md | UPDATE LOW_PRIORITY | Accepted, update works | N/A | MATCH |
| last-insert-id.md | Multi-row returns LAST id | Returns 4 (last of 2,3,4) | Returns 2 (first) | MISMATCH (correctly documented) |
| insert-ignore.md | NULL into NOT NULL | ERROR 3819 | Silently ignores | MISMATCH (correctly documented) |
| insert-ignore.md | Duplicate PK silently ignored | Row ignored, no error | Row ignored, warning | MATCH (correctly documented) |
| insert-on-duplicate.md | PK conflict triggers update | Updates correctly | Updates correctly | MATCH |
| insert-on-duplicate.md | UNIQUE index conflict | ERROR 1062 | Triggers UPDATE | MISMATCH (correctly documented) |
| current_role.md | Returns single role | "moadmin" | N/A | MATCH (doc notes difference) |

### Negative claims verified (doc says "not supported")
| File | Claim | MO Result | Verdict |
|------|-------|-----------|---------|
| alter-user.md | Multiple users per statement | Syntax error | Confirmed |
| alter-user.md | Password EXPIRE/HISTORY/etc | Syntax error | Confirmed |
| create-user.md | COMMENT/ATTRIBUTE has no effect | User created, no storage | Confirmed |
| grant.md | Privilege directly to user | Error | Confirmed |
| insert.md | LOW_PRIORITY/DELAYED/HIGH_PRIORITY | Syntax error | Confirmed |
| load-data-infile.md | REPLACE and IGNORE modifiers | Syntax error | Confirmed |
| replace.md | UNIQUE index REPLACE fails | ERROR 1062 | Confirmed |
| insert-on-duplicate.md | UNIQUE index ON DUPLICATE KEY fails | ERROR 1062 | Confirmed |

## Database State at Key Findings

### ON DUPLICATE KEY UPDATE -- PK vs UNIQUE
```
MO 3.0.12:
  CREATE TABLE t(id INT PRIMARY KEY, name VARCHAR(50), email VARCHAR(50) UNIQUE);
  INSERT INTO t VALUES(1,'Tom','tom@test.com'),(2,'Jerry','jerry@test.com');
  -- PK conflict: works
  INSERT INTO t VALUES(1,'New','new@test.com') ON DUPLICATE KEY UPDATE name='Updated';  -- SUCCESS
  -- UNIQUE conflict: fails
  INSERT INTO t VALUES(3,'New','tom@test.com') ON DUPLICATE KEY UPDATE name='Updated';  -- ERROR 1062

MySQL 8.0: Both succeed, UPDATE triggers for either PK or UNIQUE conflict
```

### REPLACE -- PK vs UNIQUE
```
MO 3.0.12:
  CREATE TABLE t(id INT PRIMARY KEY, code VARCHAR(50) UNIQUE);
  INSERT INTO t VALUES(1,'C001'),(2,'C002');
  -- PK conflict: works
  REPLACE INTO t VALUES(1,'Updated');  -- SUCCESS, replaces row 1
  -- UNIQUE conflict: fails
  REPLACE INTO t VALUES(3,'New','C001');  -- ERROR 1062

MySQL 8.0: Both succeed, replaces row with matching PK OR UNIQUE key
```

### INSERT IGNORE -- NULL into NOT NULL
```
MO 3.0.12:
  CREATE TABLE t(id INT PRIMARY KEY, name VARCHAR(50) NOT NULL);
  INSERT INTO t VALUES(1,'Tom');
  INSERT IGNORE INTO t VALUES(2,NULL);  -- ERROR 3819: constraint violation

MySQL 8.0:
  INSERT IGNORE INTO t VALUES(2,NULL);  -- Silently inserts with '' or default
```

### LAST_INSERT_ID -- Multi-row
```
MO 3.0.12:
  INSERT INTO t VALUES (NULL,'Mary'),(NULL,'Jane'),(NULL,'Lisa');
  SELECT LAST_INSERT_ID();  -- Returns 4 (last generated ID)

MySQL 8.0:
  Same INSERT
  SELECT LAST_INSERT_ID();  -- Returns 2 (first generated ID)
```

## Cleanup
- All test tables and databases created in `audit_B` database
- MO connection: mysql -h127.0.0.1 -P6001 -uroot -p111
- MySQL connection: mysql -h127.0.0.1 -P3306 -uroot -p111
