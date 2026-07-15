# Project XC

A static, source-grounded teaching/research site with four connected entry points:

- Quantum Chemistry Academy: dependency-aware learning from first amplitudes through professor-level methods, with equations, games, visual laboratories, caveats, and browser-local progress.
- XC Functional catalog: formulas, exact-exchange amounts, aliases, Libxc records, and citations.
- MO Diagrams: browser-only qualitative MO diagram builder from XYZ geometry, with degeneracy and MO-shape visualization.
- Basis Sets: quest-style PhD-level basis-set academy with math, figures, interactive plots, mini-games, and links to Basis Set Exchange.

Live site: https://alireza-lashkaripour.github.io/project-xc/

Direct pages:

- Academy gateway: https://alireza-lashkaripour.github.io/project-xc/quantum-chemistry.html
- Quantum Foundations: https://alireza-lashkaripour.github.io/project-xc/qc-foundations.html
- Mathematical Language: https://alireza-lashkaripour.github.io/project-xc/qc-math-language.html
- Approximation and Variational Thinking: https://alireza-lashkaripour.github.io/project-xc/qc-approximations.html
- Atomic Structure: https://alireza-lashkaripour.github.io/project-xc/qc-atoms.html
- XC Functional: https://alireza-lashkaripour.github.io/project-xc/xc-functionals.html
- MO Diagrams: https://alireza-lashkaripour.github.io/project-xc/mo-builder.html
- Basis Sets: https://alireza-lashkaripour.github.io/project-xc/basis-sets.html
- MO theory guide: https://alireza-lashkaripour.github.io/project-xc/mo-diagrams.html

Local checks:

```bash
python3 scripts/validate_data.py
python3 scripts/validate_academy.py
python3 scripts/test_academy_validator.py
node scripts/test_academy_models.js
node scripts/test_qc_math_models.js
node scripts/test_qc_atomic_models.js
node scripts/test_qc_atomic_interactions.js
node scripts/test_qc_approximation_models.js
node scripts/test_qc_approximation_interactions.js
node scripts/test_academy_core.js
node scripts/test_basis_progress.js
python3 scripts/build_site.py
python3 scripts/check_site_links.py
```

Caveat: Academy games, the MO builder, and the basis-set laboratory are teaching tools with explicit model boundaries. Use real quantum-chemistry calculations, program documentation, source data, and validated references for production work.

Academy implementation roadmap:

- `docs/plans/2026-07-13-quantum-chemistry-academy-master-plan.md`
- `docs/academy/sources/qc-foundations.md`
- `docs/academy/sources/qc-math-language.md`
- `docs/plans/2026-07-14-atomic-structure-chapter-plan.md`
- `docs/academy/sources/qc-atoms.md`
- `docs/plans/2026-07-15-approximation-variational-thinking-chapter-plan.md`
- `docs/academy/sources/qc-approximations.md`

- Unified visual system: elegant scientific cockpit presentation with stronger typography, first-screen module summaries, and polished cards across all pages.
- Advanced Integrals: Basis Set Quest now includes Gaussian product theorem, one-electron integrals, Boys functions, ERI tensor scaling/screening, recurrence algorithms, and derivative/gradient games.
- Progress compatibility: the Academy gateway reads existing Basis Quest badges through a read-only bridge; resetting Academy chapter progress never deletes those badges.
