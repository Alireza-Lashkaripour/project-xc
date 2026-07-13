#!/usr/bin/env python3
"""Build the static Project XC website into public/."""
from __future__ import annotations
import collections
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SITE = ROOT / "site"


def main() -> int:
    for validator in ("validate_data.py", "validate_academy.py"):
        result = subprocess.run([sys.executable, str(ROOT / "scripts" / validator)], cwd=ROOT, text=True)
        if result.returncode != 0:
            return result.returncode
    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    shutil.copytree(SITE, PUBLIC)
    shutil.copytree(ROOT / "data", PUBLIC / "data")
    (PUBLIC / "generated").mkdir(parents=True, exist_ok=True)

    with open(ROOT / "data" / "libxc_snapshot.json", encoding="utf-8") as handle:
        snapshot = json.load(handle)
    with open(ROOT / "data" / "functionals.seed.json", encoding="utf-8") as handle:
        seed = json.load(handle)
    with open(ROOT / "data" / "academy-curriculum.json", encoding="utf-8") as handle:
        academy = json.load(handle)
    academy_chapters = [chapter for track in academy["tracks"] for chapter in track["chapters"]]
    summary = {
        "libxc_snapshot_count": len(snapshot),
        "curated_seed_count": len(seed),
        "entries_with_references": sum(bool(e.get("references")) for e in snapshot),
        "families": dict(collections.Counter(e.get("family") for e in snapshot)),
        "rungs": dict(collections.Counter(e.get("rung") for e in snapshot)),
        "kinds": dict(collections.Counter(e.get("kind") for e in snapshot)),
        "formula_count": sum(1 for e in snapshot if e.get("formula")) + sum(1 for e in seed if e.get("formula")),
        "curated_formula_count": sum(1 for e in seed if e.get("formula")),
        "libxc_alias_count": sum(len(e.get("aliases", [])) for e in snapshot),
        "academy_track_count": len(academy["tracks"]),
        "academy_chapter_count": len(academy_chapters),
        "academy_available_count": sum(chapter["status"] in {"live", "existing-tool"} for chapter in academy_chapters),
    }
    with open(PUBLIC / "generated" / "summary.json", "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    with open(PUBLIC / "manifest.json", "w", encoding="utf-8") as handle:
        json.dump({"name": "Project XC", "short_name": "Project XC", "start_url": "./", "display": "standalone"}, handle, indent=2)
        handle.write("\n")
    print(f"Built Project XC site into {PUBLIC}")
    print(f"- curated records: {len(seed)}")
    print(f"- Libxc snapshot records: {len(snapshot)}")
    print(f"- Academy tracks/chapters: {len(academy['tracks'])}/{len(academy_chapters)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
