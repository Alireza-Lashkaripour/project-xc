#!/usr/bin/env python3
"""Focused regression tests for Academy HTML contract parsing."""
from __future__ import annotations

from validate_academy import inspect_html

checks = 0


def assert_equal(actual: object, expected: object, message: str) -> None:
    global checks
    checks += 1
    if actual != expected:
        raise AssertionError(f"{message}: got {actual!r}, expected {expected!r}")


sample = """
<section data-step='1' aria-label='lesson' class='card-panel academy-lesson' id='level-1'></section>
<nav class='academy-lesson-nav'></nav>
<button data-mission='mission-one' type='button' class='secondary academy-complete' id='complete-one'>Complete</button>
<div aria-label='lab' class='card lab-grid'></div>
<div aria-describedby='scroll-help' tabindex='0' aria-label='results' role='region' class='extra table-scroll'>
  <table id='results-table' class='meta-table wide-table'></table>
</div>
<p id='scroll-help' class='small table-scroll-hint'>Swipe.</p>
<a rel='external noopener noreferrer' href='https://example.test/source' target='_blank'>Source</a>
<button type='button' class='quest-complete secondary'>Legacy mission</button>
"""

inspector = inspect_html(sample)
assert_equal(inspector.level_count, 1, 'exact academy-lesson class token')
assert_equal(inspector.mission_count, 1, 'completion-control count')
assert_equal(inspector.mission_ids, ['mission-one'], 'mission id extraction')
assert_equal(inspector.game_count, 1, 'lab-grid count')
assert_equal(inspector.wide_table_count, 1, 'wide-table count')
assert_equal(inspector.scroll_region_count, 1, 'accessible scroll-region count')
assert_equal(inspector.scroll_hint_count, 1, 'scroll-hint count')
assert_equal(inspector.safe_external_link_count, 1, 'safe external-link count')
assert_equal(inspector.quest_complete_count, 1, 'legacy completion-control count')
assert_equal(inspector.html_ids, ['level-1', 'complete-one', 'results-table', 'scroll-help'], 'id extraction')
assert_equal(inspector.uncontained_wide_table_count, 0, 'wide table is nested in its accessible scroll region')
assert_equal(inspector.unhinted_wide_table_count, 0, 'wide-table region references its visible hint')

misassociated = """
<table class='wide-table'></table>
<table class='meta-table wide-table'></table>
<div aria-describedby='hint-a' tabindex='0' aria-label='empty region A' role='region' class='table-scroll'></div>
<p id='hint-a' class='table-scroll-hint'>Unrelated hint A.</p>
<div aria-describedby='hint-b' tabindex='0' aria-label='empty region B' role='region' class='table-scroll'></div>
<p id='hint-b' class='table-scroll-hint'>Unrelated hint B.</p>
"""
invalid = inspect_html(misassociated)
assert_equal(invalid.uncontained_wide_table_count, 2, 'unrelated aggregate regions cannot approve unwrapped tables')
assert_equal(invalid.unhinted_wide_table_count, 2, 'unwrapped tables cannot borrow unrelated hints')

missing_hint = """
<div tabindex='0' aria-label='results' role='region' class='table-scroll'>
  <table class='wide-table'></table>
</div>
<p id='orphan-hint' class='table-scroll-hint'>Orphan hint.</p>
"""
invalid = inspect_html(missing_hint)
assert_equal(invalid.uncontained_wide_table_count, 0, 'valid accessible ancestor is recognized structurally')
assert_equal(invalid.unhinted_wide_table_count, 1, 'region must explicitly associate the relevant hint')

wrong_hint = """
<div aria-describedby='missing-hint' tabindex='0' aria-label='results' role='region' class='table-scroll'>
  <table class='wide-table'></table>
</div>
<p id='actual-hint' class='table-scroll-hint'>This unrelated hint must not satisfy the table.</p>
"""
invalid = inspect_html(wrong_hint)
assert_equal(invalid.unhinted_wide_table_count, 1, 'aria-describedby must target an actual table hint')

print('Project XC Academy HTML parser tests OK')
print(f'- deterministic assertions: {checks}')
print('- Attribute order, exact class tokens, nested table regions, associated hints, links, missions, and ids: OK')
