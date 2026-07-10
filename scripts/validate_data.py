#!/usr/bin/env python3
"""Validate Project XC data files without third-party dependencies."""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DOI_RE = re.compile(r"^10\.\d{4,9}/\S+$", re.I)
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def load(path: str):
    with open(ROOT / path, encoding="utf-8") as handle:
        return json.load(handle)


def error(errors: list[str], msg: str) -> None:
    errors.append(msg)



def validate_formula(errors: list[str], formula: dict, label: str) -> None:
    if not isinstance(formula, dict):
        error(errors, f"{label} missing formula object")
        return
    for key in ["schema_version", "status", "template_id", "plain", "latex", "amounts"]:
        if key not in formula:
            error(errors, f"{label} formula missing {key}")
    amounts = formula.get("amounts", {})
    for key in ["channels", "exact_exchange", "short_range_exact_exchange", "long_range_exact_exchange", "range_separation_omega", "other_terms"]:
        if key not in amounts:
            error(errors, f"{label} formula.amounts missing {key}")
    exact = amounts.get("exact_exchange", {})
    if isinstance(exact, dict) and "status" not in exact:
        error(errors, f"{label} exact_exchange missing status")

def main() -> int:
    errors: list[str] = []
    snapshot = load("data/libxc_snapshot.json")
    seed = load("data/functionals.seed.json")
    aliases = load("data/program_aliases.json")

    if len(snapshot) < 500:
        error(errors, f"Libxc snapshot unexpectedly small: {len(snapshot)}")

    libxc_codes = set()
    libxc_ids = set()
    for idx, entry in enumerate(snapshot):
        prefix = f"snapshot[{idx}]"
        for key in ["libxc_code", "libxc_id", "description", "family", "section", "rung", "kind", "references", "source_url"]:
            if key not in entry:
                error(errors, f"{prefix} missing {key}")
        code = entry.get("libxc_code")
        libxc_id = entry.get("libxc_id")
        if code in libxc_codes:
            error(errors, f"duplicate Libxc code: {code}")
        libxc_codes.add(code)
        if libxc_id in libxc_ids:
            error(errors, f"duplicate Libxc id: {libxc_id}")
        libxc_ids.add(libxc_id)
        validate_formula(errors, entry.get("formula"), f"{prefix}/{code}")
        for ref in entry.get("references", []):
            doi = ref.get("doi", "")
            if doi and not DOI_RE.match(doi):
                error(errors, f"bad DOI in {code}: {doi}")
            url = ref.get("url", "")
            parsed = urlparse(url)
            if url and parsed.scheme not in {"http", "https"}:
                error(errors, f"unsafe reference URL in {code}: {url}")
            if doi and not url.startswith("https://doi.org/"):
                error(errors, f"DOI reference without doi.org URL in {code}: {doi}")

    slugs = set()
    for idx, entry in enumerate(seed):
        prefix = f"seed[{idx}]"
        for key in ["slug", "canonical_name", "aliases", "summary", "family", "rung", "kind", "ingredients", "libxc", "references", "curation_status"]:
            if key not in entry:
                error(errors, f"{prefix} missing {key}")
        slug = entry.get("slug", "")
        if not SLUG_RE.match(slug):
            error(errors, f"bad slug: {slug}")
        if slug in slugs:
            error(errors, f"duplicate slug: {slug}")
        slugs.add(slug)
        validate_formula(errors, entry.get("formula"), f"seed/{slug}")
        if len(entry.get("summary", "")) < 40:
            error(errors, f"summary too short for {slug}")
        components = entry.get("libxc", {}).get("components", [])
        if not components:
            error(errors, f"no Libxc components for {slug}")
        for comp in components:
            code = comp.get("code")
            if comp.get("id") is not None and code not in libxc_codes:
                error(errors, f"curated {slug} component {code} not in snapshot")
        validate_formula(errors, entry.get("formula"), f"{prefix}/{code}")
        for ref in entry.get("references", []):
            doi = ref.get("doi", "")
            url = ref.get("url", "")
            parsed = urlparse(url)
            if url and parsed.scheme not in {"http", "https"}:
                error(errors, f"unsafe curated reference URL in {slug}: {url}")
            if doi and not DOI_RE.match(doi):
                error(errors, f"bad curated DOI in {slug}: {doi}")
            if doi and not url.startswith("https://doi.org/"):
                error(errors, f"curated DOI reference without doi.org URL in {slug}: {doi}")
        for alias in entry.get("program_aliases", []):
            program = alias.get("program", "")
            if "/" in program:
                error(errors, f"grouped program alias is not allowed in {slug}: {program}")
            for key in ["program", "names", "status", "caveat"]:
                if key not in alias:
                    error(errors, f"program alias for {slug} missing {key}")

    for idx, item in enumerate(aliases.get("aliases", [])):
        slug = item.get("canonical_slug")
        if slug not in slugs:
            error(errors, f"alias[{idx}] points to unknown slug {slug}")
        for key in ["program", "names", "status", "caveat"]:
            if key not in item:
                error(errors, f"alias[{idx}] missing {key}")
        if "/" in item.get("program", ""):
            error(errors, f"alias[{idx}] uses grouped program name: {item.get('program')}")

    if errors:
        print("Project XC validation FAILED")
        for msg in errors:
            print(f"- {msg}")
        return 1

    print("Project XC validation OK")
    print(f"- Libxc snapshot entries: {len(snapshot)}")
    print(f"- Curated seed entries: {len(seed)}")
    print(f"- Libxc entries with references: {sum(bool(e.get('references')) for e in snapshot)}")
    print(f"- Program alias records: {len(aliases.get('aliases', []))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
