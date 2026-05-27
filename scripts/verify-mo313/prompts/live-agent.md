# Live Verification Agent — Bucket: {{BUCKET_NAME}}

You are verifying the `mysql_compat` frontmatter field accuracy by executing SQL examples from MatrixOne documentation against a running MO 3.0.13 instance.

## Connection

- Host: 127.0.0.1
- Port: 6001
- User: root
- Password: 111
- Database: `audit_{{BUCKET_NAME}}`

Before starting any checks, connect and verify:
```bash
mysql -h127.0.0.1 -P6001 -uroot -p111 -e "SELECT VERSION(); USE audit_{{BUCKET_NAME}}; SELECT DATABASE();"
```

## Your Bucket

Read `bucket-manifest.json` and extract all files belonging to bucket `{{BUCKET_NAME}}`.

## What You Check

For each file in your bucket, read the `.md` source, extract SQL examples, and execute them.

### compat = `full`
- Execute all SQL examples from the documentation
- Verify the actual output matches the expected output shown in the doc
- If syntax error or different result → FAIL
- If works exactly as documented → PASS

### compat = `partial`
- Execute SQL examples that exercise each `differs_from_mysql` entry
- Verify the described difference is actually present in MO 3.0.13
- If the claimed difference no longer exists (MO now matches MySQL) → FAIL (differs list is stale)
- If the difference is accurately described → PASS

### compat = `mo_only`
- Execute the MO-specific syntax/functions documented
- Verify they actually work in MO 3.0.13
- If syntax error or feature missing → FAIL

### compat = `none` (CRITICAL — this is the priority check)
- Construct the MySQL-standard syntax for the claimed-unsupported feature
- Execute it on MO 3.0.13
- If you get "unsupported" / "syntax error" / "not supported" → PASS (truly unsupported)
- If it EXECUTES SUCCESSFULLY → CRITICAL FAIL (the feature IS supported, compat should be changed)
- If you get a different error (permissions, resource limits, etc.) → WARN (inconclusive)

### compat = `unknown`
- Execute SQL examples
- Based on behavior, suggest: `full` (matches MySQL), `partial` (works but differs), `mo_only` (MO-specific), or `none` (unsupported)

## Edge Cases

- **SQL needs prior setup** (CREATE TABLE before INSERT, etc.): Build the minimal reproduction. Create temp tables, insert test data.
- **SQL cannot execute** (needs special privileges, external data): Mark `SKIPPED` with explicit reason.
- **Execution causes server crash/panic**: Mark `ERROR` with severity CRITICAL. This is an MO bug.
- **Execution hangs**: Set a 30-second timeout per statement. Mark `ERROR` if timeout.

## Cleanup

After each file's checks, drop any test tables you created in `audit_{{BUCKET_NAME}}` to avoid cross-file interference.

## Output Format

Produce a single JSON file: `live-{{BUCKET_NAME}}-report.json`

Use the schema defined in `scripts/verify-mo313/schemas/live-report.schema.json`.

Key rules:
- One JSON object per file, with an array of findings
- Each finding has: verdict (PASS/FAIL/WARN/SKIPPED/ERROR), severity, description, evidence
- evidence MUST include `sql_executed` and `actual_output`
- Include summary counts
- Mark `incomplete: true` only if you cannot finish all files

## Important

- Work file by file. Do NOT skip any file in your bucket.
- For each file, first read the .md source to understand the claims, THEN execute SQL.
- Always use the `audit_{{BUCKET_NAME}}` database. Create/drop test tables within it.
- Always clean up test tables after each file.
- Write the JSON output to disk when complete.
