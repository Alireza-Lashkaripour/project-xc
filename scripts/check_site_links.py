#!/usr/bin/env python3
"""Check local HTML links, assets, and fragments in the built Project XC site."""
from __future__ import annotations

import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.targets: list[tuple[str, str]] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            self.ids.add(element_id)
        for attribute in ("href", "src"):
            value = values.get(attribute)
            if value:
                self.targets.append((attribute, value))


def parse_page(path: Path) -> PageParser:
    parser = PageParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


def main() -> int:
    if not PUBLIC.exists():
        print("Project XC local-link check FAILED")
        print("- public/ does not exist; run python3 scripts/build_site.py first")
        return 1

    html_files = sorted(PUBLIC.rglob("*.html"))
    parsers = {path.resolve(): parse_page(path) for path in html_files}
    errors: list[str] = []
    checked = 0

    for page, parser in parsers.items():
        for attribute, raw_target in parser.targets:
            parts = urlsplit(raw_target)
            if parts.scheme or parts.netloc or raw_target.startswith(("mailto:", "tel:", "javascript:", "data:")):
                continue
            if not parts.path:
                target = page
            else:
                clean_path = unquote(parts.path)
                if clean_path.startswith("/"):
                    target = (PUBLIC / clean_path.lstrip("/")).resolve()
                else:
                    target = (page.parent / clean_path).resolve()
            if target.is_dir():
                target = target / "index.html"
            checked += 1
            try:
                target.relative_to(PUBLIC.resolve())
            except ValueError:
                errors.append(f"{page.relative_to(PUBLIC)} {attribute} escapes public/: {raw_target}")
                continue
            if not target.exists():
                errors.append(f"{page.relative_to(PUBLIC)} broken {attribute}: {raw_target}")
                continue
            if parts.fragment and target.suffix.lower() == ".html":
                target_parser = parsers.get(target.resolve())
                if target_parser is None:
                    target_parser = parse_page(target)
                    parsers[target.resolve()] = target_parser
                if unquote(parts.fragment) not in target_parser.ids:
                    errors.append(f"{page.relative_to(PUBLIC)} missing fragment in {raw_target}")

    if errors:
        print("Project XC local-link check FAILED")
        for message in errors:
            print(f"- {message}")
        return 1

    print("Project XC local-link check OK")
    print(f"- HTML pages: {len(html_files)}")
    print(f"- Local links/assets/fragments checked: {checked}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
