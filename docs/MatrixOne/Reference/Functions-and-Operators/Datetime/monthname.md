---
title: "MONTHNAME()"
doc_type: reference
mysql_compat: full
differs_from_mysql: []
mo_only: false
since: v3.0.15
last_updated: 2026-07-06
llms_summary: "Returns the full month name for a date value, such as 'January' or 'December', or NULL if the argument is NULL."
---
# MONTHNAME()

> Returns the full name of the month for a given date (e.g., `'January'`, `'December'`). Accepts `DATE`, `DATETIME`, and `TIMESTAMP` types. Returns NULL if the argument is NULL.

## Function Description

The `MONTHNAME()` function returns the full English month name for a date value. It is equivalent to calling `DATE_FORMAT(date, '%M')`.

## Syntax

```
> MONTHNAME(date)
```

## Arguments

| Arguments | Description |
| ---- | ---- |
| date | Required. A value of type `DATE`, `DATETIME`, or `TIMESTAMP`. Returns NULL if NULL. |

## Examples

```sql
DROP DATABASE IF EXISTS monthname_demo;
CREATE DATABASE monthname_demo;
USE monthname_demo;

SELECT MONTHNAME('2007-02-03') AS february;
SELECT MONTHNAME('2007-12-25') AS december;
SELECT MONTHNAME('2007-07-04 12:30:45') AS dt_july;
SELECT MONTHNAME(NULL) AS null_result;

CREATE TABLE t1(d DATE);
INSERT INTO t1 VALUES ('2007-01-15'), ('2007-06-20'), ('2007-12-31');
SELECT d, MONTHNAME(d) AS month_name FROM t1;
DROP TABLE t1;

DROP DATABASE monthname_demo;
```
