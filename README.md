# CysVis MVP

Phase 1 through Phase 3 prototype for the KEAP1 cysteine and ClinVar viewer described in `CysVis-spec.md`.

## What it does

- Loads the KEAP1 AlphaFold monomer in 3Dmol.js
- Colors the cartoon by KEAP1 domain
- Highlights the 27 curated cysteines with functional-class colors
- Lets you click cysteines to inspect their annotations
- Fetches ClinVar-derived KEAP1 variants from MyVariant.info
- Groups variants by residue, colors them by clinical significance, and flags cysteine overlaps
- Includes domain and layer toggles for cysteines, variants, and surface rendering
- Supports arbitrary UniProt accessions through a generic AlphaFold loading path
- Auto-detects cysteines for non-KEAP1 proteins and adds PNG export

## Run locally

Serve the folder with any static file server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Automated tests

Run the Playwright smoke suite with:

```bash
npm test
```

## Notes

- The Phase 1 dataset is hardcoded for KEAP1 (`Q14145`)
- The viewer fetches the AlphaFold structure client-side from EBI
- ClinVar variants are fetched client-side from MyVariant.info
- Only KEAP1 currently has curated domain boundaries and cysteine annotations; other proteins use a generic single-domain view with auto-detected cysteines
- The Playwright setup in this repo uses a vendored ALSA runtime in `.vendor/` so tests can run in this environment without extra system package installation
