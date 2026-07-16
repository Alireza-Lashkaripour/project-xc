# Hartree–Fock and SCF Chapter Implementation Plan

> **For Hermes:** Execute this plan on `Alireza/academy-hartree-fock-20260715` with TDD, retained browser gates, and separate scientific/implementation rereviews before publication.

**Goal:** Publish Academy chapter C2 as twelve dependency-ordered, source-grounded, earned laboratories that turn a finite determinant expectation into a variational Hartree–Fock stationary point and a defensible self-consistent-field workflow.

**Architecture:** Add one static chapter page, one dependency-free JavaScript model/UI module, one source ledger, isolated finite-model tests, and a raw-CDP interaction/mobile gate. The shared Academy store owns canonical mission IDs; a separate versioned evidence store owns earned dossiers and notebook records. Browser-public models remain answer-free, while neutral dossier identifiers and grading derived from displayed algebra prevent trivial answer routes.

**Tech stack:** HTML5, existing Project XC CSS, dependency-free browser JavaScript, Node `vm` scientific tests, dependency-free CDP browser tests, Python Academy validator/build/link gates, GitHub Actions, and GitHub Pages.

**Safe base:** `origin/main` at `3f1d8292969c7d4a826977a8328e35256ae227c4`.

---

## Twelve-mission scientific spine

| Level | Mission ID | Laboratory | Required decision and finite oracle |
|---|---|---|---|
| 1 | `hf-variational-manifold` | Determinant variation passport | Audit a one-angle occupied–virtual rotation using an exact finite energy slice, its derivative, and curvature; distinguish a supplied determinant expectation from HF stationarity. |
| 2 | `coulomb-exchange` | Coulomb/exchange forge | Build pair contributions from supplied `J`, `K`, and spin labels; apply exchange only to same-spin pairs and expose same-spin self-interaction cancellation without claiming correlation. |
| 3 | `fock-assembly` | Fock matrix foundry | Assemble a finite spin-orbital Fock matrix from `h`, a projector, and antisymmetrized two-electron integrals; audit Hermiticity and the density dependence that makes the problem nonlinear. |
| 4 | `roothaan-hall` | Generalized eigenproblem lab | Solve a real symmetric two-AO `F C = S C ε` problem by symmetric orthogonalization; verify `CᵀSC=I`, energy ordering, and residuals. |
| 5 | `density-projector` | Density closure lab | Build `D=C_occ C_occᵀ`; verify `Tr(DS)=N_occ` and `DSD=D`. State separately that the spin-summed RHF density `P=2D` obeys `PSP=2P`. |
| 6 | `orbital-stationarity` | Brillouin gate | Use occupied–virtual Fock elements as first-order stationarity evidence, distinguish them from occupied–occupied/virtual–virtual representation rotations, and state the stationary-HF scope of Brillouin’s theorem. |
| 7 | `scf-fixed-point` | SCF fixed-point race | Iterate a declared two-level nonlinear mean-field map and require an output–input density residual, not energy change alone, before calling it self-consistent. |
| 8 | `scf-pathology` | Convergence triage | Diagnose converged, oscillatory, divergent, and false-plateau logs from finite density/energy/residual histories. |
| 9 | `scf-stabilization` | Stabilizer workshop | Apply damping or a declared virtual level shift to an appropriate pathology; verify the changed iteration and retain the caveat that accelerators do not guarantee the physical/global minimum. |
| 10 | `diis` | Residual-subspace mixer | Solve a constrained residual combination with coefficients summing to one; detect singular/redundant residual histories and distinguish DIIS residual minimization from a variational energy bound. |
| 11 | `reference-spin` | Reference and spin audit | Choose RHF, ROHF, or UHF from electron/spin constraints; compute UHF `<S²>` from the alpha–beta occupied overlap and diagnose contamination/broken-symmetry trade-offs without declaring one reference universally best. |
| 12 | `hf-case-file` | HF/SCF evidence board | Resolve three staged research dossiers—reference/model choice → convergence/stationarity diagnostic → validation evidence and surviving caveat—under a finite budget after Levels 1–11 are earned. |

## Scientific contracts

- The finite Hartree–Fock energy is variational only within the declared normalized determinant/orbital manifold. A stationary point is not automatically the global minimum or stable against every allowed orbital rotation.
- Use a declared real spin-orbital convention for the finite Fock build: `F_pq=h_pq+Σ_rs D^(so)_rs <pr||qs>`, with `D^(so)` the full occupation-one 1-RDM over every occupied alpha and beta spin orbital. Keep that object explicitly separate from Level 5's one-spin spatial projector and test a symmetry-complete two-electron determinant independently.
- Coulomb and exchange are mean-field terms. Exchange acts between same-spin spin orbitals; opposite-spin exchange vanishes after spin integration. Hartree–Fock still omits correlation.
- In a nonorthogonal AO basis, canonical coefficients obey `CᵀSC=I`, and the SCF stationarity residual may be represented by `FDS-SDF`. Small energy changes alone are insufficient convergence evidence.
- For the one-spin spatial projector `D^(sigma)=C_occ C_occᵀ`, require `Tr(D^(sigma)S)=N_occ` and `D^(sigma) S D^(sigma)=D^(sigma)`; for the closed-shell spin-summed spatial density `P=2D^(sigma)`, require `Tr(PS)=N` and `PSP=2P`.
- Brillouin’s theorem is a stationary-HF statement for singly substituted determinants in the optimized orbital framework. It is not a statement that excited configurations or correlation are absent.
- DIIS extrapolates from residual/error vectors and can become ill-conditioned. It is not an energy variational theorem and can converge to an undesired stationary solution.
- The UHF spin diagnostic uses an explicit convention and compares `<S²>` with `S(S+1)`; contamination is evidence to interpret, not by itself a universal rejection criterion.
- Every finite SCF map is labeled pedagogical. It demonstrates nonlinear fixed-point behavior but is not an ab initio molecular calculation.
- The chapter stops before post-HF correlation, Kohn–Sham DFT, analytic gradients, and formal HF stability-Hessian analysis beyond a clearly labeled finite orbital-rotation diagnostic.

## Implementation tasks

### Task 1: Establish RED scientific contracts

**Files:**
- Create: `scripts/test_qc_hartree_fock_models.js`

**Steps:**
1. Assert the production module is initially absent or missing the required API.
2. Add independent finite checks for matrix operations, two-by-two symmetric/generalized eigensystems, projector closure, Fock assembly, commutator residuals, variational finite differences, SCF maps, damping, DIIS, and UHF `<S²>`.
3. Add malformed-input, singular-overlap, degenerate-eigenvalue, singular-DIIS, and false-energy-plateau cases.
4. Run `node scripts/test_qc_hartree_fock_models.js`; record the expected RED failure.

### Task 2: Implement answer-free finite models

**Files:**
- Create: `site/assets/qc-hartree-fock.js`
- Test: `scripts/test_qc_hartree_fock_models.js`

**Steps:**
1. Implement immutable-input matrix helpers and deterministic two-by-two eigensolvers.
2. Implement `generalizedEigen2`, projector/density audits, declared-index Fock assembly, HF energy, and AO commutator residual.
3. Implement exact one-angle energy/derivative/curvature helpers, occupied–virtual stationarity diagnostics, the declared two-level SCF map, damping, level-shift helper, constrained DIIS, and UHF spin diagnostics.
4. Keep browser-public exports answer-free. Export mission evaluators only through CommonJS for isolated Node tests.
5. Run the focused model suite until GREEN, then inspect syntax and source for non-finite output or mutation.

### Task 3: Add neutral dossiers and earned-state owner

**Files:**
- Modify: `site/assets/qc-hartree-fock.js`
- Test: `scripts/test_qc_hartree_fock_models.js`

**Steps:**
1. Define closure-private neutral-ID dossiers containing only the scientific input shown to learners.
2. Derive every classification from those inputs; do not store `expected`, `route`, or semantically answer-bearing case IDs.
3. Implement versioned storage key `project-xc-hartree-fock-games-v1`, strict shape/ID/stage/budget sanitization, notebook evidence, and earned mission predicates.
4. Reject direct or persisted canonical completion unless internal chapter evidence authorizes it.
5. Implement chapter-local reset that leaves all other Academy and Basis progress untouched.

### Task 4: Build the twelve-level chapter page

**Files:**
- Create: `site/qc-hartree-fock.html`
- Modify: `site/assets/qc-hartree-fock.js`

**Steps:**
1. Add the chapter hero, explicit HF/SCF model boundary, twelve-level navigation, persistent evidence notebook, and reset control.
2. Build twelve decision laboratories with fixed displayed dossiers, commitment controls, recoverable feedback, hidden decisive evidence, and disabled earned seals.
3. Add eleven finite SVG instruments for Levels 1–11 and one staged boss evidence board for Level 12.
4. Include professor notes on nonorthogonal AO metrics, SCF stationarity versus stability/global optimality, reference choices, and the boundary before correlation/DFT.
5. Add at least three safe external source links and exact “Verified source spine” wording.

### Task 5: Add visual and responsive contracts

**Files:**
- Modify: `site/assets/styles.css`

**Steps:**
1. Add a coherent Hartree–Fock visual system using existing Academy tokens and a distinct matrix/iteration visual identity.
2. Use labels, line styles, symbols, and hatching in addition to color.
3. Keep each 680 px finite instrument internally scrollable at `390×844` while preventing document overflow.
4. Preserve 44 px or larger visible touch controls, focus outlines, and reduced-motion behavior.
5. Inspect desktop and exact mobile pixels before publication.

### Task 6: Add the retained browser gate

**Files:**
- Create: `scripts/test_qc_hartree_fock_interactions.js`

**Steps:**
1. Launch isolated headless Chrome over a temporary local server and assert DOM/ARIA/plot contracts.
2. Verify fresh state, all twelve earned predicates, wrong-answer recovery, commit-before-reveal, fixed displayed-versus-graded dossiers, and focus continuity.
3. Reject public evaluator/constants exports, answer-bearing public values, and shipped-source `expected`/`route` tables.
4. Exercise malformed/blocked storage, direct and persisted canonical forgery, boss prerequisites/budget exhaustion/recovery, partial stage persistence, and complete chapter reset isolation.
5. Emulate exact `390×844`; require no document overflow, eleven two-ended internal plot scrollers, touch targets, reduced motion, and no severe browser events.

### Task 7: Write the source and verification ledger

**Files:**
- Create: `docs/academy/sources/qc-hartree-fock.md`

**Steps:**
1. Document every equation, tensor/index convention, finite dossier, and scope boundary.
2. Cite the Roothaan–Hall foundations, Pulay DIIS, modern open SCF review, UHF/spin-contamination sources, and relevant implementation references.
3. Record independent test oracles and explain why they do not merely echo production code.
4. State the browser answer boundary honestly: accidental answer oracles are removed, but static client code is not cryptographic secrecy.

### Task 8: Integrate curriculum, navigation, validation, and CI

**Files:**
- Modify: `data/academy-curriculum.json`
- Modify: `scripts/validate_academy.py`
- Modify: `scripts/test_academy_core.js`
- Modify: `.github/workflows/validate.yml`
- Modify: `.github/workflows/pages.yml`
- Modify: `site/quantum-chemistry.html`
- Modify: `site/index.html`

**Steps:**
1. Promote `qc-hartree-fock` to `live`, set `levels: 12`, `games: 12`, and add the twelve authoritative mission IDs.
2. Add the live validator rule with script, model test, interaction test, source ledger, boundary/challenge text, and eleven plots.
3. Extend shared progress/reset/reconciliation tests and update the combined example from `7/72` to `8/84`.
4. Add both retained tests to validation and Pages predeployment gates before build/upload.
5. Update fallback counts to nine live and eighteen planned routes; add the chapter to the gateway and root live sequence.

### Task 9: Verify adversarially and publish

**Steps:**
1. Run syntax checks, model tests, interaction tests, shared core/validator tests, build/link checks, whitespace checks, and the exact workflow matrices command by command.
2. Perform desktop and exact `390×844` visual QA, including all dossier states, scroll endpoints, hidden evidence, console output, and boss recovery.
3. Obtain separate read-only scientific and implementation approvals against the final staged diff; remediate every high-value finding with a regression and rereview.
4. Commit on the feature branch, push, open a PR, wait for green CI, merge, and verify the exact merge SHA in both validation and Pages workflows.
5. Compare cache-busted live HTML/JavaScript/CSS to verified local assets and run the JavaScript-capable browser gate against the live route in an isolated profile.
6. Fast-forward local `main`, stop temporary processes, and leave the repository clean.
