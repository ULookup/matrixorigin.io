---
title: "SHOW TABLES"
mysql_compat: full
---
# **SHOW TABLES**

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
+---------------+
| name          |
+---------------+
| clusters      |
| contributors  |
| databases     |
| functions     |
| numbers       |
| numbers_local |
| numbers_mt    |
| one           |
| processes     |
| settings      |
| tables        |
| tracing       |
+---------------+
```
