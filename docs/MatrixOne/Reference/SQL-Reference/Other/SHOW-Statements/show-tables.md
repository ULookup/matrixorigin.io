---
title: "SHOW TABLES"
doc_type: reference
mysql_compat: partial
differs_from_mysql:
  - "FROM/IN clause semantics differ — MySQL uses FROM/IN to specify a database name, not a pattern"
mo_only: []
since: unknown
last_updated: 2026-05-08
llms_summary: "Shows the list of tables in the currently selected database."
---
# **SHOW TABLES**

> Shows the list of tables in the currently selected database.

## **Description**

Shows the list of tables in the currently selected database.

## **Syntax**

```
> SHOW TABLES  [LIKE 'pattern' | WHERE expr | FROM 'pattern' | IN 'pattern']
```

## **Examples**

<!-- validator-ignore-exec -->
```sql
> SHOW TABLES;
+---------------------+
| Tables_in_database  |
+---------------------+
| clusters            |
| contributors        |
| databases           |
| functions           |
| numbers             |
| numbers_local       |
| numbers_mt          |
| one                 |
| processes           |
| settings            |
| tables              |
| tracing             |
+---------------------+
```
