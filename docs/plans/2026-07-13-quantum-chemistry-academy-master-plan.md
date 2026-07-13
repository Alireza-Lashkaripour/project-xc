# Project XC Quantum Chemistry Academy Master Implementation Plan

> **For Hermes:** Use the software-development, scientific-website, and subagent-driven-development workflows to execute this plan one verified milestone at a time. Never mark a chapter complete from prose alone: its equations, games, references, accessibility, browser behavior, and live deployment must all pass their gates.

**Goal:** Build a source-grounded, game-rich, visually elegant Quantum Chemistry Academy inside Project XC that teaches from first principles through research/professor-level electronic-structure theory.

**Architecture:** Preserve Project XC as a static GitHub Pages site. The root remains a lightweight gateway; `quantum-chemistry.html` becomes the Academy roadmap; each substantial subject receives a dedicated chapter page. Curriculum metadata is data-driven, while chapter prose and interactive SVG/JavaScript laboratories remain auditable static assets. Existing XC, MO, and Basis modules are linked into the curriculum instead of duplicated.

**Tech Stack:** Semantic HTML5, the existing Project XC CSS design system, vanilla JavaScript, MathJax 3, inline SVG, JSON curriculum metadata, Python standard-library validators/build scripts, GitHub Actions, and GitHub Pages.

**Plan date:** 2026-07-13 KST

**Baseline:** `main` at `b81b4618d627cea2bd03555a183e44f198b48471`

---

## 1. Product decision and non-negotiable boundaries

### 1.1 Product decision

The Academy is not one enormous HTML document. It is a connected learning product:

1. `site/index.html` — lightweight Project XC gateway.
2. `site/quantum-chemistry.html` — complete Academy map, progress summary, tracks, and chapter routing.
3. `site/qc-*.html` — independent chapter quests.
4. Existing expert tools remain first-class destinations:
   - `site/basis-sets.html`
   - `site/mo-builder.html`
   - `site/mo-diagrams.html`
   - `site/xc-functionals.html`
   - `site/methodology.html`
5. `data/academy-curriculum.json` — machine-readable chapter graph and release status.
6. `site/assets/academy-core.js` — shared progress and safe rendering utilities.
7. Chapter-specific scripts — interactive scientific models and figures.
8. Python validation — curriculum graph, routes, source fields, and chapter contracts.

### 1.2 Scientific non-negotiables

- Every advanced claim must cite an open textbook, standards source, review, original paper, or documented code/manual.
- Mathematical symbols must be defined before use.
- Derivations must state assumptions and domains.
- Toy models must be labeled as toy/qualitative models at the point of interaction.
- A browser plot must never be presented as an ab initio result unless a real calculation produced it and provenance is preserved.
- Conceptual simplifications must be paired with a “Professor mode” caveat when the simplification fails.
- Different conventions—atomic units, Fourier transforms, spin operators, orbital phases, chemist/physicist ERIs—must be named explicitly.
- Degeneracy must not be drawn as an artificial physical splitting; visual separation requires a `same E` guide.
- Canonical orbitals must not be described as unique observables.
- Method selection must distinguish static correlation, dynamic correlation, excited-state character, relativistic effects, environment, and target property.
- No invented citations, DOI values, benchmark numbers, or program behavior.

### 1.3 Product non-goals for the initial releases

- No user account or server backend.
- No graded certification claims.
- No production quantum-chemistry calculations in the browser.
- No attempt to replace a textbook, instructor, program manual, or real electronic-structure package.
- No framework migration until the static architecture demonstrably blocks maintainability or performance.
- No duplication of the existing XC catalog, MO Builder, or Basis Quest inside new pages.

---

## 2. Audience ladder and learning contract

### 2.1 Learner modes

Each chapter must support three visible depth modes even if they share one page:

1. **Starter** — concepts, physical pictures, units, and one-variable games.
2. **Practitioner** — equations, computational choices, failure modes, and realistic examples.
3. **Professor/Research** — derivations, convention warnings, algorithms, response theory, and literature routes.

The Academy must not hide hard mathematics. Instead, it must stage the mathematics so a learner can see why each object is needed before encountering the full derivation.

### 2.2 Standard chapter contract

Every mature chapter contains:

- a one-screen purpose statement;
- prerequisites and next destinations;
- 8–12 ordered levels;
- 3–5 meaningful interactive laboratories;
- a notation table;
- at least one derivation path;
- at least one misconception card;
- at least one failure-mode or diagnostic game;
- an explicit “toy vs production” boundary;
- citations and recommended reading;
- mission completion controls;
- local progress persistence;
- keyboard-accessible controls;
- responsive and screenshot-verified figures;
- a short chapter challenge or method-choice boss;
- validation assertions for headings, levels, games, routes, and references.

### 2.3 Definition of mastery

Completion buttons indicate that a learner visited/completed an activity; they do not certify mastery. A later assessment layer may add question banks, but the initial progress system must be described as navigation/progress, not accreditation.

---

## 3. Complete curriculum graph

The ordering below is dependency-aware. “Existing” means Project XC already has a related live module that will be connected into the Academy map.

### Track A — Foundations

#### Chapter A1 — Quantum Foundations (`qc-foundations.html`)

**Status:** first vertical slice.

**Learning spine:** scale and units → state/amplitude → probability and normalization → complex phase → operators/eigenvalues → Schrödinger evolution → particle in a box → uncertainty/commutators → spin → bridge to many-electron antisymmetry.

**Mathematics:**

- normalization: `∫|ψ|² dx = 1`;
- expectation values: `⟨A⟩ = ⟨ψ|Â|ψ⟩`;
- eigenvalue equation: `Â|a⟩ = a|a⟩`;
- time-independent Schrödinger equation;
- box energies `E_n = n²π²ℏ²/(2mL²)`;
- commutator uncertainty relation;
- two-component spinor notation.

**Games:** normalization lab, phase/interference mixer, particle-in-a-box node explorer, uncertainty trade-off, spin measurement simulator.

#### Chapter A2 — Mathematical Language (`qc-math-language.html`)

Vectors, inner products, basis changes, matrices, Hermitian/unitary operators, tensor products, complex numbers, Fourier pairs, variational calculus.

**Games:** vector projection board, basis-rotation visualizer, matrix eigenvector puzzle, Fourier width duel.

#### Chapter A3 — Approximation and Variational Thinking (`qc-approximations.html`)

Perturbation theory, variational principle, basis truncation, model Hamiltonians, dimensional analysis, error decomposition.

**Games:** trial-wavefunction energy minimizer, perturbation-order budget, approximation validity map.

### Track B — Atoms, orbitals, and representations

#### Chapter B1 — Atomic Structure (`qc-atoms.html`)

Hydrogen atom, quantum numbers, radial/angular separation, nodes, degeneracy, spin-orbit preview, many-electron shells.

**Games:** quantum-number validator, radial node explorer, degeneracy map, periodic-shell builder.

#### Chapter B2 — Basis Sets and Integrals (`basis-sets.html`)

**Status:** existing 18-level live module.

Connect the existing Basis Set Quest as the formal Academy chapter for finite representations, Gaussian products, one-/two-electron integrals, screening, recurrences, and basis derivatives.

#### Chapter B3 — Molecular Orbitals and Symmetry (`mo-diagrams.html`, `mo-builder.html`)

**Status:** existing guide and interactive builder.

LCAO, bonding/antibonding, symmetry-compatible mixing, degeneracy, orbital rotations, active spaces, Hückel models, frontier orbitals.

**Future games:** H2+ secular determinant, benzene Hückel wheel, symmetry mixing gate, active-space selector.

### Track C — Mean-field electronic structure

#### Chapter C1 — Many-Electron Wavefunctions (`qc-many-electron.html`)

Indistinguishability, antisymmetry, Slater determinants, spin orbitals, Slater–Condon rules, reduced density matrices.

**Games:** determinant sign swap, spin-orbital occupancy builder, Slater–Condon selection-rule challenge.

#### Chapter C2 — Hartree–Fock and SCF (`qc-hartree-fock.html`)

Mean field, Coulomb/exchange, Fock operator, Roothaan–Hall equations, density matrix, SCF convergence, restricted/open-shell/unrestricted references, orbital invariance.

**Games:** Coulomb/exchange builder, SCF fixed-point race, damping/DIIS stabilizer, spin-contamination diagnostic.

#### Chapter C3 — Geometry, Gradients, and Frequencies (`qc-geometry.html`)

Hellmann–Feynman/Pulay terms, analytic gradients, Hessians, normal modes, optimization algorithms, transition states, IRC, zero-point energy.

**Games:** PES walker, steepest/Newton/BFGS race, normal-mode animator, saddle-point finder.

### Track D — Density-functional theory

#### Chapter D1 — Density and Kohn–Sham DFT (`qc-dft.html`)

Hohenberg–Kohn logic, Kohn–Sham construction, noninteracting kinetic energy, XC energy/potential, self-consistent density.

**Games:** density-vs-wavefunction sorter, Kohn–Sham map, density response slider.

#### Chapter D2 — Functional Families and Failures (`xc-functionals.html` plus `qc-dft-failures.html`)

**Status:** existing catalog plus planned teaching chapter.

Jacob’s ladder, LDA/GGA/meta-GGA/hybrids/range separation/double hybrids, exact exchange, dispersion, self-interaction, delocalization/static-correlation errors.

**Games:** rung ladder, exact-exchange trade-off, fractional-charge curvature, stretched-bond failure map, functional-selection boss.

### Track E — Electron correlation

#### Chapter E1 — Correlation Foundations (`qc-correlation.html`)

Correlation hole, dynamic vs static correlation, configuration interaction space, size consistency/extensivity, basis convergence.

**Games:** determinant ladder, correlation budget, dissociation failure diagnostic.

#### Chapter E2 — Perturbation and CI (`qc-mp-ci.html`)

MP2 and higher-order ideas, CIS/CID/CISD/FCI, denominators, intruders, selected CI preview.

**Games:** excitation rank builder, denominator danger gauge, CI dimension explosion.

#### Chapter E3 — Coupled Cluster (`qc-coupled-cluster.html`)

Exponential ansatz, connected terms, CCSD, perturbative triples, EOM preview, diagnostics, scaling.

**Games:** disconnected-product network, amplitude flow, method-scaling boss.

#### Chapter E4 — Multireference Methods (`qc-multireference.html`)

Active spaces, CASSCF orbital/configuration optimization, CASPT2/NEVPT2, MRCI, root/state averaging, intruder states, active-space diagnostics.

**Games:** active-space builder, orbital entanglement map, state-averaging trade-off, intruder-state alarm.

### Track F — Excited states and dynamics

#### Chapter F1 — Excited-State Methods (`qc-excited-states.html`)

CIS, TDDFT/TDA, EOM-CC, spin-flip/MRSF concepts, oscillator strength, state character, double-excitation limitations.

**Games:** transition dipole selector, method-character matching, state-tracking challenge.

#### Chapter F2 — Conical Intersections and NACs (`qc-nonadiabatic.html`)

Adiabatic/diabatic representations, avoided crossings, branching plane, derivative couplings, Berry phase, surface hopping and wavepacket preview.

**Games:** avoided-crossing slider, two-state mixing map, CI seam explorer, hop-probability lab.

#### Chapter F3 — Quantum Dynamics (`qc-dynamics.html`)

Time propagation, autocorrelation, spectra, wavepackets, Ehrenfest/surface hopping/MCTDH overview, decoherence.

**Games:** wavepacket propagator, autocorrelation spectrum, decoherence comparison.

### Track G — Environment and properties

#### Chapter G1 — Solvation and Embedding (`qc-solvation.html`)

Continuum electrostatics, cavities, PCM/COSMO/ddPCM ideas, explicit solvent, QM/MM, polarizable embedding, nonequilibrium solvation.

**Games:** Born sphere, dielectric response, cavity tessellation, QM/MM partition boss.

#### Chapter G2 — Spectroscopy (`qc-spectroscopy.html`)

IR/Raman, UV–vis, fluorescence/phosphorescence, vibronic structure, EPR, two-photon absorption.

**Games:** normal-mode spectrum, selection-rule sorter, Franck–Condon displacement, transition-moment orientation.

#### Chapter G3 — Magnetic and Response Properties (`qc-response.html`)

Perturbation response, polarizability/hyperpolarizability, NMR shielding, gauge origin/GIAO, EPR tensors, analytic response equations.

**Games:** induced-dipole response, shielding-current picture, gauge-origin comparison, response-order ladder.

### Track H — Relativity, algorithms, and professor frontier

#### Chapter H1 — Relativistic Quantum Chemistry (`qc-relativity.html`)

Scalar relativity, spin–orbit coupling, ECPs, DKH/X2C, four-component preview, picture-change effects.

**Games:** orbital contraction/expansion, spin–orbit splitting, Hamiltonian-choice boss.

#### Chapter H2 — Electronic-Structure Algorithms (`qc-algorithms.html`)

Integral-direct methods, Davidson/DIIS, sparse/local methods, density fitting/Cholesky, tensor contractions, parallelism, GPU/distributed trade-offs.

**Games:** Davidson subspace builder, screening map, tensor-contraction planner, memory/flop budget.

#### Chapter H3 — Green’s Functions and Quasiparticles (`qc-greens-functions.html`)

Propagators, poles, Dyson equation/orbitals, self-energy, GW, ADC/EKT connections, spectral functions.

**Games:** pole/spectral-weight explorer, Dyson equation block diagram, self-energy frequency map.

#### Chapter H4 — Local Correlation, F12, and Embedding (`qc-advanced-correlation.html`)

Local domains, pair natural orbitals, explicit correlation/cusp, DMET/SEET/fragment methods, error control.

**Games:** orbital-domain optimizer, PNO threshold trade-off, F12 cusp repair, fragment partition challenge.

#### Chapter H5 — Quantum Computing for Chemistry (`qc-quantum-computing.html`)

Second quantization, mappings, ansätze, VQE/QPE, measurement cost, error mitigation, realistic limitations.

**Games:** fermion-to-qubit mapper, Pauli-term grouping, VQE landscape, resource-estimation boss.

#### Chapter H6 — Research Practice and Benchmark Design (`qc-research-practice.html`)

Reproducibility, reference selection, uncertainty, root/state matching, basis/method convergence, diagnostics, provenance, negative results.

**Games:** choose-the-method campaign, diagnose-a-bad-calculation, build-a-benchmark, error-source decomposition.

---

## 4. Information architecture and route contract

### 4.1 Root-page contract

Modify `site/index.html` so the first screen includes a clear fourth card:

- label: `Quantum Chemistry Academy`;
- action: `Learn from first principles to research methods`;
- route: `quantum-chemistry.html`;
- summary: visible roadmap, games, equations, and chapter progress.

Keep the root lightweight. Do not embed chapter content there.

### 4.2 Academy gateway contract

Create `site/quantum-chemistry.html` with:

- Academy hero and explicit beginner-to-professor promise;
- “Start here,” “Continue,” and “Use existing expert tools” actions;
- track cards rendered from curriculum JSON;
- chapter status badges: `live`, `in-development`, `existing-tool`, `planned`;
- prerequisite display;
- global progress summary from local storage;
- visible explanation that progress is local and not certification;
- effort/roadmap transparency;
- links to the master plan and methodology.

### 4.3 Curriculum metadata schema

Create `data/academy-curriculum.json` containing:

```json
{
  "version": 1,
  "title": "Project XC Quantum Chemistry Academy",
  "tracks": [
    {
      "id": "foundations",
      "title": "Foundations",
      "chapters": [
        {
          "id": "qc-foundations",
          "order": 1,
          "title": "Quantum Foundations",
          "route": "qc-foundations.html",
          "status": "live",
          "level": "starter-to-professor",
          "prerequisites": [],
          "levels": 10,
          "games": 5,
          "outcomes": ["..."]
        }
      ]
    }
  ]
}
```

Validation rules:

- unique track and chapter IDs;
- unique routes;
- accepted status enum;
- prerequisite IDs must exist;
- prerequisite graph must be acyclic;
- nonnegative integer level/game counts;
- live/existing routes must exist in `site/`;
- each chapter must have outcomes;
- no duplicate ordering inside a track.

### 4.4 Shared progress contract

Create `site/assets/academy-core.js` with:

- versioned storage key `project-xc-academy-progress-v1`;
- safe JSON parsing and graceful reset;
- completion keyed by chapter ID and mission ID;
- global chapter summary;
- event dispatch after progress changes;
- safe HTML escaping for data-rendered gateway text;
- no private/user-identifying data;
- no network transmission.

Do not merge the existing Basis Quest storage immediately. Instead, show it as an existing external chapter and plan a later migration with backward compatibility.

---

## 5. Visual and interaction system

### 5.1 Preserve the Project XC stance

- Fraunces display headings.
- Inter/system UI text.
- Scientific-cockpit cards and high-signal summaries.
- Blue/violet/orange accents with semantic green/danger states.
- Warm callouts for caveats.
- Avoid decorative gradients that obscure formulas or plots.

### 5.2 New Academy components

Add reusable CSS classes to `site/assets/styles.css`:

- `.academy-page`
- `.academy-hero`
- `.academy-hud`
- `.academy-track-grid`
- `.academy-track`
- `.chapter-grid`
- `.chapter-card`
- `.chapter-status`
- `.chapter-status.live|existing|building|planned`
- `.prerequisite-list`
- `.depth-switcher`
- `.professor-note`
- `.misconception-card`
- `.chapter-progress`
- `.academy-plot`
- `.equation-roadmap`

Requirements:

- readable at 320 px width;
- no horizontal page scroll;
- equations may scroll inside their formula container;
- direct plot SVG selectors only, never broad nested SVG rules that stretch MathJax;
- status must not rely on color alone;
- hover states have equivalent keyboard focus states;
- `prefers-reduced-motion` disables nonessential animation;
- buttons and range controls have accessible names.

### 5.3 Visual figure contract

Every scientific figure must have:

- `role="img"` and a meaningful accessible label;
- axes/units when numeric;
- legend or direct labels;
- caption stating what is exact, approximate, schematic, or qualitative;
- no clipped text at desktop or mobile widths;
- screenshot QA.

---

## 6. Source and provenance policy

### 6.1 Evidence tiers

1. Standards and authoritative data: NIST, IUPAC, CODATA.
2. Open course/textbook: MIT OCW, OpenStax, LibreTexts with stable page links.
3. Original papers for methods and algorithms.
4. Review papers for field-level framing.
5. Official program/library documentation for implementation behavior.

### 6.2 Chapter source ledger

Each chapter should eventually have `docs/academy/sources/<chapter-id>.md` recording:

- claim/topic;
- source title;
- URL/DOI;
- access date;
- source role;
- license/access note when relevant;
- caveat or convention used;
- which level/game consumes the source.

### 6.3 Citation display

- Put short citations near advanced claims when needed.
- Put the complete source table at the chapter end.
- Never use a citation as a substitute for explaining a concept.
- Avoid copied textbook prose; synthesize and cite.

---

## 7. Validation, testing, and release gates

### 7.1 Static checks

Required for every chapter change:

```bash
node --check site/assets/academy-core.js
node --check site/assets/<chapter>.js
python3 -m py_compile scripts/*.py
python3 scripts/validate_data.py
python3 scripts/validate_academy.py
python3 scripts/build_site.py
git diff --check
```

### 7.2 Curriculum graph tests

`validate_academy.py` must verify:

- JSON syntax/schema contract;
- route existence;
- ID uniqueness;
- valid status values;
- prerequisite existence and no cycles;
- counts and outcomes;
- homepage Academy route;
- gateway script/style references;
- live chapter mission counts match metadata.

### 7.3 Browser interaction tests

For every live chapter:

- all plot containers contain SVG after initialization;
- all controls update visible readouts;
- every mission can be completed and uncompleted/reset;
- local storage survives reload;
- malformed local storage fails safely;
- chapter navigation reaches each level;
- gateway progress updates;
- no console errors;
- external links use `noopener` when opened in a new tab.

### 7.4 Scientific sanity tests

Examples for Quantum Foundations:

- normalized density integrates to approximately one in the numerical grid;
- box energy scales as `n²/L²`;
- number of interior nodes is `n - 1`;
- global phase does not alter probability density;
- relative phase changes interference;
- Gaussian position/momentum width product respects the stated convention;
- spin probabilities sum to one.

Tests must compare formulas numerically where possible, not only assert that text exists.

### 7.5 Accessibility and performance gates

- semantic heading order;
- keyboard operation of buttons/selects/ranges;
- visible focus;
- sufficient text contrast;
- `aria-live` for changing game results where useful;
- no unlabeled form controls;
- no mobile clipping;
- gateway initial content remains useful before JavaScript completes;
- no chapter should become a single giant blocking page after MathJax rendering;
- split chapters before performance degrades rather than adding framework complexity.

### 7.6 Deployment gate

After push:

1. Verify local and remote SHA.
2. Watch `Validate Project XC data`.
3. Watch `Deploy Project XC site`.
4. HTTP-read back:
   - `/`
   - `/quantum-chemistry.html`
   - `/qc-foundations.html`
   - new JS/CSS/data assets.
5. Browser-open live gateway and chapter with a cache-busting query.
6. Run live interaction and console checks.
7. Report exact commit and workflow URLs.

---

## 8. Milestone roadmap

### Milestone 0 — Governance and master plan

**Deliverables:**

- this master plan;
- baseline commit recorded;
- curriculum and route architecture fixed;
- non-goals and release gates explicit.

**Exit gate:** plan exists in the repository and names exact files/commands.

### Milestone 1 — Academy launch foundation

**Files:**

- Create: `data/academy-curriculum.json`
- Create: `scripts/validate_academy.py`
- Create: `site/quantum-chemistry.html`
- Create: `site/assets/academy-core.js`
- Create: `site/assets/academy-gateway.js`
- Modify: `site/index.html`
- Modify: `site/assets/styles.css`
- Modify: `scripts/build_site.py`
- Modify: `.github/workflows/validate.yml`
- Modify: `README.md`

**Acceptance:** homepage card routes correctly, gateway renders curriculum/status/prerequisites, validation catches broken routes, and global progress initializes without errors.

### Milestone 2 — Quantum Foundations vertical slice

**Files:**

- Create: `site/qc-foundations.html`
- Create: `site/assets/qc-foundations.js`
- Create: `docs/academy/sources/qc-foundations.md`
- Update: `data/academy-curriculum.json`
- Update: `scripts/validate_academy.py`

**Chapter levels:**

1. Scale, constants, and atomic units.
2. State vectors and amplitudes.
3. Probability density and normalization.
4. Complex phase and interference.
5. Operators, observables, and eigenvalues.
6. Schrödinger equation and stationary states.
7. Particle in a box.
8. Uncertainty and conjugate variables.
9. Spin-1/2 measurement.
10. Indistinguishability and bridge to antisymmetry.

**Interactive laboratories:**

- normalization lab;
- phase/interference mixer;
- particle-in-a-box explorer;
- Gaussian uncertainty trade-off;
- spin measurement simulator.

**Acceptance:** 10 levels, 5 games, equations/sources/caveats, numeric sanity checks, responsive visual QA, and live deployment.

### Milestone 3 — Reuse existing expert modules

- Register Basis Quest as the Basis/Integrals chapter.
- Register MO guide/builder as the MO chapter/tool.
- Register XC catalog as the DFT functional reference tool.
- Add Academy backlinks to those pages.
- Define backward-compatible progress bridging without erasing existing Basis badges.

### Milestone 4 — Core quartet

Deliver the first coherent sequence:

1. Quantum Foundations.
2. Mathematical Language.
3. Atoms/Basis/MO.
4. Hartree–Fock and SCF.

**Exit gate:** a learner can progress from amplitude/probability to an SCF orbital picture without an unexplained conceptual jump.

### Milestone 5 — DFT and correlation core

Deliver:

- Kohn–Sham DFT;
- functional families/failures;
- correlation foundations;
- MP/CI;
- coupled cluster;
- multireference methods.

### Milestone 6 — Structures, excited states, and environments

Deliver:

- gradients/frequencies;
- excited-state methods;
- nonadiabatic chemistry;
- dynamics;
- solvation/embedding;
- spectroscopy/properties.

### Milestone 7 — Professor frontier

Deliver:

- relativistic chemistry;
- response theory;
- algorithms/HPC;
- Green’s functions;
- local/F12/embedding;
- quantum computing;
- research practice and benchmark design.

### Milestone 8 — Publication-quality Academy release

- full cross-chapter notation audit;
- source-ledger audit;
- accessibility/performance audit;
- external scientific review;
- versioned release notes;
- optional archival DOI/citation guide;
- public contribution templates for chapter corrections.

---

## 9. Immediate execution backlog: Milestones 0–2

Each item is deliberately small and verifiable.

### Task 0.1 — Record baseline

Run:

```bash
git status --short --branch
git rev-parse HEAD
```

Expected: clean `main`, SHA `b81b461...` before Academy edits.

### Task 0.2 — Save master plan

Create:

`docs/plans/2026-07-13-quantum-chemistry-academy-master-plan.md`

Verify the file contains Goal, Architecture, curriculum graph, release gates, and exact paths.

### Task 1.1 — Add failing Academy route assertions

Create `scripts/validate_academy.py` first with checks that fail because the data/gateway/chapter do not yet exist.

Run:

```bash
python3 scripts/validate_academy.py
```

Expected initial result: FAIL with explicit missing-file errors.

### Task 1.2 — Create curriculum metadata

Create `data/academy-curriculum.json` with all planned chapters, existing tools, statuses, prerequisites, outcomes, and routes.

Run validator; route checks should still fail for the not-yet-created live gateway/chapter.

### Task 1.3 — Create shared Academy core

Create `site/assets/academy-core.js` with safe storage, progress, escaping, status labels, and event helpers.

Run:

```bash
node --check site/assets/academy-core.js
```

Expected: no output, exit 0.

### Task 1.4 — Create gateway renderer

Create `site/assets/academy-gateway.js` to fetch curriculum metadata and render tracks/cards without unsafe HTML injection.

Run syntax check.

### Task 1.5 — Create Academy gateway HTML

Create `site/quantum-chemistry.html` with semantic fallback content, loading/error states, curriculum container, progress explanation, roadmap, and source/methodology links.

### Task 1.6 — Add homepage card

Modify `site/index.html`:

- update top-line and hero language from three decisions to a broader Project XC learning/research cockpit;
- add the Academy card;
- keep existing three cards and routes intact.

### Task 1.7 — Add Academy CSS

Modify `site/assets/styles.css` with Academy components, four-card responsive behavior, reduced-motion handling, and mobile gates.

### Task 1.8 — Integrate build/CI

Modify:

- `scripts/build_site.py` to run `validate_academy.py`;
- `.github/workflows/validate.yml` to run Academy validation explicitly.

### Task 1.9 — Update README

Add Academy gateway and master-plan links; retain caveats.

### Task 1.10 — Make Milestone 1 green

Run all static checks, build, and internal-link checks.

### Task 2.1 — Verify foundational sources

Create `docs/academy/sources/qc-foundations.md`. Verify URLs for NIST/CODATA, OpenStax quantum chapters, MIT OCW quantum chemistry material, and other selected open references.

### Task 2.2 — Create chapter HTML contract

Create `site/qc-foundations.html` with 10 levels, five lab containers, mission buttons, notation, misconception cards, Professor mode, and sources.

### Task 2.3 — Implement shared chapter progress

Use `academy-core.js`; do not create a second incompatible progress store.

### Task 2.4 — Implement normalization lab

Numerically normalize a selectable one-dimensional trial state and show density/area/readout.

Test known cases and malformed inputs.

### Task 2.5 — Implement phase/interference lab

Show global-phase invariance and relative-phase interference as separate modes.

### Task 2.6 — Implement particle-in-a-box lab

Render `ψ_n`, `|ψ_n|²`, energy scaling, and exactly `n-1` interior nodes.

### Task 2.7 — Implement uncertainty lab

Use one declared Gaussian/Fourier convention and display the resulting width product without mixing standard-deviation conventions.

### Task 2.8 — Implement spin lab

Normalize a two-component state and show measurement probabilities that sum to one.

### Task 2.9 — Add numeric sanity assertions

Extend `validate_academy.py` or add a deterministic Node/Python test script for formulas used in the games.

### Task 2.10 — Browser QA

Check navigation, all controls, storage, reload, malformed storage, SVG presence, console, and screenshots.

### Task 2.11 — Commit/deploy/read back

Commit coherent Academy foundation changes, push `main`, monitor both workflows, and verify live URLs/assets.

---

## 10. Effort model and scheduling

The current Project XC shell, design system, build, and interactive patterns reduce startup cost, but scientific review remains the controlling cost.

| Scope | Approximate content | Estimated focused work |
|---|---:|---:|
| Gateway + first reusable chapter | 10 lessons, 4–5 games | ~80 hours |
| MVP Academy | 32 lessons, ~12 games | ~194 hours |
| Serious full course | 84 lessons, ~35 games | ~630 hours |
| Professor-level interactive textbook | 176 lessons, ~77 games | ~1,585 hours |

At 40 focused hours/week these correspond to about 2, 5, 16, and 40 weeks. Calendar time will be longer when scientific review, feedback, and revision are included.

Release by coherent vertical slices rather than waiting for the entire Academy. Every live slice must be scientifically honest and fully verified.

---

## 11. Risk register and mitigations

### Risk: one page becomes too large

**Mitigation:** independent chapter routes; split before performance degrades.

### Risk: attractive toy models imply quantitative prediction

**Mitigation:** point-of-use caveats, exact/approximate labels, source tables, production boundaries.

### Risk: inconsistent notation across chapters

**Mitigation:** shared notation guide and cross-chapter audit before each major release.

### Risk: local progress schema changes break users

**Mitigation:** version storage keys, migrations, and no silent deletion.

### Risk: MathJax SVG is stretched by CSS

**Mitigation:** direct-child plot SVG selectors only; visual QA on live pages.

### Risk: scientific content scales faster than review capacity

**Mitigation:** chapter source ledgers, explicit status badges, no `live` status before review gates.

### Risk: curriculum becomes a list without pedagogical continuity

**Mitigation:** prerequisites, learning outcomes, “why next” links, and end-to-end learner-path review.

### Risk: homepage becomes crowded

**Mitigation:** concise four-card gateway; no chapter content on root.

### Risk: duplicated code across chapter games

**Mitigation:** extract only proven shared utilities into `academy-core.js`; avoid premature framework creation.

### Risk: broken planned links

**Mitigation:** planned chapters render as non-link cards until routes are live; validator requires routes only for live/existing status.

---

## 12. Chapter review checklist

Before any chapter changes from `in-development` to `live`:

- [ ] Prerequisites are explicit.
- [ ] Learning outcomes are testable.
- [ ] Symbols/units/conventions are defined.
- [ ] Equations render and are scientifically reviewed.
- [ ] At least three meaningful interactions work.
- [ ] Every visual has a caption and accessible label.
- [ ] Toy/exact/production boundary is visible.
- [ ] Misconceptions and failure modes are included.
- [ ] Sources are verified and recorded.
- [ ] Numeric model sanity checks pass.
- [ ] Mission/progress state works and survives reload.
- [ ] Keyboard/mobile/reduced-motion behavior passes.
- [ ] Browser console is clean.
- [ ] Internal links pass.
- [ ] GitHub Actions pass.
- [ ] Live readback and interaction checks pass.

---

## 13. Current execution status

- [x] Baseline inspected and clean at `b81b461`.
- [x] Master architecture decided.
- [x] Comprehensive curriculum and release gates written.
- [x] Academy validator created RED-first, observed failing, then made green.
- [x] Curriculum JSON created with 8 tracks and 27 dependency-connected chapters.
- [x] Homepage Academy card created.
- [x] Academy gateway created.
- [x] Shared progress core created.
- [x] Quantum Foundations chapter created with 10 levels and 5 interactive laboratories.
- [x] Deterministic scientific model tests created; 108 assertions pass locally.
- [x] Local/browser/scientific QA completed, including desktop rendering, 390 px CDP emulation, accessibility semantics, 85 local-link checks, and progress persistence/reset recovery.
- [ ] GitHub Pages launch verified.

This status block must be updated as milestones are completed; do not use memory entries as a substitute for repository state.
