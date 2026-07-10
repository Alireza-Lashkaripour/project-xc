# Project XC Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build the initial Project XC repository and website for exchange-correlation functional discovery, references, aliases, and provenance.

**Architecture:** Static GitHub Pages site generated from JSON data. A machine-imported Libxc layer provides broad coverage; curated JSON records add interpretation and caveats. Validation scripts gate changes.

**Tech Stack:** Python standard library, JSON, static HTML/CSS/JavaScript, GitHub Actions, GitHub Pages.

---

### Task 1: Repository and data skeleton

**Objective:** Create the GitHub repository, license, README, data directories, and schema.

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `DATA_LICENSE.md`
- Create: `schemas/functional.schema.json`
- Create: `data/functionals.seed.json`
- Create: `data/program_aliases.json`

**Verification:**

Run `python3 -m json.tool schemas/functional.schema.json >/dev/null`.

### Task 2: Libxc import harness

**Objective:** Import the public Libxc functionals page into structured JSON.

**Files:**
- Create: `scripts/import_libxc.py`
- Create/Update: `data/libxc_snapshot.json`

**Verification:**

Run `python3 scripts/import_libxc.py --out data/libxc_snapshot.json` and verify more than 500 entries.

### Task 3: Validation harness

**Objective:** Validate imported and curated data.

**Files:**
- Create: `scripts/validate_data.py`

**Verification:**

Run `python3 scripts/validate_data.py`; expected output begins `Project XC validation OK`.

### Task 4: Static website

**Objective:** Build a searchable static catalog and functional detail page.

**Files:**
- Create: `site/index.html`
- Create: `site/functional.html`
- Create: `site/methodology.html`
- Create: `site/assets/app.js`
- Create: `site/assets/styles.css`
- Create: `scripts/build_site.py`

**Verification:**

Run `python3 scripts/build_site.py`; inspect `public/index.html` and generated summary.

### Task 5: Multi-agent workflow docs

**Objective:** Document how future agents expand the database safely.

**Files:**
- Create: `docs/workflows/agent-harness.md`
- Create: `docs/provenance/libxc-bootstrap.md`
- Create: `docs/experiments/initial-libxc-import.md`

**Verification:**

Read the docs and confirm each phase has inputs, outputs, gates, and rollback behavior.

### Task 6: CI and Pages deployment

**Objective:** Add GitHub Actions validation and Pages deployment.

**Files:**
- Create: `.github/workflows/validate.yml`
- Create: `.github/workflows/pages.yml`
- Create: `.github/ISSUE_TEMPLATE/functional_curation.yml`
- Create: `.github/ISSUE_TEMPLATE/reference_correction.yml`

**Verification:**

Run local validation/build; push; verify GitHub repository and Pages workflow state.
