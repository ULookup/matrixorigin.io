---
title: "MAKETIME()"
doc_type: reference
mysql_compat: full
differs_from_mysql: []
mo_only: false
since: v3.0.15
last_updated: 2026-07-06
llms_summary: "Returns a TIME value constructed from the given hour, minute, and second arguments, up to a maximum of 838:59:59."
---
# MAKETIME()

> Returns a `TIME` value constructed from the given `hour`, `minute`, and `second` arguments. The valid range for hours is 0–838. If any argument is out of range or NULL, returns NULL. Floating-point inputs are truncated to integers.

## Function Description

The `MAKETIME()` function constructs a `TIME` value from three integer arguments. MySQL's `TIME` type supports hours beyond 24 (up to 838), useful for representing time intervals or offsets.

## Syntax

```
> MAKETIME(hour, minute, second)
```

## Arguments

| Arguments | Description |
| ---- | ---- |
| hour | Required. Integer 0–838. Negative values or values > 838 return NULL. |
| minute | Required. Integer 0–59. Values outside this range return NULL. |
| second | Required. Integer 0–59. Values outside this range return NULL. |

## Examples

```sql
DROP DATABASE IF EXISTS maketime_demo;
CREATE DATABASE maketime_demo;
USE maketime_demo;

SELECT MAKETIME(12, 15, 30) AS result1;
SELECT MAKETIME(0, 0, 0) AS zero_time;
SELECT MAKETIME(23, 59, 59) AS max_time;
SELECT MAKETIME(838, 59, 59) AS max_hours;
SELECT MAKETIME(100, 0, 0) AS interval_time;

-- Out-of-range or invalid arguments return NULL.
SELECT MAKETIME(-1, 15, 30) AS null_hour_oob;
SELECT MAKETIME(12, 60, 30) AS null_minute_oob;
SELECT MAKETIME(12, 15, 60) AS null_second_oob;

SELECT MAKETIME(NULL, 15, 30) AS null_hour;
SELECT MAKETIME(12, NULL, 30) AS null_minute;

CREATE TABLE t1(h INT, m INT, s INT);
INSERT INTO t1 VALUES (12, 15, 30), (0, 0, 0), (23, 59, 59);
SELECT MAKETIME(h, m, s) AS time_value FROM t1;
DROP TABLE t1;

DROP DATABASE maketime_demo;
```
