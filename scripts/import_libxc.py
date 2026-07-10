#!/usr/bin/env python3
"""Import the public Libxc functionals page into Project XC JSON.

This importer intentionally keeps provenance and does not pretend the imported
HTML description is a fully curated scientific record.
"""
from __future__ import annotations
import argparse
import collections
import datetime as _dt
import html as _html
import json
import re
import urllib.request

SOURCE_URL = "https://libxc.gitlab.io/functionals/"


def fetch_html(url: str = SOURCE_URL) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Project-XC-Libxc-Importer/0.1"})
    with urllib.request.urlopen(req, timeout=60) as response:
        return response.read().decode("utf-8", "replace")


def _strip_tags(text: str) -> str:
    return re.sub(r"\s+", " ", _html.unescape(re.sub("<.*?>", " ", text))).strip()


def classify(family: str, section: str, code: str) -> tuple[str, str]:
    low = (section or "").lower()
    kind = "exchange-correlation"
    if "exchange-correlation" in low or "_XC_" in code:
        kind = "exchange-correlation"
    elif " exchange" in low or re.search(r"(^|_)X($|_)", code):
        kind = "exchange"
    elif " correlation" in low or re.search(r"(^|_)C($|_)", code):
        kind = "correlation"
    elif " kinetic" in low or re.search(r"(^|_)K($|_)", code):
        kind = "kinetic"

    f_low = (family or "").lower()
    if "hybrid meta-gga" in f_low:
        rung = "hybrid meta-GGA"
    elif "meta-gga" in f_low:
        rung = "meta-GGA"
    elif "hybrid gga" in f_low:
        rung = "hybrid GGA"
    elif "hybrid lda" in f_low:
        rung = "hybrid LDA"
    elif "gga" in f_low:
        rung = "GGA"
    elif "lda" in f_low:
        rung = "LDA"
    else:
        rung = "unclassified"
    return rung, kind


def parse_functionals(raw: str, imported_at: str) -> list[dict]:
    token_re = re.compile(r"<h2[^>]*>.*?</h2>|<h4[^>]*>.*?</h4>|<li><strong>[A-Z0-9_]+</strong> \(id=\d+\):", re.S)
    family = ""
    section = ""
    entries: list[dict] = []
    for match in token_re.finditer(raw):
        token = match.group(0)
        if token.startswith("<h2"):
            family = _strip_tags(token)
            continue
        if token.startswith("<h4"):
            section = _strip_tags(token)
            continue

        start = match.start()
        depth = 0
        end = None
        for tag in re.finditer(r"<li\b|</li>", raw[start:], re.I):
            if tag.group(0).lower().startswith("<li"):
                depth += 1
            else:
                depth -= 1
                if depth == 0:
                    end = start + tag.end()
                    break
        block = raw[start:end]
        header = re.match(r"<li><strong>([A-Z0-9_]+)</strong> \(id=(\d+)\):\s*(.*?)\s*<ul>", block, re.S)
        if not header:
            header = re.match(r"<li><strong>([A-Z0-9_]+)</strong> \(id=(\d+)\):\s*(.*?)(?:</li>)$", block, re.S)
        if not header:
            continue

        code = header.group(1)
        rung, kind = classify(family, section, code)
        references = []
        for ref in re.finditer(r"<li><a href=\"([^\"]+)\">(.*?)</a> \(doi: <code>(.*?)</code>\)</li>", block, re.S):
            references.append({
                "doi": ref.group(3),
                "citation": _strip_tags(ref.group(2)),
                "url": ref.group(1),
            })
        entries.append({
            "source": "Libxc public functionals page",
            "source_url": SOURCE_URL,
            "imported_at": imported_at,
            "libxc_code": code,
            "libxc_id": int(header.group(2)),
            "display_name": code,
            "description": _strip_tags(header.group(3)),
            "family": family,
            "section": section,
            "rung": rung,
            "kind": kind,
            "references": references,
            "curation_status": "machine-imported-from-libxc-html",
        })
    return entries


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=SOURCE_URL)
    parser.add_argument("--out", default="data/libxc_snapshot.json")
    parser.add_argument("--summary", default="data/libxc_summary.json")
    args = parser.parse_args()

    imported_at = _dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    raw = fetch_html(args.url)
    entries = parse_functionals(raw, imported_at)
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(entries, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    summary = {
        "generated_at": imported_at,
        "source_url": args.url,
        "entry_count": len(entries),
        "entries_with_references": sum(bool(e["references"]) for e in entries),
        "reference_count": sum(len(e["references"]) for e in entries),
        "families": dict(collections.Counter(e["family"] for e in entries)),
        "rungs": dict(collections.Counter(e["rung"] for e in entries)),
        "kinds": dict(collections.Counter(e["kind"] for e in entries)),
    }
    with open(args.summary, "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    print(f"imported {len(entries)} Libxc entries to {args.out}; {summary['reference_count']} references")


if __name__ == "__main__":
    main()
