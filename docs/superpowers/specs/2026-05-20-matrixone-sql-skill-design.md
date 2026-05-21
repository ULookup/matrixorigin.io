---
title: "MatrixOne SQL AI Skill Design"
description: "Design for a superpowers-compatible skill that teaches AI agents to write correct MatrixOne SQL, avoiding MySQL-incompatible syntax"
---

# MatrixOne SQL AI Skill Design

## Problem

NL2SQL products regularly generate MySQL syntax that MatrixOne does not
support. AI models are trained on far more MySQL than MatrixOne data, so
they default to MySQL when uncertain. Current MatrixOne docs describe MO
features but do not structurally prevent AI from using MySQL defaults.

## Solution

Create a **superpowers-compatible skill** (`matrixone-sql-guide`) that acts
as a concentrated "anti-MySQL" reference for AI agents. The skill is
self-contained enough that an AI can avoid 80%+ of common mistakes without
fetching additional pages. For edge cases, it contains navigation rules
pointing to `llms-sql.txt` and other detailed reference pages.

## Skill Structure

```
docs/superpowers/skills/matrixone-sql-guide/
  SKILL.md              # ~2000 words, self-contained
```

Single file — no heavy reference needs a separate file. The unsupported
features page and compatibility matrix are already on the site.

## SKILL.md Contents

### 1. Overview & Core Principle

One sentence: MatrixOne is NOT MySQL. Always verify.

### 2. Before-Generating-SQL Checklist (flowchart)

Decision tree for AI before emitting any SQL:
- Is this statement in the `[mo-only]` category? → check llms-sql.txt for MO-native syntax
- Is it tagged `[partial]` or `[none]`? → check differs_from_mysql
- Is it a MySQL-only feature? → find MO alternative or reject

### 3. High-Frequency MySQL Pitfalls (Categorized)

~25 entries, organized by SQL category, each with:
- MySQL syntax that will fail
- MatrixOne correct alternative
- Error type: ERROR / INERT (syntax accepted but no effect) / DIFFERENT semantics

### 4. Documentation Navigation Rules

Which file to read for which problem:
- `llms-sql.txt` — statement-level compat status
- `mysql-unsupported-features/` — detailed per-feature differences
- `mysql-compatibility-matrix/` — grouped table view

### 5. Quick Reference Table

MySQL→MO direct mappings for common operations.

## Non-Goals

- Not replacing `mysql-unsupported-features.md` — that stays as authoritative reference
- Not adding runtime SQL validation — purely documentation
- Not modifying existing page structure

## Delivery

1. Skill file at `docs/superpowers/skills/matrixone-sql-guide/SKILL.md`
2. Installed locally as a superpowers skill for Claude Code
3. Can be injected directly into NL2SQL product system prompts
4. Can be referenced from `llms.txt` header section
