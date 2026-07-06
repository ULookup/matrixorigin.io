---
title: "DAYNAME()"
doc_type: reference
mysql_compat: full
differs_from_mysql: []
mo_only: false
since: v3.0.15
last_updated: 2026-07-06
llms_summary: "Returns the weekday name for a DATE, DATETIME, or TIMESTAMP value, such as 'Monday' or 'Saturday'."
---
# DAYNAME()

> Returns the name of the weekday for a given date. The returned name uses the current locale's weekday names (e.g., `'Monday'`, `'Saturday'`). Accepts `DATE`, `DATETIME`, and `TIMESTAMP` types. Returns NULL if the argument is NULL.

## Function Description

The `DAYNAME()` function returns the full English weekday name for a date value. It is equivalent to calling `DATE_FORMAT(date, '%W')`.

## Syntax

```
> DAYNAME(date)
```

## Arguments

| Arguments | Description |
| ---- | ---- |
| date | Required. A value of type `DATE`, `DATETIME`, or `TIMESTAMP`. Returns NULL if NULL. |

## Examples

```sql
DROP DATABASE IF EXISTS dayname_demo;
CREATE DATABASE dayname_demo;
USE dayname_demo;

SELECT DAYNAME('2007-02-03') AS saturday;
SELECT DAYNAME('2007-02-05') AS monday;
SELECT DAYNAME('2007-02-03 12:30:45') AS dt_saturday;
SELECT DAYNAME(NULL) AS null_result;

CREATE TABLE t1(d DATE, dt DATETIME);
INSERT INTO t1 VALUES ('2007-02-03', '2007-02-03 12:00:00'), ('2007-02-04', '2007-02-04 12:00:00');
SELECT DAYNAME(d) AS day_from_date, DAYNAME(dt) AS day_from_datetime FROM t1;
DROP TABLE t1;

CREATE TABLE t2(d DATE);
INSERT INTO t2 VALUES ('2007-02-03'), ('2007-02-04'), ('2007-02-05');
SELECT * FROM t2 WHERE DAYNAME(d) = 'Saturday';
DROP TABLE t2;

DROP DATABASE dayname_demo;
```
