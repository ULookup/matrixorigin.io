---
title: "CURTIME()"
doc_type: reference
mysql_compat: full
differs_from_mysql: []
mo_only: false
since: v3.0.11
last_updated: 2026-05-08
llms_summary: "CURTIME and its synonym CURRENT_TIME return the current server time as a TIME value, optionally with up to microsecond precision in MatrixOne."
---

# **CURTIME()**

> `CURTIME([fsp])` and its synonym `CURRENT_TIME([fsp])` return the current server time as a `TIME` value, optionally with `fsp` digits of fractional seconds (up to microsecond precision).

## **Description**

The `CURTIME()` function returns the current time as a `TIME` value. `CURRENT_TIME()` is a synonym for `CURTIME()`.

If an optional fractional seconds precision `fsp` is given, the result is returned with `fsp` digits of fractional seconds; otherwise, no fractional part is returned. The default result type uses scale 6 when a precision is not specified at bind time.

## **Syntax**

```
> CURTIME([fsp])
> CURRENT_TIME([fsp])
```

## **Arguments**

| Arguments | Description |
| ---- | ---- |
| fsp | Optional. An integer in the range `0` to `6` specifying the number of fractional-second digits to retain in the result. |

## **Examples**

<!-- validator-ignore-exec -->
```sql
mysql> SELECT CURTIME();
+-----------+
| curtime() |
+-----------+
| 09:30:17  |
+-----------+

mysql> SELECT CURRENT_TIME(3);
+-----------------+
| current_time(3) |
+-----------------+
| 09:30:17.412    |
+-----------------+
```
