# Mathematical Language source and convention ledger

**Chapter:** `qc-math-language`

**Access date:** 2026-07-13

**Purpose:** Record the mathematical conventions, source spine, exact browser-model boundaries, and deterministic checks for the second Project XC Quantum Chemistry Academy chapter. The chapter synthesizes and visualizes the material; it does not copy source prose.

## Verified open sources

| Topic | Source | Verified URL | Chapter use | Notes |
|---|---|---|---|---|
| Vectors, inner products, bases, matrices, eigenvalues | MIT OpenCourseWare, *18.06SC Linear Algebra* | https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/ | Levels 2–7 and projection/rotation/eigenvector laboratories | URL returned HTTP 200 on 2026-07-13. The browser games use two-dimensional real examples while the text states the complex finite-dimensional generalization used in quantum chemistry. |
| Complex numbers and Euler representation | MIT OpenCourseWare, *18.04 Complex Variables with Applications* | https://ocw.mit.edu/courses/18-04-complex-variables-with-applications-spring-2018/ | Level 1 | URL returned HTTP 200 on 2026-07-13. Used for the real/imaginary, polar, conjugation, and phase spine. |
| Fourier-transform definitions and conventions | NIST Digital Library of Mathematical Functions, §1.14 Integral Transforms | https://dlmf.nist.gov/1.14 | Level 9 and Fourier width laboratory | URL returned HTTP 200 on 2026-07-13. The chapter names its symmetric angular-wave-number convention explicitly because factors of `2π` vary across sources and software. |
| Quantum state/vector language and operator applications | MIT OpenCourseWare, *8.04 Quantum Physics I* | https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2016/ | Levels 2–9 | URL returned HTTP 200 on 2026-07-13. Provides an open physics route connecting abstract linear algebra to wavefunctions, observables, and Fourier pairs. |
| Quantum-chemistry mathematical route | MIT OpenCourseWare, *5.61 Physical Chemistry* | https://ocw.mit.edu/courses/5-61-physical-chemistry-fall-2017/ | Levels 5–10 and recommended continuation | URL returned HTTP 200 on 2026-07-13. Used as the chemistry-facing bridge to matrix mechanics and variational electronic structure. |
| Wavefunction terminology | IUPAC Gold Book, “wavefunction” | https://goldbook.iupac.org/terms/view/W06686 | Representation reminders and terminology | URL returned HTTP 200 on 2026-07-13. The chapter distinguishes a basis-independent state from one coordinate representation of that state. |

## Convention ledger

### Complex scalars

- `z = x + i y = r exp(iφ)`, with `r ≥ 0` and phase defined modulo `2π` when `r > 0`.
- `z* = x - i y` and `|z|² = z*z = x² + y²`.
- A complex phase is not an extra spatial axis; it records amplitude relations needed for interference and unitary evolution.

### Inner products and projections

The chapter uses the physics bra–ket convention

`⟨u|v⟩ = Σ_i u_i* v_i`,

which is conjugate-linear in the bra and linear in the ket. Some mathematics texts reverse which argument is linear; equations must not mix conventions.

For a normalized direction `|u⟩`,

`P_u|v⟩ = |u⟩⟨u|v⟩`,

and the residual is orthogonal to `|u⟩`. The projection game uses real two-dimensional vectors, so complex conjugation is invisible there but stated in the derivation.

### Basis changes

- Columns of `R` are the new orthonormal basis vectors written in the old coordinates.
- Passive coordinate change: `c' = R^T c` for the real rotation game; reconstruction: `c = R c'`.
- Complex generalization: `c' = U† c` and `c = U c'` when `U†U = I`.
- Rotating coordinates is not the same operation as actively rotating the physical vector, although the same matrix family can describe either when the convention is changed consistently.

### Operator matrices and nonorthogonal coordinates

For an orthonormal basis, covariant matrix elements `A_ij = ⟨e_i|Â|e_j⟩` act on coefficient columns by `d=Ac`, and ordinary matrix products represent composed operators. For a nonorthogonal basis `{χ_μ}` with `S_μν=⟨χ_μ|χ_ν⟩`, the same covariant definition instead gives

`S d = A c`, hence `d = S⁻¹ A c` when `S` is invertible.

Equivalently, one may introduce a dual basis or mixed-index matrix, but that convention must be stated. Covariant AO matrices cannot silently be treated as though `S=I`.

### Matrices, eigensystems, and Rayleigh residuals

The game matrix is the real-symmetric subset

`A = [[a,b],[b,d]]`.

Its eigenvalues are

`λ± = (a+d)/2 ± 1/2 sqrt((a-d)² + 4b²)`.

For normalized trial vector `v`, the displayed scalar is the Rayleigh quotient `λ(v)=v^TAv`, and the diagnostic residual is `r=Av-λ(v)v`. A zero residual means `v` is an eigenvector. Degenerate eigenvalues do not select a unique eigenvector basis inside the degenerate subspace.

### Hermitian and unitary maps

- Hermitian: `A†=A`; expectation values are real and finite-dimensional eigenvectors can be chosen orthonormal.
- Unitary: `U†U=UU†=I`; norms and inner products are preserved.
- “Hermitian” and “unitary” are properties relative to the inner product and domain. Infinite-dimensional unbounded operators require domain care beyond finite matrices.

### Tensor products

- Product basis states are written `|i⟩⊗|j⟩`, with dimensions multiplying: `dim(H_A⊗H_B)=dim(H_A)dim(H_B)`.
- A general vector in the product space need not factor into one vector for each subsystem.
- Tensor products do not by themselves impose fermionic antisymmetry; antisymmetrization is introduced in the many-electron chapter.

### Fourier pair

The chapter uses the symmetric angular-wave-number convention

`φ(k) = (1/sqrt(2π)) ∫ exp(-ikx) ψ(x) dx`,

`ψ(x) = (1/sqrt(2π)) ∫ exp(+ikx) φ(k) dk`.

For the normalized Gaussian amplitude

`ψ(x) ∝ exp[-x²/(4σ_x²)] exp(i k_0 x)`,

`|ψ|²` has standard deviation `σ_x`, `|φ|²` has standard deviation `σ_k=1/(2σ_x)`, and `σ_xσ_k=1/2`. Replacing `k` by momentum `p=ℏk` gives `σ_xσ_p=ℏ/2`.

The two browser panels use independent symmetric display windows. Each window is at least `[-4,4]` and expands when necessary to keep three standard deviations visible; the reported widths come from the analytic densities and numerical moment checks, not from pixel measurements. The `k` window remains centered at zero so changing `k_0` visibly translates the Fourier density.

### Variational and functional language

For an orthonormal coefficient representation of a Hermitian matrix or suitable self-adjoint Hamiltonian,

`R[c] = (c†Hc)/(c†c)`, and stationarity gives `Hc=λc`.

For a nonorthogonal basis with positive-definite overlap matrix `S`,

`R_S[c] = (c†Hc)/(c†Sc)`, with `c†Sc=1`, and stationarity gives the generalized eigenproblem `Hc=λSc`.

The ground-state upper-bound statement additionally requires an admissible normalized trial state in the operator domain and a Hamiltonian bounded from below. A stationary point need not be the ground state; higher eigenvectors are stationary too.

## Interactive-model boundary

The four laboratories use exact two-dimensional linear algebra or an analytic Gaussian Fourier pair. They are not molecular calculations, do not diagonalize an electronic Hamiltonian, and do not establish basis-set convergence, electron correlation, or chemical accuracy. The eigensystem laboratory is restricted to real symmetric `2×2` matrices; production quantum chemistry uses much larger real or complex Hermitian/generalized eigenproblems, often with nonorthogonal bases and iterative solvers.

## Deterministic review contract

`scripts/test_qc_math_models.js` must verify:

- polar/Cartesian complex-number identities;
- projection reconstruction, orthogonality, and Pythagorean norm decomposition;
- passive basis-change round trips, direct basis-vector dot products, the advertised 90° sign convention, norm preservation, and orthogonality;
- analytic `2×2` eigenvalues, trace/determinant invariants, orthogonal eigenvectors, Rayleigh quotients, residuals, and degenerate reveal behavior;
- Gaussian Fourier normalization, means, variances, and `σ_xσ_k=1/2`.

Any change to a convention, model equation, or mission count requires updating this ledger, the tests, and the on-page caveat together.
