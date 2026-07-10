# Experiment: initial Libxc import

## Question

Can Project XC seed a broad XC catalog from the public Libxc functionals documentation?

## Method

A Python standard-library importer fetched `https://libxc.gitlab.io/functionals/` and parsed family headings, section headings, Libxc code names, Libxc IDs, descriptions, and DOI references.

## Result

- Parsed entries: 678
- Entries with at least one reference: 666
- Total reference links: 782

Family counts:

```json
{
  "LDA functionals": 71,
  "hybrid LDA functionals": 4,
  "GGA functionals": 258,
  "hybrid GGA functionals": 113,
  "meta-GGA functionals": 181,
  "hybrid meta-GGA functionals": 51
}
```

## Verdict

The import is good enough for the discovery layer. It still needs human/agent curation for aliases, program-specific meanings, mathematical parameter details, and verified citation roles.
