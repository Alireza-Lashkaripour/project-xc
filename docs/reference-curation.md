# Reference curation protocol

## Reference classes

1. Original functional paper.
2. Parameterization or variant paper.
3. Program implementation documentation.
4. Source-code evidence.
5. Reproducible input/output evidence.

## DOI handling

- Store DOI as raw DOI, e.g. `10.1103/PhysRevLett.77.3865`.
- Store URL as `https://doi.org/<doi>`.
- Do not invent missing DOIs.
- If a reference is imported from Libxc, mark it as imported until checked.

## Alias handling

Aliases are dangerous. For example, `B3LYP` may not mean the same VWN convention everywhere. The alias table must state whether the alias is imported, documentation-verified, source-verified, or test-verified.
