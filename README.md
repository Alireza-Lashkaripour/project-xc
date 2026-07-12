# Project XC

A small static teaching/research site with three entry points:

- XC Functional catalog: formulas, exact-exchange amounts, aliases, Libxc records, and citations.
- MO Diagrams: browser-only qualitative MO diagram builder from XYZ geometry, with degeneracy and MO-shape visualization.
- Basis Sets: step-by-step PhD-level basis-set academy with math, figures, mini-games, and links to Basis Set Exchange.

Live site: https://alireza-lashkaripour.github.io/project-xc/

Direct pages:

- XC Functional: https://alireza-lashkaripour.github.io/project-xc/xc-functionals.html
- MO Diagrams: https://alireza-lashkaripour.github.io/project-xc/mo-builder.html
- Basis Sets: https://alireza-lashkaripour.github.io/project-xc/basis-sets.html
- MO theory guide: https://alireza-lashkaripour.github.io/project-xc/mo-diagrams.html

Local checks:

```bash
python3 scripts/validate_data.py
python3 scripts/build_site.py
```

Caveat: the MO builder and basis-set lab are qualitative teaching tools; use real quantum-chemistry calculations and Basis Set Exchange data for production work.
