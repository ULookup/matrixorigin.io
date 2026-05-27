# Multi-Agent Parallel Verification (MO 3.0.13) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create agent prompt templates, JSON schemas, and orchestration scripts to run 28 parallel agents (14 static + 14 live) verifying `mysql_compat` accuracy for all 402 SQL Reference files against MO 3.0.13, with Merge Agent cross-referencing both passes into `final-report.json`.

**Architecture:** Each static/live agent gets an identical prompt template parameterized by bucket name. 28 agents run in parallel. A Merge Agent consumes all 28 JSON reports and produces the final cross-referenced report. All prompts are self-contained markdown files; the orchestrator handles pre-flight (Docker, databases) and triggers agent dispatch.

**Tech Stack:** Bash (orchestration), JSON Schema (report validation), Markdown (agent prompts), Docker + mysql CLI (MO connection)

---

## File Structure

```
scripts/verify-mo313/
├── orchestrate.sh                    # Pre-flight + agent dispatch instructions
├── prompts/
│   ├── static-agent.md               # Static agent prompt template
│   ├── live-agent.md                 # Live agent prompt template
│   └── merge-agent.md                # Merge agent prompt template
├── schemas/
│   ├── static-report.schema.json     # Static agent output schema
│   ├── live-report.schema.json       # Live agent output schema
│   └── final-report.schema.json      # Merge agent output schema
└── README.md                         # Usage instructions
```

---

### Task 1: Create JSON output schemas

**Files:**
- Create: `scripts/verify-mo313/schemas/static-report.schema.json`
- Create: `scripts/verify-mo313/schemas/live-report.schema.json`
- Create: `scripts/verify-mo313/schemas/final-report.schema.json`

- [ ] **Step 1: Create static agent report schema**

Write `scripts/verify-mo313/schemas/static-report.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "static-report",
  "type": "object",
  "required": ["agent", "bucket", "mo_version", "generated_at", "files"],
  "properties": {
    "agent": { "const": "static" },
    "bucket": { "type": "string", "description": "Bucket name from bucket-manifest.json" },
    "mo_version": { "type": "string", "description": "Target MO version, e.g. 3.0.13" },
    "generated_at": { "type": "string", "format": "date-time" },
    "summary": {
      "type": "object",
      "properties": {
        "total_files": { "type": "integer" },
        "total_claims": { "type": "integer" },
        "pass": { "type": "integer" },
        "fail": { "type": "integer" },
        "warn": { "type": "integer" },
        "skipped": { "type": "integer" }
      }
    },
    "files": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["file", "current_compat", "findings"],
        "properties": {
          "file": { "type": "string", "description": "Path relative to repo root" },
          "current_compat": { "enum": ["full", "partial", "mo_only", "none", "unknown"] },
          "suggested_compat": { "enum": ["full", "partial", "mo_only", "none", "unknown"] },
          "findings": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["verdict", "severity", "description", "evidence"],
              "properties": {
                "verdict": { "enum": ["PASS", "FAIL", "WARN", "SKIPPED"] },
                "severity": { "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
                "field_checked": { "type": "string", "description": "Which compat aspect: compat_label, differs_list, mo_only_list, body_text, missing_from_doc" },
                "description": { "type": "string" },
                "evidence": {
                  "type": "object",
                  "required": ["mysql_ref"],
                  "properties": {
                    "mysql_ref": { "type": "string", "description": "MySQL 8.0 doc URL or section reference" },
                    "mysql_behavior": { "type": "string" },
                    "mo_doc_claim": { "type": "string" },
                    "suggestion": { "type": "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "incomplete": { "type": "boolean", "description": "True if agent timed out before finishing all files" }
  }
}
```

- [ ] **Step 2: Create live agent report schema**

Write `scripts/verify-mo313/schemas/live-report.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "live-report",
  "type": "object",
  "required": ["agent", "bucket", "mo_version", "generated_at", "files"],
  "properties": {
    "agent": { "const": "live" },
    "bucket": { "type": "string" },
    "mo_version": { "type": "string" },
    "generated_at": { "type": "string", "format": "date-time" },
    "summary": {
      "type": "object",
      "properties": {
        "total_files": { "type": "integer" },
        "total_claims": { "type": "integer" },
        "pass": { "type": "integer" },
        "fail": { "type": "integer" },
        "warn": { "type": "integer" },
        "skipped": { "type": "integer" },
        "errors": { "type": "integer" }
      }
    },
    "files": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["file", "current_compat", "findings"],
        "properties": {
          "file": { "type": "string" },
          "current_compat": { "enum": ["full", "partial", "mo_only", "none", "unknown"] },
          "findings": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["verdict", "severity", "description", "evidence"],
              "properties": {
                "verdict": { "enum": ["PASS", "FAIL", "WARN", "SKIPPED", "ERROR"] },
                "severity": { "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
                "field_checked": { "type": "string" },
                "description": { "type": "string" },
                "evidence": {
                  "type": "object",
                  "required": ["sql_executed", "actual_output"],
                  "properties": {
                    "sql_executed": { "type": "string" },
                    "actual_output": { "type": "string" },
                    "expected_behavior": { "type": "string" },
                    "matches_doc": { "type": "boolean" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "incomplete": { "type": "boolean" }
  }
}
```

- [ ] **Step 3: Create final report schema**

Write `scripts/verify-mo313/schemas/final-report.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "final-report",
  "type": "object",
  "required": ["meta", "summary", "by_severity", "by_bucket", "findings"],
  "properties": {
    "meta": {
      "type": "object",
      "required": ["mo_version", "generated_at", "total_files", "total_buckets", "static_agents", "live_agents"],
      "properties": {
        "mo_version": { "type": "string" },
        "generated_at": { "type": "string", "format": "date-time" },
        "total_files": { "type": "integer" },
        "total_buckets": { "type": "integer" },
        "static_agents": { "type": "integer" },
        "live_agents": { "type": "integer" },
        "missing_buckets": { "type": "array", "items": { "type": "string" }, "description": "Buckets where an agent failed to produce a report" }
      }
    },
    "summary": {
      "type": "object",
      "required": ["total_claims_checked", "pass", "confirmed_fail", "conflict", "live_only", "static_only", "needs_human_review"],
      "properties": {
        "total_claims_checked": { "type": "integer" },
        "pass": { "type": "integer" },
        "confirmed_fail": { "type": "integer" },
        "conflict": { "type": "integer" },
        "live_only": { "type": "integer" },
        "static_only": { "type": "integer" },
        "needs_human_review": { "type": "integer" }
      }
    },
    "by_severity": {
      "type": "object",
      "properties": {
        "critical": { "type": "integer" },
        "high": { "type": "integer" },
        "medium": { "type": "integer" },
        "low": { "type": "integer" }
      }
    },
    "by_bucket": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "pass": { "type": "integer" },
          "confirmed_fail": { "type": "integer" },
          "conflict": { "type": "integer" }
        }
      }
    },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["file", "merge_verdict", "severity", "description"],
        "properties": {
          "file": { "type": "string" },
          "merge_verdict": { "enum": ["PASS", "CONFIRMED FAIL", "CONFLICT", "LIVE_ONLY", "STATIC_ONLY"] },
          "severity": { "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
          "description": { "type": "string" },
          "static_evidence": { "type": "object" },
          "live_evidence": { "type": "object" },
          "auto_resolved": { "type": "boolean" },
          "needs_human_review": { "type": "boolean" },
          "suggested_action": { "type": "string" }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-mo313/schemas/
git commit -m "feat: add JSON schemas for static, live, and final reports"
```

---

### Task 2: Create Static Agent prompt template

**Files:**
- Create: `scripts/verify-mo313/prompts/static-agent.md`

- [ ] **Step 1: Write static agent prompt**

Write `scripts/verify-mo313/prompts/static-agent.md`:

```markdown
# Static Verification Agent — Bucket: {{BUCKET_NAME}}

You are verifying the `mysql_compat` frontmatter field accuracy for a subset of MatrixOne SQL documentation files by comparing them against MySQL 8.0 reference documentation.

## Your Bucket

Read `bucket-manifest.json` and extract all files belonging to bucket `{{BUCKET_NAME}}`. This is your file list.

For context, the JSON structure is:
```json
{
  "buckets": {
    "{{BUCKET_NAME}}": {
      "file_count": N,
      "files": [
        { "path": "docs/MatrixOne/Reference/...", "mysql_compat": "full|partial|mo_only|none|unknown", "has_sql_blocks": true }
      ]
    }
  }
}
```

## What You Check

For each file in your bucket, read the `.md` source. For each compat label, verify it against MySQL 8.0 docs:

### compat = `full`
- Does the MatrixOne documentation describe behavior identical to MySQL 8.0?
- Check MySQL 8.0 reference docs (use WebFetch on https://dev.mysql.com/doc/refman/8.0/en/ for the corresponding feature)
- If any behavioral difference is found → FAIL with evidence

### compat = `partial`
- Is each entry in `differs_from_mysql` accurate? (cross-check against MySQL 8.0 docs)
- Are there obvious MySQL behaviors that MO differs on but are NOT listed in `differs_from_mysql`?
- Are any claimed differences actually NOT different? (MO now matches MySQL)

### compat = `mo_only`
- Is this feature genuinely absent from MySQL 8.0?
- Search MySQL 8.0 docs for equivalent syntax/function
- If MySQL has it (or introduced it in 8.0.x) → FAIL

### compat = `none`
- Does MySQL 8.0 have this feature?
- If MySQL also doesn't have it → PASS (correctly labeled as unsupported by both)
- If MySQL has it and MO claims unsupported → FAIL (should likely be `partial` or `full`)
- If MO page doesn't exist at all for a MySQL feature → STATIC_ONLY finding

### compat = `unknown`
- Based on MySQL 8.0 comparison, suggest a classification
- If clearly matching MySQL → suggest `full`
- If matching with differences → suggest `partial`
- If clearly MO-only → suggest `mo_only`
- If clearly unsupported → suggest `none`

## Evidence Requirements

Every finding MUST include:
- `mysql_ref`: specific MySQL 8.0 doc URL or section (e.g., "https://dev.mysql.com/doc/refman/8.0/en/create-table.html")
- `mysql_behavior`: what MySQL 8.0 does
- `mo_doc_claim`: what the MO doc currently says
- `suggestion`: what action to take

## Output Format

Produce a single JSON file: `static-{{BUCKET_NAME}}-report.json`

Use the schema defined in `scripts/verify-mo313/schemas/static-report.schema.json`.

Key rules:
- One JSON object per file, with an array of findings
- Each finding has: verdict (PASS/FAIL/WARN/SKIPPED), severity (CRITICAL/HIGH/MEDIUM/LOW), description, evidence
- FAIL on classification errors, missing differences, incorrect mo_only claims
- WARN on minor issues (unclear phrasing, missing edge cases)
- SKIP files with no SQL content and no MySQL analog (e.g., pure MO architecture pages)
- Include summary counts (total_files, total_claims, pass, fail, warn, skipped)

## Important

- Work file by file. Do NOT skip any file in your bucket.
- For MySQL 8.0 lookups, use WebFetch on dev.mysql.com. If WebFetch fails, note the URL and mark finding as WARN with note "MySQL doc unreachable".
- Do NOT connect to any database. This is purely a documentation comparison.
- Write the JSON output to disk when complete.
```

- [ ] **Step 2: Commit**

```bash
git add scripts/verify-mo313/prompts/static-agent.md
git commit -m "feat: add static agent prompt template"
```

---

### Task 3: Create Live Agent prompt template

**Files:**
- Create: `scripts/verify-mo313/prompts/live-agent.md`

- [ ] **Step 1: Write live agent prompt**

Write `scripts/verify-mo313/prompts/live-agent.md`:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add scripts/verify-mo313/prompts/live-agent.md
git commit -m "feat: add live agent prompt template"
```

---

### Task 4: Create Merge Agent prompt template

**Files:**
- Create: `scripts/verify-mo313/prompts/merge-agent.md`

- [ ] **Step 1: Write merge agent prompt**

Write `scripts/verify-mo313/prompts/merge-agent.md`:

```markdown
# Merge Agent — Cross-Reference Static and Live Reports

You merge the findings from 14 static agents and 14 live agents into a single `final-report.json`.

## Inputs

Read all 28 JSON report files. They follow these naming patterns:
- `static-{bucket}-report.json` (14 files)
- `live-{bucket}-report.json` (14 files)

If any expected file is missing, note it in `meta.missing_buckets`.

## Phase 1: Normalize

For each file that appears in BOTH a static and live report:

1. Match by `file` path (exact string match)
2. Within the same file, match findings by semantic similarity. Two findings match if they describe the same issue (e.g., both mention "AUTO_INCREMENT differ"). Match generously — it's better to flag two findings as related than to miss a connection.
3. Findings in static but not live → STATIC_ONLY
4. Findings in live but not static → LIVE_ONLY

## Phase 2: Cross-Reference

For each matched finding pair, apply the merge matrix:

| Static | Live   | Merge Verdict   |
|--------|--------|-----------------|
| PASS   | PASS   | PASS            |
| FAIL   | FAIL   | CONFIRMED FAIL  |
| PASS   | FAIL   | CONFLICT        |
| FAIL   | PASS   | CONFLICT        |
| WARN   | PASS   | PASS (downgrade)|
| WARN   | FAIL   | CONFIRMED FAIL  |
| WARN   | WARN   | CONFIRMED FAIL (promote WARN) |
| (none) | PASS   | LIVE_ONLY       |
| (none) | FAIL   | LIVE_ONLY       |
| PASS   | (none) | STATIC_ONLY     |
| FAIL   | (none) | STATIC_ONLY     |

## Phase 3: CONFLICT Resolution

For each CONFLICT pair:
- Read both evidence objects carefully
- If one side has clearly stronger evidence (e.g., live execution result trumps static assumption), set `auto_resolved: true` and pick the winning verdict, with explanation in `description`
- If both sides have credible but contradictory evidence, set `needs_human_review: true`

## Phase 4: Output

Write `final-report.json` following the schema at `scripts/verify-mo313/schemas/final-report.schema.json`.

Required aggregations:
- `summary`: count all PASS / CONFIRMED FAIL / CONFLICT / LIVE_ONLY / STATIC_ONLY / needs_human_review
- `by_severity`: count CRITICAL / HIGH / MEDIUM / LOW
- `by_bucket`: per-bucket counts of pass / confirmed_fail / conflict

Each finding entry must include:
- `file`: the doc file path
- `merge_verdict`: from the merge matrix
- `severity`: highest severity from either agent (CRITICAL > HIGH > MEDIUM > LOW)
- `description`: synthesized description combining both agents' findings
- `static_evidence`: the static agent's evidence object (if exists)
- `live_evidence`: the live agent's evidence object (if exists)
- `auto_resolved`: true if the conflict was automatically resolved
- `needs_human_review`: true if human judgment is needed
- `suggested_action`: what to do (update frontmatter, fix body text, add to differs list, etc.)

## Important

- If a bucket has only a static report or only a live report (the other agent failed), still include those findings (they will all be STATIC_ONLY or LIVE_ONLY).
- Sort findings by severity (CRITICAL first), then by bucket.
- Always include `suggested_action` — make it actionable for a human or script.
```

- [ ] **Step 2: Commit**

```bash
git add scripts/verify-mo313/prompts/merge-agent.md
git commit -m "feat: add merge agent prompt template"
```

---

### Task 5: Create orchestration script

**Files:**
- Create: `scripts/verify-mo313/orchestrate.sh`

- [ ] **Step 1: Write orchestration script**

Write `scripts/verify-mo313/orchestrate.sh`:

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

print_success() { echo -e "${GREEN}==${NC} $1"; }
print_warning() { echo -e "${YELLOW}==${NC} $1"; }
print_error()   { echo -e "${RED}==${NC} $1"; }
print_info()    { echo -e "${CYAN}--${NC} $1"; }

# Bucket names (must match bucket-manifest.json keys)
BUCKETS=(
    "DDL"
    "DML"
    "DCL"
    "DQL-base"
    "DQL-apply"
    "Other-SQL"
    "Data-Types"
    "Func-String"
    "Func-Math"
    "Func-Datetime"
    "Func-Aggregate"
    "Func-Other"
    "Operators"
    "Misc"
)

MO_VERSION="${MO_VERSION:-3.0.13}"
OUTPUT_DIR="${REPO_ROOT}/audit-output-${MO_VERSION}"

usage() {
    echo "Usage: $0 {preflight|dispatch|merge|status|cleanup}"
    echo ""
    echo "Commands:"
    echo "  preflight  Start MO ${MO_VERSION} Docker, create audit databases"
    echo "  dispatch   Print agent dispatch instructions (28 agents + 1 merge)"
    echo "  merge      Run the merge agent on collected reports"
    echo "  status     Check which reports exist in ${OUTPUT_DIR}"
    echo "  cleanup    Stop MO container, remove audit databases"
    echo ""
    echo "Environment:"
    echo "  MO_VERSION   Target MatrixOne version (default: 3.0.13)"
}

# ---- Pre-flight ----

do_preflight() {
    echo "============================================================"
    echo " Pre-flight: MO ${MO_VERSION}"
    echo "============================================================"

    # 1. Start MO Docker
    print_info "Starting MO ${MO_VERSION} Docker..."
    cd "$REPO_ROOT"
    bash scripts/mo-test-env.sh start "$MO_VERSION"

    # 2. Wait for readiness
    print_info "Waiting for MO to be ready..."
    sleep 5
    for i in $(seq 1 30); do
        if mysql -h127.0.0.1 -P6001 -uroot -p111 -e "SELECT 1" >/dev/null 2>&1; then
            print_success "MO is ready"
            break
        fi
        sleep 2
    done

    # 3. Create isolated databases
    print_info "Creating audit databases..."
    for bucket in "${BUCKETS[@]}"; do
        local db_name="audit_${bucket//-/_}"
        mysql -h127.0.0.1 -P6001 -uroot -p111 -e "DROP DATABASE IF EXISTS \`${db_name}\`; CREATE DATABASE \`${db_name}\`;" 2>/dev/null
        print_success "Database ${db_name} created"
    done

    # 4. Create output directory
    mkdir -p "$OUTPUT_DIR"
    print_success "Output dir: ${OUTPUT_DIR}"

    # 5. Verify bucket-manifest.json
    if [ ! -f "$REPO_ROOT/bucket-manifest.json" ]; then
        print_error "bucket-manifest.json not found!"
        exit 1
    fi
    local file_count
    file_count=$(python3 -c "import json; m=json.load(open('$REPO_ROOT/bucket-manifest.json')); print(m['total_files'])")
    print_success "bucket-manifest.json has ${file_count} files across ${#BUCKETS[@]} buckets"
}

# ---- Dispatch ----

do_dispatch() {
    echo "============================================================"
    echo " Agent Dispatch Instructions"
    echo "============================================================"
    echo ""
    echo "Output directory: ${OUTPUT_DIR}"
    echo ""
    echo "--- STATIC AGENTS (14) ---"
    echo ""
    for bucket in "${BUCKETS[@]}"; do
        local prompt_file="${SCRIPT_DIR}/prompts/static-agent.md"
        local prompt_content
        prompt_content=$(sed "s/{{BUCKET_NAME}}/${bucket}/g" "$prompt_file")
        echo "### static-${bucket}"
        echo "Prompt: ${prompt_file} (with BUCKET_NAME=${bucket})"
        echo "Output: ${OUTPUT_DIR}/static-${bucket}-report.json"
        echo ""
    done

    echo "--- LIVE AGENTS (14) ---"
    echo ""
    for bucket in "${BUCKETS[@]}"; do
        local prompt_file="${SCRIPT_DIR}/prompts/live-agent.md"
        local prompt_content
        prompt_content=$(sed "s/{{BUCKET_NAME}}/${bucket}/g" "$prompt_file")
        local db_name="audit_${bucket//-/_}"
        echo "### live-${bucket}"
        echo "Database: ${db_name}"
        echo "Prompt: ${prompt_file} (with BUCKET_NAME=${bucket})"
        echo "Output: ${OUTPUT_DIR}/live-${bucket}-report.json"
        echo ""
    done

    echo "--- DISPATCH PLAN ---"
    echo ""
    echo "Launch all 28 agents in parallel as background agents."
    echo "Each agent:"
    echo "  1. Read its prompt file (already parameterized with bucket name)"
    echo "  2. Execute verification"
    echo "  3. Write JSON report to ${OUTPUT_DIR}/"
    echo ""
    echo "After all 28 complete (or timeout):"
    echo "  Run: $0 merge"
    echo ""
    echo "--- AGENT DISPATCH COMMANDS ---"
    echo ""
    echo "For each bucket, dispatch two agents concurrently:"
    echo ""
    echo '```'
    echo '# Example for bucket DDL:'
    echo ''
    echo '# Static agent:'
    echo 'cat scripts/verify-mo313/prompts/static-agent.md | sed "s/{{BUCKET_NAME}}/DDL/g"'
    echo ''
    echo '# Live agent:'
    echo 'cat scripts/verify-mo313/prompts/live-agent.md | sed "s/{{BUCKET_NAME}}/DDL/g"'
    echo '```'
}

# ---- Merge ----

do_merge() {
    echo "============================================================"
    echo " Merge Reports"
    echo "============================================================"

    # Count available reports
    local static_count live_count
    static_count=$(ls "${OUTPUT_DIR}"/static-*-report.json 2>/dev/null | wc -l | tr -d ' ')
    live_count=$(ls "${OUTPUT_DIR}"/live-*-report.json 2>/dev/null | wc -l | tr -d ' ')

    print_info "Static reports found: ${static_count}/14"
    print_info "Live reports found: ${live_count}/14"

    if [ "$static_count" -eq 0 ] && [ "$live_count" -eq 0 ]; then
        print_error "No reports found in ${OUTPUT_DIR}"
        exit 1
    fi

    print_info "To run the merge, provide the merge agent prompt to a Claude Code agent:"
    echo ""
    echo "  Prompt file: scripts/verify-mo313/prompts/merge-agent.md"
    echo "  Input dir: ${OUTPUT_DIR}"
    echo "  Output: ${OUTPUT_DIR}/final-report.json"
}

# ---- Status ----

do_status() {
    echo "Report Status for MO ${MO_VERSION}:"
    echo ""

    for bucket in "${BUCKETS[@]}"; do
        local s_ok l_ok
        if [ -f "${OUTPUT_DIR}/static-${bucket}-report.json" ]; then
            s_ok="${GREEN}DONE${NC}"
        else
            s_ok="${RED}MISS${NC}"
        fi
        if [ -f "${OUTPUT_DIR}/live-${bucket}-report.json" ]; then
            l_ok="${GREEN}DONE${NC}"
        else
            l_ok="${RED}MISS${NC}"
        fi
        printf "  %-15s  static: %b  live: %b\n" "$bucket" "$s_ok" "$l_ok"
    done

    if [ -f "${OUTPUT_DIR}/final-report.json" ]; then
        echo ""
        print_success "final-report.json exists"
    fi
}

# ---- Cleanup ----

do_cleanup() {
    print_info "Stopping MO container..."
    cd "$REPO_ROOT"
    bash scripts/mo-test-env.sh stop
    print_success "Cleanup complete"
}

# ---- Main ----

case "${1:-}" in
    preflight) do_preflight ;;
    dispatch)  do_dispatch ;;
    merge)     do_merge ;;
    status)    do_status ;;
    cleanup)   do_cleanup ;;
    *)
        usage
        exit 1
        ;;
esac
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/verify-mo313/orchestrate.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-mo313/orchestrate.sh
git commit -m "feat: add orchestration script for pre-flight, dispatch, merge, and cleanup"
```

---

### Task 6: Create README with usage instructions

**Files:**
- Create: `scripts/verify-mo313/README.md`

- [ ] **Step 1: Write README**

Write `scripts/verify-mo313/README.md`:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add scripts/verify-mo313/README.md
git commit -m "docs: add verify-mo313 README with usage instructions"
```

---

## Self-Review

**1. Spec coverage:**
- Static agent check logic (full/partial/mo_only/none/unknown) → Task 2 (static prompt)
- Live agent check logic, none validation priority, isolation → Task 3 (live prompt)
- Merge agent normalize, cross-reference, conflict resolution → Task 4 (merge prompt)
- JSON output schemas for all three agent types → Task 1 (schemas)
- Orchestration pre-flight, dispatch, timeout/retry, merge → Task 5 (orchestrate.sh)
- Deliverable final-report.json → Task 1 schema + Task 4 merge prompt
- Coverage: All spec sections accounted for.

**2. Placeholder scan:**
- No TBD, TODO, or "implement later"
- All prompt content is complete and self-contained
- All schemas are fully specified
- All shell script logic is implemented

**3. Type consistency:**
- Schema field names match across static, live, and final schemas
- `verdict` values: PASS/FAIL/WARN/SKIPPED/ERROR — consistent
- `severity` values: CRITICAL/HIGH/MEDIUM/LOW — identical across schemas
- `evidence` objects: each agent type has its own evidence schema, merge references both
- Bucket names in orchestrate.sh match the keys in bucket-manifest.json

**4. Gap check:**
- Timeout/retry: orchestrate.sh `do_dispatch` mentions timeout handling in instructions; actual retry is done manually by the orchestrator (re-launch failed agent)
- Agent isolation (live): database-per-agent (`audit_{bucket}`) covered in preflight
- Incomplete flag: called out in both agent prompts and schemas
