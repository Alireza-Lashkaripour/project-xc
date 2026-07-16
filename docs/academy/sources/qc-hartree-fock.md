# Hartree–Fock and SCF: source and model ledger

This record is the scientific contract for `site/qc-hartree-fock.html` and `site/assets/qc-hartree-fock.js`. It fixes the finite conventions, separates exact finite algebra from pedagogical SCF models, and records the independent oracles in `scripts/test_qc_hartree_fock_models.js`.

Checked 2026-07-16.

## Source spine

| Topic | Source | Address | Verification/use |
|---|---|---|---|
| Finite-basis SCF theory, orthogonalization, convergence, damping, level shifting, DIIS, stability, and open-shell references | S. Lehtola, F. Blockhuys, and C. Van Alsenoy, “An Overview of Self-Consistent Field Calculations Within Finite Basis Sets,” *Molecules* **25**, 1218 (2020) | https://doi.org/10.3390/molecules25051218 | Open review and primary chapter spine. The MDPI page and DOI target were checked on 2026-07-15. |
| Closed-shell molecular-orbital equations | C. C. J. Roothaan, “New Developments in Molecular Orbital Theory,” *Reviews of Modern Physics* **23**, 69 (1951) | https://doi.org/10.1103/RevModPhys.23.69 | Primary bibliographic anchor for the Roothaan equations. The APS resolver can challenge automated clients; the chapter does not claim automated full-text access. |
| Generalized finite-basis molecular-orbital equations | G. G. Hall, “The Molecular Orbital Theory of Chemical Valency. VIII. A Method of Calculating Ionization Potentials,” *Proceedings of the Royal Society A* **205**, 541 (1951) | https://doi.org/10.1098/rspa.1951.0048 | Primary bibliographic anchor for the Hall–Roothaan finite-basis formulation. |
| DIIS | P. Pulay, “Convergence acceleration of iterative sequences. The case of SCF iteration,” *Chemical Physics Letters* **73**, 393–398 (1980) | https://doi.org/10.1016/0009-2614(80)80396-4 | Primary anchor for the constrained residual extrapolation taught in Level 10. |
| Robust SCF convergence diagnostics | K. N. Kudin, G. E. Scuseria, and E. Cancès, “A black-box self-consistent field convergence algorithm: One step closer,” *Journal of Chemical Physics* **116**, 8255 (2002) | https://doi.org/10.1063/1.1470195 | Used to frame convergence as a nonlinear optimization/fixed-point problem and to motivate residual/history diagnostics. |
| Unrestricted open-shell orbitals | J. A. Pople and R. K. Nesbet, “Self-Consistent Orbitals for Radicals,” *Journal of Chemical Physics* **22**, 571 (1954) | https://doi.org/10.1063/1.1740120 | Primary bibliographic anchor for unrestricted references. |
| Spin contamination and broken symmetry | P.-O. Löwdin, “Quantum Theory of Many-Particle Systems. III. Extension of the Hartree–Fock Scheme to Include Degenerate Systems and Correlation Effects,” *Physical Review* **97**, 1509 (1955) | https://doi.org/10.1103/PhysRev.97.1509 | Historical anchor for the unrestricted-spin discussion; the page uses the explicitly stated finite determinant formula below. |

The chapter inherits determinant, antisymmetrized-integral, and reduced-density conventions from `docs/academy/sources/qc-many-electron.md`, and generalized-eigenproblem/basis conditioning context from the Basis Quest.

## Exact finite conventions

### Spin-orbital Fock contraction

The finite Fock and energy model uses real spin orbitals, antisymmetrized two-electron integrals, and the **full occupation-one spin-orbital 1-RDM** `D^(so)`. Its occupied columns include every occupied alpha and beta spin orbital:

`F_pq = h_pq + sum_rs D^(so)_rs <p r || q s>`,

`D^(so) = C_occ^(so) (C_occ^(so))^T`.

For this convention, the electronic Hartree–Fock energy is

`E_HF = 1/2 Tr[D^(so) (h+F)]`.

This `D^(so)` is not the single-spin spatial projector used in Level 5. Level 5 names that separate object `D^(sigma)` and audits `D^(sigma) S D^(sigma)=D^(sigma)`; for closed-shell RHF it also introduces the spin-summed spatial density `P=2D^(sigma)`. Neither `D^(sigma)` nor `P` is silently inserted into the spin-orbital contraction above. A spatial-orbital RHF Fock formula requires the familiar separate Coulomb/exchange occupancy factors.

Level 2 separately exposes the pair structure:

- opposite spin: `J` only;
- same spin: `J-K`;
- identical-orbital self term: `J-K=0` when `J=K`.

The last item is one-electron self-interaction cancellation within exact exchange, not a claim that Hartree–Fock contains all correlation or that every many-electron self-interaction question is solved.

The accepted Fock dossier is a genuine two-electron spin-orbital determinant: `D^(so)=I_2`, `h=diag(-1.0,-0.8) Ha`, and the independent real antisymmetrized integral `<01||01>=0.4 Ha` with all required partners (`<10||01>=-0.4`, `<01||10>=-0.4`, `<10||10>=0.4`). The resulting finite matrices are `G=diag(0.4,0.4) Ha`, `F=diag(-0.6,-0.4) Ha`, and `E_HF=-1.4 Ha`. The rejected dossier adds raw entries with equal first-pair indices and unequal off-diagonal contractions; both the integral-permutation residual and Fock-Hermiticity residual expose the defect.

### Generalized eigenproblem

For a positive-definite overlap matrix `S`, the finite Roothaan–Hall problem is

`F C = S C epsilon`,  `C^T S C = I`.

The implementation symmetrically diagonalizes `S`, forms `X=S^(-1/2)`, solves

`(X^T F X) C' = C' epsilon`,

and returns `C=X C'`. Every accepted dossier checks both generalized residuals

`||F c_i - epsilon_i S c_i||_2`

and the metric orthonormality residual `||C^T S C-I||_F`. A singular or non-positive overlap matrix is rejected; it is not regularized into a different problem behind the learner’s back.

### Density-projector certificates

For the one-spin spatial occupied projector `D^(sigma)`,

`Tr(D^(sigma) S)=N_occ^(sigma)`,  `D^(sigma) S D^(sigma) = D^(sigma)`.

For a spin-summed doubly occupied RHF spatial density `P=2D^(sigma)`, the corresponding closure is `P S P=2P`. This Level 5 convention is explicitly distinct from the full spin-orbital `D^(so)` used by the Fock and energy model.

### SCF stationarity residual

The AO-basis commutator residual is

`R = F D S - S D F`.

At a self-consistent occupied invariant subspace, `R=0` up to numerical tolerance. The chapter never treats a small energy change alone as an SCF certificate.

### One-parameter orbital-rotation slice

Level 1 uses an exact two-dimensional quadratic slice

`E(theta)=a cos^2(theta)+d sin^2(theta)+2b sin(theta)cos(theta)`.

Its derivatives are

`dE/dtheta=(d-a) sin(2theta)+2b cos(2theta)`,

`d^2E/dtheta^2=2(d-a) cos(2theta)-4b sin(2theta)`.

A finite-difference oracle independently checks the analytic derivative. A minimum or maximum is classified only after stationarity is established. This is a declared orbital-rotation slice, not a proof that a molecular Hartree–Fock solution is the global minimum over all determinants.

### Orbital invariance and Brillouin stationarity

At a stationary Hartree–Fock determinant, occupied–virtual Fock couplings vanish in the stationary orbital basis. Rotations within the occupied subspace change the orbital representation but not the determinant’s occupied projector; rotations wholly within the virtual subspace likewise do not change the occupied state. A stationary solution can still have a negative orbital Hessian direction. Therefore:

`SCF convergence != Hartree–Fock stability != physical adequacy`.

## Declared reduced SCF model

Levels 7 and 9 use a two-level scalar model, clearly labeled “reduced SCF model.” It is not a molecular calculation. For density-polarization coordinate `x`:

`F(x) = [[-delta/2 + U x, t], [t, delta/2 - U x]]`,

`g(x) = (delta - 2 U x) / sqrt((delta - 2 U x)^2 + 4 t^2)`.

The raw iteration is `x_(n+1)=g(x_n)`. The displayed reduced energy is

`E(x) = -delta x/2 - |t| sqrt(1-x^2) + U x^2/2`.

The fixed-point residual is `|g(x_n)-x_n|`. The finite model can converge or enter a two-cycle depending on the parameters. It exists to make nonlinear self-consistency and intervention effects directly inspectable; its scalar coordinate, parameter values, and behavior are not transferred to production molecular SCF thresholds.

### Convergence-log classifier

The synthetic log classifier uses declared teaching thresholds:

- converged: final density residual `<=10^-6` and final energy change `<=10^-8`;
- false plateau: energy change `<=10^-8` while density residual remains `>10^-6`;
- oscillatory: a repeated two-cycle in the supplied density history;
- divergent: the last three residuals increase strictly and the final one is more than twice the first.

These thresholds classify only the displayed finite dossiers. Program defaults, precision, system size, method, and target property must determine production thresholds.

### Damping and level shifting

Old-density-weighted damping is

`x_mix = w_old x_old + (1-w_old) x_raw`,  `0<=w_old<1`.

The reduced level shift is defined only in an orthonormal basis:

`F_shifted = F + lambda (I-D)`,  `lambda>=0`.

A positive shift raises the current virtual projector in this model. Damping and level shifting alter the iteration path and can fail; they are interventions, not proofs of a correct final state. Any artificial shift should be removed or accounted for before reporting the unmodified fixed point.

The Level 9 evidence is intervention-specific. The damping dossier reports contraction of the maximum displayed update step under the declared old-density weight, but labels that contraction as requiring a fresh residual-checked rerun. The level-shift dossier instead applies `lambda=0.50 Ha` to a diagonal orthonormal two-level Fock/projector pair and exposes the occupied–virtual gap change from `0.03` to `0.53 Ha`; it does not fabricate a shifted SCF trajectory. The no-intervention dossier reports the already-passing energy and density gates without drawing an altered path.

### DIIS

For residual vectors `r_i`, the finite DIIS problem is

`min_c ||sum_i c_i r_i||_2^2` subject to `sum_i c_i=1`.

The code forms `B_ij=r_i dot r_j` and solves the augmented constrained system. Linearly dependent histories are rejected by the finite solver as singular evidence. DIIS coefficients need not lie in `[0,1]`, and the extrapolated Hartree–Fock energy is not guaranteed to be a variational upper bound at every iteration.

### UHF spin certificate

For real unrestricted occupied orbitals with `N_alpha>=N_beta`,

`<S^2> = S_z(S_z+1) + N_beta - sum_ij |S_ij^(alpha beta)|^2`,

`S_z=(N_alpha-N_beta)/2`.

The target high-spin determinant value is `S(S+1)` with `S=S_z`; the reported contamination is the difference. For one alpha and one beta orbital, the model reduces to `<S^2>=1-|<phi_alpha|phi_beta>|^2`. The chapter treats spin contamination as a diagnostic, not an automatic instruction to discard every broken-symmetry UHF solution.

### RHF, ROHF, and UHF decision boundary

The finite reference dossiers encode explicit goals:

- RHF: paired alpha/beta electrons constrained to the same spatial orbitals;
- ROHF: a spin-adapted high-spin open-shell determinant with common doubly occupied structure;
- UHF: independently relaxed alpha and beta spatial orbitals, allowing spin-symmetry breaking and requiring `<S^2>` evidence.

No reference is advertised as universally best. Convergence to one of them is not evidence that it is the lowest-energy stable solution, has the desired state character, or captures strong/static correlation.

## Mission and evidence contract

The page contains exactly twelve `.lab-grid` missions and eleven finite SVG plots.

| Mission | Required dossiers | Earned evidence |
|---|---:|---|
| 1. Variational determinant | 3 | Correctly classify stationary minimum, stationary maximum, and nonstationary rotation slices from derivative/curvature evidence. |
| 2. Coulomb and exchange | 3 | Distinguish same-spin `J-K`, opposite-spin `J`, and exact self-term cancellation. |
| 3. Fock assembly | 2 | Contract supplied finite `h`, full spin-orbital `D^(so)`, and antisymmetrized integrals; require both integral-permutation and Fock-Hermiticity certificates. |
| 4. Roothaan–Hall | 2 | Solve a valid generalized problem and reject a non-positive overlap metric. |
| 5. Density projector | 2 | Verify both electron count and metric idempotency; reject a fractional nonprojector. |
| 6. Orbital stationarity | 3 | Separate a stable stationary slice, a nonzero occupied–virtual gradient, and an unstable stationary slice. |
| 7. SCF fixed point | 2 | Require a small map residual; reject a two-cycle even when iterates remain bounded. |
| 8. Convergence diagnostics | 4 | Classify converged, false-plateau, oscillatory, and divergent logs. |
| 9. SCF stabilization | 3 | Select damping, an orthonormal virtual level shift, or no intervention from the supplied pathology/evidence. |
| 10. DIIS | 2 | Accept an independently reducible residual subspace and reject a singular duplicate history. |
| 11. Reference and spin | 3 | Select RHF, ROHF, or UHF from explicit constraints and audit the finite `<S^2>` certificate. |
| 12. HF/SCF evidence board | 3 three-stage case files | Commit reference, primary diagnostic, and evidence package with four attempts per file. |

Every non-boss dossier is identified by a neutral opaque ID. Production data contain scientific inputs only. Evaluators derive the accepted classification at run time. Boss case files store no route arrays; each stage is recomputed from reference constraints, log classification, and spin evidence.

A mission seal remains disabled until every required dossier for that mission has passed. The boss remains disabled until the first eleven missions are evidenced. The boss has a recoverable attempt budget and resets only its current case on exhaustion.

### Persistence and canonical-progress boundary

Chapter evidence is stored under

`project-xc-hartree-fock-games-v1`.

The version-2 chapter record persists replayable case transcripts rather than trusting a cleared-ID list: neutral case ID, committed choice, and a fingerprint of the displayed dossier. Restore rejects stale fingerprints and reruns the production classifier before accepting each case. Boss prefixes are likewise replayed against the current three-stage classifier and dossier fingerprint. These checks provide consistency and recovery, not cryptographic security against a learner who rewrites a static client and its storage.

Canonical Academy mission completion is stored separately by `academy-core.js`. A capture-phase evidence predicate blocks a manually re-enabled seal before the shared click handler can write progress, and every render removes unsupported direct or persisted canonical completions. Restore also filters unknown IDs, wrong JSON shapes, impossible boss stages, incorrect saved answers, and boss state without prerequisites. The chapter reset removes only Hartree–Fock evidence and Hartree–Fock canonical mission IDs.

### Public API boundary

`window.QCHartreeFockModels` exposes only answer-free scientific transforms:

- finite symmetric and generalized eigensolvers;
- density-projector construction and audit;
- antisymmetrized-integral permutation audit, Fock contraction, and finite energy;
- commutator residual;
- orbital-rotation slice and derivatives;
- reduced SCF map/iteration and log classifier;
- damping, orthonormal level shifting, DIIS, and UHF `<S^2>`.

Dossier banks, mission evaluators, accepted labels, and boss derivation stay closure-private. CommonJS test exports are available only outside the browser.

## Independent verification oracles

`scripts/test_qc_hartree_fock_models.js` performs 280 assertions. It does not merely call an evaluator with a route copied from a browser dossier. Independent checks include:

1. trace/discriminant roots for symmetric `2x2` matrices;
2. direct quadratic roots of `det(F-epsilon S)=0` over a parameter sweep;
3. direct generalized residuals, recomputed `C^T S C`, and the production metric-residual certificate;
4. independently multiplied `D S D` projector closure;
5. entrywise invariance of the density projector under a finite occupied–occupied unitary rotation;
6. a symmetry-complete two-electron antisymmetrized tensor, independent permutation audit, exact Fock contraction, `E_HF=-1.4 Ha` energy, occupied self-interaction cancellation, and malformed-tensor rejection;
7. central finite differences for the orbital-rotation derivative;
8. a direct closed-form reduced SCF map value and iterative residual checks;
9. independent pathology logs for all four convergence classes;
10. direct damping and level-shift arithmetic;
11. intervention-specific damping-step contraction, level-shift gap change, and no-intervention residual evidence;
12. a brute-force grid minimization of the two-vector DIIS objective;
13. hand-derived pure singlet, broken-symmetry `M_S=0`, pure doublet, and contaminated doublet `<S^2>` cases;
14. malformed-input rejection plus an exact browser-public-API allowlist and function-source anti-oracle scan.

`scripts/test_qc_hartree_fock_interactions.js` performs 42 browser assertions covering all dossiers, every boss stage, attempt exhaustion, commit-gated evidence, answer-free unrevealed intervention geometry, intervention-specific post-commit damping/gap/no-action plots, the four-matrix Fock and dual Roothaan residual certificates, all three visible pre-grade reference constraints, pre-write seal guarding, canonical-progress forgery rejection, version-2 transcript/fingerprint rejection, malformed restore with and without prerequisites, blocked storage, reload persistence, chapter-only reset, keyboard focus, reduced-motion behavior, an exact `390x844` layout-viewport assertion, eleven internally scrolling plots, 44-pixel touch-target size, and severe console/runtime/network failures.

## Deliberately unmodeled claims

The chapter does **not** claim to provide:

- a molecular integral engine or production SCF implementation;
- basis-set, geometry, relativistic, solvent, finite-temperature, or external-field convergence advice;
- a proof that a converged determinant is the global Hartree–Fock minimum;
- a full orbital-Hessian stability analysis;
- a universal convergence threshold or universal damping/level-shift/DIIS recipe;
- a guarantee that RHF, ROHF, or UHF is qualitatively adequate in a strongly correlated regime;
- post-Hartree–Fock correlation, Kohn–Sham DFT, analytic derivatives, properties, or excited states;
- equivalence between orbital energies and general observables beyond the specifically stated Hartree–Fock context.

Those boundaries are prerequisites for later Academy chapters rather than gaps hidden inside this one.
