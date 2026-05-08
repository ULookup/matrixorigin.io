---
title: "DROP ROLE"
doc_type: reference
mysql_compat: mo_only
differs_from_mysql: []
mo_only:
  - "DROP ROLE"
since: unknown
last_updated: 2026-05-08
llms_summary: "Removes the specified role from the system."
---
# **DROP ROLE**

> Removes the specified role from the system.

## **Description**

Removes the specified role from the system.

## **Syntax**

```
> DROP ROLE [IF EXISTS] role [, role ] ...
```

## **Examples**

```sql
> drop role if exists rolex;
Query OK, 0 rows affected (0.02 sec)
```

!!! note
    If the user using this role is in a session, when the role is removed, the session will be disconnected immediately, and this role can no longer be used for operations.
