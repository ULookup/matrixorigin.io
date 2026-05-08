---
title: "ELT()"
doc_type: reference
mysql_compat: full
differs_from_mysql: []
mo_only: false
since: v3.0.11
last_updated: 2026-05-08
llms_summary: "ELT returns the N-th string argument counting from 1, yielding NULL when N is out of range or any referenced argument is NULL in MatrixOne."
---

# **ELT()**

> `ELT(N, str1, str2, ...)` returns the N-th string argument counting from 1, and returns `NULL` when `N` is `NULL`, `N < 1`, `N` exceeds the number of string arguments, or the selected string argument itself is `NULL`.

## **Description**

The `ELT()` function returns the `N`-th string argument, counting from `1`. `ELT(1, str1, str2, ...)` returns `str1`, `ELT(2, ...)` returns `str2`, and so on.

The function returns `NULL` in any of the following cases:

- `N` is `NULL` or any of the string arguments evaluated at that index is `NULL`.
- `N < 1` or `N` is greater than the number of string arguments supplied.
- `N` is an integer type (`UINT64`, `BIT`) whose value falls outside the valid range.

At least two arguments are required (the index and one string); otherwise, the call is rejected at bind time. Non-string rest arguments are cast to `VARCHAR`. When any rest argument is `BINARY` / `VARBINARY` / `BLOB`, the result type is `BLOB`; otherwise, it is `VARCHAR`.

## **Syntax**

```
> ELT(N, str1, str2, str3, ...)
```

## **Arguments**

| Arguments | Description |
| ---- | ---- |
| N | Required. An integer expression selecting which string to return. Types `BOOL`, `INT`, `FLOAT`, and `DECIMAL` are cast to `INT64`; `UINT64` / `BIT` are used as-is. |
| str1, str2, ... | Required. One or more string expressions. Non-string types are cast to `VARCHAR`. |

## **Examples**

```sql
DROP DATABASE IF EXISTS elt_demo;
CREATE DATABASE elt_demo;
USE elt_demo;

SELECT ELT(1, 'Aa', 'Bb', 'Cc', 'Dd') AS r1;
SELECT ELT(3, 'Aa', 'Bb', 'Cc', 'Dd') AS r2;
SELECT ELT(0, 'Aa', 'Bb', 'Cc', 'Dd') AS out_of_range;
SELECT ELT(5, 'Aa', 'Bb', 'Cc', 'Dd') AS out_of_range2;
SELECT ELT(NULL, 'Aa', 'Bb')          AS n_is_null;

DROP DATABASE elt_demo;
```
