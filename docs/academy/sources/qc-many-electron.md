# Many-Electron Wavefunctions: source and model ledger

This record is the scientific contract for `site/qc-many-electron.html` and `site/assets/qc-many-electron.js`. It fixes the finite-space conventions, labels every displayed claim, and records the independent oracles used by `scripts/test_qc_many_electron_models.js`.

Checked 2026-07-15.

## Source spine

| Topic | Source | Address | Verification/use |
|---|---|---|---|
| Many-electron states and determinants | MIT OpenCourseWare 5.61, Lecture 23, “Many–Electron Atoms” | https://ocw.mit.edu/courses/5-61-physical-chemistry-fall-2017/resources/mit5_61f17_lec23/ | The OCW lecture-note index and resource page loaded on 2026-07-15. Used for the pedagogical bridge from antisymmetry to determinants. |
| Determinantal matrix elements | MIT OpenCourseWare 5.61, Lecture 23 supplement, “Slater Determinantal Matrix Elements” | https://ocw.mit.edu/courses/5-61-physical-chemistry-fall-2017/resources/mit5_61f17_lec23_supp/ | The open supplement link was verified in the OCW lecture-note index on 2026-07-15. Used for determinant signs and matrix-element structure. |
| Slater determinants and Slater–Condon rules | Jack Simons, *Advanced Theoretical Chemistry*, electronic-structure chapters | https://chem.libretexts.org/Bookshelves/Physical_and_Theoretical_Chemistry_Textbook_Maps/Advanced_Theoretical_Chemistry_(Simons) | The textbook map returned HTTP 200 on 2026-07-15. A deeper chapter URL was intermittently blocked by CloudFront, so the stable map is linked publicly while the rules are also tied to the primary papers below. |
| Determinant formulation | J. C. Slater, “The Theory of Complex Spectra,” *Physical Review* **34**, 1293 (1929) | https://doi.org/10.1103/PhysRev.34.1293 | Primary bibliographic anchor for Slater determinants. The APS resolver may challenge automated clients; DOI metadata is used bibliographically. |
| Matrix-element rules | E. U. Condon, “The Theory of Complex Spectra,” *Physical Review* **36**, 1121 (1930) | https://doi.org/10.1103/PhysRev.36.1121 | Primary bibliographic anchor for the Slater–Condon rules. |
| Fermionic 1-RDM conditions and N-representability boundary | A. J. Coleman, “Structure of Fermion Density Matrices,” *Reviews of Modern Physics* **35**, 668–686 (1963) | https://doi.org/10.1103/RevModPhys.35.668 | Primary bibliographic anchor. The APS resolver returned an automated-browser challenge on 2026-07-15; the chapter therefore does not claim browser-verified full text. |
| 2-RDM perspective | D. A. Mazziotti, “Two-Electron Reduced Density Matrix as the Basic Variable in Many-Electron Quantum Chemistry and Physics,” *Chemical Reviews* **112**, 244–262 (2012) | https://doi.org/10.1021/cr2000493 | Used only to frame the broader 2-RDM/N-representability problem that the finite certificate does **not** solve. |

The chapter also inherits the tensor-product boundary from `docs/academy/sources/qc-math-language.md`: a tensor product supplies distinguishable-coordinate structure; fermionic antisymmetrization is an additional physical constraint.

## Exact finite-space conventions

### Ordered spin orbitals and fixed-N sectors

Spin-orbital indices are nonnegative integers in the declared canonical order `p=0,…,M−1`. Occupation bitstrings are printed in that same left-to-right order. The fixed-`N` determinant sector has

`dim = C(M,N)`.

The complete Fock space has dimension `2^M`, but the chapter stays in a fixed-`N` sector except for intermediate creation/annihilation actions.

Creation and annihilation use

`a_p† |n_0…n_p…> = (-1)^(sum_{k<p} n_k) (1-n_p) |n_0…1_p…>`,

`a_p  |n_0…n_p…> = (-1)^(sum_{k<p} n_k) n_p     |n_0…0_p…>`.

A repeated creation index gives the zero vector. It is not assigned a permutation sign or normalized afterward.

### Exchange and determinant parity

Level 1 classifies a **total spin-coordinate amplitude**. For electrons,

`Psi(...,x_i,...,x_j,...) = -Psi(...,x_j,...,x_i,...)`.

The page explicitly avoids the false shortcut “the spatial wavefunction must always be antisymmetric”: a symmetric spatial factor can combine with an antisymmetric spin factor so that the total state is fermionic.

For a list of distinct occupied indices, the sign relative to ascending canonical order is

`sign(P) = (-1)^inv(P)`.

A determinant’s overall sign is conventional, while relative determinant phases in a linear combination affect observables and spin adaptation.

### Nonorthogonal determinant overlap

For two occupied orbital sets,

`<Phi_chi|Phi_eta> = det S`,  `S_ij=<chi_i|eta_j>`.

For one determinant’s norm, `S=G` is its occupied-orbital Gram matrix. `det G=1` only for the normalized orthonormal example; `1/sqrt(N!)` alone does not normalize a determinant built from nonorthonormal orbitals. Exact linear dependence gives `det G=0` and the zero wedge state.

The near-singular dossier uses a relative teaching threshold `lambda_min <= 10^-4 lambda_max`. It is labeled a finite numerical diagnostic requiring threshold scanning, not a molecule-independent physical cutoff or theorem.

### Slater–Condon structural selection

For equal-electron-number determinants, excitation rank is the number of occupied orbitals removed from one determinant (equivalently, the number inserted into the other). The chapter states only the structural rank filter:

- a one-body operator can connect rank 0 or 1;
- a two-body operator can connect rank 0, 1, or 2;
- higher ranks are forced to zero by operator rank.

“Can connect” and “structurally allowed” never mean “guaranteed nonzero.” Actual integral values, spatial/spin symmetry, and cancellation can still produce zero.

For a supplied determinant and supplied one-electron/direct/exchange objects, Level 6 uses the exact finite expectation

`<Phi|H|Phi> = sum_i h_ii + sum_{i<j}(J_ij-K_ij)`.

This is not called a Hartree–Fock solution: no orbital variation, stationarity condition, Fock operator, or self-consistent field iteration is performed.

### Spin adaptation convention

The chapter declares canonical spin-orbital order

`(a alpha, a beta, b alpha, b beta)`

and determinant definitions

`D1=|a alpha, b beta|`,  `D2=|a beta, b alpha|`.

With that determinant convention,

`|S=0,M_S=0> = (D1-D2)/sqrt(2)`,

`|S=1,M_S=0> = (D1+D2)/sqrt(2)`.

For a normalized real state `c1 D1+c2 D2`,

`w_singlet=(c1-c2)^2/[2(c1^2+c2^2)]`,

`w_triplet=(c1+c2)^2/[2(c1^2+c2^2)]`,

`<S^2>=2 w_triplet` in units with `hbar=1`.

Changing determinant ordering can change printed coefficient signs. The physical spin diagnosis must be transformed consistently.

### 1-RDM

The spin-orbital convention is

`gamma_pq = <Psi|a_p† a_q|Psi>`.

For a normalized fixed-`N` fermion state:

- `gamma` is Hermitian;
- `Tr gamma=N`;
- its natural spin-orbital occupations lie in `[0,1]`;
- a single Slater determinant has `gamma^2=gamma`.

The converse idempotency statement is used only in the declared finite pure-state context. Fractional natural occupations in the exposed two-determinant example demonstrate that it is not one determinant. The chapter does not claim that the 1-RDM reconstructs the full many-electron wavefunction or all pair observables.

### 2-RDM and contraction

The exact index convention is

`Gamma_pq,rs = <Psi|a_p† a_q† a_s a_r|Psi>`.

With this convention,

`sum_pq Gamma_pq,pq = N(N-1)`,

`sum_q Gamma_pq,rq = (N-1) gamma_pr`.

The implementation also checks antisymmetry under `p<->q` and `r<->s`. The exact exposed dossier is representable because both RDMs are generated directly from the same normalized finite CI state. For an arbitrary candidate 2-RDM, Hermiticity/antisymmetry, traces, and this contraction are necessary consistency evidence but are not presented as a complete practical solution of the N-representability problem.

## Dossier definitions

### Exchange

- X-14 supplies `(0.6,-0.6)`;
- X-22 supplies `(0.4,0.4)`;
- X-31 supplies `(0.7,0.2)`.

These are finite amplitude pairs, not normalized molecular wavefunctions. They isolate the exchange operation; the evaluator computes symmetric and antisymmetric residuals from the displayed pair rather than consulting a stored answer label.

### Occupation and parity

- sectors `(M,N)=(4,2),(6,3),(8,4)` have counts `6,20,70`;
- parity files `[1,0,2]`, `[2,0,3,1]`, `[3,2,1,0]` have signs `-1,-1,+1`.

### Gram artifacts

- identity → normalized;
- `[[1,0.6],[0.6,1]]` → `det G=0.64`, retain and renormalize;
- overlap `0.99999` → positive but near-singular under the declared diagnostic threshold, scan sensitivity;
- duplicate rows → exact zero determinant, reject.

### Selection pairs

The fixed determinant pairs differ by ranks 0, 1, 2, and 3. Levels 5 and 6 grade the exact displayed pair. There is no editable Professor model separate from a hidden graded dossier.

### Spin files

`D1-D2`, `D1+D2`, and `D1` yield pure singlet, pure triplet, and equal singlet/triplet mixture respectively under the declared convention.

### RDM files

- one determinant `|1001>` → occupations `(1,1,0,0)` up to ordering and idempotent `gamma`;
- normalized equal-weight `|1001>-|0110>` → four occupations `0.5`, trace 2, non-idempotent;
- diagonal candidate `(1,0.7,0.6)` → trace 2.3 and rejection;
- exact 2-RDM generated from the two-determinant state → trace 2 and zero contraction residual to numerical tolerance;
- corrupted 2-RDM adds `0.2` to `Gamma_03,03` → fails trace and contraction;
- R2-25 supplies no `Gamma`; the learner must decide whether one-body evidence alone can support a pair certificate.

## Commit-before-reveal and runtime boundary

All dossier data are fixed in code and each control displays the dossier being graded. Mission classifications are derived at commit time from the same finite algebra used to draw the visible dossier; there is no static `expected` or boss-route table in the shipped browser source. The learner commits before the evaluator certificate—residual, count, parity, spectrum, excitation rank, spin weights, idempotency, or contraction residual—appears. A wrong commitment reveals a diagnostic and allows recovery; it does not award a seal.

The browser-visible `window.QCManyElectronModels` API exposes only answer-free algebraic diagnostics. Mission evaluators remain closure-private in production; the Node model harness receives a CommonJS-only test surface. The CDP regression rejects public `evaluate*` functions, `constants`, or shipped static `expected`, `route`, and legacy answer-map leakage.

## Independent verification oracles

`scripts/test_qc_many_electron_models.js` currently checks:

- binomial values against explicit enumeration of all `2^M` bitstrings;
- permutation signs against direct inversion counts, including a duplicate-orbital zero;
- creation/annihilation signs by lower-index occupation counts;
- excitation ranks from independent bitstring differences;
- 2×2 and identity determinant overlaps against analytic values;
- one-body determinant matrix elements through explicit second-quantized actions;
- direct and exchange contributions against an independently totaled supplied pair ledger;
- singlet/triplet weights and `<S^2>` at pure and mixed checkpoints;
- 1-RDM traces, Hermiticity, natural occupations, Pauli bounds, and idempotency;
- 2-RDM antisymmetry, trace, and contraction, plus a deliberately corrupted pair element;
- a deterministic mixed-CI sweep in `(M,N)=(4,2),(5,2),(5,3)` for traces, contraction, Pauli bounds, and global-sign invariance;
- all fixed mission dossiers and every stage of the final synthesis routes.

Browser interaction tests additionally require commit-before-reveal, wrong-answer recovery, all earned predicates, notebook persistence, malformed/blocked storage safety, exact reset re-locking/defaults, unrelated Academy/Basis progress isolation, keyboard focus, non-color keys, touch targets, and true `390×844` internal plot scrolling.

## Scope boundary for the next chapter

This chapter deliberately stops before Hartree–Fock. The next chapter may introduce orbital variation, the Fock operator, Coulomb/exchange operators, self-consistency, canonical orbital energies, and restricted/unrestricted/open-shell choices. Nothing in this chapter labels a supplied determinant expectation as a variationally optimized mean-field solution.
