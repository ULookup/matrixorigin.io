# DATA BRANCH PICK

## Description

The `DATA BRANCH PICK` statement cherry-picks a selected subset of changes from a source table into a destination table. Rows to pick are addressed either by primary-key values (`KEYS(...)`) or by a time range of snapshots (`BETWEEN SNAPSHOT ... AND ...`).

`PICK` reuses the data-branch diff engine internally: it produces the same `INSERT` / `DELETE` / `UPDATE` change set that `DATA BRANCH DIFF` would produce between the two tables, then filters that change set to the requested keys (or snapshot window) and applies the remaining changes to the destination table.

## Syntax

```
DATA BRANCH PICK source_table [{ SNAPSHOT = 'snapshot_name' }]
    INTO dest_table
    [ BETWEEN SNAPSHOT from_name AND to_name ]
    [ KEYS ( key_list ) ]
    [ WHEN CONFLICT { FAIL | SKIP | ACCEPT } ]
```

`key_list` is either a list of primary-key literals (for example, `1, 2, 3` or `(1,'alice'), (2,'bob')` for a composite primary key) or a `SELECT` subquery that returns the primary-key columns.

`from_name` and `to_name` can be either identifiers or quoted string literals naming snapshots already created in the account.

## Arguments

| Parameter | Description |
|-----------|-------------|
| `source_table` | The table to cherry-pick rows from. May be qualified with a database name. An optional `{ SNAPSHOT = 'name' }` attribute freezes the source-side view of the table to a snapshot. |
| `dest_table` | The table the picked rows are written to. No snapshot attribute is accepted here. |
| `BETWEEN SNAPSHOT from_name AND to_name` | Restricts the set of rows to pick to the changes that appear between the two snapshots of `source_table`. |
| `KEYS ( key_list )` | Restricts the set of rows to pick to those whose primary key is in `key_list`. For a composite primary key each key is a parenthesised tuple. A `SELECT` subquery that returns the primary-key columns is also accepted. |
| `WHEN CONFLICT FAIL` | Default. If a key in the destination has been modified or deleted locally in a way that conflicts with the picked change, the statement returns an error and the destination is unchanged. |
| `WHEN CONFLICT SKIP` | Skip conflicting keys silently. Non-conflicting picked keys are still applied. |
| `WHEN CONFLICT ACCEPT` | Overwrite the destination with the source value for conflicting keys (source wins). |

At least one of `BETWEEN SNAPSHOT ...` or `KEYS(...)` must be supplied; both may be combined.

## Usage Notes

- `DATA BRANCH PICK` is not supported inside an explicit transaction (`BEGIN ... COMMIT`). Running it inside one returns `DATA BRANCH PICK is not supported in explicit transactions`.
- At least one of `KEYS(...)` or `BETWEEN SNAPSHOT ... AND ...` must be supplied. Running `DATA BRANCH PICK` without either returns `DATA BRANCH PICK requires a KEYS or BETWEEN SNAPSHOT clause`.
- A source-side `{ SNAPSHOT = 'name' }` and a `BETWEEN SNAPSHOT ... AND ...` clause cannot be combined. Trying to use both returns `BETWEEN SNAPSHOT and source table snapshot option cannot be used together`.
- The destination table does not accept a snapshot attribute. Writing `dest_table { SNAPSHOT = 'name' }` returns `destination snapshot option is not supported for DATA BRANCH PICK`.
- Both source and destination are authenticated. The caller needs read privilege on `source_table` and modify privilege on `dest_table`.
- The primary-key filter applies to the change set computed against the Lowest Common Ancestor (LCA) of the two tables, just like `DATA BRANCH DIFF`. Keys that are not present in the change set (for example, a key that exists in the destination but not in the source) are a no-op.
- Composite primary keys and `DECIMAL` primary keys are supported in both the literal list form and the subquery form of `KEYS(...)`.
- When the source-side snapshot is fixed with `{ SNAPSHOT = 'name' }`, changes made to `source_table` after the snapshot are not picked.

### Conflict semantics

A "conflict" for `DATA BRANCH PICK` is a key where the destination has been modified or deleted locally after the LCA and the source change for the same key is therefore not a pure fast-forward:

- `FAIL` aborts the pick and leaves the destination unchanged.
- `SKIP` drops the conflicting keys from the pick set; other picked keys are still applied.
- `ACCEPT` re-applies the source value to the destination (source wins); for a key deleted locally and updated on the source, `ACCEPT` re-inserts the source row.

Rows where the source has deleted a key and the destination still has it are propagated as deletes.

## Examples

The examples below all run inside a single database `data_branch_pick_demo_db`.

### Example 1: pick by primary key from an independent table

```sql
DROP DATABASE IF EXISTS data_branch_pick_demo_db;
CREATE DATABASE data_branch_pick_demo_db;
USE data_branch_pick_demo_db;

CREATE TABLE t1 (a INT, b INT, PRIMARY KEY(a));
INSERT INTO t1 VALUES (1,1),(3,3),(5,5);

CREATE TABLE t2 (a INT, b INT, PRIMARY KEY(a));
INSERT INTO t2 VALUES (1,1),(2,2),(4,4);

DATA BRANCH PICK t2 INTO t1 KEYS(2);
SELECT * FROM t1 ORDER BY a ASC;

DATA BRANCH PICK t2 INTO t1 KEYS(4);
SELECT * FROM t1 ORDER BY a ASC;

DROP TABLE t1;
DROP TABLE t2;
```

### Example 2: pick by primary key with a common ancestor

```sql
USE data_branch_pick_demo_db;

CREATE TABLE t0 (a INT, b INT, PRIMARY KEY(a));
INSERT INTO t0 VALUES (1,1),(2,2),(3,3);

DATA BRANCH CREATE TABLE t1 FROM t0;
INSERT INTO t1 VALUES (4,4);

DATA BRANCH CREATE TABLE t2 FROM t0;
INSERT INTO t2 VALUES (5,5),(6,6),(7,7);

DATA BRANCH PICK t2 INTO t1 KEYS(5,7);
SELECT * FROM t1 ORDER BY a ASC;

DROP TABLE t0;
DROP TABLE t1;
DROP TABLE t2;
```

### Example 3: pick by snapshot window (`BETWEEN SNAPSHOT`)

```sql
USE data_branch_pick_demo_db;

DROP SNAPSHOT IF EXISTS pick_sp_from;
DROP SNAPSHOT IF EXISTS pick_sp_to;

CREATE TABLE t0 (a INT, b INT, PRIMARY KEY(a));
INSERT INTO t0 VALUES (1,1);

DATA BRANCH CREATE TABLE t1 FROM t0;

CREATE SNAPSHOT pick_sp_from FOR ACCOUNT sys;

INSERT INTO t1 VALUES (2,2),(3,3);

CREATE SNAPSHOT pick_sp_to FOR ACCOUNT sys;

INSERT INTO t1 VALUES (4,4);

DATA BRANCH PICK t1 INTO t0 BETWEEN SNAPSHOT 'pick_sp_from' AND 'pick_sp_to';
SELECT * FROM t0 ORDER BY a ASC;

DROP SNAPSHOT pick_sp_from;
DROP SNAPSHOT pick_sp_to;
DROP TABLE t0;
DROP TABLE t1;
```

### Example 4: conflict resolution with `WHEN CONFLICT ACCEPT`

```sql
USE data_branch_pick_demo_db;

CREATE TABLE t0 (a INT, b INT, PRIMARY KEY(a));
INSERT INTO t0 VALUES (1,1),(2,2),(3,3);

DATA BRANCH CREATE TABLE t1 FROM t0;
DELETE FROM t1 WHERE a = 2;

DATA BRANCH CREATE TABLE t2 FROM t0;
UPDATE t2 SET b = 200 WHERE a = 2;

DATA BRANCH PICK t2 INTO t1 KEYS(2) WHEN CONFLICT ACCEPT;
SELECT * FROM t1 ORDER BY a ASC;

DROP TABLE t0;
DROP TABLE t1;
DROP TABLE t2;
```

### Example 5: composite primary key by tuple literals and by subquery

```sql
USE data_branch_pick_demo_db;

CREATE TABLE t0 (id INT, name VARCHAR(20), val INT, PRIMARY KEY(id, name));
INSERT INTO t0 VALUES (1,'alice',10),(2,'bob',20),(3,'charlie',30);

DATA BRANCH CREATE TABLE t1 FROM t0;
DATA BRANCH CREATE TABLE t2 FROM t0;

INSERT INTO t2 VALUES (4,'dave',40),(5,'eve',50),(6,'frank',60);

DATA BRANCH PICK t2 INTO t1 KEYS((4,'dave'),(6,'frank'));
SELECT * FROM t1 ORDER BY id, name;

DATA BRANCH PICK t2 INTO t1 KEYS(SELECT id, name FROM t2 WHERE id = 5);
SELECT * FROM t1 ORDER BY id, name;

DROP TABLE t0;
DROP TABLE t1;
DROP TABLE t2;
```

### Example 6: rejecting an explicit transaction

```sql
USE data_branch_pick_demo_db;

CREATE TABLE t1 (a INT, b INT, PRIMARY KEY(a));
INSERT INTO t1 VALUES (1,1);

CREATE TABLE t2 (a INT, b INT, PRIMARY KEY(a));
INSERT INTO t2 VALUES (1,1),(2,2);

BEGIN;
-- Expected-Success: false
DATA BRANCH PICK t2 INTO t1 KEYS(2);
COMMIT;

DROP TABLE t1;
DROP TABLE t2;

DROP DATABASE data_branch_pick_demo_db;
```

## Notes

- `DATA BRANCH PICK` is applied on top of whatever LCA relation the two tables have. Picking between two unrelated tables (no LCA) is supported; picking between tables where one is an ancestor of the other is also supported.
- Only primary-key based matching is supported. Tables without a user primary key use the engine's hidden fake primary key.
- The default conflict policy is `FAIL`; add an explicit `WHEN CONFLICT SKIP` or `WHEN CONFLICT ACCEPT` clause when local divergence is expected.
