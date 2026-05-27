# verify-mo313 — Multi-Agent Parallel Documentation Verification

Verifies `mysql_compat` frontmatter accuracy for all 402 SQL Reference docs against MatrixOne 3.0.13 using 28 parallel agents (14 static + 14 live) with cross-referenced merge.

## Quick Start

```bash
# 1. Start MO 3.0.13 and create test databases
./scripts/verify-mo313/orchestrate.sh preflight

# 2. Print dispatch instructions
./scripts/verify-mo313/orchestrate.sh dispatch

# 3. Dispatch 28 agents in Claude Code (see dispatch output above)
#    Each agent gets a parameterized prompt from prompts/static-agent.md or prompts/live-agent.md
#    Run static and live agents for ALL 14 buckets

# 4. Check which reports are done
./scripts/verify-mo313/orchestrate.sh status

# 5. When all 28 reports exist, run merge
./scripts/verify-mo313/orchestrate.sh merge

# 6. Clean up
./scripts/verify-mo313/orchestrate.sh cleanup
```

## Files

```
scripts/verify-mo313/
├── orchestrate.sh              # Pre-flight, dispatch, merge, status, cleanup
├── prompts/
│   ├── static-agent.md         # Template: static verification per bucket
│   ├── live-agent.md           # Template: live SQL execution per bucket
│   └── merge-agent.md          # Template: cross-reference 28 reports
├── schemas/
│   ├── static-report.schema.json
│   ├── live-report.schema.json
│   └── final-report.schema.json
└── README.md
```

## Agent Dispatch (manual, in Claude Code)

For each of the 14 buckets, launch two agents in Claude Code:

**Static agent:**
```
Read prompts/static-agent.md (replace {{BUCKET_NAME}} with the bucket name).
Read bucket-manifest.json for your bucket's file list.
For each file, compare MO doc against MySQL 8.0 docs.
Output to audit-output-3.0.13/static-{bucket}-report.json
```

**Live agent:**
```
Read prompts/live-agent.md (replace {{BUCKET_NAME}} with the bucket name).
Connect to MO 3.0.13 at 127.0.0.1:6001 (root/111), use database audit_{bucket}.
Read bucket-manifest.json for your bucket's file list.
For each file, execute SQL examples against MO.
Output to audit-output-3.0.13/live-{bucket}-report.json
```

Launch all 28 in parallel. Each agent works independently.

## Merge

After all 28 reports are collected:

```
Read prompts/merge-agent.md.
Read all 28 report files from audit-output-3.0.13/.
Cross-reference, resolve conflicts, output final-report.json.
```

## Output

- `audit-output-3.0.13/static-{bucket}-report.json` (14 files)
- `audit-output-3.0.13/live-{bucket}-report.json` (14 files)
- `audit-output-3.0.13/final-report.json` (1 file, merged)
