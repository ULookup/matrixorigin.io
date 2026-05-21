# MySQL Compatibility Curated List Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ~34 newly identified MySQL-unsupported features to the CURATED array in `scripts/generate-unsupported-features.js` and regenerate the output page.

**Architecture:** Edit the CURATED constant in the generator script, adding new entries grouped by category. Existing entries are preserved. Regenerate `docs/MatrixOne/Reference/mysql-unsupported-features.md`.

**Tech Stack:** Node.js

---

### Task 1: Add new DDL curated entries

**Files:**
- Modify: `scripts/generate-unsupported-features.js:40-41` (insert after line 41, before the `// DML` comment)

- [ ] **Step 1: Insert 15 new DDL entries after existing DDL block**

Replace line 41-42 (the blank line and `// DML` comment between DDL and DML sections):

```javascript
  { category: 'DDL', feature: 'Character sets and collations beyond utf8mb4/utf8mb4_bin', note: 'Only the utf8mb4 character set and utf8mb4_bin collation are supported; other charsets (latin1, gbk, utf8, utf8mb3) and collations are not available' },
  { category: 'DDL', feature: 'ALTER EVENT', note: 'Event body/schedule/status modification not supported (no event scheduler)' },
  { category: 'DDL', feature: 'ALTER FUNCTION (MySQL stored function)', note: 'Modifying MySQL-style stored function characteristics is not supported; ALTER FUNCTION in MatrixOne serves a different purpose' },
  { category: 'DDL', feature: 'ALTER INSTANCE', note: 'MySQL 8.0 instance reconfiguration (e.g. InnoDB redo log rotation) is not supported' },
  { category: 'DDL', feature: 'ALTER PROCEDURE', note: 'Modifying stored procedure characteristics is not supported (no stored procedures)' },
  { category: 'DDL', feature: 'ALTER RESOURCE GROUP', note: 'Resource group VCPU/thread priority management is not supported' },
  { category: 'DDL', feature: 'ALTER SERVER', note: 'FEDERATED engine server connection options are not supported' },
  { category: 'DDL', feature: 'ALTER TABLESPACE', note: 'Tablespace data file add/drop/rename is not supported' },
  { category: 'DDL', feature: 'CREATE RESOURCE GROUP', note: 'Resource group creation (VCPU affinity, thread priority) is not supported' },
  { category: 'DDL', feature: 'CREATE SERVER', note: 'FEDERATED engine remote server definitions are not supported' },
  { category: 'DDL', feature: 'CREATE SPATIAL REFERENCE SYSTEM', note: 'Custom spatial reference systems for GIS are not supported' },
  { category: 'DDL', feature: 'CREATE TABLESPACE', note: 'General/undo tablespace creation is not supported; MatrixOne manages storage automatically' },
  { category: 'DDL', feature: 'DROP RESOURCE GROUP', note: 'Resource group removal is not supported' },
  { category: 'DDL', feature: 'DROP SERVER', note: 'FEDERATED server definition removal is not supported' },
  { category: 'DDL', feature: 'DROP SPATIAL REFERENCE SYSTEM', note: 'SRS definition removal is not supported' },
  { category: 'DDL', feature: 'DROP TABLESPACE', note: 'Tablespace removal is not supported; MatrixOne manages storage automatically' },

  // DML
```

- [ ] **Step 2: Commit**

```bash
git add scripts/generate-unsupported-features.js
git commit -m "feat: add 15 new DDL entries to MySQL unsupported features curated list"
```

---

### Task 2: Add new DML and Transactions curated entries

**Files:**
- Modify: `scripts/generate-unsupported-features.js` (DML section and Transactions section)

- [ ] **Step 1: Add 4 DML entries after existing DML block**

Replace the blank line between `// DML` block end and `// DCL` (around line 48-50):

Find:
```javascript
  { category: 'DML', feature: 'SET NAMES / SET CHARACTER SET', note: 'Not supported; only utf8mb4 charset is available so charset switching is unnecessary' },

  // DCL
```

Replace with:
```javascript
  { category: 'DML', feature: 'SET NAMES / SET CHARACTER SET', note: 'Not supported; only utf8mb4 charset is available so charset switching is unnecessary' },
  { category: 'DML', feature: 'IMPORT TABLE', note: 'MySQL 8.0 IMPORT TABLE (import InnoDB .ibd tablespace files) is not supported' },
  { category: 'DML', feature: 'Parenthesized Query Expressions', note: 'MySQL 8.0.19+ parenthesized query blocks with per-block ORDER BY / LIMIT are not supported' },
  { category: 'DML', feature: 'TABLE statement', note: 'MySQL 8.0.19+ TABLE tablename (equivalent to SELECT * FROM) is not supported' },
  { category: 'DML', feature: 'VALUES statement (DML)', note: 'MySQL 8.0.19+ VALUES row_constructor_list as standalone DML is not supported' },

  // DCL
```

- [ ] **Step 2: Add 2 Transaction entries**

Find this block in the Transactions section (around line 88-90):
```javascript
  { category: 'Transactions', feature: 'LOCK TABLES / UNLOCK TABLES', note: 'Explicit table-level locking is not supported' },
  { category: 'Transactions', feature: 'FLUSH TABLES WITH READ LOCK', note: 'Global read locks are not supported' },
  { category: 'Transactions', feature: 'SET operations within transactions', note: 'SET variable assignments are not allowed within an active transaction block' },
```

Replace with:
```javascript
  { category: 'Transactions', feature: 'SAVEPOINT / ROLLBACK TO SAVEPOINT', note: 'Savepoints within transactions are not supported' },
  { category: 'Transactions', feature: 'RELEASE SAVEPOINT', note: 'Releasing a transaction savepoint is not supported (no savepoints)' },
  { category: 'Transactions', feature: 'XA transactions (distributed transactions)', note: 'XA START / XA END / XA PREPARE / XA COMMIT are not supported; MatrixOne uses its own distributed transaction model' },
  { category: 'Transactions', feature: 'LOCK TABLES / UNLOCK TABLES', note: 'Explicit table-level locking is not supported' },
  { category: 'Transactions', feature: 'LOCK INSTANCE FOR BACKUP / UNLOCK INSTANCE', note: 'MySQL 8.0 backup-oriented global instance locks are not supported' },
  { category: 'Transactions', feature: 'FLUSH TABLES WITH READ LOCK', note: 'Global read locks are not supported' },
  { category: 'Transactions', feature: 'SET operations within transactions', note: 'SET variable assignments are not allowed within an active transaction block' },
```

Note: RELEASE SAVEPOINT is inserted after the existing SAVEPOINT entry. LOCK INSTANCE FOR BACKUP is inserted after LOCK TABLES.

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-unsupported-features.js
git commit -m "feat: add DML and Transaction entries to MySQL unsupported features curated list"
```

---

### Task 3: Expand Replication curated entries

**Files:**
- Modify: `scripts/generate-unsupported-features.js` (Replication section)

- [ ] **Step 1: Replace and expand Replication block**

Find the existing block (around line 92-95):
```javascript
  // Replication & Binary Log
  { category: 'Replication', feature: 'Binary log (binlog)', note: 'MySQL binary log and related statements (SHOW BINARY LOGS, SHOW MASTER STATUS, PURGE BINARY LOGS, etc.) are not supported; MatrixOne uses its own CDC mechanism' },
  { category: 'Replication', feature: 'CHANGE MASTER / START SLAVE / STOP SLAVE', note: 'MySQL replication protocol is not supported; MatrixOne has mo_cdc and pub/sub instead' },
  { category: 'Replication', feature: 'RESET MASTER / RESET SLAVE', note: 'MySQL replication management is not supported' },
```

Replace with:
```javascript
  // Replication & Binary Log
  { category: 'Replication', feature: 'Binary log (binlog)', note: 'MySQL binary log and related statements are not supported; MatrixOne uses its own CDC mechanism' },
  { category: 'Replication', feature: 'SHOW BINARY LOGS / SHOW MASTER LOGS', note: 'Listing binary log files on the server is not supported' },
  { category: 'Replication', feature: 'SHOW BINLOG EVENTS', note: 'Displaying events in a binary log is not supported' },
  { category: 'Replication', feature: 'SHOW MASTER STATUS', note: 'Showing source server binary log position is not supported' },
  { category: 'Replication', feature: 'PURGE BINARY LOGS', note: 'Deleting binary log files is not supported' },
  { category: 'Replication', feature: 'SHOW REPLICA STATUS / SHOW SLAVE STATUS', note: 'Showing replica server status is not supported' },
  { category: 'Replication', feature: 'SHOW REPLICAS / SHOW SLAVE HOSTS', note: 'Listing registered replicas is not supported' },
  { category: 'Replication', feature: 'SHOW RELAYLOG EVENTS', note: 'Displaying relay log events is not supported' },
  { category: 'Replication', feature: 'CHANGE MASTER TO / START SLAVE / STOP SLAVE', note: 'MySQL replication protocol (source/replica management) is not supported; MatrixOne has mo_cdc and pub/sub instead' },
  { category: 'Replication', feature: 'RESET MASTER / RESET SLAVE', note: 'MySQL replication management commands are not supported' },
  { category: 'Replication', feature: 'CLONE LOCAL DATA DIRECTORY', note: 'MySQL 8.0 clone plugin local cloning is not supported' },
  { category: 'Replication', feature: 'CLONE INSTANCE', note: 'MySQL 8.0 clone plugin remote cloning is not supported' },
```

- [ ] **Step 2: Commit**

```bash
git add scripts/generate-unsupported-features.js
git commit -m "feat: expand Replication entries in MySQL unsupported features curated list"
```

---

### Task 4: Add new SHOW and Administration curated entries

**Files:**
- Modify: `scripts/generate-unsupported-features.js` (SHOW and Administration sections)

- [ ] **Step 1: Add 5 SHOW entries**

Find this line in the SHOW section (around line 107):
```javascript
  { category: 'SHOW Statements', feature: 'SHOW ERRORS / SHOW WARNINGS', note: 'Results differ significantly from MySQL due to different implementation' },
```

Insert after it:
```javascript
  { category: 'SHOW Statements', feature: 'SHOW CREATE EVENT', note: 'Not supported (no event scheduler)' },
  { category: 'SHOW Statements', feature: 'SHOW CREATE PROCEDURE', note: 'Not supported (no stored procedures)' },
  { category: 'SHOW Statements', feature: 'SHOW CREATE TRIGGER', note: 'Not supported (no triggers)' },
  { category: 'SHOW Statements', feature: 'SHOW FUNCTION CODE', note: 'Not supported (no stored function internals to display)' },
  { category: 'SHOW Statements', feature: 'SHOW PROCEDURE CODE', note: 'Not supported (no stored procedure internals to display)' },
```

- [ ] **Step 2: Add 1 Administration entry**

Find this line in the Administration section (around line 123-124):
```javascript
  { category: 'Administration', feature: 'SHUTDOWN', note: 'Server shutdown statement is not supported' },
  { category: 'Administration', feature: 'HELP statement', note: 'HELP command for SQL syntax reference is not supported' },
```

Insert before HELP:
```javascript
  { category: 'Administration', feature: 'BINLOG statement', note: 'The BINLOG statement for executing events decoded from a binary log is not supported' },
```

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-unsupported-features.js
git commit -m "feat: add SHOW and Administration entries to MySQL unsupported features curated list"
```

---

### Task 5: Regenerate output page and verify

**Files:**
- Regenerate: `docs/MatrixOne/Reference/mysql-unsupported-features.md`

- [ ] **Step 1: Run generator**

```bash
node scripts/generate-unsupported-features.js
```

Expected: Output shows Curated count ~128 (up from 94), script exits 0.

- [ ] **Step 2: Verify summary count**

```bash
head -25 docs/MatrixOne/Reference/mysql-unsupported-features.md
```

Expected: `Completely Missing (curated)` shows ~128.

- [ ] **Step 3: Spot-check new entries in output**

```bash
grep -n "ALTER INSTANCE\|IMPORT TABLE\|RELEASE SAVEPOINT\|LOCK INSTANCE\|SHOW BINLOG EVENTS\|CLONE INSTANCE\|SHOW CREATE EVENT\|BINLOG statement" docs/MatrixOne/Reference/mysql-unsupported-features.md
```

Expected: All 8 entries found in output.

- [ ] **Step 4: Verify no duplicates by checking category counts**

```bash
grep -c "^| " docs/MatrixOne/Reference/mysql-unsupported-features.md
```

- [ ] **Step 5: Commit**

```bash
git add docs/MatrixOne/Reference/mysql-unsupported-features.md
git commit -m "docs: regenerate MySQL unsupported features page with expanded curated list"
```
