---
title: "QUOTE()"
doc_type: reference
mysql_compat: full
differs_from_mysql: []
mo_only: false
since: v3.0.15
last_updated: 2026-07-06
llms_summary: "Quotes a string to produce a result that can be used as a properly escaped data value in an SQL statement, returning NULL if the argument is NULL."
---
# QUOTE()

> Quotes a string to produce a result that can be used as a properly escaped data value in an SQL statement. Single quotes and backslashes are escaped; NULL bytes (`\0`) and control characters (`Ctrl+Z`) are also escaped. Returns NULL if the argument is NULL.

## Function Description

The `QUOTE()` function takes a string and returns a quoted version where special characters are escaped for safe use in SQL statements. The result is wrapped in single quotes with internal single quotes doubled and backslashes doubled. This matches MySQL's `QUOTE()` behavior.

## Syntax

```
> QUOTE(str)
```

## Arguments

| Arguments | Description |
| ---- | ---- |
| str | Required. The string to quote. If NULL, returns NULL. |

## Examples

```sql
DROP DATABASE IF EXISTS quote_demo;
CREATE DATABASE quote_demo;
USE quote_demo;

SELECT QUOTE('Hello') AS basic;
SELECT QUOTE('Don''t') AS with_quote;
SELECT QUOTE('C:\\path') AS with_backslash;
SELECT QUOTE('') AS empty_result;
SELECT QUOTE(NULL) AS null_result;

CREATE TABLE t1(str VARCHAR(100));
INSERT INTO t1 VALUES ('Hello'), ('Don''t'), ('It''s'), ('C:\\path');
SELECT str, QUOTE(str) AS quoted FROM t1;
DROP TABLE t1;

DROP DATABASE quote_demo;
```
