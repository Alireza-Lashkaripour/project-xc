#!/usr/bin/env python3
"""Validate the Project XC Quantum Chemistry Academy structure.

This validator intentionally uses only the Python standard library so it can run
locally and in GitHub Actions without installing dependencies.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CURRICULUM = ROOT / "data" / "academy-curriculum.json"
SITE = ROOT / "site"
PLAN = ROOT / "docs" / "plans" / "2026-07-13-quantum-chemistry-academy-master-plan.md"
WORKFLOW = ROOT / ".github" / "workflows" / "validate.yml"

STATUS_VALUES = {"live", "in-development", "existing-tool", "planned"}
PROGRESS_KINDS = {"academy-missions", "legacy-badges"}
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
ROUTE_RE = re.compile(r"^[a-z0-9][a-z0-9-]*\.html$")
LIVE_CHAPTER_RULES = {
    "qc-foundations": {
        "script": "qc-foundations.js",
        "test": "test_academy_models.js",
        "source": "qc-foundations.md",
        "boundary": "Toy-model boundary",
        "challenge": "Final rule",
    },
    "qc-math-language": {
        "script": "qc-math-language.js",
        "test": "test_qc_math_models.js",
        "source": "qc-math-language.md",
        "boundary": "Interactive-model boundary",
        "challenge": "Chapter boss",
    },
}


def add(errors: list[str], message: str) -> None:
    errors.append(message)


def responsive_table_counts(text: str) -> tuple[int, int, int]:
    """Count wide tables, accessible scroll regions, and narrow-screen hints."""
    wide_tables = len(re.findall(r'<table\b(?=[^>]*class="[^"]*\bwide-table\b[^"]*")[^>]*>', text))
    scroll_regions = len(re.findall(
        r'<div\b(?=[^>]*class="[^"]*\btable-scroll\b[^"]*")(?=[^>]*role="region")(?=[^>]*tabindex="0")[^>]*>',
        text,
    ))
    scroll_hints = len(re.findall(r'<p\b(?=[^>]*class="[^"]*\btable-scroll-hint\b[^"]*")[^>]*>', text))
    return wide_tables, scroll_regions, scroll_hints


def safe_external_link_count(text: str) -> int:
    """Count new-tab links that protect window.opener, regardless of attribute order."""
    return len(re.findall(
        r'<a\b(?=[^>]*target="_blank")(?=[^>]*rel="[^"]*\bnoopener\b[^"]*")[^>]*>',
        text,
    ))


def load_json(path: Path, errors: list[str]) -> dict | None:
    if not path.exists():
        add(errors, f"missing required file: {path.relative_to(ROOT)}")
        return None
    try:
        with path.open(encoding="utf-8") as handle:
            value = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        add(errors, f"cannot read {path.relative_to(ROOT)}: {exc}")
        return None
    if not isinstance(value, dict):
        add(errors, f"{path.relative_to(ROOT)} must contain a JSON object")
        return None
    return value


def validate_curriculum(data: dict, errors: list[str]) -> tuple[dict[str, dict], int, int]:
    if data.get("version") != 1:
        add(errors, "academy curriculum version must be 1")
    if not isinstance(data.get("title"), str) or not data.get("title", "").strip():
        add(errors, "academy curriculum title is required")

    tracks = data.get("tracks")
    if not isinstance(tracks, list) or not tracks:
        add(errors, "academy curriculum must contain a non-empty tracks list")
        return {}, 0, 0

    track_ids: set[str] = set()
    chapter_ids: set[str] = set()
    routes: set[str] = set()
    chapters: dict[str, dict] = {}

    for ti, track in enumerate(tracks):
        label = f"tracks[{ti}]"
        if not isinstance(track, dict):
            add(errors, f"{label} must be an object")
            continue
        track_id = track.get("id", "")
        if not isinstance(track_id, str) or not ID_RE.fullmatch(track_id):
            add(errors, f"{label} has invalid id {track_id!r}")
        elif track_id in track_ids:
            add(errors, f"duplicate track id: {track_id}")
        else:
            track_ids.add(track_id)
        if not isinstance(track.get("title"), str) or not track.get("title", "").strip():
            add(errors, f"{label} is missing title")
        if not isinstance(track.get("description"), str) or len(track.get("description", "").strip()) < 30:
            add(errors, f"{label} description must be at least 30 characters")

        items = track.get("chapters")
        if not isinstance(items, list) or not items:
            add(errors, f"{label} must contain chapters")
            continue
        orders: set[int] = set()
        for ci, chapter in enumerate(items):
            clabel = f"{label}.chapters[{ci}]"
            if not isinstance(chapter, dict):
                add(errors, f"{clabel} must be an object")
                continue
            chapter_id = chapter.get("id", "")
            if not isinstance(chapter_id, str) or not ID_RE.fullmatch(chapter_id):
                add(errors, f"{clabel} has invalid id {chapter_id!r}")
                continue
            if chapter_id in chapter_ids:
                add(errors, f"duplicate chapter id: {chapter_id}")
            chapter_ids.add(chapter_id)
            chapters[chapter_id] = chapter

            order = chapter.get("order")
            if not isinstance(order, int) or order < 1:
                add(errors, f"{chapter_id} order must be a positive integer")
            elif order in orders:
                add(errors, f"duplicate order {order} in track {track_id}")
            else:
                orders.add(order)

            for key in ("title", "summary", "level"):
                if not isinstance(chapter.get(key), str) or not chapter.get(key, "").strip():
                    add(errors, f"{chapter_id} is missing {key}")
            if len(chapter.get("summary", "").strip()) < 45:
                add(errors, f"{chapter_id} summary must be at least 45 characters")

            status = chapter.get("status")
            if status not in STATUS_VALUES:
                add(errors, f"{chapter_id} has invalid status {status!r}")

            route = chapter.get("route", "")
            if route:
                if not isinstance(route, str) or not ROUTE_RE.fullmatch(route):
                    add(errors, f"{chapter_id} has invalid route {route!r}")
                elif route in routes:
                    add(errors, f"duplicate Academy route: {route}")
                else:
                    routes.add(route)
            if status in {"live", "existing-tool"}:
                if not route:
                    add(errors, f"{chapter_id} status {status} requires a route")
                elif not (SITE / route).exists():
                    add(errors, f"{chapter_id} route does not exist: site/{route}")

            for count_key in ("levels", "games"):
                count = chapter.get(count_key)
                if not isinstance(count, int) or count < 0:
                    add(errors, f"{chapter_id} {count_key} must be a nonnegative integer")

            progress = chapter.get("progress")
            if progress is not None:
                if not isinstance(progress, dict):
                    add(errors, f"{chapter_id} progress must be an object")
                else:
                    kind = progress.get("kind")
                    total = progress.get("total")
                    label_text = progress.get("label")
                    if kind not in PROGRESS_KINDS:
                        add(errors, f"{chapter_id} has invalid progress kind {kind!r}")
                    if not isinstance(total, int) or total < 1:
                        add(errors, f"{chapter_id} progress total must be a positive integer")
                    if not isinstance(label_text, str) or not label_text.strip():
                        add(errors, f"{chapter_id} progress label is required")
                    if kind == "academy-missions" and status != "live":
                        add(errors, f"{chapter_id} academy-missions progress requires live status")
                    if kind == "legacy-badges":
                        if status != "existing-tool":
                            add(errors, f"{chapter_id} legacy-badges progress requires existing-tool status")
                        storage_key = progress.get("storage_key")
                        if not isinstance(storage_key, str) or not storage_key.startswith("project-xc-"):
                            add(errors, f"{chapter_id} legacy-badges progress requires a project-xc storage_key")
            elif status == "live":
                add(errors, f"{chapter_id} live chapter must define a progress contract")

            prereqs = chapter.get("prerequisites")
            if not isinstance(prereqs, list) or any(not isinstance(x, str) for x in prereqs):
                add(errors, f"{chapter_id} prerequisites must be a list of chapter ids")

            outcomes = chapter.get("outcomes")
            if not isinstance(outcomes, list) or not outcomes:
                add(errors, f"{chapter_id} must define at least one outcome")
            elif any(not isinstance(x, str) or len(x.strip()) < 12 for x in outcomes):
                add(errors, f"{chapter_id} outcomes must be descriptive strings")

    for chapter_id, chapter in chapters.items():
        for prereq in chapter.get("prerequisites", []):
            if prereq not in chapters:
                add(errors, f"{chapter_id} prerequisite does not exist: {prereq}")
            if prereq == chapter_id:
                add(errors, f"{chapter_id} cannot require itself")

    # Detect prerequisite cycles with a depth-first traversal.
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(chapter_id: str, path: list[str]) -> None:
        if chapter_id in visited:
            return
        if chapter_id in visiting:
            add(errors, "prerequisite cycle: " + " -> ".join(path + [chapter_id]))
            return
        visiting.add(chapter_id)
        for prereq in chapters.get(chapter_id, {}).get("prerequisites", []):
            if prereq in chapters:
                visit(prereq, path + [chapter_id])
        visiting.remove(chapter_id)
        visited.add(chapter_id)

    for chapter_id in chapters:
        visit(chapter_id, [])

    return chapters, len(tracks), len(chapters)


def validate_site_contract(chapters: dict[str, dict], errors: list[str]) -> None:
    required = [
        PLAN,
        WORKFLOW,
        SITE / "quantum-chemistry.html",
        SITE / "assets" / "academy-core.js",
        SITE / "assets" / "academy-gateway.js",
    ]
    for path in required:
        if not path.exists():
            add(errors, f"missing required file: {path.relative_to(ROOT)}")

    homepage = SITE / "index.html"
    if homepage.exists():
        text = homepage.read_text(encoding="utf-8")
        if 'href="quantum-chemistry.html"' not in text:
            add(errors, "homepage does not link to quantum-chemistry.html")
        if "Quantum Chemistry Academy" not in text:
            add(errors, "homepage does not name Quantum Chemistry Academy")
        for chapter_id, chapter in chapters.items():
            if chapter.get("status") == "live" and f'href="{chapter.get("route")}"' not in text:
                add(errors, f"homepage does not link directly to live chapter {chapter_id}")

    for name in ("basis-sets.html", "mo-diagrams.html", "mo-builder.html", "xc-functionals.html", "functional.html", "methodology.html"):
        page = SITE / name
        if page.exists() and 'href="quantum-chemistry.html"' not in page.read_text(encoding="utf-8"):
            add(errors, f"site/{name} does not link back to the Academy")

    gateway = SITE / "quantum-chemistry.html"
    if gateway.exists():
        text = gateway.read_text(encoding="utf-8")
        for needle in (
            'id="academyTracks"',
            'assets/academy-core.js',
            'assets/academy-gateway.js',
            "Local progress, not certification",
        ):
            if needle not in text:
                add(errors, f"Academy gateway missing contract text: {needle}")

    live_chapters = {chapter_id for chapter_id, chapter in chapters.items() if chapter.get("status") == "live"}
    missing_rules = live_chapters - LIVE_CHAPTER_RULES.keys()
    for chapter_id in sorted(missing_rules):
        add(errors, f"live chapter {chapter_id} has no validator rule")

    workflow_text = WORKFLOW.read_text(encoding="utf-8") if WORKFLOW.exists() else ""
    class_token = r"(?<![A-Za-z0-9_-]){}(?![A-Za-z0-9_-])"
    for chapter_id, rule in LIVE_CHAPTER_RULES.items():
        chapter = chapters.get(chapter_id)
        if not chapter or chapter.get("status") != "live":
            continue
        page = SITE / chapter["route"]
        script = SITE / "assets" / rule["script"]
        test = ROOT / "scripts" / rule["test"]
        source = ROOT / "docs" / "academy" / "sources" / rule["source"]
        for path in (page, script, test, source):
            if not path.exists():
                add(errors, f"{chapter_id} missing required file: {path.relative_to(ROOT)}")
        if f"node scripts/{rule['test']}" not in workflow_text:
            add(errors, f"GitHub validation workflow does not run {rule['test']}")
        if not page.exists():
            continue

        text = page.read_text(encoding="utf-8")
        level_count = len(re.findall(r'class="[^"]*' + class_token.format("academy-lesson") + r'[^"]*"', text))
        mission_tags = re.findall(r'<button\b[^>]*class="[^"]*' + class_token.format("academy-complete") + r'[^"]*"[^>]*>', text)
        mission_count = len(mission_tags)
        mission_ids = [match.group(1) for tag in mission_tags if (match := re.search(r'\bdata-mission="([^"]+)"', tag))]
        game_count = len(re.findall(r'class="[^"]*' + class_token.format("lab-grid") + r'[^"]*"', text))
        html_ids = re.findall(r'\bid="([^"]+)"', text)
        duplicate_ids = sorted({item for item in html_ids if html_ids.count(item) > 1})
        wide_table_count, scroll_region_count, scroll_hint_count = responsive_table_counts(text)
        progress_contract = chapter.get("progress")
        mission_total = progress_contract.get("total", chapter.get("levels")) if isinstance(progress_contract, dict) else chapter.get("levels")
        if level_count != chapter.get("levels"):
            add(errors, f"{chapter_id} level count {level_count} != metadata {chapter.get('levels')}")
        if mission_count != mission_total:
            add(errors, f"{chapter_id} mission count {mission_count} != metadata progress total {mission_total}")
        if game_count != chapter.get("games"):
            add(errors, f"{chapter_id} game count {game_count} != metadata {chapter.get('games')}")
        if len(mission_ids) != mission_count:
            add(errors, f"{chapter_id} completion controls must declare data-mission")
        elif len(mission_ids) != len(set(mission_ids)):
            add(errors, f"{chapter_id} mission ids must be unique")
        if duplicate_ids:
            add(errors, f"{chapter_id} has duplicate HTML ids: {', '.join(duplicate_ids)}")
        if scroll_region_count < wide_table_count:
            add(errors, f"{chapter_id} has {wide_table_count} wide tables but only {scroll_region_count} accessible scroll regions")
        if scroll_hint_count < wide_table_count:
            add(errors, f"{chapter_id} has {wide_table_count} wide tables but only {scroll_hint_count} narrow-screen scroll hints")
        if safe_external_link_count(text) < 3:
            add(errors, f"{chapter_id} must expose at least three safe external source links")
        for needle in (
            'assets/academy-core.js',
            f'assets/{rule["script"]}',
            rule["boundary"],
            "Professor mode",
            rule["challenge"],
            "Verified source spine",
        ):
            if needle not in text:
                add(errors, f"{chapter_id} missing contract text: {needle}")

    basis = SITE / "basis-sets.html"
    basis_expected = chapters.get("qc-basis-sets", {})
    basis_progress = basis_expected.get("progress")
    if basis.exists() and isinstance(basis_progress, dict) and basis_progress.get("kind") == "legacy-badges":
        text = basis.read_text(encoding="utf-8")
        badge_count = len(re.findall(r'class="[^"]*\bquest-complete\b[^"]*"', text))
        expected_total = basis_progress["total"]
        if badge_count != expected_total:
            add(errors, f"Basis Quest badge count {badge_count} != metadata progress total {expected_total}")
        wide_table_count, scroll_region_count, scroll_hint_count = responsive_table_counts(text)
        if scroll_region_count < wide_table_count:
            add(errors, f"Basis Quest has {wide_table_count} wide tables but only {scroll_region_count} accessible scroll regions")
        if scroll_hint_count < wide_table_count:
            add(errors, f"Basis Quest has {wide_table_count} wide tables but only {scroll_hint_count} narrow-screen scroll hints")
        basis_js = (SITE / "assets" / "basis-sets.js").read_text(encoding="utf-8")
        if basis_progress["storage_key"] not in basis_js:
            add(errors, "Basis Quest progress storage_key does not match site/assets/basis-sets.js")

    if WORKFLOW.exists() and "node scripts/test_academy_core.js" not in WORKFLOW.read_text(encoding="utf-8"):
        add(errors, "GitHub validation workflow does not run Academy progress regression tests")


def main() -> int:
    errors: list[str] = []
    curriculum = load_json(CURRICULUM, errors)
    chapters: dict[str, dict] = {}
    track_count = 0
    chapter_count = 0
    if curriculum is not None:
        chapters, track_count, chapter_count = validate_curriculum(curriculum, errors)
    validate_site_contract(chapters, errors)

    if errors:
        print("Project XC Academy validation FAILED")
        for message in errors:
            print(f"- {message}")
        return 1

    print("Project XC Academy validation OK")
    print(f"- Tracks: {track_count}")
    print(f"- Chapters: {chapter_count}")
    print("- Homepage, gateway, shared progress, and live chapter contracts: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
