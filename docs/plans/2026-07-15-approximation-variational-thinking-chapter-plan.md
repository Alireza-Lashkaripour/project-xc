# Approximation and Variational Thinking Chapter Implementation Plan

> **For Hermes:** Execute this plan task-by-task with focused TDD, independent scientific/integration review, and real-browser QA before publication.

**Goal:** Publish a beautiful, source-grounded Approximation and Variational Thinking chapter that teaches learners how to choose, test, and distrust controlled approximations through 12 levels and 12 substantial laboratories—one coherent multi-step game at every level.

**Why this chapter is next:** `qc-approximations` is chapter A3, the first remaining planned chapter in the authoritative curriculum order. Its prerequisites, `qc-foundations` and `qc-math-language`, are both live. Atomic Structure remains live and unchanged.

**Architecture:** Add one independent static chapter (`qc-approximations.html`) backed by one production JavaScript model/UI module, a Node oracle test that loads that exact production module, and a dependency-free Chrome/Chromium interaction regression. Integrate it through the existing curriculum, shared Academy progress, root page, gateway, validators, CI, Pages gate, README, and source ledger without changing existing routes or storage contracts.

**Tech Stack:** Static HTML, existing Project XC CSS, vanilla JavaScript, MathJax, inline SVG, Node `vm` tests, Chrome DevTools Protocol browser tests, Python standard-library structural validators, GitHub Pages.

---

## Scientific contract

### Model hierarchy

Every result must identify its scope:

1. **Exact finite-model algebra:** normalized Rayleigh quotients and eigenvalues of stated 2×2/finite matrices; overlap-matrix eigenvalues; degenerate-subspace diagonalization; signed error telescoping.
2. **Variational statement with hypotheses:** for a normalized admissible trial state of a self-adjoint Hamiltonian bounded below, the Rayleigh quotient is an upper bound to the ground-state energy. The browser demonstrates this inside stated finite/Hamiltonian models only.
3. **Restricted trial-family approximation:** the Gaussian harmonic-oscillator laboratory explores one parameterized family. Its exact optimum at `α=1` is special to the chosen solvable model, not a generic promise that a small ansatz is exact.
4. **Nested-subspace Rayleigh–Ritz model:** principal subspaces of one fixed six-site Hamiltonian yield nonincreasing upper estimates in exact arithmetic. The six-dimensional result is the browser oracle, not a continuum or complete-basis-set limit.
5. **Generalized eigenproblem model:** `Hc=ESc` with positive-definite `S`; conditioning worsens as the smallest overlap eigenvalue approaches zero. Thresholding is an explicit numerical/model choice, not a universal constant.
6. **Perturbation models:** nondegenerate and degenerate first/low-order constructions are compared against exact two-state finite models. A small displayed ratio is a diagnostic, not a universal convergence theorem.
7. **Asymptotic-series model:** the factorial series belongs to an explicitly defined positive integral. More terms need not improve a truncated asymptotic expansion; the numerical integral is the finite browser reference.
8. **Error-accounting model:** signed solver, representation, and model differences telescope exactly and can cancel. Their absolute magnitudes are diagnostics, not statistical uncertainties.
9. **Residual certificate:** a Temple-type lower bound is used only when a normalized finite-model trial has a Rayleigh quotient below a supplied next-level bound. A residual without spectral separation does not certify the targeted root.

### Authoritative mission IDs

1. `approximation-passport`
2. `dimensionless-scaling`
3. `rayleigh-quotient`
4. `variational-gaussian`
5. `basis-truncation`
6. `nonorthogonal-basis`
7. `nondegenerate-perturbation`
8. `degenerate-perturbation`
9. `series-budget`
10. `error-decomposition`
11. `residual-bounds`
12. `approximation-case-file`

## Level and laboratory map

| Level | Topic | Deep multi-step laboratory |
|---|---|---|
| 1 | Approximation passports | Classify a case by method class and dominant omitted layer, then audit the claim language and required validation evidence |
| 2 | Dimensionless scaling | Scale a quartic oscillator into `H/(ℏω)=½(-d²/dq²+q²)+gq⁴`, vary `m,k,β`, and read which combinations actually control the dimensionless problem |
| 3 | Rayleigh quotient landscape | Rotate a normalized trial vector over a coupled 2×2 Hamiltonian, inspect energy/residual, find both stationary eigenvectors, and distinguish minimum from maximum |
| 4 | Variational Gaussian sculptor | Tune Gaussian width for the harmonic oscillator, balance kinetic and potential penalties, bracket the ground energy, and diagnose the virial condition |
| 5 | Nested-basis expedition | Enlarge one fixed six-site Ritz subspace, track monotone energy and residual convergence, choose a tolerance, and state what the finite oracle does not prove |
| 6 | Overlap conditioning rescue | Solve a 2×2 generalized eigenproblem while increasing basis overlap, inspect `S` eigenvalues/condition number, and choose an explicit near-dependence response |
| 7 | Nondegenerate perturbation ladder | Compare zeroth-, second-, and fourth-order energies against exact diagonalization while varying coupling/gap; identify when apparent agreement or failure occurs |
| 8 | Degenerate-subspace crossroads | Rotate a perturbation inside a degenerate subspace, eliminate the off-diagonal residual, handle an exact no-splitting case, and reject basis-dependent diagonal guesses |
| 9 | Asymptotic order budget | Truncate a factorial series for a defined integral, inspect signed terms and absolute error by order, find the best finite order, and show why “more terms” can fail |
| 10 | Error-budget ledger | Reconstruct a telescoping chain from numerical to basis-limit to model-limit to reference values, identify dominant signed/absolute components, and expose cancellation |
| 11 | Residual and bound inspector | Build a normalized three-level trial, compute Rayleigh value/variance/residual, apply or reject a Temple-type bracket based on the gap condition, and interpret certification |
| 12 | Approximation campaign boss | Solve five case files by choosing method, diagnostic, and required evidence; receive field-by-field feedback and an explicit caveat instead of one opaque score |

## Production API

```js
window.QCApproximationModels = Object.freeze({
  evaluateApproximationPassport,
  dimensionlessQuartic,
  symmetricEigen2x2,
  rayleighQuotient2,
  gaussianVariational,
  basisTruncation,
  generalizedEigen2,
  perturbationTwoLevel,
  degeneratePerturbation,
  asymptoticIntegral,
  asymptoticSeriesModel,
  errorDecomposition,
  residualCertificate,
  evaluateApproximationCase
});
```

## Deterministic oracle matrix

- passport cases reject an exact/approximate category mismatch and require the correct omitted-error layer;
- quartic scaling gives `ω=1`, `ℓ=1`, and `g=β` for `m=k=ℏ=1`, and respects `g=βℏ/(m²ω³)`;
- 2×2 eigenvalues match the analytic quadratic formula; every normalized Rayleigh value lies between them; residuals vanish at both eigenvectors;
- Gaussian harmonic-oscillator model gives `T=α/4`, `V=1/(4α)`, `E≥1/2`, exact minimum at `α=1`, and `E(α)=E(1/α)`;
- six-site chain gives `E_n=2-2cos[π/(n+1)]` for nested sizes `n=1…6`, monotonically decreasing to the declared finite oracle, with analytic boundary residual and zero residual at `n=6`;
- generalized eigenvalues satisfy `det(H-ES)=0`, reduce to the ordinary 2×2 spectrum at `s=0`, and reject `|s|≥1`; `κ(S)=(1+|s|)/(1-|s|)`;
- two-level perturbation exact lower energy is `(Δ-sqrt(Δ²+4x²))/2` with `x=λV`; orders 2 and 4 have the correct signs and weak-coupling scaling;
- degenerate first-order shifts are the eigenvalues of `W`; trace and determinant are rotation invariant; `W∝I` remains exactly degenerate for every rotation;
- `F(g)=∫₀∞ exp(-t)/(1+gt)dt` is checked against `F(0)=1` and `F(1)=0.596347362323194…`; partial sums use `Σ(-g)^n n!` and expose a finite best order;
- signed error components telescope exactly to total error, while absolute components do not cancel;
- the three-level residual equals energy variance; the Temple-type lower bound is at or below the exact model ground when `μ<E₁` and is explicitly unavailable otherwise;
- every boss case requires all three fields—method, diagnostic, evidence—and returns per-field feedback.

## Visual and accessibility contract

- Visual motif: a **precision workshop / uncertainty cartography**—midnight indigo rails, teal admissible regions, amber truncation markers, coral warning hatches, and warm paper cards. Color is always reinforced by line style, marker shape, sign, text, or pattern.
- Ten responsive scientific SVG laboratories, each with a normal-HTML key and a concise figure caption.
- Wide SVGs live in focusable horizontal plot scrollers; mobile retains an internal width of about 680 px while the document remains exactly 390 px wide.
- Every control has a programmatic label, touch target, visible focus, deterministic initial state, and adjacent `aria-live` readout.
- No game relies on drag-only input. Range controls have synchronized numerical output; challenge buttons retain logical focus.
- Exact coincidences use one true coordinate/line. No annotation displacement may imply a nonexistent energy splitting.
- Reduced-motion preferences disable nonessential transitions.

## Integration contract

**Create:**
- `site/qc-approximations.html`
- `site/assets/qc-approximations.js`
- `scripts/test_qc_approximation_models.js`
- `scripts/test_qc_approximation_interactions.js`
- `docs/academy/sources/qc-approximations.md`
- this plan

**Modify:**
- `data/academy-curriculum.json`
- `scripts/validate_academy.py`
- `scripts/test_academy_validator.py` if parser-contract coverage changes
- `scripts/test_academy_core.js`
- `.github/workflows/validate.yml`
- `.github/workflows/pages.yml`
- `site/index.html`
- `site/quantum-chemistry.html`
- `site/assets/styles.css`
- `README.md`

Curriculum release values:
- `status: live`
- `levels: 12`
- `games: 12`
- progress kind `academy-missions`, total 12, exactly the mission IDs above
- gateway fallback totals move from 6 available / 21 planned to 7 available / 20 planned
- Academy available learning missions move from 50 to 62

## Verification commands

```bash
node --check site/assets/qc-approximations.js
node --check scripts/test_qc_approximation_models.js
node --check scripts/test_qc_approximation_interactions.js
node scripts/test_qc_approximation_models.js
node scripts/test_qc_approximation_interactions.js
node scripts/test_academy_models.js
node scripts/test_qc_math_models.js
node scripts/test_qc_atomic_models.js
node scripts/test_qc_atomic_interactions.js
node scripts/test_academy_core.js
node scripts/test_basis_progress.js
python3 scripts/test_academy_validator.py
python3 scripts/validate_academy.py
python3 scripts/validate_data.py
python3 -m json.tool data/academy-curriculum.json >/dev/null
python3 scripts/build_site.py
python3 scripts/check_site_links.py
git diff --check
```

Also run the new interaction suite under Node 20, independent arithmetic spot checks, read-only scientific/integration review, and browser QA at `1440×900` plus true mobile/touch `390×844`.

## Publication contract

1. Inspect and simplify the complete diff.
2. Commit only on `Alireza/academy-approximation-thinking-20260714`.
3. Push the safe branch and open a focused PR.
4. Merge only after local verification and explicit CI success.
5. Confirm post-merge validation, Pages build, deployment record, cache-busted resources, and live desktop/mobile interactions.
6. Clean temporary `hermes-verify-` servers, profiles, scripts, and screenshots.
