# Quantum Foundations source ledger

**Chapter:** `qc-foundations`

**Access date:** 2026-07-13

**Purpose:** Record the source spine, convention choices, and game usage for the first Project XC Quantum Chemistry Academy chapter. This ledger supports the teaching content; it does not copy source prose.

## Verified open sources

| Topic | Source | Verified URL | Chapter use | Notes |
|---|---|---|---|---|
| Constants and atomic units | NIST, Fundamental Physical Constants / CODATA | https://physics.nist.gov/cuu/Constants/index.html | Level 1 scales and unit bridge | URL returned HTTP 200 on 2026-07-13. Values should be read from the current CODATA table when exact numerical constants are added. The launch chapter avoids hard-coding unnecessary precision. |
| Quantum-mechanics overview | OpenStax, *University Physics Volume 3*, Chapter 7 introduction | https://openstax.org/books/university-physics-volume-3/pages/7-introduction | Levels 1–3 conceptual bridge | URL returned HTTP 200 on 2026-07-13. Open textbook overview; Project XC explanations are independently synthesized. |
| Uncertainty principle | OpenStax, Section 7.2 | https://openstax.org/books/university-physics-volume-3/pages/7-2-the-heisenberg-uncertainty-principle | Level 8 and Gaussian uncertainty game | URL returned HTTP 200 on 2026-07-13. Project XC explicitly distinguishes standard deviations from vague “measurement disturbance” language. |
| Particle in a box | OpenStax, Section 7.4 | https://openstax.org/books/university-physics-volume-3/pages/7-4-the-quantum-particle-in-a-box | Level 7 and box explorer | URL returned HTTP 200 on 2026-07-13. Used for the exact infinite-well energy and wavefunction model. |
| Electron spin | OpenStax, Section 8.3 | https://openstax.org/books/university-physics-volume-3/pages/8-3-electron-spin | Level 9 and spin measurement game | URL returned HTTP 200 on 2026-07-13. The game is a two-state measurement model, not a hidden classical arrow. |
| Wavefunction terminology | IUPAC Gold Book, “wavefunction” | https://goldbook.iupac.org/terms/view/W06686 | Levels 2–3 terminology | URL returned HTTP 200 on 2026-07-13. Used as an authoritative chemistry terminology anchor. |
| Quantum chemistry course route | MIT OpenCourseWare 5.61, *Physical Chemistry*, Fall 2017 | https://ocw.mit.edu/courses/5-61-physical-chemistry-fall-2017/ | Recommended continuation and professor-mode context | URL returned HTTP 200 on 2026-07-13. Provides a deeper open-course route from quantum foundations into molecular quantum mechanics. |

## Convention ledger

### Probability and normalization

- One-dimensional chapter games use `∫ |ψ(x)|² dx = 1` over the displayed numerical domain.
- Numerical density areas use deterministic trapezoidal integration.
- A displayed trial function is explicitly renormalized before the plot is interpreted as a probability density.

### Phase and interference

- A global phase `e^{iφ}ψ` leaves `|ψ|²` unchanged.
- Relative phase between two overlapping amplitudes changes their interference.
- The phase game must never imply that global phase is measurable by itself.

### Particle in a box

- Infinite well on `0 < x < L`.
- `ψ_n(x) = sqrt(2/L) sin(nπx/L)`.
- `E_n = n²π²ℏ²/(2mL²)`.
- The game reports energy in units of `E_1(L = 1)` to avoid pretending that an unspecified particle/length has an absolute energy.
- Interior node count is exactly `n - 1`.

### Gaussian uncertainty

The displayed normalized wavefunction uses

`ψ(x) ∝ exp[-(x-x0)²/(4σ_x²)] exp(i k0 x)`.

Therefore `|ψ|²` has position standard deviation `σ_x`, the momentum standard deviation is `σ_p = ℏ/(2σ_x)`, and the minimum product is `σ_x σ_p = ℏ/2`.

### Spin

- State: `|ψ⟩ = cos(θ/2)|↑z⟩ + e^{iφ} sin(θ/2)|↓z⟩`.
- z-axis probabilities: `P(↑z) = cos²(θ/2)` and `P(↓z) = sin²(θ/2)`.
- The launch game visualizes probability and repeated-measurement expectation; it does not claim a definite pre-existing z value.

## Toy-model boundary

The interactive models are exact only within their declared simplified systems (for example, an infinite one-dimensional well or an ideal two-state spin measurement). They are not electronic-structure calculations and do not include electron correlation, nuclei, finite basis sets, relativity, environment, or measurement apparatus dynamics unless explicitly stated.

## Future review items

- Add an open primary/standards source for complex phase conventions when the Mathematical Language chapter is implemented.
- Add exact CODATA constant values only through a generated data record with edition/date metadata.
- Add deterministic numerical unit tests for all five games before changing the chapter status from the launch vertical slice to a versioned stable release.
