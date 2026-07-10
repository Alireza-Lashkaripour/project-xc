# Project XC — Exchange-Correlation Functional Exchange

Project XC is a Basis-Set-Exchange-inspired open catalog for density-functional theory exchange-correlation (XC) functionals.

Goal: make it easy to find a functional, understand what it means, identify aliases across quantum-chemistry programs, cite the right papers, and verify implementation/provenance.

Live-site target: GitHub Pages from this repository.

Repository: https://github.com/Alireza-Lashkaripour/project-xc

## What is included now

- Machine-imported Libxc functionals snapshot: 678 entries.
- Libxc entries with DOI/citation references: 666.
- Total imported reference links: 782.
- Curated high-impact seed records: 21.
- Static searchable website with filters, details, reference cards, and compare tray.
- Validation harness for schema, DOI shape, duplicates, and curated/Libxc cross-links.
- Multi-agent workflow harness for scaling the project safely.
- GitHub Actions for validation and GitHub Pages deployment.

## Scope

Project XC tracks:

- LDA, GGA, meta-GGA, hybrid GGA, hybrid meta-GGA, range-separated hybrids.
- Exchange-only, correlation-only, exchange-correlation, and kinetic-energy functionals.
- Canonical names, aliases, program names, Libxc IDs, references, and curation notes.
- Caveats such as B3LYP VWN convention differences, range-separation parameters, dispersion corrections, and nonlocal correlation.

## Data layers

1. `data/libxc_snapshot.json`
   - Generated from the public Libxc functionals page.
   - Provides broad coverage and DOI/citation anchors.
   - Treat as imported source data, not manually verified scientific interpretation.

2. `data/functionals.seed.json`
   - Curated high-impact functional records.
   - Adds aliases, ingredients, caveats, program-name notes, and parameter summaries.

3. `data/program_aliases.json`
   - Starts the cross-program alias table.
   - Intended to grow through verified program documentation and test inputs.

## Commands

Validate data:

```bash
python3 scripts/validate_data.py
python3 scripts/harness_status.py
```

Re-import Libxc snapshot:

```bash
python3 scripts/import_libxc.py --out data/libxc_snapshot.json
```

Build the static site:

```bash
python3 scripts/build_site.py
```

Serve locally:

```bash
python3 -m http.server 8000 -d public
```

Then open:

```text
http://localhost:8000
```

## Scientific caution

XC functionals are not as clean as basis sets. Names can hide:

- program-specific formula variants,
- different VWN correlation conventions,
- different range-separation parameters,
- dispersion corrections applied outside the XC kernel,
- nonlocal correlation terms handled in separate code paths,
- grid and numerical integration sensitivity,
- different Libxc/component composition conventions.

Project XC therefore stores every claim with provenance and a curation status.

## Licenses and attribution

- Repository code: MIT license, see `LICENSE`.
- Curated Project XC metadata: CC BY 4.0 intent, see `DATA_LICENSE.md`.
- Imported Libxc-derived snapshot: attribute to Libxc and respect Libxc/MPL-2.0 terms; see `DATA_LICENSE.md`.

## Project status

Bootstrap created 2026-07-10T01:04:44Z. The site and harness are intentionally data-driven so agents and human contributors can expand the catalog without rewriting the website.

## Multi-agent harness

Operational prompt packs and machine-readable task queues live under `harness/`. Start with `harness/queues/bootstrap-tasks.json` and validate with `python3 scripts/harness_status.py`.


## Formula model

Every displayed record now carries a `formula` object. For curated records this contains a Project XC seed interpretation of the functional decomposition and known exact-exchange/range-separation amounts. For imported Libxc records it contains a clearly labeled generic scaffold derived from rung/kind, with unknown coefficients marked `unknown-not-curated` rather than guessed.

Core fields:

- `formula.latex`: display formula or scaffold.
- `formula.amounts.exact_exchange`: exact-exchange fraction or explicit unknown/not-applicable status.
- `formula.amounts.short_range_exact_exchange` and `long_range_exact_exchange`: range-separated amounts when known.
- `formula.amounts.range_separation_omega`: omega value or explicit unknown/not-applicable status.
- `formula.amounts.other_terms`: dispersion, VV10, or other external/nonlocal terms.
- `formula.terms`: component-level decomposition with Libxc code links when available.
