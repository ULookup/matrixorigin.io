---
title: "SHOW TABLE STATUS"
doc_type: reference
mysql_compat: partial
differs_from_mysql:
  - "Result columns differ from MySQL; MatrixOne uses TAE storage engine metadata instead of InnoDB statistics"
  - "Engine column always shows TAE instead of InnoDB"
mo_only: []
since: unknown
last_updated: 2026-05-20
llms_summary: "SHOW TABLE STATUS provides table metadata including storage engine, row count, and other status information."
---
# **SHOW TABLE STATUS**

> SHOW TABLE STATUS provides table metadata including storage engine, row count, and other status information.

## **Description**

`SHOW TABLE STATUS` provides metadata about tables in a database, similar to MySQL. However, the result columns and values differ from MySQL because MatrixOne uses the TAE (Transactional Analytical Engine) storage engine instead of InnoDB. The `Engine` column always shows `TAE`.

## **Syntax**

```
> SHOW TABLE STATUS
    [{FROM | IN} db_name]
    [LIKE 'pattern' | WHERE expr]
```

## **Examples**

<!-- validator-ignore-exec -->
```sql
drop database if exists demo_1;
create database demo_1;
use demo_1;
create table t1 (col1 int);

mysql> show table status from demo_1;
+------+--------+----------+------------+------+----------------+-------------+-----------------+--------------+-----------+----------------+---------------------+-------------+------------+-----------------+----------+----------------+---------+
| Name | Engine | Comment  | CharSet    | Type | Version        | Row_format  | Create_options  | Rows         | Data_free | Create_time    | Update_time         | Check_time  | Collation  | Index_length   | Max_data | Avg_row_length | Checksum|
+------+--------+----------+------------+------+----------------+-------------+-----------------+--------------+-----------+----------------+---------------------+-------------+------------+-----------------+----------+----------------+---------+
| t1   | TAE    |          | utf8mb4_bin|      | 0              |             |                 | 0            | 0         | 2026-05-20     | 2026-05-20          |             |            | 0               | 0        | 0              |         |
+------+--------+----------+------------+------+----------------+-------------+-----------------+--------------+-----------+----------------+---------------------+-------------+------------+-----------------+----------+----------------+---------+
1 row in set (0.00 sec)
```
