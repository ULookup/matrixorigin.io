---
title: "RIGHT()"
doc_type: reference
mysql_compat: full
differs_from_mysql: []
mo_only: false
since: v3.0.15
last_updated: 2026-07-06
llms_summary: "Returns the rightmost len characters from the string str, or empty string if len is negative and NULL if str is NULL."
---
# RIGHT()

> Returns the rightmost `len` characters from the string `str`. If `len` is negative, the result is an empty string. If `len` exceeds the string length, the full string is returned. Returns NULL if `str` is NULL.

## Function Description

The `RIGHT()` function extracts a substring from the right side of a given string. It is multibyte-safe and works correctly with Unicode characters, including Chinese, Japanese, and other multi-byte encodings.

## Syntax

```
> RIGHT(str, len)
```

## Arguments

| Arguments | Description |
| ---- | ---- |
| str | Required. The string to extract from. |
| len | Required. The number of characters to extract. If negative, returns an empty string. If larger than the string length, returns the entire string. If NULL, returns NULL. |

## Examples

```sql
DROP DATABASE IF EXISTS right_demo;
CREATE DATABASE right_demo;
USE right_demo;

SELECT RIGHT('Hello World', 5) AS result1;
SELECT RIGHT('Hello', 10) AS result2;
SELECT RIGHT('Hello', 0) AS result3;
SELECT RIGHT('abcde', -1) AS neg_result;
SELECT RIGHT('', 5) AS empty_str_result;
SELECT RIGHT(NULL, 5) AS null_str_result;

CREATE TABLE t1(str VARCHAR(50), len INT);
INSERT INTO t1 VALUES ('Hello World', 5), ('Hello', 10), ('Hello', 0), ('abcde', 3), ('test', 1);
SELECT str, len, RIGHT(str, len) AS right_result FROM t1;
DROP TABLE t1;

CREATE TABLE t2(str VARCHAR(50));
INSERT INTO t2 VALUES ('Hello World'), ('Hello'), ('test'), ('abcde');
SELECT * FROM t2 WHERE RIGHT(str, 5) = 'World';
SELECT * FROM t2 WHERE RIGHT(str, 1) = 'o';
DROP TABLE t2;

DROP DATABASE right_demo;
```
