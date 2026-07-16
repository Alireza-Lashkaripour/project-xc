# Geometry, Gradients, and Frequencies Chapter Implementation Plan

> **For Hermes:** Execute this plan on `Alireza/academy-geometry-20260716` with TDD, retained browser gates, and separate scientific/implementation rereviews before publication.

**Goal:** Publish Academy chapter C3 as ten dependency-ordered, source-grounded, earned laboratories that connect converged electronic energies to nuclear forces, geometry optimization, curvature, vibrational analysis, transition-state validation, and IRC evidence.

**Architecture:** Add one static chapter page, one dependency-free JavaScript model/UI module, one source ledger, isolated finite-model tests, and a raw-CDP interaction/mobile gate. Reuse the shared Academy store only for authoritative mission IDs; own replayable earned evidence in a separate versioned geometry store. Keep browser-public transforms answer-free, derive grading from fixed displayed scientific inputs, and label every finite surface as a teaching model rather than an ab initio molecular calculation.

**Tech stack:** HTML5, existing Project XC CSS, dependency-free browser JavaScript, Node `vm` scientific tests, dependency-free CDP browser tests, Python Academy validator/build/link gates, GitHub Actions, and GitHub Pages.

**Safe base:** `origin/main` at `59165219659da4c91854e027f962c8e31eaf2a4a`.

---

## Ten-mission scientific spine

| Level | Mission ID | Laboratory | Required decision and independent finite oracle |
|---|---|---|---|
| 1 | `pes-forces` | Potential-energy-surface walker | Evaluate a declared two-coordinate surface, distinguish gradient from force (`F=-∇E`), choose a downhill direction, and verify it with an independent directional finite difference. |
| 2 | `analytic-gradient` | Analytic-gradient ledger | Assemble a stationary finite-basis derivative from nuclear, one-electron, two-electron, and overlap/Pulay terms; reject a stationary-gradient claim when the SCF residual is too large. |
| 3 | `gradient-validation` | Finite-difference step laboratory | Compare an analytic derivative with central finite differences across large, useful, and cancellation-dominated steps; diagnose truncation versus roundoff rather than treating any numerical difference as truth. |
| 4 | `geometry-optimization` | Optimizer step race | Compare steepest descent and trust-limited Newton steps on supplied quadratic surfaces; use predicted energy change and curvature instead of assuming Newton is always safe. |
| 5 | `trust-bfgs` | Trust/BFGS workshop | Apply the Hessian-form BFGS update only when `sᵀy>0`; combine predicted-versus-actual reduction with a trust-radius decision and reject noisy/negative-curvature updates. |
| 6 | `hessian-curvature` | Curvature foundry | Audit a symmetric Hessian against finite differences of gradients, diagonalize it, and use eigenvalue inertia with an explicit near-zero tolerance. |
| 7 | `normal-modes` | Mass-weighted mode laboratory | Build `M^{-1/2} H M^{-1/2}`, identify translational and stretching modes in a finite diatomic model, and verify the analytic nonzero eigenvalue `k(1/m₁+1/m₂)` plus isotope trends. |
| 8 | `stationary-points` | Frequency and stationary-point audit | Combine gradient norm, significant negative Hessian eigenvalues, near-zero external/numerical modes, linear/nonlinear mode counts, and ZPE from real frequencies to classify minima, first-order saddles, higher-order saddles, or unresolved artifacts. |
| 9 | `transition-state-irc` | Saddle/IRC bridge | On a declared double-well surface, require one significant negative mode, displace in both signs of that mode, follow mass-weighted downhill paths, and verify distinct connected minima plus a ZPE-corrected barrier. |
| 10 | `geometry-case-file` | Geometry evidence board | Resolve three staged research dossiers—target/workflow → dominant diagnostic → sufficient validation and surviving caveat—after Levels 1–9 are earned and within a finite evidence budget. |

## Scientific contracts

- Nuclear force is `F_A=-dE/dR_A`; the sign must never be silently interchanged with the energy gradient.
- A potential-energy surface in this chapter is Born–Oppenheimer electronic-plus-nuclear energy in declared coordinates. Every plotted polynomial or double-well is pedagogical, not a molecular prediction.
- For stationary variational HF in an atom-centered finite basis, the derivative ledger includes explicit nuclear, one-electron, two-electron, and overlap/energy-weighted-density (Pulay) terms. Orbital response cancels from the total first derivative only under the declared stationary variational conditions; unconverged or nonvariational methods require additional response treatment.
- Analytic-versus-finite-difference agreement is a validation diagnostic, not proof that both implementations are correct. Central differences have truncation error at large step and floating-point cancellation at very small step.
- Geometry convergence requires more than a small energy change. Declare gradient, displacement, and step/energy criteria, and inspect the final Hessian separately.
- Newton steps depend on curvature. An indefinite or ill-conditioned Hessian can point away from a minimum; trust regions and line searches globalize a local model but do not prove the desired basin was found.
- Hessian-form BFGS preserves positive definiteness only under the usual positive-curvature condition `sᵀy>0` with appropriate denominators. Reject or damp unsafe updates rather than divide through singular data.
- Frequencies come from the mass-weighted Hessian after removing/identifying translations and rotations. A nonlinear molecule has `3N-6` vibrational modes and a linear molecule `3N-5`, subject to numerical and coordinate caveats.
- A minimum has no significant imaginary vibrational mode; a first-order transition structure has exactly one significant negative-curvature mode whose displacement follows the intended reaction coordinate. Tiny imaginary values may be numerical or external-mode contamination.
- An IRC is a mass-weighted steepest-descent path from a saddle, not a guarantee of global reaction mechanism or kinetics. Both directions and endpoint identities must be checked.
- Molar ZPE is `1/2 N_A Σ h c ν̃_i` over real vibrational frequencies under the harmonic approximation. Imaginary modes are excluded, and anharmonic, thermal, entropic, and tunneling effects remain outside this correction.
- Any ZPE-corrected barrier must combine electronic and ZPE terms in the same declared molar energy unit; the finite IRC dossier uses dimensionless coordinates and explicitly declares its electronic surface in kcal/mol.
- The chapter stops before full analytic second-derivative implementation, redundant internal-coordinate machinery, constrained dynamics, free-energy sampling, and production reaction-rate theory.

## Implementation tasks

### Task 1: Establish RED scientific contracts

**Files:**
- Create: `scripts/test_qc_geometry_models.js`

**Steps:**
1. Assert the production geometry module is initially absent or missing its required API.
2. Add independent finite checks for vector/matrix validation, symmetric two-by-two eigensystems, quadratic surfaces, force sign, directional derivatives, derivative-ledger sums, central differences, optimization steps, trust ratios, BFGS updates, Hessian inertia, mass weighting, normal modes, frequency/ZPE conversion, double-well gradients/Hessians, and IRC endpoints.
3. Use independent formulas in tests: characteristic-polynomial roots, closed-form quadratic derivatives, analytic diatomic eigenvalue, direct BFGS matrix arithmetic, and independently evaluated energy differences.
4. Add malformed/nonfinite data, asymmetric Hessian, singular Newton step, nonpositive masses, nonpositive finite-difference step, `sᵀy≤0`, zero predicted reduction, near-zero eigenvalue, incomplete `3N-6`/`3N-5` mode count, zero-gradient saddle start, and incorrect IRC endpoint cases.
5. Run `node scripts/test_qc_geometry_models.js`; record the expected RED failure before implementing production code.

### Task 2: Implement answer-free deterministic models

**Files:**
- Create: `site/assets/qc-geometry.js`
- Test: `scripts/test_qc_geometry_models.js`

**Steps:**
1. Implement immutable-input vector/matrix helpers and a deterministic symmetric two-by-two eigensolver.
2. Implement `quadraticSurface`, `directionalDerivative`, `stationaryGradientLedger`, polynomial analytic/central derivatives, `optimizationStep`, `predictedQuadraticChange`, `trustRatio`, and Hessian-form `bfgsUpdate`.
3. Implement `finiteDifferenceHessian2`, `hessianInertia`, `massWeightedHessian`, `normalModes2`, `stationaryPointAudit`, and `zpeKcalMol` with an explicitly documented spectroscopic conversion constant.
4. Implement the declared double-well surface, saddle displacements, normalized mass-weighted descent, finite IRC tracing, endpoint audit, and ZPE-corrected barrier helper.
5. Keep browser-public exports limited to answer-free transforms. Export mission evaluators only through CommonJS for isolated Node tests.
6. Run the focused suite to GREEN, then inspect syntax, input immutability, nonfinite rejection, and deterministic repeatability.

### Task 3: Add neutral dossiers and replay-valid earned state

**Files:**
- Modify: `site/assets/qc-geometry.js`
- Test: `scripts/test_qc_geometry_models.js`

**Steps:**
1. Define closure-private neutral-ID dossiers containing only the scientific inputs displayed to learners; use identifiers such as `surface-a` and labels such as `File G-14`, not semantic answer names.
2. Derive every decision from displayed inputs. Do not ship `expected`, `answerKey`, `route`, or compact answer-bearing maps in the browser-public API.
3. Implement versioned key `project-xc-geometry-games-v1`, strict version/shape/ID/choice/fingerprint/stage/budget sanitization, and a persistent geometry evidence notebook.
4. Replay every stored transcript through the current evaluator and fixed-dossier fingerprint before earning a mission. Do not accept generic legacy completion for this unpublished chapter.
5. Reject direct or persisted canonical completion unless internal geometry evidence authorizes it.
6. Implement chapter-local reset that leaves all other Academy chapters and Basis Quest progress untouched.

### Task 4: Build the ten-level chapter page

**Files:**
- Create: `site/qc-geometry.html`
- Modify: `site/assets/qc-geometry.js`

**Steps:**
1. Add the chapter hero, explicit geometry-model boundary, ten-level navigation, persistent evidence notebook, and chapter-only reset control.
2. Build ten commitment laboratories with fixed visible dossiers, neutral choices, recoverable failure, hidden decisive certificates, and disabled earned seals.
3. Add nine finite SVG instruments for Levels 1–9 and a staged boss evidence board for Level 10.
4. Make Level 10 require all nine preceding earned missions and three dossiers, with three ordered stages and a four-attempt per-dossier budget plus recoverable reset.
5. Add professor notes on variational derivative conditions, external modes/projection, Hessian tolerances, TS mode identity, IRC scope, harmonic/ZPE limitations, and the boundary before free-energy/rate claims.
6. Add at least five safe external source links and exact “Verified source spine” wording.

### Task 5: Add visual and responsive contracts

**Files:**
- Modify: `site/assets/styles.css`

**Steps:**
1. Extend the existing Academy design with a distinct geometry identity: contour/topography, gradient arrows, matrix curvature, mode displacement, spectrum, and path notation.
2. Encode every scientific distinction with labels, marker shapes, line styles, hatching, or direct annotations in addition to color.
3. Generate unique SVG definition IDs and HTML-escape every dossier-derived string before `innerHTML` insertion.
4. Keep each 680 px instrument internally scrollable at exact `390×844` while preventing document overflow and preserving readable authored labels.
5. Preserve at least 44 px visible touch controls, focus outlines, keyboard continuity after grading/re-rendering, reduced-motion behavior, and formula-container overflow isolation.

### Task 6: Add the retained browser interaction gate

**Files:**
- Create: `scripts/test_qc_geometry_interactions.js`

**Steps:**
1. Launch isolated headless Chrome over a temporary local server and assert DOM, ARIA, plot, source, and initialization contracts.
2. Verify all ten earned predicates, wrong-answer recovery, commit-before-reveal, fixed displayed-versus-graded dossier identity, selected-dossier plot changes, and focus continuity.
3. Reject public evaluator/constants exports, answer-bearing public values, and shipped-source `expected`, `answerKey`, or route tables.
4. Exercise malformed/blocked storage, unknown IDs, wrong fingerprints, invalid choices, partial and forged transcripts, direct/persisted canonical forgery, boss prerequisites, stage replay, budget exhaustion/recovery, and chapter-reset isolation.
5. Assert Level 2 visibly includes every gradient-ledger term and stationary/unconverged constraint before grading; assert Level 8 visibly includes gradient norm, inertia tolerance, mode counts, and ZPE convention.
6. Emulate exact `390×844`; require no document overflow, nine two-ended internal plot scrollers, ≥44 px controls, formula containment, reduced motion, and no severe browser events.
7. Capture optional desktop/mobile screenshots through environment variables for pixel inspection without modifying repository files.

### Task 7: Write the source and verification ledger

**Files:**
- Create: `docs/academy/sources/qc-geometry.md`

**Steps:**
1. Document every coordinate, sign, derivative, Hessian, mass-weighting, frequency, IRC, and unit convention.
2. Cite primary/open anchors for analytic derivatives/Pulay terms, optimization/BFGS/trust methods, vibrational analysis, IRC, and modern implementation practice.
3. Record each fixed dossier and every independent test oracle, explaining why the tests do not merely echo production code.
4. Explain the stationary variational scope of the simplified gradient ledger and explicitly separate it from nonvariational correlated-method response gradients.
5. State the browser answer boundary honestly: accidental oracles are removed, but static client code is not cryptographic secrecy.

### Task 8: Integrate curriculum, gateway, validation, and CI

**Files:**
- Modify: `data/academy-curriculum.json`
- Modify: `scripts/validate_academy.py`
- Modify: `scripts/test_academy_core.js`
- Modify: `.github/workflows/validate.yml`
- Modify: `.github/workflows/pages.yml`
- Modify: `site/quantum-chemistry.html`
- Modify: `site/index.html`
- Modify: `docs/plans/2026-07-13-quantum-chemistry-academy-master-plan.md`

**Steps:**
1. Promote `qc-geometry` to `live`, retain `levels: 10`, set `games: 10`, and add the ten authoritative mission IDs in dependency order.
2. Add a live validator rule with script, model test, interaction test, source ledger, exact `Geometry-model boundary` and `Geometry evidence board` text, and nine plots.
3. Extend shared progress/reset/reconciliation tests and update the aggregate example from `8/84` to `9/94`.
4. Add both geometry tests to validation and Pages predeployment gates before build/upload.
5. Update gateway static fallbacks from 9 available/18 planned to 10 available/17 planned; add Geometry to the gateway and root live sequence while keeping the root lightweight.
6. Update C3’s master-plan status and game description without altering later roadmap scope.

### Task 9: Verify adversarially and publish

**Steps:**
1. Run syntax checks, model tests, interaction tests, shared core/validator tests, all retained chapter tests, build/link checks, whitespace checks, and exact workflow matrices command by command.
2. Perform desktop and exact `390×844` visual QA, including all dossier states, contour/vector label collisions, coincident/near-zero modes, internal-scroll endpoints, hidden evidence, MathJax containment, and console output.
3. Obtain separate read-only scientific and implementation/security approvals against the final staged diff; remediate each actionable finding with a focused regression and narrow rereview.
4. Commit on the feature branch, push the exact full SHA, open a PR against `main`, wait for green CI, merge without deleting provenance branches, and verify the exact merge SHA in both validation and Pages workflows.
5. Compare cache-busted live HTML/JavaScript/CSS/gateway/homepage/curriculum artifacts byte-for-byte with merge source and run the JavaScript-capable interaction gate against the live route in an isolated temporary profile.
6. Fast-forward local `main`, remove temporary verifier/review artifacts, stop temporary processes, and leave the repository clean.
