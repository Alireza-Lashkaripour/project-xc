# Project XC multi-agent harness

This document is the operating workflow for scaling Project XC with multiple agents while preserving scientific provenance.

## Agent lanes

### 1. Source-discovery agent

Finds authoritative data sources:

- Libxc functionals page/source.
- Program manuals for Gaussian, GAMESS-US, ORCA, PySCF, Psi4, Q-Chem, NWChem, OpenQP.
- Review papers and original functional papers.

Outputs:

- source URL,
- access date,
- license note,
- candidate records,
- risk/caveat list.

Gate:

- No source enters curated data without license/provenance note.

### 2. Importer agent

Writes or updates import scripts.

Inputs:

- source-discovery report,
- target JSON schema,
- existing importer tests.

Outputs:

- importer code,
- raw/imported snapshot,
- import summary,
- parser caveats.

Gate:

- importer must be deterministic,
- duplicate IDs/codes rejected,
- DOI shape checked,
- raw source URL and import timestamp stored.

### 3. Functional-curation agent

Turns imported records into curated scientific records.

For each functional:

- canonical name,
- aliases,
- rung/kind,
- ingredients,
- exact-exchange/range-separation/dispersion parameters,
- references,
- notes and known ambiguities.

Gate:

- curation status cannot be `verified` until reviewed by reference and implementation agents.

### 4. Reference-verification agent

Checks every DOI and citation.

Outputs:

- DOI status,
- BibTeX if available,
- original-paper role,
- missing-reference TODOs.

Gate:

- no invented DOI,
- no inferred citation without source,
- ambiguous references marked explicitly.

### 5. Program-alias agent

Maps functional names across programs.

Evidence hierarchy:

1. official manual,
2. source code,
3. test input/output,
4. community documentation.

Outputs:

- alias table entry,
- program version,
- evidence link/path,
- caveat.

Gate:

- aliases stay `needs-program-doc-verification` until evidence is attached.

### 6. Formula/parameter agent

Extracts mathematical ingredients and scalar parameters.

Examples:

- B3LYP exact exchange fraction,
- CAM-B3LYP short/long-range fractions,
- omega values,
- VV10/nonlocal switches,
- D3/D4 correction status.

Gate:

- formula claims must cite a paper or verified source implementation.

### 7. Site-build agent

Maintains static website UX.

Responsibilities:

- search,
- filters,
- compare tray,
- detail pages,
- accessibility,
- responsive layout.

Gate:

- website must build from data only,
- no manual catalog cards,
- JS errors checked in browser/console when practical.

### 8. QA/integration reviewer

Runs final checks:

```bash
python3 scripts/validate_data.py
python3 scripts/build_site.py
python3 -m http.server 8000 -d public
```

Gate:

- validation OK,
- build OK,
- sample detail pages load,
- git diff reviewed.

## Phase plan

### Phase A — Bootstrap

- Create repo.
- Import Libxc catalog.
- Seed major functionals.
- Build website.
- Add CI/Pages.

### Phase B — Coverage expansion

- Divide Libxc records by rung/family.
- One curation agent per family.
- Reference verifier audits every DOI.
- Alias agent adds program names.

### Phase C — Program reproducibility

- Add small input examples per program.
- Record actual output names/IDs where possible.
- Store versioned evidence in `docs/provenance/programs/`.

### Phase D — Formula/parameter depth

- Add machine-readable parameter fields.
- Add formula summary cards.
- Add warnings for variants.

### Phase E — Publication-quality release

- Tag release.
- Archive Zenodo DOI if desired.
- Add citation guide.
- Add contribution governance.

## Revision gates

Every PR/change must answer:

1. What data changed?
2. What source supports it?
3. What ambiguity remains?
4. What validation ran?
5. Which agent/human reviewed it?

## Abort gates

Stop and ask before:

- relicensing imported data,
- marking broad families as verified without review,
- deleting provenance,
- replacing source-derived data by guessed values,
- changing repo visibility or GitHub Pages deployment model.

## Machine-readable harness artifacts

- `harness/agents/*.md`: prompt packs for each agent lane.
- `harness/queues/bootstrap-tasks.json`: current curation/validation task queue.
- `harness/reviews/`: destination for review outputs.
- `scripts/harness_status.py`: queue validation and status summary.
