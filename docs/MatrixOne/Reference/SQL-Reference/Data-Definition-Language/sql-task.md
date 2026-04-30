# SQL Tasks

## Description

A SQL task is a named, server-side SQL job stored in `mo_task.sql_task`. A task may be triggered manually with `EXECUTE TASK`, or automatically on a cron schedule. Each execution is recorded as a row in `mo_task.sql_task_run`.

SQL tasks are managed by the following statements:

- `CREATE TASK` — define a task (one-shot or scheduled).
- `ALTER TASK` — suspend/resume a task or change one of its clauses.
- `DROP TASK` — remove a task definition.
- `EXECUTE TASK` — run a task immediately once.
- `SHOW TASKS` — list the current account's tasks.
- `SHOW TASK RUNS` — list the execution history.

Each task is scoped to the creating account and preserves the creating user and role; when a scheduled or manual run fires, the task body is executed under that creator's identity and against its default database.

## Syntax

### CREATE TASK

```
CREATE TASK [IF NOT EXISTS] task_name
    [ SCHEDULE 'cron_expr' [ TIMEZONE 'tz_name' ] ]
    [ WHEN ( gate_expression ) ]
    [ RETRY retry_limit ]
    [ TIMEOUT 'duration' ]
    AS BEGIN
        task_body
    END
```

### ALTER TASK

```
ALTER TASK task_name SUSPEND
ALTER TASK task_name RESUME
ALTER TASK task_name SET SCHEDULE 'cron_expr' [ TIMEZONE 'tz_name' ]
ALTER TASK task_name SET WHEN ( gate_expression )
ALTER TASK task_name SET RETRY retry_limit
ALTER TASK task_name SET TIMEOUT 'duration'
```

### DROP TASK

```
DROP TASK [IF EXISTS] task_name
```

### EXECUTE TASK

```
EXECUTE TASK task_name
```

### SHOW TASKS / SHOW TASK RUNS

```
SHOW TASKS
SHOW TASK RUNS [ FOR task_name ] [ LIMIT n ]
```

## Arguments

| Clause | Description |
|--------|-------------|
| `SCHEDULE 'cron_expr'` | Six-field cron expression (seconds, minutes, hours, day-of-month, month, day-of-week). If omitted, the task only runs when explicitly triggered by `EXECUTE TASK`. |
| `TIMEZONE 'tz_name'` | IANA timezone name used when evaluating the cron expression. Defaults to `UTC` when omitted. |
| `WHEN ( gate_expression )` | A boolean expression evaluated before each run. When it evaluates to false, the run is skipped (recorded as `SKIPPED` in `mo_task.sql_task_run`). The gate may be a boolean expression or a scalar subquery. |
| `RETRY retry_limit` | Maximum number of extra attempts after the first failure for a single trigger. Default is `0` (no retry). |
| `TIMEOUT 'duration'` | Per-run wall-clock timeout, parsed by the Go `time.ParseDuration` syntax (for example `'30s'`, `'5m'`, `'1h'`). A run exceeding its timeout is recorded as `TIMEOUT`. |
| `task_body` | One or more SQL statements between `AS BEGIN` and `END`. The body is executed as a single unit; the first failing statement terminates the run. |
| `task_name` | Identifier, unique within the account. |
| `retry_limit` | Integer `>= 0`. |
| `SUSPEND` / `RESUME` | Disable/re-enable automatic scheduling. `EXECUTE TASK` still works on a suspended task. |
| `FOR task_name` | Filter the output of `SHOW TASK RUNS` to a single task. |
| `LIMIT n` | Limit the number of rows returned by `SHOW TASK RUNS`. |

### Output columns

`SHOW TASKS` returns one row per task with columns:

`task_name`, `schedule`, `enabled`, `gate_condition`, `retry_limit`, `timeout`, `created_at`, `last_run_status`, `last_run_time`.

`SHOW TASK RUNS` returns one row per run with columns:

`run_id`, `task_name`, `trigger_type`, `status`, `started_at`, `finished_at`, `duration`, `attempt`, `rows_affected`, `error_message`.

`trigger_type` is `SCHEDULED` for a cron-driven run and `MANUAL` for an `EXECUTE TASK` run. `status` is one of `RUNNING`, `SUCCESS`, `FAILED`, `SKIPPED`, `TIMEOUT`.

## Usage Notes

- SQL tasks require the backend task service to be available. If it has not started yet the statement returns `task service not ready yet, please try again later.`
- `CREATE TASK` fails with `sql task <name> already exists` when a task of the same name exists in the account, unless `IF NOT EXISTS` is used.
- `ALTER TASK`, `DROP TASK`, and `EXECUTE TASK` fail with `sql task <name> not found` when the target task does not exist. `DROP TASK IF EXISTS` suppresses the error.
- When `SCHEDULE` is omitted, the task has no cron and only runs via `EXECUTE TASK`.
- `ALTER TASK ... SUSPEND` stops scheduled firing but keeps the definition; `RESUME` recomputes the next fire time from "now" so a long-suspended task does not catch up missed windows.
- `TIMEOUT` accepts any string accepted by `time.ParseDuration` (for example `"90s"`, `"2m"`); an empty string disables the per-run timeout. A negative value is rejected.
- A task can only have one run in progress at a time per account. A second `EXECUTE TASK` while the previous run is still running returns `sql task is already running`.
- The task body runs under the definer's account, user, and default role; it does not inherit the session-level database of the caller. Use fully qualified table names (`db.table`) or set a default database when creating the task.
- Each run's rows are recorded in `mo_task.sql_task_run`; `mo_task.sql_task` carries the latest definition.

## Examples

The examples below run inside a single database `sql_task_demo_db`. Each task body contains a single statement so no internal `;` is needed between `BEGIN` and `END`; in real deployments the task body may contain multiple `;`-separated statements.

### Example 1: a manual task triggered with `EXECUTE TASK`

```sql
DROP DATABASE IF EXISTS sql_task_demo_db;
CREATE DATABASE sql_task_demo_db;
USE sql_task_demo_db;

CREATE TABLE manual_events (id INT PRIMARY KEY);

DROP TASK IF EXISTS sql_task_manual;

CREATE TASK sql_task_manual
AS BEGIN
    INSERT INTO manual_events SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM manual_events WHERE id = 1)
END;

EXECUTE TASK sql_task_manual;
SELECT COUNT(*) FROM manual_events;

DROP TASK IF EXISTS sql_task_manual;
DROP TABLE manual_events;
```

### Example 2: a cron-scheduled task with `TIMEZONE`

```sql
USE sql_task_demo_db;

CREATE TABLE scheduled_events (
    marker VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TASK IF EXISTS sql_task_cron;

CREATE TASK sql_task_cron
    SCHEDULE '0 0 0 1 1 *'
    TIMEZONE 'UTC'
AS BEGIN
    INSERT INTO scheduled_events(marker) VALUES ('cron')
END;

ALTER TASK sql_task_cron SET SCHEDULE '*/1 * * * * *' TIMEZONE 'UTC';
ALTER TASK sql_task_cron SUSPEND;
ALTER TASK sql_task_cron RESUME;

EXECUTE TASK sql_task_cron;
SELECT COUNT(*) FROM scheduled_events;

DROP TASK IF EXISTS sql_task_cron;
DROP TABLE scheduled_events;
```

### Example 3: gate the task with `WHEN (...)`

```sql
USE sql_task_demo_db;

CREATE TABLE gate_source (id INT PRIMARY KEY);
CREATE TABLE gate_sink (tag VARCHAR(32) PRIMARY KEY);

DROP TASK IF EXISTS sql_task_gate;

CREATE TASK sql_task_gate
    WHEN (EXISTS (SELECT 1 FROM gate_source WHERE id = 1))
AS BEGIN
    INSERT INTO gate_sink SELECT 'gate-ok' WHERE NOT EXISTS (SELECT 1 FROM gate_sink WHERE tag = 'gate-ok')
END;

EXECUTE TASK sql_task_gate;
SELECT COUNT(*) FROM gate_sink;

INSERT INTO gate_source VALUES (1);
EXECUTE TASK sql_task_gate;
SELECT COUNT(*) FROM gate_sink;

DROP TASK IF EXISTS sql_task_gate;
DROP TABLE gate_sink;
DROP TABLE gate_source;
```

### Example 4: `TIMEOUT` and `RETRY`

```sql
USE sql_task_demo_db;

CREATE TABLE timeout_sink (v INT);
CREATE TABLE retry_target (v INT);

DROP TASK IF EXISTS sql_task_timeout;
DROP TASK IF EXISTS sql_task_retry;

CREATE TASK sql_task_timeout
    TIMEOUT '1s'
AS BEGIN
    INSERT INTO timeout_sink SELECT sleep(2)
END;

EXECUTE TASK sql_task_timeout;
SELECT COUNT(*) FROM timeout_sink;

CREATE TASK sql_task_retry
    RETRY 1
AS BEGIN
    INSERT INTO retry_target VALUES (1)
END;

EXECUTE TASK sql_task_retry;
SELECT COUNT(*) FROM retry_target;

DROP TASK IF EXISTS sql_task_timeout;
DROP TASK IF EXISTS sql_task_retry;
DROP TABLE timeout_sink;
DROP TABLE retry_target;
```

### Example 5: inspecting tasks and runs

```sql
USE sql_task_demo_db;

CREATE TABLE run_target (v INT);

DROP TASK IF EXISTS sql_task_show;

CREATE TASK sql_task_show
AS BEGIN
    INSERT INTO run_target VALUES (1)
END;

EXECUTE TASK sql_task_show;

SHOW TASKS;
SHOW TASK RUNS FOR sql_task_show LIMIT 5;

DROP TASK IF EXISTS sql_task_show;
DROP TABLE run_target;
```

### Example 6: overlap protection

```sql
USE sql_task_demo_db;

CREATE TABLE overlap_sink (v INT);

DROP TASK IF EXISTS sql_task_overlap;

CREATE TASK sql_task_overlap
AS BEGIN
    INSERT INTO overlap_sink SELECT sleep(1)
END;

EXECUTE TASK sql_task_overlap;

-- Expected-Success: false
EXECUTE TASK sql_task_overlap;

DROP TASK IF EXISTS sql_task_overlap;
DROP TABLE overlap_sink;

DROP DATABASE sql_task_demo_db;
```

## Notes

- The cron parser accepts six-field expressions: `second minute hour day-of-month month day-of-week`, plus descriptors such as `@hourly`.
- `WHEN (...)` supports either a boolean expression or a scalar subquery that returns a value convertible to boolean.
- SQL task state is persisted across cluster restarts; scheduled tasks resume based on their next fire time.
- `mo_task.sql_task` and `mo_task.sql_task_run` are exposed as regular tables; users with sufficient privileges can query them directly for custom monitoring.
