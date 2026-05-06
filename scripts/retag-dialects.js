#!/usr/bin/env node
/**
 * Retag third-party SQL dialects so they don't fail MatrixOne's parser.
 *
 * For each (file, fenceStartLine, newLang) entry in the decision table:
 *   - Rewrite the opening fence from ```sql to ```<newLang>
 *   - Drop any immediately-preceding `<!-- validator-ignore -->` comment
 *     line — once the fence is not "sql", the validator no longer picks
 *     it up, so the marker is redundant.
 *
 * Idempotent: skips fences whose language is already `newLang`.
 *
 * Decision sources:
 *   - Page title/content confirms upstream database (PostgreSQL / Oracle /
 *     SQL Server / MongoDB Flink CDC / etc.)
 *   - SQL uses dialect-specific syntax (NVARCHAR, NUMBER, `WITH ('connector')`,
 *     `exec master.dbo.sp_*`, `replica identity full`, …)
 */

import { readFileSync, writeFileSync } from 'node:fs'

// Each entry: [filePath, startLineInTriage, newLang]
// `startLineInTriage` = first SQL content line from the triage report, which
// equals fenceLine + 1. We locate the fence as startLine - 1.
const DECISIONS = [
  // Flink SQL DDL — CREATE TABLE … WITH ('connector' = …)
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-mongo-matrixone.md', 99, 'flink'],
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-mongo-matrixone.md', 123, 'flink'],
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-oracle-matrixone.md', 90, 'flink'],
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-postgresql-matrixone.md', 97, 'flink'],
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-postgresql-matrixone.md', 104, 'flink'],
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-postgresql-matrixone.md', 130, 'flink'],
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-sqlserver-matrixone.md', 173, 'flink'],
  // Oracle native DDL (NUMBER / VARCHAR2)
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-oracle-matrixone.md', 22, 'plsql'],
  // PostgreSQL native DDL (replica identity)
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-postgresql-matrixone.md', 212, 'postgresql'],
  // T-SQL / SQL Server native DDL & commands
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-sqlserver-matrixone.md', 22, 'tsql'],
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-sqlserver-matrixone.md', 47, 'tsql'],
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-sqlserver-matrixone.md', 66, 'tsql'],
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-sqlserver-matrixone.md', 83, 'tsql'],
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-sqlserver-matrixone.md', 105, 'tsql'],
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-sqlserver-matrixone.md', 229, 'tsql'],
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-sqlserver-matrixone.md', 251, 'tsql'],
  ['docs/MatrixOne/Develop/Ecological-Tools/Computing-Engine/Flink/flink-sqlserver-matrixone.md', 266, 'tsql'],
]

function main() {
  // Group by file so we apply edits bottom-up (line indices stay stable).
  const byFile = new Map()
  for (const [file, startLine, lang] of DECISIONS) {
    if (!byFile.has(file)) byFile.set(file, [])
    byFile.get(file).push({ startLine, lang })
  }

  let retagged = 0
  let droppedIgnores = 0
  for (const [file, edits] of byFile) {
    const raw = readFileSync(file, 'utf-8')
    const lines = raw.split('\n')
    // Sort descending so bottom edits don't shift indices for earlier ones.
    edits.sort((a, b) => b.startLine - a.startLine)
    for (const { startLine, lang } of edits) {
      const fenceIdx = startLine - 2  // 0-indexed fence line
      if (fenceIdx < 0 || fenceIdx >= lines.length) continue
      const fenceLine = lines[fenceIdx]
      const m = fenceLine.match(/^(\s*)```(\w*)\s*(<!--[^>]*-->)?\s*$/)
      if (!m) {
        console.warn(`  ! ${file}:${fenceIdx + 1} expected fence, got: ${fenceLine.slice(0, 80)}`)
        continue
      }
      const indent = m[1] || ''
      const currentLang = m[2] || ''
      if (currentLang === lang) continue  // already tagged
      lines[fenceIdx] = `${indent}\`\`\`${lang}`
      retagged++
      // Drop a preceding `<!-- validator-ignore -->` line (bare).
      if (fenceIdx > 0 && /^\s*<!--\s*validator-ignore\s*-->\s*$/.test(lines[fenceIdx - 1])) {
        lines.splice(fenceIdx - 1, 1)
        droppedIgnores++
      }
    }
    writeFileSync(file, lines.join('\n'), 'utf-8')
    console.log(`  ✓ ${file} — ${edits.length} edits`)
  }
  console.log('')
  console.log(`Fences retagged: ${retagged}`)
  console.log(`Preceding ignore markers removed: ${droppedIgnores}`)
}

main()
