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
