# Many-Electron Wavefunctions Chapter Implementation Plan

> **For Hermes:** Execute this plan on `Alireza/academy-many-electron-20260715`, preserving the canonical `qc-many-electron.html` route and all existing Academy/Basis progress.

**Goal:** Publish Academy chapter C1 as ten dependency-ordered, source-grounded, earned laboratories from fermionic exchange through Slater determinants, spin adaptation, Slater–Condon structure, reduced density matrices, and a synthesis case file.

**Architecture:** Add one static chapter page, one dependency-free JavaScript model/UI module, one source ledger, deterministic production-model tests, and a CDP interaction/mobile gate. Use the shared Academy progress owner for canonical mission IDs and a separate versioned evidence/notebook store for earned state. Keep the next Hartree–Fock chapter out of scope: determinant matrix elements are exact finite-algebra teaching objects, not self-consistent mean-field equations.

**Tech stack:** HTML5, existing Project XC CSS, dependency-free browser JavaScript, Node `vm` model tests, dependency-free CDP browser tests, Python Academy validator/build/link gates.

**Safe base:** `origin/main` at `cb653468fe69cf16ed3bfe88edea3162f5ea452e`.

---

## Scientific and gameplay contract

| Level | Mission ID | Earned laboratory | Exact/limited model and win predicate |
|---|---|---|---|
| 1 | `fermion-exchange` | Exchange passport | Commit distinguishable/symmetric/antisymmetric behavior for several swapped-amplitude dossiers; identify electrons as fermions without treating labels as identities. |
| 2 | `spin-orbital-occupancy` | Occupation forge | Build valid `N`-electron bitstrings in `M` spin orbitals, reject duplicate creation, and match the exact `C(M,N)` determinant-space count. |
| 3 | `determinant-parity` | Sign ledger | Canonicalize orbital order, compute permutation parity, and predict the determinant sign before the parity oracle appears. |
| 4 | `determinant-overlap` | Gram-volume rescue | Use `<Φ_A|Φ_B>=det S`; distinguish normalized, nonorthogonal, and linearly dependent determinant files, then choose the appropriate action. |
| 5 | `one-body-selection` | One-body connectivity audit | Classify determinant pairs as identical, singly, or multiply substituted and decide whether a one-body matrix element is structurally allowed; “allowed” never means guaranteed nonzero. |
| 6 | `two-body-selection` | Pair-operator audit | Extend the structural rule to two-body operators and separate direct/exchange contributions in an exact single-determinant expectation value without deriving Hartree–Fock. |
| 7 | `spin-adaptation` | Spin-coupling forge | Combine two `M_S=0` determinants using an explicit spin-orbital ordering, commit singlet/triplet phase, and diagnose `<S²>` for pure and contaminated mixtures. |
| 8 | `one-rdm` | Natural-occupation lab | Build the spin-orbital 1-RDM from a tiny CI state; verify Hermiticity, `Tr γ=N`, occupation bounds, and idempotency only for a single determinant. |
| 9 | `two-rdm` | Contraction certificate | Build a tiny 2-RDM and verify antisymmetry, `Tr Γ=N(N−1)`, and `Σ_q Γ_{pq,rq}=(N−1)γ_{pr}`; explain that these checks are necessary evidence, not a complete practical 2-RDM N-representability solution. |
| 10 | `many-electron-case-file` | Many-electron evidence board | Resolve three staged dossiers under a finite evidence budget: state representation → allowed matrix element/diagnostic → sufficient evidence and surviving caveat. Requires notebook evidence from Levels 1–9. |

Every seal starts as `Locked seal · …`. A challenge freezes or derives grading from the exact displayed state; no Professor control may silently grade a different fixed dossier. Decisive parity, determinant overlap, spin label, matrix-element oracle, RDM spectrum/contraction, and boss evidence remain hidden until commitment. Failure is recoverable. Canonical completion remains authoritative if already present, while malformed standalone game state cannot invent completion.

## Mathematical conventions

- Spin orbitals have a declared canonical index order. A determinant is the normalized wedge product of orthonormal spin orbitals in ascending index order.
- Fermionic operators use `a_p†|n_0…n_{M−1}> = (−1)^(Σ_{k<p} n_k)(1−n_p)|…1_p…>` and the analogous annihilator.
- Permutation parity is the inversion count modulo two; duplicate indices make a determinant identically zero rather than assigning a sign.
- For nonorthogonal occupied sets, determinant overlap is the determinant of their occupied-orbital overlap matrix. The norm is `det G`; near-singular thresholds are diagnostics, not universal constants.
- Slater–Condon selection logic is stated structurally: a one-body operator can connect determinants differing by at most one substitution; a two-body operator can connect at most two. Integral symmetry can still make an allowed element zero.
- For canonical ordering `(aα,aβ,bα,bβ)`, define `D1=|aα bβ|`, `D2=|aβ bα|`, singlet `(D1−D2)/√2`, and triplet `M_S=0` `(D1+D2)/√2`. The page must state this convention because a different determinant ordering changes displayed phases.
- Use spin-orbital `γ_pq=<a_p†a_q>` and `Γ_pq,rs=<a_p†a_q†a_s a_r>`. Then `Tr γ=N`, `Tr Γ=N(N−1)`, and `Σ_q Γ_pq,rq=(N−1)γ_pr`.
- All models are finite determinant-space algebra. They do not optimize orbitals, solve Hartree–Fock, provide dynamic correlation, or establish complete 2-RDM N-representability.

## Implementation tasks

### Task 1: Add RED production-model contract

**Files:**
- Create: `scripts/test_qc_many_electron_models.js`

Write a Node/VM test that initially fails because `site/assets/qc-many-electron.js` is absent. Require exported pure functions for permutation parity, occupation combinatorics, fermionic creation/annihilation, excitation rank, determinant overlap, one-/two-body structural selection, spin adaptation, 1-RDM, 2-RDM, contraction diagnostics, and case-file evaluation. Use independent enumeration/direct matrix multiplication oracles rather than duplicating production formulas.

Run: `node scripts/test_qc_many_electron_models.js`
Expected before implementation: `RED: site/assets/qc-many-electron.js does not exist`.

### Task 2: Implement finite many-electron models

**Files:**
- Create: `site/assets/qc-many-electron.js`

Implement validated real-valued finite models. Keep DOM initialization behind `DOMContentLoaded`, export `window.QCManyElectronModels`, reject malformed bitstrings/permutations, and never label a structurally allowed matrix element as necessarily nonzero.

Run: `node --check site/assets/qc-many-electron.js && node scripts/test_qc_many_electron_models.js`.

### Task 3: Build the ten-laboratory chapter

**Files:**
- Create: `site/qc-many-electron.html`
- Modify: `site/assets/styles.css`

Use the established Academy hero/progress/navigation/lab/plot primitives with a distinct many-electron visual system. Include ten `academy-lesson` sections, ten `lab-grid` containers, ten canonical completion controls, explicit model boundary, persistent evidence notebook, source table, keyboard-readable plot regions, non-color plot encodings, and a final boss. Keep wide plots at a readable authored width in focusable internal scrollers on narrow screens.

### Task 4: Add earned state, reveal discipline, and reset recovery

**Files:**
- Modify: `site/assets/qc-many-electron.js`
- Test: `scripts/test_qc_many_electron_interactions.js`

Use `project-xc-many-electron-games-v1` for versioned chapter evidence. Test untouched seals, wrong-answer recovery, commit-before-reveal, all dossier cases, notebook persistence, malformed/blocked storage, canonical legacy completion, stale-ID filtering, focus continuity, key-repeat suppression, reduced motion, exact post-reset defaults/oracle hiding, and true `390×844` document/plot behavior.

### Task 5: Publish the route into Academy metadata and navigation

**Files:**
- Modify: `data/academy-curriculum.json`
- Modify: `site/quantum-chemistry.html`
- Modify: `site/index.html`
- Modify: `scripts/test_academy_core.js`

Change `qc-many-electron` to `live`, set `games: 10`, add the ten mission IDs and progress contract, update static available/planned counts to `8/19`, add direct root/gateway entry links, and extend shared progress/reconciliation/reset-isolation totals from 62 to 72 available missions.

### Task 6: Add source ledger and validator/CI contracts

**Files:**
- Create: `docs/academy/sources/qc-many-electron.md`
- Modify: `scripts/validate_academy.py`
- Modify: `.github/workflows/validate.yml`
- Modify: `.github/workflows/pages.yml`

Add the live-chapter rule, model and interaction gates to validation and deployment, and document conventions, equations, source provenance, model boundaries, exposed-domain tests, and N-representability caveats.

### Task 7: Verify exact final tree

Focused:

```bash
node --check site/assets/qc-many-electron.js
node --check scripts/test_qc_many_electron_models.js
node --check scripts/test_qc_many_electron_interactions.js
node scripts/test_qc_many_electron_models.js
node scripts/test_qc_many_electron_interactions.js
```

Retained:

```bash
python3 scripts/validate_data.py
python3 scripts/validate_academy.py
python3 scripts/test_academy_validator.py
node scripts/test_academy_models.js
node scripts/test_qc_math_models.js
node scripts/test_qc_atomic_models.js
node scripts/test_qc_atomic_interactions.js
node scripts/test_qc_approximation_models.js
node scripts/test_qc_approximation_interactions.js
node scripts/test_academy_core.js
node scripts/test_basis_progress.js
python3 scripts/harness_status.py
python3 scripts/build_site.py
python3 scripts/check_site_links.py
git diff --check
```

Repeat the new focused suites on Node 20. Run desktop `1440×900` and true-mobile `390×844` CDP QA with cache disabled, inspect actual plot pixels, formula containment, focus, console/network errors, no document overflow, and both ends of every internal plot scroller. Obtain blocker-only scientific/software/learning reviews and a narrow re-review after any fix.

### Task 8: Publish and verify live

Commit only a clean verified diff, push the safe branch, open a PR, wait for exact-head validation, merge without force, wait for Pages at the full merge SHA, then perform cache-busted HTTP byte comparison and the full interaction harness against the live origin. Keep the branch until publication is verified.
