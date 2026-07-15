# Approximation and Variational Thinking source and convention ledger

**Chapter:** `qc-approximations`

**Access date:** 2026-07-15

**Purpose:** Record the scientific source spine, equations, hypotheses, finite-model boundaries, visual conventions, and deterministic production checks for Project XC Academy’s Approximation and Variational Thinking chapter. The chapter synthesizes these ideas and supplies original finite teaching models; it does not reproduce source prose or present browser toys as production electronic-structure calculations.

## Verified open sources

| Topic | Source | Verified URL | Chapter use | Verification note |
|---|---|---|---|---|
| Chemistry-facing matrix mechanics, nondegenerate perturbation theory, LCAO, and the generalized eigenvalue equation | MIT OpenCourseWare, *5.61 Physical Chemistry*, lecture notes | https://ocw.mit.edu/courses/5-61-physical-chemistry-fall-2017/pages/lecture-notes/ | Levels 3, 6, and 7; connection from finite matrices and overlap to molecular electronic structure | Lecture-note index loaded on 2026-07-15 and exposed lectures 13–16 plus the LCAO/general-eigenvalue supplement. |
| Degenerate and nondegenerate perturbation theory and approximation boundaries | MIT OpenCourseWare, *8.06 Quantum Physics III*, lecture notes | https://ocw.mit.edu/courses/8-06-quantum-physics-iii-spring-2018/pages/lecture-notes/ | Levels 7–8 and the boss case files | Page loaded on 2026-07-15 and exposed Chapter 1 Perturbation Theory plus separate semiclassical/adiabatic approximation chapters. |
| Ground-state variational/Rayleigh–Ritz principle | UC San Diego Physics 130A notes, “The Variational Principle (Rayleigh-Ritz Approximation)” | https://quantummechanics.ucsd.edu/ph130a/130_notes/node375.html | Levels 3–5; upper-bound language and trial-state minimization | Page and linked course-note navigation loaded on 2026-07-15. |
| Asymptotic notation and Poincaré asymptotic expansions | NIST Digital Library of Mathematical Functions, §2.1 | https://dlmf.nist.gov/2.1 | Level 9; distinction between an asymptotic expansion and a convergent infinite sum | Section and subsections 2.1(i)–(v) loaded on 2026-07-15. |
| Rayleigh–Ritz upper bounds and Temple-type lower estimates for self-adjoint operators | N. W. Bazley and D. W. Fox, “Generalizations of Temple’s Inequality,” *Proceedings of the AMS* **69**, 1978 | https://www.ams.org/journals/proc/1978-069-02/S0002-9939-1978-0487733-4/S0002-9939-1978-0487733-4.pdf | Level 11; residual/variance bracket and its spectral-separation hypothesis | Open AMS PDF loaded on 2026-07-15. |
| Measurement-uncertainty terminology and the warning that identified components require a declared combination/reporting procedure | NIST Technical Note 1297 | https://www.nist.gov/pml/nist-technical-note-1297 | Level 10 boundary: the browser’s signed computational-error telescope is not a statistical uncertainty budget | NIST page, contents, classification, combination, and reporting sections loaded on 2026-07-15. |

## Core conventions

- All finite Hamiltonians are real symmetric and all trial vectors are normalized.
- Energies in the teaching models are dimensionless unless a unit is printed.
- “Exact” always means exact **inside the explicitly stated finite or analytic model**.
- A numerical quadrature value is called a numerical reference, not exact.
- A threshold, ratio, or traffic-light label is a teaching diagnostic, not a universal convergence theorem.
- An energy annotation may move horizontally for readability, but a coincident energy is never split vertically.

## Level 1: approximation passports

The laboratory separates three questions:

1. Which operation is used—variational minimization, subspace truncation, perturbative expansion, numerical solution, or model replacement?
2. Which layer is omitted—model physics, representation, or solver/numerical convergence?
3. What evidence is needed—upper-bound/nesting behavior, order/parameter stability, residual and gap, benchmark comparison, or all of these?

A method label alone never establishes accuracy.

## Level 2: dimensionless quartic oscillator

Start with

`H = p²/(2m) + 1/2 kx² + βx⁴`,

`ω = sqrt(k/m)`,

`ℓ = sqrt(ℏ/(mω))`,

and `q=x/ℓ`. Dividing by `ℏω` gives

`H/(ℏω) = 1/2[-d²/dq² + q²] + gq⁴`,

`g = βℓ⁴/(ℏω) = βℏ/(m²ω³)`.

The browser uses internally consistent model units and fixes `ℏ=1`. Changing `m`, `k`, and `β` can change physical scales while the dimensionless shape is controlled by `g`. The plot is a potential-shape comparison, not a solved anharmonic spectrum.

## Levels 3–5: variational and nested-space models

For a normalized trial vector `c` and real symmetric `H`,

`R(c)=cᵀHc`.

Inside the finite model, the minimum and maximum over all normalized vectors are the lowest and highest eigenvalues. The ground-state upper-bound statement requires an admissible normalized trial in the domain of a self-adjoint Hamiltonian bounded below.

### Gaussian family

For the dimensionless harmonic oscillator

`H = -1/2 d²/dx² + 1/2 x²`

and normalized trial

`ψ_α(x)=(α/π)^(1/4) exp(-αx²/2)`, `α>0`,

`T(α)=α/4`,

`V(α)=1/(4α)`,

`E(α)=α/4+1/(4α) ≥ 1/2`.

The equality at `α=1` and `T=V=1/4` is special to this model/trial family. It must not be generalized to arbitrary ansätze or Hamiltonians.

### Six-site nested Ritz model

The declared full finite Hamiltonian is the 6×6 tridiagonal matrix with diagonal `2` and first off-diagonals `-1`. Its leading `n×n` principal subspace has lowest Ritz value

`E_n = 2 - 2cos[π/(n+1)]`, `n=1,…,6`.

The values decrease monotonically as the nested space grows. For `n<6`, the embedded normalized lowest Ritz vector has one nonzero external residual component with magnitude

`||r_n|| = sqrt[2/(n+1)] sin[nπ/(n+1)]`.

For `n=6`, the residual against the declared full matrix is zero. The `n=6` value is a finite oracle, not a continuum/CBS result.

## Level 6: nonorthogonal basis

Use

`S=[[1,s],[s,1]]`, `|s|<1`,

so the overlap eigenvalues are `1±s` and

`κ₂(S)=(1+|s|)/(1-|s|)`.

The generalized eigenvalues solve

`det(H-ES)=0`,

`(1-s²)E² + (2sH₁₂-H₁₁-H₂₂)E + (H₁₁H₂₂-H₁₂²)=0`.

The browser reports conditioning and shows an explicit teaching threshold, but never claims one threshold is universally correct. The rescue decision evaluates the selected observable at the committed threshold and at neighboring cutoffs `τ±0.005`; this is a bounded three-point teaching scan, not a production threshold study. When `|s|≥1`, `S` is not positive definite and the exposed model rejects the input. If two generalized roots coincide, the plot draws one physical rail and separates only their text labels; near-coincident roots below display resolution are grouped and labelled as such rather than silently overprinted.

## Levels 7–8: perturbation models

### Nondegenerate two-level model

For

`H(λ)=[[0,λV],[λV,Δ]]`, `Δ>0`,

with `x=λV`, the exact lower finite-model energy is

`E_-(λ)=[Δ-sqrt(Δ²+4x²)]/2`.

Its displayed low-order expansion is

`E_- = -x²/Δ + x⁴/Δ³ + O(x⁶/Δ⁵)`.

The ratio `|x/Δ|` is a local diagnostic only. Small low-order error in one quantity does not prove every property or geometry is reliable. The earned trust-range dossier is intentionally fixed at `Δ=2.00` and `V=0.50`; Professor-mode changes are exploratory and cannot clear that dossier until the fixed mission model is restored. This prevents grading a modified visible Hamiltonian against an unrelated hidden answer key.

### Degenerate subspace

If `E₀I` is exactly degenerate and the perturbation restricted to that subspace is

`W=[[W₁₁,W₁₂],[W₁₂,W₂₂]]`,

then the first-order shifts are the eigenvalues of `W`, not generally its diagonal entries in an arbitrary basis. Orthogonal rotations preserve `tr(W)`, `det(W)`, and its eigenvalues while changing its displayed diagonal/off-diagonal elements. If `W=wI` exactly, the two states remain coincident and no orientation is preferred. A nonzero splitting below the plotting tolerance is instead reported as **numerically unresolved**; it retains two computed shifts and must not be promoted to exact degeneracy or an exact no-preferred-basis claim.

## Level 9: factorial asymptotic series

The positive reference function is defined by

`F(g)=∫₀∞ exp(-t)/(1+gt) dt`, `g≥0`.

Expanding the denominator formally and integrating term by term produces

`F(g) ~ Σ_(n=0)^∞ (-g)^n n!` as `g→0⁺`.

For fixed `g>0`, the factorial coefficients eventually grow, so this is not interpreted as a convergent infinite sum. The browser computes a finite Simpson reference on `[0,30]`; the omitted positive tail is below `exp(-30)`. It then compares partial sums through a declared maximum order and identifies the lowest observed absolute error. At `g=1`, the independent reference value is

`F(1)=e E₁(1)=0.596347362323194…`.

## Level 10: signed computational-error telescope

For values produced at successive layers,

- `E_num`: current numerical/solver result,
- `E_basis`: converged result in the declared representation,
- `E_model`: representation-limit result of the declared physical model,
- `E_ref`: external target/reference,

set

`δ_solver=E_num-E_basis`,

`δ_repr=E_basis-E_model`,

`δ_model=E_model-E_ref`.

Then exactly

`δ_total=E_num-E_ref=δ_solver+δ_repr+δ_model`.

Signed components may cancel. `Σ|δ_i|` is a diagnostic burden, not an uncertainty interval, and the decomposition depends on the declared path/order of limits.

## Level 11: residual and Temple-type certificate

The finite spectrum is fixed at `E₀=0`, `E₁=1.5`, `E₂=4`. The normalized trial is

`c=(cosθ, sinθ cosφ, sinθ sinφ)`.

Its Rayleigh value and variance are

`μ=Σ_i |c_i|²E_i`,

`σ²=Σ_i |c_i|²(E_i-μ)²=||(H-μ)c||²`.

The variational upper bound is `E₀≤μ`. When `μ<E₁`, the displayed Temple-type lower estimate is

`E₀ ≥ μ - σ²/(E₁-μ)`.

The browser suppresses this certificate when the gap condition fails. In the wrong-root dossier, the production-style report withholds target-root separation before commitment; the teaching oracle is revealed afterward and shows that the formally valid finite-model bracket is extremely wide despite the tiny residual. Professor-mode angle changes are exploratory and cannot grade any fixed claim file until its declared trial is restored. In a real calculation, a trustworthy lower separator for the next spectral value is itself nontrivial; a small residual can be close to the wrong root.

## Interactive-model boundary

The 12 games combine exact finite algebra, a solvable analytic oscillator family, controlled series truncation, fixed numerical quadrature, and deterministic case ledgers. They are not electronic-structure benchmarks, basis-set extrapolations, uncertainty quantification, or evidence that a selected production method is accurate for a molecule.

## Deterministic review contract

`scripts/test_qc_approximation_models.js` must load the production API and verify every formula and boundary above, including independent constants and invalid inputs.

`scripts/test_qc_approximation_interactions.js` must load the production page and verify:

- all 12 laboratories initialize with locked seals and without console/page errors;
- every seal remains locked until its multi-stage decision objective is earned;
- commit-before-reveal oracles, best-order markers, and manual-search helpers are visually absent until their declared reveal conditions;
- wrong attempts provide recoverable, human-readable feedback and cannot earn progress;
- every declared plot contains a production SVG without `NaN`/`undefined` geometry;
- exact scalar degeneracy uses one true energy line, while sub-tolerance nonzero splitting is labelled numerically unresolved;
- coincident generalized roots use one rail with distinct readable labels;
- the staged boss enforces all eleven notebook prerequisites, three dossiers, and its token budget;
- completion reaches 12/12, the notebook and seals persist across reload, legacy canonical completion is preserved, and chapter reset affects only this chapter while re-locking every local oracle/helper/readout and restoring fixed dossier controls;
- desktop `1440×900` has no document overflow;
- canonical mobile/touch `390×844` has no document overflow while every wide plot has positive, usable, focusable internal horizontal scrolling;
- controls have accessible names, visible focus targets, non-color status text, and usable touch dimensions.

Both GitHub validation and the Pages pre-upload gate must invoke the exact numerical and interaction tests.

Any change to a formula, mission ID/count, finite oracle, threshold label, or model category requires updating this ledger, production tests, curriculum metadata, and on-page boundary together.
