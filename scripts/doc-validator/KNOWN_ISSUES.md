# doc-validator — Known Issues

## 1. `Unknown database doc_test_*` on PARTITION BY DDL in multi-block files

**Symptom.** When a markdown file contains several ```` ```sql ```` blocks
whose first/early statements are `CREATE TABLE ... PARTITION BY ...`, the
execution checker fails with:

```
DDL execution failed: Unknown database doc_test_docs_matrixone_...
```

Replaying the same statements directly via `mysql -h 127.0.0.1 -P 6001`
succeeds, so the SQL itself is valid on the 3.0-dev image. The connection
context created by `utils/db-connection.js :: createTestDatabase` (which
issues `CREATE DATABASE ... IF NOT EXISTS` + `USE <db>`) appears to be
dropped mid-file before the next block is executed.

**Reproduction (as of 2026-05-05)**:

- `docs/MatrixOne/Performance-Tuning/optimization-concepts/through-partition-by.md`
- `docs/MatrixOne/Reference/Limitations/mo-partition-support.md`

**Temporary workaround.** The offending blocks in the two files above are
marked with `<!-- validator-ignore-exec -->` so they still undergo syntax
validation but are skipped by the execution runner. Once the root cause in
`checkers/sql-runner.js` (or the underlying mysql2 connection lifecycle) is
fixed, remove the markers and let the full execution scan pass naturally.

**Suspected root cause.** Worth investigating:

- Whether the mysql2 pool evicts the connection between blocks.
- Whether any block in these files issues `DROP DATABASE` on the active DB.
- Whether `ensureConnection()` in `db-connection.js` silently reopens a
  fresh connection without replaying the `USE <test-db>` statement.

Fix should make `checkFile()` idempotent: re-issue `USE <this.currentTestDb>`
before every block (or every statement) rather than relying on the session
sticky state.
