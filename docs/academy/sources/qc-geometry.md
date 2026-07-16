# Geometry, Gradients, and Frequencies — source and model ledger

Status: authoritative implementation ledger for `qc-geometry.html`

Chapter route: `site/qc-geometry.html`

Scientific model: `site/assets/qc-geometry.js`

Independent model tests: `scripts/test_qc_geometry_models.js`

Browser interaction tests: `scripts/test_qc_geometry_interactions.js`

Implementation plan: `docs/plans/2026-07-16-geometry-gradients-frequencies-chapter.md`

## Scope boundary

This chapter begins after a learner has earned the Hartree–Fock/SCF and Approximation Thinking prerequisites. It treats nuclear motion on a declared electronic-energy model. It does not reteach SCF and it does not silently promote finite teaching surfaces into molecular predictions.

A small gradient, an optimizer convergence flag, or a harmonic spectrum is evidence only for the declared:

- electronic method and reference;
- basis and effective-core treatment;
- nuclear coordinates and masses;
- SCF, integral, grid, optimizer, and derivative thresholds;
- environment and constraints;
- stationary-point and vibrational projection conventions.

The chapter does **not** certify the global minimum, an experimental spectrum, an anharmonic or finite-temperature free energy, a rate constant, or a global reaction mechanism.

## Units and numerical conventions

- Teaching Cartesian/generalized coordinates are dimensionless unless a dossier labels a physical unit. The IRC dossier explicitly declares dimensionless `x,y` and electronic energies in kcal mol⁻¹.
- Gradient-ledger entries are displayed in hartree/bohr.
- Trust-region quadratic changes use the same abstract energy unit as the supplied local model.
- Hessian eigenvalues in the finite models are abstract curvature units.
- Positive harmonic wavenumbers supplied to `zpeKcalMol` are in cm⁻¹.
- `zpeKcalMol` uses

  \[
  E_{\mathrm{ZPE}}=\frac12hcN_A\sum_i\tilde\nu_i,
  \]

  implemented as `0.0014295718 kcal mol^-1 cm` per positive wavenumber. Imaginary modes are not passed as real frequencies.
- Matrix symmetry is tested against explicit tolerances. Near-zero eigenvalues are not rounded into positive or negative labels.
- The browser dossier fingerprints are FNV-1a-style integrity tags for replay validation, not cryptographic signatures.

## Mission 1 — potential-energy surfaces, gradients, and forces

The finite surface is

\[
E(\mathbf q)=E_0+\mathbf l^T\mathbf q+\frac12\mathbf q^TH\mathbf q,
\quad
\nabla E=\mathbf l+H\mathbf q,
\quad
\mathbf F=-\nabla E.
\]

The directional derivative along a normalized direction \(\hat{\mathbf d}\) is \(\nabla E\cdot\hat{\mathbf d}\).

Independent oracles:

- direct scalar expansion of the quadratic energy;
- direct matrix-vector expansion of the gradient;
- explicit sign reversal for the force;
- normalized directional-dot-product comparison.

Neutral dossiers cover positive first-coordinate force, negative second-coordinate force, and a stationary point. The plot shows the gradient before commitment but seals the force certificate until a decision is made.

## Mission 2 — stationary analytic-gradient ledger and Pulay evidence

For a stationary finite-basis Hartree–Fock state, the chapter uses the schematic AO derivative ledger

\[
E^x = E_{NN}^x
+ \sum_{\mu\nu}P_{\mu\nu}h_{\mu\nu}^x
+ \frac12\sum_{\mu\nu\rho\sigma}\Pi_{\mu\nu\rho\sigma}(\mu\nu|\rho\sigma)^x
- \sum_{\mu\nu}X_{\mu\nu}S_{\mu\nu}^x.
\]

The final overlap-derivative term is the energy-weighted-density/Pulay contribution for a moving atom-centered basis. The finite implementation receives signed nuclear, one-electron, two-electron, and overlap/Pulay terms and sums them independently.

Important qualification: the stationary HF derivative formula assumes a sufficiently converged variational electronic state. When the SCF residual exceeds the declared gate, the mission requires reconvergence rather than treating the stationary formula as certified. For nonvariational methods and higher derivatives, explicit response equations may remain necessary; this teaching ledger does not claim otherwise.

Independent oracles:

- direct signed summation with and without the overlap/Pulay term;
- explicit SCF-residual comparison to `1e-7`;
- test that omitting a nonzero Pulay term changes the derivative by exactly that term.

## Mission 3 — analytic versus central finite-difference gradients

For polynomial

\[
E(x)=\sum_{n=0}^{N}a_nx^n,
\]

production and test code independently evaluate

\[
E'(x)=\sum_{n=1}^{N}na_nx^{n-1},
\qquad
E'_{\mathrm{CD}}(x;h)=\frac{E(x+h)-E(x-h)}{2h}.
\]

The three dossiers distinguish:

- a useful error window;
- a large displacement dominated by truncation error;
- a tiny displacement dominated by floating-point subtraction/cancellation.

The chapter intentionally does not suggest that one universal finite-difference step is valid for every coordinate, unit system, electronic method, grid, or numerical precision.

Independent oracles include exact polynomial differentiation, direct two-point energy evaluation, useful-window error checks, and invalid-step rejection.

## Mission 4 — geometry-optimization steps

The local quadratic model is

\[
m(\mathbf s)=E+\mathbf g^T\mathbf s+\frac12\mathbf s^TH\mathbf s.
\]

Implemented proposals are:

\[
\mathbf s_{SD}=-\alpha\mathbf g,
\qquad
H\mathbf s_N=-\mathbf g.
\]

Both may be clipped to a declared trust radius \(\Delta\). The predicted change is evaluated directly from the quadratic model rather than inferred from a method label.

The decision logic uses finite Hessian inertia and a conditioning proxy. An indefinite local Hessian is not accepted blindly as a minimum-search Newton model. A positive but nearly singular local Hessian favors a safer gradient step in the teaching dossiers.

Independent oracles:

- direct two-by-two linear solve;
- Euclidean trust-radius norm;
- direct predicted-change calculation;
- explicit Hessian eigenvalue/inertia calculation.

## Mission 5 — trust regions and BFGS

For Hessian approximation \(B\), displacement \(\mathbf s\), and gradient change \(\mathbf y\), the implemented BFGS update is

\[
B_{k+1}=B_k-
\frac{B_k\mathbf s\mathbf s^TB_k}{\mathbf s^TB_k\mathbf s}
+
\frac{\mathbf y\mathbf y^T}{\mathbf y^T\mathbf s}.
\]

The update requires positive and numerically safe denominators, especially the curvature condition \(\mathbf s^T\mathbf y>0\). Unsafe updates are skipped rather than coerced.

The trust ratio is

\[
\rho=\frac{E_k-E_{k+1}}{m_k(0)-m_k(\mathbf s)}.
\]

The finite policy rejects/shrinks for \(\rho<0.25\), accepts/expands for \(\rho>0.75\) when the step is on the trust boundary, and otherwise accepts/keeps. The specific thresholds are declared teaching policy, not a claim that every production optimizer uses the same constants.

Independent oracles include direct outer-product arithmetic, secant residual \(\|B_{k+1}s-y\|\), symmetry, positive-definiteness, and direct actual/predicted ratio.

## Mission 6 — Hessian curvature and inertia

A Hessian must be symmetric to represent a scalar energy’s second derivatives under the declared smooth-coordinate model. The two-coordinate finite-difference Hessian uses central differences of analytic gradients:

\[
H_{ij}\approx\frac{g_i(\mathbf q+h\mathbf e_j)-g_i(\mathbf q-h\mathbf e_j)}{2h}.
\]

The inertia report counts eigenvalues less than \(-\tau\), within \(\pm\tau\), and greater than \(+\tau\). Dossiers cover positive-definite, one-negative-mode, asymmetric/rejected, and unresolved-near-zero cases.

Near-zero modes are intentionally not auto-labeled as translations, rotations, free internal rotations, or numerical noise. Physical assignment requires projected Cartesian mode vectors and declared coordinate constraints.

## Mission 7 — mass weighting and normal modes

For positive masses,

\[
F=M^{-1/2}HM^{-1/2}.
\]

The finite diatomic spring Hessian

\[
H=k\begin{pmatrix}1&-1\\-1&1\end{pmatrix}
\]

has mass-weighted eigenvalues

\[
\lambda_{\mathrm{translation}}=0,
\qquad
\lambda_{\mathrm{stretch}}=k\left(\frac1{m_1}+\frac1{m_2}\right).
\]

This analytically exposes a translational zero mode and the isotope trend. It is a finite one-dimensional teaching model; it is not a replacement for projecting three translations and two or three rotations from a full molecular Cartesian Hessian.

Invalid/nonpositive masses are rejected. Cartesian displacement vectors are recovered with \(M^{-1/2}\) from mass-weighted eigenvectors.

## Mission 8 — stationary points, frequencies, and harmonic ZPE

Before a stationary-point label is assigned, the supplied projected vibrational-space dimension must equal `3N-6` (nonlinear) or `3N-5` (linear). A mismatch returns `invalid-mode-count` even if the supplied subset looks positive. For a count-valid dossier, a gradient norm above the declared threshold returns `not-stationary`; otherwise Hessian inertia is interpreted as follows:

- zero significant negative modes → minimum;
- exactly one significant negative mode → first-order saddle;
- more than one → higher-order saddle;
- any unresolved near-zero vibrational curvature → unresolved classification.

The fifth fixed spectrum deliberately omits one nonlinear-triatomic vibrational mode and must be rejected. This prevents a truncated all-positive list from masquerading as a minimum.

The finite display maps positive abstract curvature to a teaching wavenumber with a declared scale only to exercise ZPE arithmetic. It does not claim a physical molecule’s spectrum.

The chapter explicitly excludes anharmonic, thermal, entropic, tunneling, solvent, rovibrational, and free-energy corrections from the harmonic ZPE certificate.

## Mission 9 — transition states and intrinsic reaction paths

The finite surface is

\[
E(x,y)=b(x^2-1)^2+\frac12ky^2.
\]

Here `x,y` are dimensionless. Every IRC dossier declares `b = 1 kcal mol⁻¹`; `k = +1` or `−1 kcal mol⁻¹` per squared dimensionless coordinate. Therefore the electronic saddle-minus-minimum barrier supplied to `zpeCorrectedBarrier` is explicitly `1 kcal mol⁻¹`, in the same molar unit as the harmonic ZPE terms. No abstract model-energy value is added to a physical ZPE value.

At the origin,

\[
H(0,0)=\begin{pmatrix}-4b&0\\0&k\end{pmatrix}.
\]

For positive \(b,k\), the origin is a first-order saddle and the negative mode points along the double-well coordinate. The tracer displaces by both signs of that mode and performs deterministic downhill steps to distinct minima near \(x=\pm1\).

Dossiers require:

- exactly one significant negative mode;
- both path directions;
- convergence to distinct stationary endpoints;
- explicit exclusion of the imaginary TS mode from harmonic ZPE.

The finite tracer is an inspectable equal-mass gradient-descent analogue, not a production predictor-corrector IRC implementation. The chapter does not infer rates, recrossing, tunneling, or global mechanism uniqueness from the local path.

## Mission 10 — geometry evidence board

The final board contains three fixed neutral dossiers:

1. a candidate minimum with tight gradient, no negative modes, and an analytic/finite-difference gradient comparison;
2. a candidate transition state with one negative mode, strong reaction-coordinate overlap, and distinct two-sided IRC endpoints;
3. a tiny negative eigenvalue below the declared significance threshold with strong external-mode contamination.

Each dossier requires three immutable decisions:

1. target/workflow;
2. dominant diagnostic;
3. sufficient validation package.

Four rejected attempts reset only the active dossier. Case switching and reload preserve only replay-valid stage transcripts. A fabricated stage 3, wrong fingerprint, unknown dossier, malformed bucket, or canonical Academy completion without local evidence does not unlock mastery.

## Deterministic implementation surface

The browser exposes only answer-free scientific transforms on `window.QCGeometryModels`:

- vector and two-by-two symmetric eigensystem helpers;
- quadratic surfaces and directional derivatives;
- stationary gradient ledger;
- polynomial/finite-difference derivatives;
- optimization, trust-ratio, and BFGS transforms;
- finite-difference Hessian and inertia;
- mass-weighted modes;
- stationary-point and harmonic-ZPE audit;
- double-well, IRC, endpoint, and corrected-barrier transforms.

Neutral dossiers and mission evaluators remain private to the closure. CommonJS tests receive private evaluators only for deterministic regression coverage.

## Persistence and canonical progress

Chapter evidence key: `project-xc-geometry-games-v1`

Schema version: `2`

A neutral case replays only if:

- its bucket and ID are known;
- the choice slug has a constrained format;
- its fingerprint matches the current dossier content;
- the current evaluator independently accepts the stored choice.

Boss evidence additionally requires all nine prerequisite mission seals, a matching dossier fingerprint, a legal stage, exact transcript length, and successful replay of every committed stage.

Canonical Academy progress is subordinate to chapter evidence. Unsupported canonical completions are removed. Chapter reset clears only geometry state and `qc-geometry` canonical missions; unrelated Academy and Basis Quest data remain intact.

## Verification inventory

`scripts/test_qc_geometry_models.js` independently checks:

- 22-key public API allowlist;
- no evaluator/dossier leakage through public function source;
- quadratic energy/gradient/force signs;
- directional derivatives;
- gradient-ledger totals and stationarity gates;
- analytic and finite-difference polynomial derivatives;
- trust-limited optimization steps;
- BFGS matrix arithmetic and curvature rejection;
- finite-difference Hessians;
- inertia and asymmetry rejection;
- mass weighting, analytic diatomic stretch, isotope trend, and invalid masses;
- stationary classifications and mode-count contracts;
- ZPE arithmetic;
- double-well saddle, two-sided path endpoints, and corrected barriers;
- every neutral mission and boss-stage evaluator.

`scripts/test_qc_geometry_interactions.js` exercises real Chrome/CDP behavior:

- 10 lessons, 10 games, 10 mission seals, 9 finite plots, and 9 keys;
- duplicate IDs, accessible names, plot semantics, finite SVG markup, and source links;
- precommit constraints and hidden decisive oracle keys;
- wrong-answer feedback without answer-slug disclosure;
- all 30 neutral dossiers and all 9 boss stages;
- focus continuity and keyboard lesson navigation;
- four-attempt boss recovery and partial-stage case-switch persistence;
- valid reload replay;
- malformed, forged-fingerprint, impossible-stage, manually enabled seal, and canonical-only forgery rejection;
- blocked-storage fallback;
- chapter-only reset isolation;
- reduced-motion behavior;
- exact 390×844 viewport, no document overflow, internal plot scrolling, and 44 px touch targets;
- no runtime exceptions or severe console events.

## Authoritative source anchors

1. P. Pulay, “Ab initio calculation of force constants and equilibrium geometries in polyatomic molecules. I. Theory,” *Molecular Physics* (1969), DOI: https://doi.org/10.1080/00268976900100941
   - Anchor for atom-centered-basis analytic derivatives and Pulay/overlap terms.
2. H. B. Schlegel, “Optimization of equilibrium geometries and transition structures,” *Journal of Computational Chemistry* 3 (1982), DOI: https://doi.org/10.1002/jcc.540030212
   - Anchor for molecular geometry-optimization strategy and transition structures.
3. J. Nocedal and S. J. Wright, *Numerical Optimization*, second edition, DOI: https://doi.org/10.1007/978-0-387-40065-5
   - Anchor for trust-region and quasi-Newton/BFGS algorithms.
4. K. Fukui, “The path of chemical reactions — the IRC approach,” *Accounts of Chemical Research* 14 (1981), DOI: https://doi.org/10.1021/ar00072a001
   - Anchor for intrinsic reaction-coordinate concepts.
5. T. Helgaker, P. Jørgensen, and J. Olsen, *Molecular Electronic-Structure Theory*, DOI: https://doi.org/10.1002/9781119019572
   - Anchor for electronic-structure derivatives, response theory, and molecular Hessian conventions.
6. NIST, “Fundamental Physical Constants,” https://physics.nist.gov/cuu/Constants/
   - Standards anchor for the `hcN_A` wavenumber-to-molar-energy conversion.

URL verification on 2026-07-16:

- Springer/Nocedal–Wright and NIST returned HTTP 200.
- The Pulay/Taylor & Francis, Schlegel/Wiley, Fukui/ACS, and Helgaker/Wiley DOI URLs resolved to the intended publisher pages but returned HTTP 403 to automated `curl`, consistent with publisher anti-bot policy. They are valid DOI redirects, not broken identifiers.

## Known finite-model limitations

- All matrices are at most two-by-two except simple mode arrays.
- The normal-mode laboratory does not implement full Eckart translation/rotation projection.
- The displayed frequency scale for abstract eigenvalues is pedagogical.
- The IRC tracer is deterministic gradient descent on an analytic double well, not a production mass-weighted predictor-corrector integrator.
- Dossiers are constructed finite examples, not ab initio calculations on named molecules.
- The final evidence board teaches validation design; it does not certify chemistry outside its fixed artifacts.
