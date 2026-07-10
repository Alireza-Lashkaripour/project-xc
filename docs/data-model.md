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


## Formula object

Project XC stores formula data for every displayed record. Curated seed records may include concrete decompositions and exact-exchange amounts; imported Libxc records get generic templates with explicit uncertainty labels. This prevents the site from silently inventing coefficients while still giving every functional a visible scientific definition panel.

Required fields include `schema_version`, `status`, `template_id`, `plain`, `latex`, `variables`, `terms`, and `amounts`. The `amounts` object must include exact exchange, short/long-range exact exchange, range-separation omega, channel presence, and other/external terms.

## Alias object

Imported Libxc records may include an `aliases` array. These aliases are generated search/display metadata from Libxc codes, descriptions, omega/w typography variants, delimiter variants, and a maintained common-name map. Alias entries do not imply that the formula has been fully curated; the formula status still controls scientific confidence. Searches normalize punctuation, underscores, hyphens, slashes, and `ω`/`w`/`omega` spellings, and typed queries search all records even when the blank catalog view defaults to curated records.
