"""MkDocs hook: emit agent-friendly artifacts alongside the HTML build.

Produces three things so LLM-driven clients (Cursor, Claude Code, ChatGPT,
MCP servers, etc.) can consume the MatrixOne docs without parsing HTML:

1. **Per-page markdown mirror.** Every source `docs/MatrixOne/**/*.md` file
   is copied into `site/` at the same relative location (minus the
   `MatrixOne/` prefix that the mkdocs nav already strips). Frontmatter is
   preserved as-is — it's cheap metadata for downstream tools.
2. **`site/llms.txt`**. A concise llmstxt.org-format index pointing at the
   most load-bearing pages (Overview → Get Started → Reference) plus a
   blockquote of behavioural directives for SQL-writing agents.
3. **`site/llms-full.txt`**. The whole corpus concatenated into one file so
   agents can stuff the full docs into a single context window when needed.

Override the base URL via `MATRIXONE_DOCS_BASE_URL` env var. Defaults to
`https://docs.matrixorigin.io`.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Iterable

BASE_URL_DEFAULT = "https://docs.matrixorigin.io"
DOC_ROOT_REL = Path("MatrixOne")

# Curated list of top-tier pages to highlight in llms.txt. Paths are relative
# to `docs/` (same as the rest of the mkdocs config). Order matters: items
# appear in the listed sequence in the output.
FEATURED_PAGES = [
    ("Docs", [
        ("MatrixOne/Overview/matrixone-introduction.md",
         "What MatrixOne is and when to pick it"),
        ("MatrixOne/Overview/matrixone-feature-list.md",
         "Feature list at a glance"),
        ("MatrixOne/Get-Started/install-standalone-matrixone.md",
         "Single-node install walkthrough"),
        ("MatrixOne/Reference/SQL-Reference/SQL-Type.md",
         "SQL statement taxonomy"),
        ("MatrixOne/Reference/mysql-compatibility-matrix.md",
         "MySQL 8.0 compatibility status per SQL statement"),
    ]),
    ("SDK & Drivers", [
        ("MatrixOne/Develop/connect-mo/python-connect-to-matrixone.md",
         "Python client setup"),
        ("MatrixOne/Develop/connect-mo/java-connect-to-matrixone/connect-mo-with-jdbc.md",
         "Java/JDBC client setup"),
        ("MatrixOne/Develop/connect-mo/connect-to-matrixone-with-go.md",
         "Go client setup"),
    ]),
    ("Operate", [
        ("MatrixOne/Deploy/deploy-MatrixOne-cluster.md",
         "Cluster deployment overview"),
        ("MatrixOne/Maintain/backup-restore/backup-restore-overview.md",
         "Backup & restore strategy"),
    ]),
]

SYSTEM_PROMPT_BLOCK = (
    "MatrixOne is a cloud-native HTAP database broadly MySQL 8.0 compatible, "
    "but not every MySQL 8.0 feature is supported. Before assuming syntax "
    "works, consult the MySQL Compatibility Matrix at "
    "/MatrixOne/Reference/mysql-compatibility-matrix.md. Use `SHOW CREATE "
    "TABLE` to confirm schema shape; system tables differ from MySQL. SQL "
    "examples on these pages are validated against the latest 3.0-dev image "
    "via `scripts/doc-validator`."
)


def _base_url() -> str:
    return os.environ.get("MATRIXONE_DOCS_BASE_URL", BASE_URL_DEFAULT).rstrip("/")


def _iter_source_pages(docs_dir: Path) -> Iterable[Path]:
    for path in sorted((docs_dir / DOC_ROOT_REL).rglob("*.md")):
        yield path


def on_post_build(config, **_kwargs):
    site_dir = Path(config["site_dir"]).resolve()
    docs_dir = Path(config["docs_dir"]).resolve()
    if not site_dir.exists():
        return

    # 1. Per-page markdown mirror.
    mirrored = 0
    for src in _iter_source_pages(docs_dir):
        rel = src.relative_to(docs_dir)
        dest = site_dir / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        mirrored += 1
    print(f"[agent-delivery] mirrored {mirrored} markdown source files into site/")

    # 2. llms.txt
    base = _base_url()
    llms = ["# MatrixOne", ""]
    llms.append(f"> {SYSTEM_PROMPT_BLOCK}")
    llms.append("")
    llms.append("Hints for AI agents writing MatrixOne SQL:")
    llms.append("")
    llms.append("- Not all MySQL 8.0 features are supported — consult the compatibility matrix.")
    llms.append("- Prefer MatrixOne-native clauses when documented (`CLUSTER BY`, `AS OF TIMESTAMP`, `USING IVFFLAT`, `CLONE`).")
    llms.append("- Use `SHOW CREATE TABLE <name>` to inspect a table before mutating it.")
    llms.append("")
    for section_title, entries in FEATURED_PAGES:
        llms.append(f"## {section_title}")
        for rel_path, desc in entries:
            url = f"{base}/{rel_path}"
            title = _page_title(docs_dir / rel_path) or rel_path
            llms.append(f"- [{title}]({url}): {desc}")
        llms.append("")
    (site_dir / "llms.txt").write_text("\n".join(llms), encoding="utf-8")

    # 3. llms-full.txt
    sections_order = [
        "MatrixOne/Overview",
        "MatrixOne/Get-Started",
        "MatrixOne/Reference",
        "MatrixOne/Develop",
        "MatrixOne/Deploy",
        "MatrixOne/Maintain",
        "MatrixOne/Performance-Tuning",
        "MatrixOne/Security",
        "MatrixOne/Migrate",
        "MatrixOne/Tutorial",
        "MatrixOne/Troubleshooting",
        "MatrixOne/FAQs",
        "MatrixOne/Release-Notes",
        "MatrixOne/Test",
        "MatrixOne/Contribution-Guide",
    ]
    full_parts = [
        "# MatrixOne — Full Documentation",
        "",
        "Source: " + base,
        "",
        SYSTEM_PROMPT_BLOCK,
        "",
    ]
    seen: set[Path] = set()
    for prefix in sections_order:
        root = docs_dir / prefix
        if not root.exists():
            continue
        for src in sorted(root.rglob("*.md")):
            rel = src.relative_to(docs_dir)
            if rel in seen:
                continue
            seen.add(rel)
            full_parts.append("")
            full_parts.append(f"# === {rel.as_posix()} ===")
            full_parts.append("")
            full_parts.append(src.read_text(encoding="utf-8"))
    # Append any remaining pages we didn't group above.
    for src in _iter_source_pages(docs_dir):
        rel = src.relative_to(docs_dir)
        if rel in seen:
            continue
        seen.add(rel)
        full_parts.append("")
        full_parts.append(f"# === {rel.as_posix()} ===")
        full_parts.append("")
        full_parts.append(src.read_text(encoding="utf-8"))
    (site_dir / "llms-full.txt").write_text("\n".join(full_parts), encoding="utf-8")
    print(f"[agent-delivery] emitted llms.txt and llms-full.txt ({len(seen)} pages)")


def _page_title(md_path: Path) -> str | None:
    if not md_path.exists():
        return None
    text = md_path.read_text(encoding="utf-8", errors="replace")
    # Prefer explicit `title:` frontmatter; fall back to first H1.
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            frontmatter = text[3:end]
            for line in frontmatter.splitlines():
                if line.startswith("title:"):
                    raw = line.split(":", 1)[1].strip()
                    return raw.strip('"\'')
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip().replace("**", "")
    return None
