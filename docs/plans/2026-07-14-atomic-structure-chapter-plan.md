# Atomic Structure Chapter Implementation Plan

> **For Hermes:** Execute this plan task-by-task with focused TDD, independent scientific/integration review, and browser QA before publication.

**Goal:** Publish a beautiful, source-grounded Atomic Structure chapter that takes a learner from hydrogenic quantum numbers to many-electron configurations, LS terms, and an explicitly bounded fine-structure model through 12 levels and 12 substantial games.

**Architecture:** Add one independent static chapter (`qc-atoms.html`) backed by one production JavaScript model/UI module, a Node oracle test that loads the production module directly, and a dependency-free Chrome/Chromium interaction regression. Integrate it through the existing curriculum, shared Academy progress, homepage, validators, CI, Pages gate, README, and source ledger without changing existing chapter storage or routes.

**Tech Stack:** Static HTML, existing Project XC CSS, vanilla JavaScript, MathJax, inline SVG, Node `vm` tests, Chrome DevTools Protocol browser tests, Python standard-library structural validators, GitHub Pages.

---

## Scientific contract

### Model hierarchy

Every result must identify its scope:

1. **Exact inside the stated nonrelativistic one-electron Coulomb model:** quantum-number ranges, `n²` spatial degeneracy, hydrogenic energy, radial functions/nodes, and angular nodes.
2. **Exact angular electric-dipole filter, not a complete intensity prediction:** `Δl=±1`, `Δm=0,±1`; zero-energy hydrogenic pairs do not produce a finite-frequency line.
3. **Approximate named model:** Slater-rule effective charge; never label its energies as experimental ionization energies.
4. **Empirical/pedagogical ground-configuration ledger:** neutral atoms H–Kr, including Cr/Cu exceptions; not an ab-initio energy minimization and not an ion configuration engine.
5. **Exact combinatorics within one equivalent-electron subshell and pure LS coupling:** determinant microstates and term decomposition.
6. **Ideal first-order `A L·S` model:** allowed `J`, degeneracies, Landé interval rule, and degeneracy-weighted barycenter; not a general relativistic atomic-structure calculation.

### Constants and conventions

- Atomic units unless a unit is printed explicitly.
- Infinite nuclear mass and no relativity/fine structure for the Coulomb ladder.
- `E_n = -Z²/(2n²) E_h`.
- `ρ=2Zr/n`; normalized radial function
  `R_nl = sqrt[(2Z/n)^3 (n-l-1)!/(2n(n+l)!)] exp(-ρ/2) ρ^l L_(n-l-1)^(2l+1)(ρ)`.
- Radial probability is `P(r)=r²|R_nl(r)|²`; radial nodes `n-l-1`, angular nodes `l`, total nodes `n-1`.
- Complex `Y_l^m` states have definite `m`; familiar real `p`/`d` pictures are real linear combinations of `±m` and must not be labeled as unique `m≠0` eigenfunctions.
- Photon wavelength uses the chapter’s model energy difference and a documented eV·nm conversion constant; experimental lines are delegated to NIST ASD.
- Term labels use `^(2S+1)L`; fine-structure labels add `_J`.

### Authoritative mission IDs

1. `model-map`
2. `quantum-numbers`
3. `coulomb-spectrum`
4. `radial-structure`
5. `angular-structure`
6. `dipole-transitions`
7. `screening`
8. `configurations`
9. `periodic-patterns`
10. `term-symbols`
11. `fine-structure`
12. `atomic-case-file`

## Level and game map

| Level | Topic | Deep interaction |
|---|---|---|
| 1 | Which atom model is speaking? | Model Passport game classifies claims as Coulomb-exact, empirical configuration-ledger, Slater approximation, or ideal LS-coupling model |
| 2 | Quantum numbers | Quantum-number gate accepts/rejects `(n,l,m)` and explains every constraint, capacities, and node counts |
| 3 | Coulomb degeneracy | Hydrogenic energy-ladder forge varies `Z`, `n_max`, and highlights same-`n` degeneracy |
| 4 | Radial structure | Normalized Laguerre radial explorer varies `(n,l,Z)`, displays `R` and `r²|R|²`, and locates radial nodes |
| 5 | Angular structure | Real-orbital node studio varies `s/p/d` shape, slice plane, and rotation; phase sign, nodal planes/cones, and real-`±m` caveat remain visible |
| 6 | Spectroscopy | Transition spectroscope checks E1 angular rules, direction, model `ΔE`, wavelength, and zero-energy degeneracy |
| 7 | Electron shielding | Slater screening arena chooses atom/target orbital and decomposes every screening contribution |
| 8 | Ground configurations | Orbital-box configuration forge lets learners build and audit neutral H–Kr configurations with Pauli/Hund/Aufbau diagnostics and Cr/Cu exceptions |
| 9 | Periodic shell patterns | Periodic detective reports period, block, valence pattern, unpaired count, and model magnetic classification |
| 10 | Equivalent-electron terms | Microstate foundry enumerates determinant `(M_L,M_S)` counts and decomposes `p^q`/`d^q` into allowed LS terms |
| 11 | Fine structure preview | `A L·S` ladder varies a term and `A`, renders allowed `J`, degeneracies, shifts, intervals, and barycenter |
| 12 | Atomic case-file boss | Multi-part deterministic cases require model selection, node/transition/configuration/term interpretation, with per-rule feedback rather than a single score |

## Task 1: Freeze contract and source ledger

**Files:**
- Create: `docs/academy/sources/qc-atoms.md`
- Create: `docs/plans/2026-07-14-atomic-structure-chapter-plan.md`

**Steps:**
1. Record verified MIT OCW, NIST DLMF, NIST ASD/Atomic Spectroscopy Compendium, NIST CODATA, OpenStax, and IUPAC URLs with chapter use and access date.
2. Record every equation, model limitation, and deterministic oracle.
3. Review the distinction among complex `m` eigenstates, real orbital pictures, E1 angular rules, empirical configurations, and LS-coupling models.

## Task 2: Add red curriculum/validator/workflow contracts

**Files:**
- Modify: `data/academy-curriculum.json`
- Modify: `scripts/validate_academy.py`
- Modify: `.github/workflows/validate.yml`
- Modify: `.github/workflows/pages.yml`
- Modify: `scripts/test_academy_core.js`

**Steps:**
1. Mark `qc-atoms` live with 12 levels, 12 games, and the 12 mission IDs.
2. Add a live-chapter validator rule requiring `qc-atoms.js`, `test_qc_atomic_models.js`, `test_qc_atomic_interactions.js`, source ledger, model-boundary text, final boss, and the declared accessible plots.
3. Require both atomic tests in validation and Pages pre-upload gates.
4. Add progress tests proving only the 12 authoritative atomic mission IDs count and chapter reset does not touch Foundations, Math, or Basis storage.
5. Run focused tests and confirm the missing page/script/test fail before implementation.

## Task 3: Implement pure production models

**Files:**
- Create: `site/assets/qc-atoms.js`
- Create: `scripts/test_qc_atomic_models.js`

**Production API:**

```js
window.QCAtomicModels = Object.freeze({
  quantumState, hydrogenicEnergy, associatedLaguerre,
  radialNodes, radialModel, angularAmplitude, angularSlice,
  transitionModel, groundConfiguration, slaterEffectiveCharge,
  configurationAudit, atomDiagnostic, enumerateMicrostates,
  decomposeLSTerms, fineStructureLevels, evaluateAtomicCase
});
```

**Oracle matrix:**
- valid `1s`, `2p`; reject `n=0`, `l=n`, `|m|>l`, nonintegers;
- shell capacities `2n²`, subshell capacities `2(2l+1)`, node identity;
- H/He⁺ Coulomb scaling and same-`n` degeneracy;
- exact low-order Laguerre values and `2s`, both `3s`, and `3p` analytic node radii;
- numerical radial normalization, expected node counts, and direct Laguerre-zero checks over all allowed states through `n=6`;
- real-orbital nodal/parity probes for `s`, `p`, and `d` shapes;
- H-like `2p→1s` allowed, `2s→1s` E1-forbidden, `Δm=2` forbidden, same-`n` zero-energy case;
- complete neutral H–Kr electron counts and Cr/Cu exceptions;
- Slater examples C `2p: Z_eff=3.25`, Na `3s: 2.20`, Fe `3d: 6.25`;
- configuration audit diagnoses empty/wrong/Hund-breaking proposals, isolates a same-spin Pauli violation, and accepts every canonical H–Kr box ledger;
- `p²: 15 → ¹S+¹D+³P`, `p³: 20 → ⁴S+²D+²P`, `d²: 45 → ¹S+¹D+¹G+³P+³F`, plus determinant/dimension closure for every exposed p/d occupancy and electron-hole symmetry;
- `³P` fine shifts `(-2,-1,+1)A`, degeneracy-weighted barycenter zero, and Landé intervals.

Run red first, implement minimally, then refactor shared sampling, combinatorics, and SVG-safe helpers.

## Task 4: Build the 12-level chapter UI

**Files:**
- Create: `site/qc-atoms.html`
- Modify: `site/assets/qc-atoms.js`
- Modify only as needed: `site/assets/styles.css`

**Steps:**
1. Build the chapter hero, explicit model boundary, 12-level navigation, shared progress shelf, and 12 completion buttons.
2. Implement all 12 game panels with labeled controls, `aria-live` feedback, focus-visible controls, and deterministic reset/reveal states.
3. Use a restrained “spectral instrument” visual motif: warm paper cards, dark indigo energy rails, amber spectral lines, violet phase sign, and diagram grids. Color is supplementary to text, patterns, marker shapes, and signs.
4. Put wide plots/tables inside focusable contained horizontal scroll regions with visible mobile hints and normal-HTML keys.
5. Ensure reduced motion, keyboard use, and no page-level horizontal overflow.
6. Bind progress through `ProjectXCAcademy.bindChapter({ chapterId: 'qc-atoms', totalMissions: 12 })`.

## Task 5: Integrate discoverability and documentation

**Files:**
- Modify: `site/index.html`
- Modify: `site/quantum-chemistry.html`
- Modify: `README.md`
- Modify: `data/academy-curriculum.json`

**Steps:**
1. Add the direct B1 Atomic Structure link to the root live-chapter navigation.
2. Add Atomic Structure to the Academy entry grid and update available/planned fallback counts.
3. Add README direct page, local test command, and source-ledger link.
4. Confirm the data-driven gateway links the new route and reports 12 more available missions.

## Task 6: Focused verification and review

**Commands:**

```bash
node --check site/assets/qc-atoms.js
node scripts/test_qc_atomic_models.js
node scripts/test_qc_atomic_interactions.js
python3 scripts/test_academy_validator.py
python3 scripts/validate_academy.py
node scripts/test_academy_core.js
python3 scripts/build_site.py
python3 scripts/check_site_links.py
git diff --check
```

**Steps:**
1. Run exact/rational or independently coded spot checks for radial, configuration, microstate, and fine-structure oracles.
2. Run read-only scientific and integration/accessibility reviews; resolve all medium/high findings.
3. Generate an OS-safe `hermes-verify-` ad-hoc script, run focused final checks, and remove it.

## Task 7: Browser QA

**Desktop:** `1440×900`.

**True mobile:** CDP emulation `390×844`, device scale factor 1, mobile/touch enabled.

**Acceptance:**
- all 12 labs initialize and react to controls;
- no console/page errors except a documented external-renderer condition if independently checked;
- formulas do not overflow the document;
- scrollable plots/tables have `scrollWidth>clientWidth` where intended and the document remains 390 px wide;
- orbital-box focus remains on the same control after each Space/Enter activation, and keyboard focus/scroll work elsewhere;
- `A=0` and `⁴S` fine-structure states use one true-energy line with separate stacked labels, an explicit `same E` bracket, and a non-overlapping barycenter annotation;
- phase/nodes/series remain distinguishable without color;
- progress reaches 12/12, persists on reload, and chapter reset is isolated;
- desktop has no new clipping or awkward forced scroll.

Capture representative screenshots for radial, angular, configuration, term, fine-structure, and boss states and inspect pixels.

## Task 8: Publish and verify

1. Inspect and simplify the complete diff before committing.
2. Commit on `Alireza/academy-atomic-structure-20260714`; push only that safe branch.
3. Open a focused PR and wait for validation.
4. Merge only after local evidence, CI, and both independent reviews pass.
5. Verify exact merge SHA, validation run, Pages run, deployment record, cache-busted static resources, and live desktop/mobile interactions.
6. Delete temporary server/browser profiles/harnesses and report exact URLs and evidence.
