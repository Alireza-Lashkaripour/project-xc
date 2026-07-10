# Data model

Project XC uses layered JSON.

## Imported Libxc snapshot

`data/libxc_snapshot.json` records:

- `libxc_code`
- `libxc_id`
- `description`
- `family`
- `section`
- `rung`
- `kind`
- `references`
- `source_url`
- `curation_status`

This layer is broad and machine-imported.

## Curated functional records

`data/functionals.seed.json` records:

- `slug`: stable URL key
- `canonical_name`
- `aliases`
- `summary`
- `family`, `rung`, `kind`
- `ingredients`
- `libxc.primary_code` and `libxc.components`
- `parameters`
- `references`
- `program_aliases`
- `notes`
- `curation_status`

## Program aliases

`data/program_aliases.json` links program names to canonical records. Alias entries must include a status and caveat. Future versions should add evidence links to program documentation/source/test logs.
