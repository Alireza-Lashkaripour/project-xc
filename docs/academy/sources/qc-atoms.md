# Atomic Structure source and convention ledger

**Chapter:** `qc-atoms`

**Access date:** 2026-07-14

**Purpose:** Record the scientific source spine, constants, conventions, model boundaries, and deterministic production checks for Project XC Academy’s Atomic Structure chapter. The chapter synthesizes and visualizes these ideas; it does not reproduce source prose or experimental tables.

## Verified open sources

| Topic | Source | Verified URL | Chapter use | Verification note |
|---|---|---|---|---|
| Chemistry-facing quantum mechanics and spectroscopy | MIT OpenCourseWare, *5.61 Physical Chemistry* | https://ocw.mit.edu/courses/5-61-physical-chemistry-fall-2017/ | Hydrogenic states, angular momentum, spectroscopy, and the bridge from one-electron atoms to many-electron chemistry | Page and course-material navigation loaded on 2026-07-14. |
| Associated Laguerre polynomials and zeros | NIST Digital Library of Mathematical Functions, Chapter 18 | https://dlmf.nist.gov/18 | Recurrence and zero structure behind normalized hydrogenic radial functions | Chapter 18 and its recurrence/zeros sections loaded on 2026-07-14. |
| Evaluated atomic levels, wavelengths, transition probabilities, ground states, and ionization energies | NIST Atomic Spectra Database, SRD 78 | https://physics.nist.gov/PhysRefData/ASD/ | Experimental-data boundary and recommended continuation beyond the browser’s Coulomb spectrum | NIST ASD landing page, data scope, version 5.12, and DOI `10.18434/T4W30F` loaded on 2026-07-14. |
| Shells, configurations, hydrogen-like ions, LS coupling, allowed terms, coupling schemes, and spectral-line selection rules | W. C. Martin and W. L. Wiese, NIST *Atomic Spectroscopy—A Compendium of Basic Ideas, Notation, Data, and Formulas* | https://physics.nist.gov/Pubs/AtSpec/index.html | Levels 1, 6, and 8–11; terminology and pure-LS model boundaries | Topical index loaded on 2026-07-14 and explicitly exposed the cited sections. |
| Hartree energy in electronvolts | NIST 2022 CODATA recommended values | https://physics.nist.gov/cgi-bin/cuu/Value?hrev | `E_h = 27.211386245981 eV` for browser readouts | Value and uncertainty loaded on 2026-07-14. |
| Electronic structure, quantum numbers, electron configurations, and periodic properties | OpenStax, *Chemistry 2e*, Chapter 6 | https://openstax.org/books/chemistry-2e/pages/6-introduction | Starter-mode route through Levels 2, 8, and 9 | Chapter and sections 6.1–6.5 loaded on 2026-07-14. |
| Atomic-orbital terminology | IUPAC Gold Book, “atomic orbital” | https://goldbook.iupac.org/terms/view/A00500 | Terminology boundary: a one-electron wavefunction obtained from an atomic Schrödinger equation | Definition and DOI `10.1351/goldbook.A00500` loaded on 2026-07-14. |

## Additional model reference

- J. C. Slater, “Atomic Shielding Constants,” *Physical Review* **36**, 57–64 (1930), DOI: https://doi.org/10.1103/PhysRev.36.57. The DOI resolver presented an automated-browser challenge on 2026-07-14, so it is cited bibliographically rather than marked as a browser-verified open page. Slater screening is used only as a named historical approximation.

## Constants and units

The production code uses

- `E_h = 27.211386245981 eV` from 2022 CODATA;
- `hc = 1239.8419843320025 eV nm`, computed from exact SI values `h=6.62607015×10⁻³⁴ J s`, `c=299792458 m s⁻¹`, and `e=1.602176634×10⁻¹⁹ C`;
- distance in Bohr radii `a₀` inside radial plots;
- energy in hartrees internally, with eV printed as a conversion.

No browser value is presented with more chemically meaningful precision than the model supports.

## Convention ledger

### One-electron Coulomb model

For a point nucleus of charge `+Z`, one electron, infinite nuclear mass, no external field, and the nonrelativistic Coulomb Hamiltonian in atomic units,

`H = -1/2 ∇² - Z/r`,

`E_n = -Z²/(2n²)`.

The energy depends only on `n`, so the spin-free spatial shell degeneracy is `Σ_(l=0)^(n-1)(2l+1)=n²`. This accidental Coulomb degeneracy is broken by effects omitted from this model: finite nuclear mass, relativistic/fine-structure terms, external fields, and—in many-electron atoms—electron repulsion and screening.

### Quantum numbers and nodes

- `n=1,2,…`;
- `l=0,…,n-1`;
- `m=-l,…,+l` for complex spherical harmonics `Y_l^m`;
- one spatial subshell has `2l+1` orbitals and capacity `2(2l+1)` after spin is included;
- one shell has capacity `2n²`;
- radial nodes: `n-l-1`;
- angular nodes: `l`;
- total nodes: `n-1`.

Exactly degenerate hydrogenic states do not have a unique preferred orbital basis inside the degenerate subspace.

### Hydrogenic radial function

With `ρ=2Zr/n`,

`R_nl(r) = sqrt[(2Z/n)^3 (n-l-1)!/(2n(n+l)!)] exp(-ρ/2) ρ^l L_(n-l-1)^(2l+1)(ρ)`.

The radial probability density is

`P_nl(r)=r² |R_nl(r)|²`,

normalized by `∫_0^∞ P_nl(r) dr = 1`. The browser uses the generalized-Laguerre three-term recurrence, brackets its positive zeros, and uses bisection for displayed radial-node radii. Numerical normalization is a check on a finite adaptive display domain, not the source of the analytic normalization constant.

### Angular pictures and `m`

The node studio evaluates real tesseral shapes proportional to `s`, `x/r`, `y/r`, `z/r`, `xy/r²`, `xz/r²`, `yz/r²`, `(x²-y²)/r²`, or `(2z²-x²-y²)/r²` on a selected plane. Their zero sets and phase signs are meaningful; their rendered lobe size is a visualization scale.

Except for `m=0`, familiar real `p` and `d` pictures are real linear combinations of complex `Y_l^(+m)` and `Y_l^(-m)`. They are not unique eigenfunctions of `L_z`, and rotations inside an exactly degenerate subspace do not create an energy splitting.

### Electric-dipole transition filter

The laboratory applies only the orbital angular electric-dipole conditions

`Δl=±1`, `Δm=0,±1`.

It reports these as an **E1 angular filter**, not a complete intensity calculation. It omits spin selection, radial matrix-element magnitude, configuration mixing, reduced-mass shifts, fine structure, hyperfine structure, Lamb shifts, linewidths, and environmental effects. A same-`n` pair in the ideal Coulomb model can pass the angular filter but has zero model photon energy and therefore no finite-frequency line.

For nonzero `|ΔE|`, the displayed model wavelength is `λ=hc/|ΔE|`.

### Many-electron boundary and Slater screening

The nonrelativistic clamped-nucleus atomic Hamiltonian contains electron repulsion:

`H = Σ_i[-1/2∇_i²-Z/r_i] + Σ_(i<j)1/r_ij`.

It is not separable into independent hydrogenic electrons. Slater’s rules replace the other-electron environment by a screening constant `S` and `Z_eff=Z-S`. The chapter exposes every contribution and labels the result approximate. It does not equate `-Z_eff²/(2n²)` with an observed orbital energy or ionization energy.

Implemented grouping and weights:

- for a target `ns/np` electron: another electron in the same `(ns,np)` group contributes `0.35` (`0.30` in `1s`); each electron in shell `n-1` contributes `0.85`; each electron in lower shells contributes `1.00`;
- for a target `nd` electron: another electron in the same `nd` group contributes `0.35`; every electron in groups to its left contributes `1.00`; electrons to the right contribute zero.

The chapter limits this game to neutral H–Kr configurations represented by its explicit ledger.

### Ground configurations and orbital boxes

The neutral H–Kr configuration ledger follows the standard pedagogical Aufbau order and explicitly stores the Cr `[Ar]3d⁵4s¹` and Cu `[Ar]3d¹⁰4s¹` exceptions. It is an empirical teaching ledger, not a variational solver. The configuration forge audits:

- total electron count;
- at most two opposite-spin electrons per spatial orbital (Pauli);
- maximum parallel single occupation before pairing within a degenerate subshell (Hund);
- agreement with the chapter’s neutral ground-configuration ledger.

It does not generate ionic configurations, excited configurations, or relativistic heavy-atom ordering.

### Equivalent-electron microstates and LS terms

For a single `l^q` subshell, the game enumerates all `C[2(2l+1),q]` Slater-determinant microstates from spin orbitals `(m_l,m_s)`. It counts each `(M_L,M_S)` cell and decomposes the table into pure-LS terms by repeatedly subtracting complete `(2L+1)(2S+1)` rectangles beginning at the highest remaining nonnegative `M_S` and `M_L`.

The result is exact combinatorics for one equivalent-electron subshell under pure LS coupling. It is not a prediction that LS coupling is pure in every real atom, and repeated terms remain distinct occurrences.

### Ideal fine structure

For a selected `^(2S+1)L` term in the pedagogical first-order model

`H_SO = A L·S`,

`J=|L-S|,…,L+S`,

`ΔE_J = A/2 [J(J+1)-L(L+1)-S(S+1)]`.

The model verifies `Σ_J(2J+1)ΔE_J=0` and the Landé interval rule `E_J-E_(J-1)=AJ`. The sign/magnitude of `A` is user supplied; the game does not derive `A`, handle term mixing, or replace a Dirac/Breit/relativistic calculation. Exactly coincident shifts—including every level at `A=0` and the sole `⁴S_(3/2)` level for any `A`—are drawn on one true-energy line. Their `J` labels are stacked beside an explicit `same E` bracket, while the barycenter annotation is placed separately; annotation spacing must never imply a physical splitting.

## Interactive-model boundary

The 12 games mix exact one-electron Coulomb results, exact finite combinatorics, a named approximate screening model, an explicit neutral-configuration ledger, and an ideal LS spin–orbit model. Each panel labels which category is active. None is an ab-initio many-electron atomic calculation, an experimental spectrum fit, or a substitute for NIST ASD and a validated electronic-structure program.

## Deterministic review contract

`scripts/test_qc_atomic_models.js` must test the production functions directly and verify at minimum:

- valid/invalid quantum-number boundaries, capacities, and node identities;
- `Z²/n²` Coulomb scaling and same-`n` degeneracy;
- generalized-Laguerre low-order values;
- `2s` radial node `2/Z`, both `3s` nodes `3(3±√3)/(2Z)`, `3p` radial node `6/Z`, every reported node as a Laguerre zero through `n=6`, and numerical radial normalization;
- nodal-plane/parity probes for every real `s/p/d` shape;
- allowed/forbidden E1 angular cases, direction, zero-energy degeneracy, and model wavelengths;
- all neutral H–Kr electron counts, subshell capacities, Cr/Cu exceptions, orbital-box audits, and a deliberately same-spin Pauli violation that preserves electron count;
- Slater examples C `2p: Z_eff=3.25`, Na `3s: 2.20`, Fe `3d: 6.25`;
- microstate determinant totals and term-dimension sums for every exposed `p¹…p⁵` and `d¹…d⁹` occupancy, named `p²`/`p³`/`d²` term oracles, electron-hole symmetry, and zero residual subtraction;
- fine-structure `J` ranges, `³P` shifts, degeneracy-weighted barycenter, Landé intervals, and grouping of coincident `A=0`/`⁴S` energies;
- final case-file scoring and model-category feedback.

`scripts/test_qc_atomic_interactions.js` launches the production page in headless Chrome/Chromium. It verifies that Space and Enter advance an orbital box without replacing the focused control, that auto-repeated Enter is default-suppressed without advancing again, and that `A=0`, `⁴S`, and ordinary `³P` labels remain separate while coincident markers stay on one physical energy line. The same canonical test reloads with CDP mobile/touch emulation at `390×844` and proves document containment, a focusable plot region, and positive internal horizontal scrolling. Both GitHub validation and the Pages pre-upload gate run this browser contract.

Any change to a formula, constant, configuration ledger, mission count, or model category requires updating this ledger, production tests, curriculum metadata, and on-page boundary together.
