---
title: "QUARTER()"
doc_type: reference
mysql_compat: full
differs_from_mysql: []
mo_only: false
since: v3.0.15
last_updated: 2026-07-06
llms_summary: "Returns the quarter of the year for a given date as an integer from 1 to 4, or NULL if the argument is NULL."
---
# QUARTER()

> Returns the quarter of the year for a given date as an integer value in the range 1–4. January–March returns 1, April–June returns 2, July–September returns 3, and October–December returns 4. Returns NULL if the argument is NULL.

## Function Description

The `QUARTER()` function extracts the quarter number from a date. It is useful for grouping or filtering data by fiscal or calendar quarters.

## Syntax

```
> QUARTER(date)
```

## Arguments

| Arguments | Description |
| ---- | ---- |
| date | Required. A value of type `DATE`, `DATETIME`, or `TIMESTAMP`. Returns NULL if NULL. |

## Examples

```sql
DROP DATABASE IF EXISTS quarter_demo;
CREATE DATABASE quarter_demo;
USE quarter_demo;

SELECT QUARTER('2007-01-15') AS q1;
SELECT QUARTER('2007-04-20') AS q2;
SELECT QUARTER('2007-08-05') AS q3;
SELECT QUARTER('2007-11-30') AS q4;
SELECT QUARTER('2007-06-15 12:30:45') AS dt_q2;
SELECT QUARTER(NULL) AS null_result;

CREATE TABLE t1(d DATE);
INSERT INTO t1 VALUES ('2007-02-01'), ('2007-05-15'), ('2007-09-10'), ('2007-12-25');
SELECT d, QUARTER(d) AS quarter_num FROM t1;
DROP TABLE t1;

DROP DATABASE quarter_demo;
```
