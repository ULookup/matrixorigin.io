# Multi-Agent Parallel Verification Design (MO 3.0.13)

## Goal

Verify `mysql_compat` frontmatter accuracy for all 402 SQL Reference files against MO 3.0.13. Check whether `full`/`partial`/`mo_only` claims are correct, and whether `none` (unsupport) claims are genuinely unsupported.

## Architecture

```
Orchestrator (启动 28 agent + 1 merge)
    │
    ├── 14 Static Agents  (MySQL 8.0 doc comparison)
    └── 14 Live Agents    (MO 3.0.13 SQL execution)
            │
            ▼
      Merge Agent (交叉比对 → 最终报告)
```

28 independent agents run in parallel. A Merge Agent runs after all complete, cross-referencing static and live findings into a single `final-report.json`.

- **Static Agent**: Compares MO doc content against MySQL 8.0 reference docs. No MO instance needed.
- **Live Agent**: Connects to MO 3.0.13 Docker, executes SQL examples, validates behavior.
- **Merge Agent**: Normalizes, cross-references, resolves conflicts, outputs final structured report.
- **File allocation**: Reuses existing `bucket-manifest.json` (14 buckets, 402 files).

---

## Static Agent

### Input
- File list from `bucket-manifest.json` for its bucket
- MatrixOne .md source (frontmatter + body)
- MySQL 8.0 docs (WebFetch or local cache)

### Check Logic

| compat | Check | Evidence Required |
|--------|-------|-------------------|
| `full` | MO doc matches MySQL 8.0 syntax/semantics | MySQL doc section reference, version |
| `partial` | `differs_from_mysql` accurate, no missing differences | Per-difference MySQL cross-reference |
| `mo_only` | Feature genuinely absent from MySQL 8.0 | Search confirmation of no MySQL equivalent |
| `none` | MySQL has it, MO claims unsupported | Confirm MySQL has it, MO has no doc |
| `unknown` | Classify with recommendation | MySQL doc comparison |

### Output (per file)

```json
{
  "file": "docs/MatrixOne/Reference/.../create-table.md",
  "bucket": "DDL",
  "agent": "static",
  "current_compat": "partial",
  "findings": [
    {
      "field": "partial",
      "verdict": "PASS|FAIL|WARN",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "description": "...",
      "evidence": { "mysql_ref": "...", "mysql_behavior": "...", "mo_doc_claim": "...", "suggestion": "..." }
    }
  ],
  "suggested_compat": "partial",
  "checked_at": "ISO8601"
}
```

---

## Live Agent

### Prerequisites
- MO 3.0.13 Docker running locally
- Isolated database per agent (`audit_DDL`, `audit_DML`, ...)
- MySQL protocol connection

### Check Logic

| compat | Check | Action |
|--------|-------|--------|
| `full` | Full syntax/semantics compatibility | Execute all SQL examples, validate output |
| `partial` | Documented behavior matches reality | Execute SQL, verify each `differs_from_mysql` entry |
| `mo_only` | Feature exists and works | Execute MO-specific syntax/functions |
| `none` | Truly unsupported | Execute MySQL-standard syntax on MO, confirm it errors |
| `unknown` | Determine actual compat | Execute examples, compare with MySQL behavior |

### `none` Validation (critical)

1. Extract MySQL-standard syntax for the feature
2. Execute on MO
3. "unsupported" / "syntax error" → `none` confirmed
4. Executes successfully → CRITICAL FAIL (should be `full`/`partial`)
5. Other error (permissions, resources) → WARN (inconclusive)

### Isolation

Each live agent uses a dedicated database (`audit_bucket_<name>`) to avoid cross-agent interference.

### Output (per file)

```json
{
  "file": "docs/MatrixOne/Reference/.../create-table.md",
  "bucket": "DDL",
  "agent": "live",
  "current_compat": "partial",
  "mo_version": "3.0.13",
  "findings": [
    {
      "field": "partial",
      "verdict": "PASS|FAIL|WARN",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "description": "...",
      "evidence": { "sql_executed": "...", "actual_output": "...", "expected_behavior": "...", "matches_doc": true }
    }
  ],
  "checked_at": "ISO8601"
}
```

### Edge Cases
- SQL needs context (data, multi-step) → build minimal reproduction
- Cannot execute → `SKIPPED` with reason
- Timeout / server panic → `ERROR` (likely MO bug)

---

## Merge Agent

### 3 Phases

1. **Normalize**: Match static and live findings per file. Direct `file` path match first; within same file, match findings by LLM semantic similarity (threshold: 0.7). Unmatched findings become STATIC_ONLY or LIVE_ONLY.
2. **Cross-reference**: Apply merge matrix to classify each finding
3. **Output**: Generate `final-report.json`

### Merge Matrix

```
static × live → merge_verdict

PASS  × PASS   → PASS              (both agree, correct)
FAIL  × FAIL   → CONFIRMED FAIL    (both agree, issue confirmed)
PASS  × FAIL   → CONFLICT          (disagree, needs human review)
FAIL  × PASS   → CONFLICT          (disagree, needs human review)
WARN  × (any)  → (keeps the non-WARN verdict, or WARN if both WARN)
(无)  × PASS   → LIVE_ONLY         (only live agent caught this)
(无)  × FAIL   → LIVE_ONLY
PASS  × (无)   → STATIC_ONLY       (only static agent caught this)
FAIL  × (无)   → STATIC_ONLY
```

### CONFLICT Resolution
- Compare evidence strength; if one side clearly outweighs the other → `auto_resolved: true` with reasoning
- If genuinely ambiguous → `needs_human_review: true`

### Final Report Schema

```json
{
  "meta": { "mo_version": "3.0.13", "generated_at": "ISO8601", "total_files": 402, "total_buckets": 14, "static_agents": 14, "live_agents": 14 },
  "summary": { "total_claims_checked": 0, "pass": 0, "confirmed_fail": 0, "conflict": 0, "live_only": 0, "static_only": 0, "needs_human_review": 0 },
  "by_severity": { "critical": 0, "high": 0, "medium": 0, "low": 0 },
  "by_bucket": { "DDL": { "pass": 0, "confirmed_fail": 0, "conflict": 0 }, "..." : {} },
  "findings": [
    {
      "file": "...",
      "merge_verdict": "CONFIRMED FAIL",
      "severity": "HIGH",
      "description": "...",
      "static_evidence": {},
      "live_evidence": {},
      "auto_resolved": false,
      "suggested_action": "..."
    }
  ]
}
```

---

## Orchestration

### Pre-flight (manual/scripted)
1. Verify `bucket-manifest.json` is current
2. Start MO 3.0.13 Docker instance
3. Create 14 isolated databases: `audit_DDL` .. `audit_Misc`
4. Verify MO connectivity

### Launch
All 28 agents launched in parallel. Each produces `{type}-{bucket}-report.json`.

### Timeout & Retry
- Per-agent timeout: 30 min
- Partial results saved on timeout (marked `incomplete: true`)
- Crash → retry once, then skip bucket
- Merge triggers when all agents complete or timeout

### Merge
- Runs after all 28 agents finish
- Outputs `final-report.json`

### Post-Merge (optional)
- Filter by severity=CRITICAL for immediate human review
- Deep-verify CONFLICT items
- Batch-apply confirmed fixes to doc frontmatter

---

## Deliverable

Single structured JSON file: `final-report.json`. Machine-consumable. Contains all findings with evidence, severity classification, and merge verdicts.
