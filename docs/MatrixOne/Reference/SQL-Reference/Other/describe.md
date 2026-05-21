---
title: "DESCRIBE / DESC"
doc_type: reference
mysql_compat: full
differs_from_mysql: []
mo_only: []
since: unknown
last_updated: 2026-05-20
llms_summary: "DESCRIBE and DESC provide information about columns in a table."
---
# **DESCRIBE / DESC**

> DESCRIBE and DESC provide information about columns in a table.

## **Description**

The `DESCRIBE` statement provides information about the columns in a table. `DESC` is a synonym for `DESCRIBE`.

## **Syntax**

```
{DESCRIBE | DESC} tbl_name [col_name | wild]
```

## **Examples**

<!-- validator-ignore-exec -->
```sql
drop table if exists t1;
create table t1(
    col1 int comment 'First column',
    col2 float,
    col3 varchar(100)
);

mysql> desc t1;
+-------+--------------+------+------+---------+---------+
| Field | Type         | Null | Key  | Default | Extra   |
+-------+--------------+------+------+---------+---------+
| col1  | INT          | YES  |      | NULL    |         |
| col2  | FLOAT        | YES  |      | NULL    |         |
| col3  | VARCHAR(100) | YES  |      | NULL    |         |
+-------+--------------+------+------+---------+---------+
3 rows in set (0.00 sec)

mysql> desc t1 col1;
+-------+------+------+------+---------+---------+
| Field | Type | Null | Key  | Default | Extra   |
+-------+------+------+------+---------+---------+
| col1  | INT  | YES  |      | NULL    |         |
+-------+------+------+------+---------+---------+
1 row in set (0.00 sec)
```
