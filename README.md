# Project XC

A small static site with two tools:

- XC Functional catalog: formulas, exact-exchange amounts, aliases, Libxc records, and citations.
- MO Diagrams: browser-only qualitative MO diagram builder from XYZ geometry, with degeneracy and MO-shape visualization.

Live site: https://alireza-lashkaripour.github.io/project-xc/

Direct pages:

- XC Functional: https://alireza-lashkaripour.github.io/project-xc/xc-functionals.html
- MO Diagrams: https://alireza-lashkaripour.github.io/project-xc/mo-builder.html
- MO theory guide: https://alireza-lashkaripour.github.io/project-xc/mo-diagrams.html

Local checks:

```bash
python3 scripts/validate_data.py
python3 scripts/build_site.py
```

Caveat: the MO builder is a qualitative Hückel/toy-LCAO teaching prefilter, not an ab initio orbital calculation.
