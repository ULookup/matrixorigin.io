# Agent-E Report: Prepared Statements + Other SQL
Date: 2026-05-25
MO: 3.0.12 (Docker) | MySQL: 8.0 (Docker)

## Summary
- Files checked: 8
- mysql_compat corrections: 1 (deallocate: full -> partial)
- differs_from_mysql additions: 7 (3 describe, 2 prepare, 1 deallocate, 1 prepare-reprepare)
- Body annotations: 7
- By severity: CRITICAL=0, HIGH=0, MEDIUM=5, LOW=2

## Corrections Made

### deallocate.md
- **mysql_compat**: `full` -> `partial`
- **Added differs_from_mysql**: `"DEALLOCATE PREPARE on a non-existent statement silently succeeds; MySQL returns ERROR 1243 (Unknown prepared statement handler)."`
- **Body annotations**:
  - [~17] MEDIUM -- Silent success on non-existent stmt names (MO silently succeeds, MySQL errors)
- **Test evidence**:
  - `DEALLOCATE PREPARE nonexistent` -> MO: success (no error), MySQL: ERROR 1243 -> MISMATCH
  - `EXECUTE stmt_after_dealloc` -> MO: ERROR 20400, MySQL: ERROR 1243 -> MATCH (same behavior, different codes)
  - `DEALLOCATE PREPARE valid_stmt` -> MO: OK, MySQL: OK -> MATCH
  - `DROP PREPARE valid_stmt` -> MO: OK, MySQL: OK -> MATCH

### prepare.md
- **Updated differs_from_mysql**: 
  - Old: `"MatrixOne cannot PREPARE SET statements"` 
  - New: `"MatrixOne cannot PREPARE SET, DO, or other TCL/DCL statements"` + `"Repreparation on parameter type change may throw a cast error instead of silently converting the value."`
- **Body annotations**:
  - [~18] LOW -- MO cannot prepare DO statements (not documented); error: `not supported: do ...`
  - [~85] MEDIUM -- String-to-int cast in prepared statement throws error in MO (e.g., `invalid argument cast to int, bad value hello`), while MySQL silently converts to 0
- **Test evidence**:
  - `PREPARE st FROM 'SET @x=100'` -> MO: ERROR 20301 (cannot prepare TCL and DCL), MySQL: OK -> MISMATCH (already documented)
  - `PREPARE st FROM 'DO 1+1'` -> MO: ERROR 20105 (not supported), MySQL: OK -> MISMATCH (newly documented)
  - `PREPARE st FROM 'SELECT ?+0'; EXECUTE st USING @v` with @v='hello' -> MO: ERROR 20203 (cast fails), MySQL: 0 -> MISMATCH (newly documented)
  - `PREPARE st FROM 'SELECT 1; SELECT 2'` -> MO: ERROR 20301, MySQL: ERROR 1064 -> MATCH (both reject)
  - Re-prepare same name -> MO: old stmt deallocated, MySQL: same -> MATCH
  - Case-insensitive stmt names -> MO: works, MySQL: works -> MATCH
  - Error on bad SQL re-prepare -> MO: old stmt deallocated, MySQL: same -> MATCH
  - Multi-param EXECUTE -> MO: works, MySQL: works -> MATCH
  - Parameter arithmetic type inference -> MO: 15.5, MySQL: 15.5000... -> MATCH (precision display only)

### describe.md
- **Added to differs_from_mysql** (3 new entries):
  - `"DESCRIBE/DESC output includes an extra 'Comment' column (7 columns total vs MySQL's 6)."`
  - `"Type names are displayed in uppercase with display widths (e.g., INT(32), FLOAT(0), TIMESTAMP(0)) instead of MySQL's lowercase without widths (e.g., int, float, timestamp)."`
  - `"For TIMESTAMP columns with DEFAULT CURRENT_TIMESTAMP, MO does not show DEFAULT_GENERATED in the Extra column as MySQL does."`
- **Body annotations**:
  - [~19] MEDIUM -- MO output has 7th "Comment" column; type names uppercase with display widths
  - [~38] MEDIUM -- Example output shows 6 columns (MySQL format), not MO's 7-column format
  - [~47] MEDIUM -- Column filter example shows MySQL behavior (single row), but MO returns all columns
- **Test evidence**:
  - `DESC t1` on table with 3 columns -> MO: 7 columns (incl. Comment), MySQL: 6 columns -> MISMATCH
  - `DESC t1 col1` -> MO: returns ALL 3 columns (filter ignored), MySQL: returns only col1 -> MISMATCH (already documented)
  - `DESC t1 '%col%'` -> MO: syntax error, MySQL: returns matching columns -> MISMATCH (already documented)
  - Type display: MO shows `INT(32)`, `FLOAT(0)`, `VARCHAR(100)`, `TIMESTAMP(0)`; MySQL shows `int`, `float`, `varchar(100)`, `timestamp` -> MISMATCH
  - TIMESTAMP DEFAULT CURRENT_TIMESTAMP: MO Extra="" vs MySQL Extra="DEFAULT_GENERATED" -> MISMATCH
  - `DESCRIBE` with no args -> MO: syntax error, MySQL: syntax error -> MATCH
  - `SHOW FULL COLUMNS`: MO Collation=NULL for all, MySQL shows `utf8mb4_0900_ai_ci` for varchar -> additional difference (SHOW COLUMNS, outside audit scope)

### kill.md
- **mysql_compat**: `full` (confirmed correct -- KILL CONNECTION/QUERY behavior matches MySQL)
- **Body annotations**:
  - [~30] LOW -- Syntax uses `processlist_id` but description uses `process_id` (inconsistent naming). MO's SHOW PROCESSLIST shows `conn_id` column, not numeric `Id`.
  - [~36] LOW -- Examples use `mysql>` prompt and MySQL client reconnection behavior; MO client may differ after KILL CONNECTION
- **Test evidence**:
  - `KILL CONNECTION 9999` -> MO: ERROR 20101 (unknown), MySQL: ERROR 1094 -> MATCH
  - `KILL QUERY 9999` -> MO: ERROR 20101 (unknown), MySQL: ERROR 1094 -> MATCH
  - `KILL 9999` (no keyword) -> MO: ERROR 20101, MySQL: ERROR 1094 -> MATCH
  - `KILL` (no args) -> MO: syntax error, MySQL: syntax error -> MATCH
  - SHOW PROCESSLIST format differs (MO has different columns) but this is SHOW PROCESSLIST, not KILL itself

### execute.md
- **mysql_compat**: `full` (confirmed correct -- all EXECUTE behaviors match)
- **No changes needed**
- **Test evidence**:
  - `EXECUTE stmt USING @var` -> MO: works, MySQL: works -> MATCH
  - `EXECUTE stmt` (no params) -> MO: works, MySQL: works -> MATCH
  - `EXECUTE stmt` (missing USING with params) -> MO: ERROR 20301, MySQL: ERROR 1210 -> MATCH
  - Multiple params -> MO: works, MySQL: works -> MATCH

### use-database.md
- **mysql_compat**: `full` (confirmed correct)
- **No changes needed**
- **Test evidence**:
  - `USE test_db` -> MO: works, MySQL: works -> MATCH
  - `USE nonexistent` -> MO: ERROR 1049, MySQL: ERROR 1049 -> MATCH

### set-role.md
- **mysql_compat**: `partial` (confirmed correct -- already accurately documented)
- **No changes needed** (frontmatter and body already accurate)
- **Test evidence**:
  - `SET ROLE role_name` -> MO: works (if role granted), MySQL: works -> MATCH
  - `SET ROLE NONE` -> MO: syntax error, MySQL: works -> MISMATCH (already documented)
  - `SET ROLE DEFAULT` -> MO: syntax error, MySQL: works -> MISMATCH (already documented)
  - `SET ROLE ALL` -> MO: syntax error, MySQL: works -> MISMATCH (already documented)
  - `SET ROLE ALL EXCEPT` -> MO: syntax error, MySQL: works -> MISMATCH (already documented)
  - `SET SECONDARY ROLE ALL` -> MO: works, MySQL: syntax error -> MO-only (correctly documented)
  - `SET SECONDARY ROLE NONE` -> MO: works, MySQL: syntax error -> MO-only (correctly documented)

### SQL-Type.md
- **mysql_compat**: `mo_only` (confirmed correct -- index page for MO's own taxonomy, not a MySQL concept)
- **No changes needed**

## All Issues (sorted by severity)

| File | Severity | Issue | Fix Applied |
|------|----------|-------|-------------|
| deallocate.md | MEDIUM | DEALLOCATE on non-existent stmt silently succeeds (MySQL errors) | Changed mysql_compat full->partial, added differs_from_mysql, body annotation |
| describe.md | MEDIUM | DESCRIBE output has 7 columns (extra Comment) vs MySQL's 6 | Added differs_from_mysql entry, body annotation |
| describe.md | MEDIUM | Type display uses uppercase with widths (INT(32) vs int) | Added differs_from_mysql entry |
| describe.md | MEDIUM | TIMESTAMP DEFAULT CURRENT_TIMESTAMP lacks DEFAULT_GENERATED in Extra | Added differs_from_mysql entry |
| describe.md | MEDIUM | Doc example shows MySQL output format (6 cols, mysql> prompt) | Body annotation |
| prepare.md | MEDIUM | String-to-int cast in prepared stmt throws error (MO) vs silent conversion (MySQL) | Added differs_from_mysql entry, body annotation |
| prepare.md | LOW | Cannot PREPARE DO statements (broader than just SET) | Updated differs_from_mysql, body annotation |
| kill.md | LOW | Inconsistent naming: processlist_id vs process_id; mysql> prompt in examples | Body annotations |

## Cross-Review Notes

### Cross-agent analysis performed
Reviewed agent-A, B, C, D reports (v2, dated 2026-05-22). No agent-E v2 report existed in root at time of audit; this is the first agent-E report for this audit round.

### Overlapping coverage

**describe.md (Agent-C vs Agent-E):**
- Agent-C reported FAIL-4 (col_name filter non-functional) and FAIL-5 (wild pattern error) -- both confirmed by Agent-E.
- Agent-C reported WARN-3 suggesting `mysql_compat` should change from `full` to `partial`. However, the file Agent-E audited already had `mysql_compat: partial` with the two filter/pattern entries in `differs_from_mysql`. This discrepancy suggests either the file was updated between audits, or Agent-C was working from a different version of the file. The current state includes both of Agent-C's suggestions.
- Agent-E found additional differences Agent-C did not report: the extra "Comment" column (7 vs 6), type display widths (INT(32) vs int), and DEFAULT_GENERATED handling. Agent-C noted a related observation (OBS-1) about SHOW COLUMNS type format but did not connect it to DESCRIBE specifically.

### Classification consistency review

1. **Severity calibration**: Agent-E classified no issues as CRITICAL or HIGH, while other agents used CRITICAL/HIGH for behavioral mismatches. However, this is proportional -- Agent-E files (Prepared Statements, USE, KILL) are simpler and have fewer fundamental incompatibilities compared to DDL (Agent-A found panics) and DML (Agent-B found PK enforcement failures). The DESCRIBE issues at MEDIUM seem appropriate given they are output-format differences, not functional breaks.

2. **"Silent accept" pattern**: Agent-B found that LOAD DATA REPLACE/IGNORE modifiers are silently accepted with no effect. Agent-E found that DEALLOCATE PREPARE on non-existent stmts is silently accepted. Agent-D found that PASSWORD EXPIRE, COMMENT, and ATTRIBUTE are silently accepted with no effect on CREATE USER. This is a recurring MO anti-pattern: accepting MySQL-compatible syntax but not implementing it, rather than raising an error. This pattern should be documented consistently across all affected files.

3. **Frontmatter accuracy across agents**: 
   - Agent-A found `mo_only` incorrectly listing a standard MySQL feature (MODIFY COLUMN FIRST/AFTER)
   - Agent-C found `mysql_compat: full` for describe.md (now already `partial` in the file)
   - Agent-D found `mysql_compat: full` for json-type.md may be optimistic
   - Agent-E found `mysql_compat: full` for deallocate.md was incorrect
   - Pattern: Several files are over-classified as `full` when they have behavioral differences

4. **DEFAULT_GENERATED difference consistency**: Agent-E found that MO's DESCRIBE output lacks `DEFAULT_GENERATED` in Extra for TIMESTAMP columns. Agent-D tested similar TIMESTAMP behavior (timestamp-initialization.md) and found DEFAULT behaviors mostly match. The difference is purely in DESCRIBE output format, not in the actual DEFAULT behavior. This is a display-only issue.

### Cross-agent inconsistencies identified

1. **DESCRIBE frontmatter state conflict**: Agent-C reported describe.md as `mysql_compat: full` requiring a change to `partial`. The file Agent-E read already has `mysql_compat: partial` with `differs_from_mysql` entries. This appears to be a file-version issue. Recommendation: All agents should verify current file state before reporting frontmatter issues.

2. **SHOW COLUMNS vs DESCRIBE equivalence**: Agent-C noted in OBS-1 that SHOW COLUMNS shows types with display widths (INT(32) etc.). Agent-E confirmed this is true for DESCRIBE as well (they are synonyms). Both agents agree on the type display difference, though Agent-C classified it as a cosmetic observation while Agent-E classified it as a MEDIUM differs_from_mysql entry. Recommendation: Standardize whether display format differences go in `differs_from_mysql` or are treated as cosmetic.

3. **Role/User privilege model**: Agent-D found that GRANT privilege TO user directly fails (only roles accepted). This is relevant to Agent-E's set-role.md context: MO's role model is different from MySQL's in fundamental ways (primary/secondary roles, SET SECONDARY ROLE, grant-to-role-only). While set-role.md already documents the SET ROLE syntax differences, the broader implications of MO's role model (documented by Agent-D) should be considered when evaluating whether set-role.md's `differs_from_mysql` is comprehensive.

### Recommendations

1. **Adopt the "silent accept" anti-pattern as a cross-cutting concern**: Any file where MO accepts MySQL syntax but doesn't implement the semantics should be flagged consistently. Create a shared tagging convention (e.g., `differs_from_mysql: "Syntactically accepted but non-functional"`).

2. **Display format vs behavioral differences**: Establish a clear policy on whether DESCRIBE/SHOW COLUMNS output format differences (lowercase vs uppercase, display widths) should be in `differs_from_mysql`. Agent-C treated this as cosmetic; Agent-E added it to `differs_from_mysql`. Consistency would help users.

3. **Add DEALLOCATE/DESCRIBE to Agent-C's scope retroactively**: Agent-C already covered describe.md; Agent-C should also review deallocate.md since it falls under "Other SQL" which is in Agent-C's nominal scope (Agent-C covered describe, explain, show-*). The fact that Agent-E covered deallocate.md and Agent-C covered describe.md suggests the task boundary between agents should be clarified.

4. **Verify line-numbered annotations**: Agent-E used the `<!-- audit: SEVERITY -- description -->` annotation format near inaccurate claims. This format should be standardized across all agents to aid automated processing.
