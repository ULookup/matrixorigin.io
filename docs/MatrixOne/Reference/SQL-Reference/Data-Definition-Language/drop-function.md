# **DROP FUNCTION**

## **Grammar description**

The `DROP FUNCTION` statement represents the deletion of a user-defined function.

## **Grammar structure**

```
> DROP FUNCTION <name> ([<arg_data_type> ]… )
```

## **Examples**

**Example 1**

<!-- validator-ignore -->
```sql
--Removing Parametric Functions

create or replace function py_add(a int, b int) returns int language python as 
$$
def add(a, b):
  return a + b
$$
handler 'add';

mysql> select py_add(1,2);
+--------------+
| py_add(1, 2) |
+--------------+
|            3 |
+--------------+
1 row in set (0.01 sec)

--When we no longer need the function, we can remove it
drop function py_add(int, int);
```

**Example 2**

<!-- validator-ignore -->
```sql
--Deleting Unreferenced Functions
mysql> CREATE FUNCTION t1_fun () RETURNS VARCHAR LANGUAGE SQL AS 'select n1 from t1 limit 1' ;
Query OK, 0 rows affected (0.01 sec)

mysql> drop function t1_fun();
Query OK, 0 rows affected (0.01 sec)
```