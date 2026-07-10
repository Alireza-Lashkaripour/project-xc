# Project XC charter

## Mission

Build an open, auditable, and searchable exchange-correlation functional exchange for DFT, inspired by Basis Set Exchange but adapted to the scientific ambiguity of XC functionals.

## Non-negotiables

1. Every scientific claim has provenance.
2. Imported data is separated from curated interpretation.
3. Program aliases are never assumed; they are verified per program/version.
4. Ambiguities are first-class data, not footnotes hidden in prose.
5. The website is generated from data files; catalog HTML is not manually edited.

## Definition of “done” for a verified functional

A functional is verified only when it has:

- canonical name and aliases,
- Jacob's-ladder rung and kind,
- ingredients and major parameters,
- original references with DOI/BibTeX where possible,
- Libxc code(s) or explicit non-Libxc status,
- program alias table with evidence,
- caveats/variant notes,
- at least one reviewer sign-off.

## Bootstrap status

The first repository version includes a broad Libxc snapshot and a curated seed layer for high-impact functionals. It is not yet a complete hand-verified encyclopedia of every functional.
