# Role Rules

## Description

A role rule is a per-role, per-table SQL rewrite rule. When a user whose active role has one or more rules executes a SELECT, MatrixOne injects a rewrite hint at the front of the SQL, and the optimizer then uses the stored rewrite text to remap the referenced table to the filtered SELECT given in the rule.

Role rules are managed by:

- `ALTER ROLE role ADD RULE "rule_sql" ON TABLE db.tbl` — create or replace a rule.
- `ALTER ROLE role DROP RULE ON TABLE db.tbl` — remove a rule.
- `SHOW RULES ON ROLE role` — list all rules on a role.

Rules are stored in `mo_catalog.mo_role_rule` (`role_id`, `rule_name`, `rule`). Rule injection is gated by the session variable `enable_remap_hint`: rules only take effect when it is set.

## Syntax

```
ALTER ROLE role_name ADD RULE "rule_sql" ON TABLE db_name.table_name

ALTER ROLE role_name DROP RULE ON TABLE db_name.table_name

SHOW RULES ON ROLE role_name
```

## Arguments

| Clause | Description |
|--------|-------------|
| `role_name` | Name of an existing role. When the role does not exist the statement returns `there is no role <role_name>`. |
| `"rule_sql"` | A SELECT statement that replaces references to `db_name.table_name`. Wrap the text in double quotes. |
| `db_name.table_name` | The target table the rule applies to. Used as the rule key; at most one rule may exist per `(role, db.table)` pair. Re-running `ADD RULE` on the same pair overwrites the previous rule. |
| `enable_remap_hint` | Session/global system variable (boolean, default `0`). Set to `1` to activate rewrite-hint injection for the current session. |

Rules are keyed by `(role_id, rule_name)`, where `rule_name` is derived from `db_name.table_name`. Dropping a rule that does not exist returns `rule '<db>.<tbl>' does not exist for role '<role>'`.

## Usage Notes

- `ALTER ROLE ... ADD RULE` first checks that the role exists, then deletes any existing rule with the same `rule_name` and inserts the new one. This makes the statement idempotent when called with the same table twice.
- `ALTER ROLE ... DROP RULE` requires that both the role and the rule exist; otherwise it returns an internal error.
- `SHOW RULES ON ROLE` returns two columns: `rule_name` (the `db.table` key) and `rule` (the stored SELECT text).
- Rules are applied only when the session has `enable_remap_hint` set. Without it, rules exist but do not affect queries.
- After modifying a rule, the change is visible to the current session immediately. Sessions on the same role that were already connected continue to use their cached rules until they refresh their role (for example via `SET ROLE`) or reconnect.
- The grantee still needs regular `SELECT` privileges on the referenced table for the rewrite to produce a usable query.
- There is exactly one rule per `(role, db.table)` pair. To apply multiple filters to the same table, combine them in one `rule_sql` statement.

## Examples

The examples below run inside a single database `role_rule_demo_db`.

### Example 1: add a rule and inspect with `SHOW RULES`

```sql
DROP DATABASE IF EXISTS role_rule_demo_db;
CREATE DATABASE role_rule_demo_db;
USE role_rule_demo_db;

CREATE TABLE t1 (a INT, age INT);
INSERT INTO t1 VALUES (1,1),(2,2),(100,30);

DROP ROLE IF EXISTS test_rule_role;
CREATE ROLE test_rule_role;

ALTER ROLE test_rule_role ADD RULE "select * from role_rule_demo_db.t1 where age > 28" ON TABLE role_rule_demo_db.t1;
SHOW RULES ON ROLE test_rule_role;

DROP ROLE IF EXISTS test_rule_role;
DROP TABLE t1;
DROP DATABASE role_rule_demo_db;
```

### Example 2: update a rule and drop it

```sql
DROP DATABASE IF EXISTS role_rule_demo_db;
CREATE DATABASE role_rule_demo_db;
USE role_rule_demo_db;

CREATE TABLE t1 (a INT, age INT);
INSERT INTO t1 VALUES (1,1),(2,2),(100,30);

DROP ROLE IF EXISTS test_rule_role;
CREATE ROLE test_rule_role;

ALTER ROLE test_rule_role ADD RULE "select * from role_rule_demo_db.t1 where age > 28" ON TABLE role_rule_demo_db.t1;

-- Re-adding on the same table overwrites the rule.
ALTER ROLE test_rule_role ADD RULE "select * from role_rule_demo_db.t1 where age > 50" ON TABLE role_rule_demo_db.t1;
SHOW RULES ON ROLE test_rule_role;

ALTER ROLE test_rule_role DROP RULE ON TABLE role_rule_demo_db.t1;
SHOW RULES ON ROLE test_rule_role;

DROP ROLE IF EXISTS test_rule_role;
DROP TABLE t1;
DROP DATABASE role_rule_demo_db;
```

### Example 3: `enable_remap_hint` activates the rewrite

```sql
DROP DATABASE IF EXISTS role_rule_demo_db;
CREATE DATABASE role_rule_demo_db;
USE role_rule_demo_db;

CREATE TABLE t1 (a INT, age INT);
INSERT INTO t1 VALUES (1,1),(2,2),(100,30);

DROP ROLE IF EXISTS test_rule_role;
CREATE ROLE test_rule_role;

ALTER ROLE test_rule_role ADD RULE "select * from role_rule_demo_db.t1 where age > 28" ON TABLE role_rule_demo_db.t1;

SET enable_remap_hint = 1;
SELECT * FROM role_rule_demo_db.t1;

DROP ROLE IF EXISTS test_rule_role;
DROP TABLE t1;
DROP DATABASE role_rule_demo_db;
```

### Example 4: errors on non-existent role and non-existent rule

```sql
DROP DATABASE IF EXISTS role_rule_demo_db;
CREATE DATABASE role_rule_demo_db;
USE role_rule_demo_db;

CREATE TABLE t1 (a INT, age INT);

DROP ROLE IF EXISTS test_rule_role;
CREATE ROLE test_rule_role;

-- Expected-Success: false
ALTER ROLE non_existent_role ADD RULE "select * from role_rule_demo_db.t1" ON TABLE role_rule_demo_db.t1;

-- Expected-Success: false
ALTER ROLE test_rule_role DROP RULE ON TABLE role_rule_demo_db.t1;

-- Expected-Success: false
SHOW RULES ON ROLE non_existent_role;

DROP ROLE IF EXISTS test_rule_role;
DROP TABLE t1;
DROP DATABASE role_rule_demo_db;
```

## Notes

- `enable_remap_hint` is a boolean system variable with scope `ScopeBoth`; it can be set per-session with `SET enable_remap_hint = 1` or globally with `SET GLOBAL enable_remap_hint = 1`.
- The rewrite hint is injected as a `/*+ {"rewrites": {...}} */` comment; the optimizer consumes it internally.
- A rule without a matching active role, or a session without `enable_remap_hint` set, is a no-op — it neither helps nor hurts regular queries.
