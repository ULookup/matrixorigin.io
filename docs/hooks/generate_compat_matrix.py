"""MkDocs hook: regenerate MySQL compatibility artifacts before building.

Runs two Node scripts during `on_pre_build`:
1. `scripts/generate-compat-matrix.js` — the MySQL compatibility matrix table
2. `scripts/generate-unsupported-features.js` — the unsupported features list

Both output files are written into `docs/MatrixOne/Reference/` and must stay
in lock-step with `mysql_compat` frontmatter on source pages.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

_SCRIPTS = [
    "scripts/generate-compat-matrix.js",
    "scripts/generate-unsupported-features.js",
]


def on_pre_build(config, **_kwargs):
    repo_root = Path(config["config_file_path"]).resolve().parent
    node = shutil.which("node")
    if node is None:
        print("[compat-matrix] node not found on PATH; skipping regeneration")
        return
    for script_rel in _SCRIPTS:
        script = repo_root / script_rel
        if not script.exists():
            print(f"[compat-matrix] {script_rel} not found; skipping")
            continue
        try:
            subprocess.run([node, str(script)], cwd=repo_root, check=True)
        except subprocess.CalledProcessError as exc:
            raise SystemExit(
                f"[compat-matrix] {script_rel} failed with exit code {exc.returncode}"
            )
