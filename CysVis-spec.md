# CysVis: Cysteine Residue & Variant Visualizer

## Spec for Coding Agent (Claude Code)

---

## 1. Overview

Build a single-page web application that displays a 3D protein structure with two data layers overlaid:

1. **Cysteine residues** — highlighted and annotated with known reactivity/functional data
2. **Human genetic variants** — from ClinVar, colored by clinical significance (pathogenic, VUS, benign)

The prototype uses **KEAP1** (UniProt: Q14145) as the default protein. The app should be generalizable to any protein by UniProt ID, but KEAP1 is the hardcoded demo case.

**Target audience**: Ben Cravatt's lab / chemoproteomics researchers. The UI should be clean, functional, and science-forward — not flashy.

---

## 2. Architecture

### Stack
- **Frontend**: Single HTML file (or minimal React app) — keep it simple
- **3D Viewer**: [3Dmol.js](https://3dmol.csb.pitt.edu/) via CDN (`https://3Dmol.org/build/3Dmol-min.js`)
- **Data fetching**: Client-side fetch calls to public APIs (no backend needed for prototype)
- **Styling**: Minimal CSS, no framework required. Dark background for the viewer, light sidebar.

### Why 3Dmol.js (not Mol*)
- Simpler API, easier to embed
- Direct PDB download support (`$3Dmol.download`)
- Lightweight, single script include
- Good enough for a prototype; Mol* is overkill here

---

## 3. Data Sources & API Calls

### 3.1 Protein Structure

**Primary: AlphaFold** (full-length structure, important because KEAP1 has no full-length experimental structure)

```
GET https://alphafold.ebi.ac.uk/api/prediction/Q14145
```

Returns JSON with `pdbUrl` and `cifUrl` fields. Download the PDB file:

```
GET https://alphafold.ebi.ac.uk/files/AF-Q14145-F1-model_v4.pdb
```

**Fallback: RCSB PDB** (partial structures)
- BTB domain: `4CXI`
- Kelch domain: `2FLU`, `5WFV`

For the prototype, **use the AlphaFold full-length model** since no single PDB entry covers the complete protein (especially the IVR domain where the critical C273/C288 residues live).

### 3.2 Cysteine Residue Data

KEAP1 has **27 cysteine residues** in the human protein (624 aa total). Hardcode these for the prototype.

Important design note: the app should **not** use a single mutually exclusive cysteine class such as `sensor` / `reactive` / `structural` / `unknown` as its general ontology. That KEAP1-specific language is biologically meaningful for KEAP1, but it does not generalize across arbitrary proteins.

Instead, model cysteine annotations as **independent layers** that can coexist on the same residue. A cysteine may be:
- `hyperreactive`
- `ligandable`
- `redox_modified`
- `catalytic`
- `disulfide`
- `metal_binding`
- `uncharacterized`

These are not mutually exclusive. For example, a cysteine can be both `hyperreactive` and `ligandable`, or both `metal_binding` and `redox_modified`.

For KEAP1 specifically, retain protein-specific mechanistic notes such as "electrophile sensor cysteine" as a **notes field**, not as the global ontology.

Suggested prototype data shape:

```javascript
const KEAP1_CYSTEINES = [
  // NTR domain (1-49)
  { resi: 14, domain: "NTR", annotations: ["uncharacterized"] },
  { resi: 23, domain: "NTR", annotations: ["uncharacterized"] },
  { resi: 38, domain: "NTR", annotations: ["uncharacterized"] },

  // BTB domain (50-179) — homodimerization & CUL3 binding
  { resi: 77,  domain: "BTB", annotations: ["uncharacterized"],
    notes: "Potentially structurally important; retain any KEAP1-specific interpretation in notes rather than a global class." },
  { resi: 151, domain: "BTB", annotations: ["uncharacterized"],
    notes: "Primary KEAP1 electrophile sensor. Surrounded by basic residues (H129, K131, R135, K150, H154) that lower its pKa. Required for NRF2 stabilization by sulforaphane and oxidative stress. Most reactive cysteine in KEAP1." },
  { resi: 171, domain: "BTB", annotations: ["uncharacterized"] },

  // IVR domain (180-314) — contains critical KEAP1 sensor cysteines
  { resi: 196, domain: "IVR", annotations: ["uncharacterized"] },
  { resi: 226, domain: "IVR", annotations: ["uncharacterized"],
    notes: "Labeled by thiol-reactive reagents in vitro." },
  { resi: 241, domain: "IVR", annotations: ["uncharacterized"] },
  { resi: 249, domain: "IVR", annotations: ["uncharacterized"] },
  { resi: 257, domain: "IVR", annotations: ["uncharacterized"],
    notes: "Preferred site of thiol labeling in vitro." },
  { resi: 273, domain: "IVR", annotations: ["uncharacterized"],
    notes: "Critical KEAP1 sensor cysteine for KEAP1-dependent ubiquitination of NRF2. Required for basal repression. May participate in zinc binding or direct ubiquitin transfer. Adjacent to R272, H274." },
  { resi: 288, domain: "IVR", annotations: ["uncharacterized"],
    notes: "Critical KEAP1 sensor cysteine that works with C273 for basal NRF2 repression. Adjacent to K287." },
  { resi: 297, domain: "IVR", annotations: ["uncharacterized"],
    notes: "Preferred site of thiol labeling in vitro." },

  // Kelch domain (315-598) — NRF2 binding (6-blade β-propeller)
  { resi: 319, domain: "Kelch", annotations: ["uncharacterized"] },
  { resi: 368, domain: "Kelch", annotations: ["uncharacterized"] },
  { resi: 395, domain: "Kelch", annotations: ["uncharacterized"] },
  { resi: 406, domain: "Kelch", annotations: ["uncharacterized"] },
  { resi: 434, domain: "Kelch", annotations: ["uncharacterized"] },
  { resi: 489, domain: "Kelch", annotations: ["uncharacterized"] },
  { resi: 513, domain: "Kelch", annotations: ["uncharacterized"] },
  { resi: 518, domain: "Kelch", annotations: ["uncharacterized"] },
  { resi: 583, domain: "Kelch", annotations: ["uncharacterized"] },

  // CTR domain (599-624)
  { resi: 613, domain: "CTR", annotations: ["uncharacterized"] },
  { resi: 622, domain: "CTR", annotations: ["uncharacterized"] },
  { resi: 624, domain: "CTR", annotations: ["uncharacterized"] },
];
```

For the prototype, visualize **one cysteine annotation layer at a time** rather than collapsing everything into one class.

Suggested general-purpose layers:
- `hyperreactive` — from chemoproteomic intrinsic reactivity measurements such as isoTOP-ABPP ratios
- `ligandable` — engaged by electrophilic fragments in competitive chemoproteomic screens
- `redox_modified` — known oxidative PTMs such as sulfenylation, sulfinylation, glutathionylation, or nitrosylation
- `catalytic` — active-site or mechanistically essential cysteine from UniProt annotation
- `disulfide` — annotated disulfide-bond cysteine
- `metal_binding` — annotated metal-coordinating cysteine
- `uncharacterized` — cysteine detected or present in sequence with no additional annotation

KEAP1-specific sensor biology should appear in:
- `notes`
- detail panel callouts
- optional protein-specific overlays

but **not** as the general cysteine ontology.

### 3.3 Human Genetic Variants (ClinVar)

Use the NCBI E-utilities to fetch ClinVar variants for KEAP1:

```
# Step 1: Search for all ClinVar variants in KEAP1
GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar&term=KEAP1[gene]&retmax=500&retmode=json

# Step 2: Get summaries for the returned IDs
GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&id=<comma-separated-ids>&retmode=json
```

**Alternative (simpler, recommended for prototype)**: Use MyVariant.info which aggregates ClinVar data with a cleaner API:

```
GET https://myvariant.info/v1/query?q=clinvar.gene.symbol:KEAP1&fields=clinvar&size=500
```

**Parse out:**
- Amino acid position (from HGVS protein notation)
- Clinical significance: Pathogenic, Likely pathogenic, VUS, Likely benign, Benign
- Condition/disease association
- Variant type (missense, nonsense, frameshift, etc.)

**Variant color scheme:**
- Pathogenic / Likely pathogenic → **red** sphere
- VUS → **yellow** sphere
- Benign / Likely benign → **green** sphere

### 3.4 CysDB and Other Annotation Sources

For a generalizable tool, the best annotation strategy is to combine orthogonal sources:

- **CysDB** (https://backuslab.shinyapps.io/cysdb/)
  Use as the primary source for chemoproteomic annotations such as:
  - `hyperreactive`
  - `ligandable`

- **UniProt**
  Use feature annotations for:
  - `catalytic` (active site / binding site)
  - `disulfide`
  - `metal_binding`

- **RedoxDB / dbPTM / PhosphoSitePlus**
  Use for:
  - `redox_modified`

CysDB should be treated as an annotation source for chemoproteomic properties, **not** as a source of KEAP1-style pathway-specific labels such as `sensor`.

---

## 4. UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  CysVis: Cysteine & Variant Viewer          [KEAP1 ▼] [Go] │
├──────────────────────────────────┬──────────────────────────┤
│                                  │  KEAP1 (Q14145)          │
│                                  │  624 aa, 27 cysteines    │
│                                  │                          │
│     3Dmol.js Viewer              │  ── Domains ──           │
│     (dark background)            │  □ NTR (1-49)            │
│                                  │  □ BTB (50-179)          │
│                                  │  □ IVR (180-314)         │
│                                  │  □ Kelch (315-598)       │
│                                  │  □ CTR (599-624)         │
│                                  │                          │
│                                  │  ── Layers ──            │
│                                  │  ☑ Cysteines             │
│                                  │  ☑ Variants (ClinVar)    │
│                                  │  ☐ Surface               │
│                                  │                          │
│                                  │  ── Annotation Layer ──  │
│                                  │  [Hyperreactive ▼]       │
│                                  │                          │
│                                  │  ── Legend ──            │
│                                  │  ● Annotated cysteine    │
│                                  │  ● Unannotated cysteine  │
│                                  │  ◆ Pathogenic variant    │
│                                  │  ◆ VUS                   │
│                                  │  ◆ Benign variant        │
│                                  │                          │
├──────────────────────────────────┴──────────────────────────┤
│  Detail panel: Click a residue to see annotations           │
│  C151 (BTB domain)                                          │
│  KEAP1-specific note: canonical electrophile sensor         │
│  Primary electrophile sensor. Surrounded by basic residues  │
│  (H129, K131, R135, K150, H154) that lower its pKa...      │
│  ClinVar: 2 variants at this position (1 VUS, 1 Benign)    │
└─────────────────────────────────────────────────────────────┘
```

### Layout Details

- **Header**: Protein selector (text input for UniProt ID + Go button). Default: KEAP1 / Q14145
- **Main area** (split ~65/35):
  - Left: 3Dmol.js viewer (minimum 600x500px, responsive)
  - Right: Control panel (scrollable sidebar)
- **Bottom panel**: Detail view (appears on residue click/hover)

---

## 5. 3D Viewer Behavior

### 5.1 Initial Load
1. Fetch AlphaFold structure for Q14145
2. Display as cartoon, colored by domain:
   - NTR: light gray
   - BTB: pink/salmon
   - IVR: gold/yellow
   - Kelch: light blue
   - CTR: light gray
3. Overlay cysteine residues as **spheres** (stick + sphere representation) colored by the currently selected annotation layer
4. Add variant positions as small **cross/star markers** or offset spheres colored by significance

### 5.2 Interaction
- **Click on a cysteine sphere**: Populate detail panel with cysteine annotation + any overlapping variants
- **Click on a variant marker**: Populate detail panel with ClinVar data (significance, condition, HGVS)
- **Hover**: Show tooltip with residue number and name
- **Domain checkboxes**: Toggle visibility of each domain (cartoon representation)
- **Layer toggles**:
  - Cysteines ON/OFF
  - Variants ON/OFF
  - Surface ON/OFF (transparent surface, useful for seeing buried vs exposed cysteines)

### 5.3 3Dmol.js Implementation Notes

```javascript
// Initialize viewer
const viewer = $3Dmol.createViewer("viewer-div", {
  backgroundColor: "0x1a1a2e"
});

// Load AlphaFold structure
$.get("https://alphafold.ebi.ac.uk/files/AF-Q14145-F1-model_v4.pdb", function(data) {
  viewer.addModel(data, "pdb");

  // Cartoon colored by domain
  viewer.setStyle({}, { cartoon: { color: "white", opacity: 0.8 } });

  // Domain coloring
  viewer.setStyle({ resi: ["1-49"] }, { cartoon: { color: "0xcccccc" } });   // NTR
  viewer.setStyle({ resi: ["50-179"] }, { cartoon: { color: "0xf4a7a0" } }); // BTB
  viewer.setStyle({ resi: ["180-314"] }, { cartoon: { color: "0xf0d06e" } }); // IVR
  viewer.setStyle({ resi: ["315-598"] }, { cartoon: { color: "0x7eb8da" } }); // Kelch
  viewer.setStyle({ resi: ["599-624"] }, { cartoon: { color: "0xcccccc" } }); // CTR

  // Cysteine residues as stick+sphere
  KEAP1_CYSTEINES.forEach(cys => {
    const color = colorForSelectedAnnotationLayer(cys);
    viewer.addStyle(
      { resi: cys.resi, atom: "SG" },  // sulfur atom of cysteine
      { sphere: { radius: 0.8, color: color } }
    );
    viewer.addStyle(
      { resi: cys.resi, resn: "CYS" },
      { stick: { radius: 0.15, color: color } }
    );
  });

  // Click handler for detail panel
  viewer.setClickable({}, true, function(atom) {
    showDetailPanel(atom);
  });

  viewer.zoomTo();
  viewer.render();
});
```

---

## 6. Data Processing Logic

### 6.1 ClinVar Variant Parsing

From the MyVariant.info response, extract amino acid position:

```javascript
// Parse HGVS protein notation to get residue number
// e.g., "p.Arg320Cys" → 320
// e.g., "p.Cys151Ser" → 151
function parseHGVSProtein(hgvs) {
  const match = hgvs.match(/p\.[A-Z][a-z]{2}(\d+)/);
  return match ? parseInt(match[1]) : null;
}
```

Group variants by residue position. Flag any variants that land ON a cysteine residue (these are especially interesting — they destroy/create a cysteine).

### 6.2 Cysteine-Variant Overlap Detection

For each variant, check:
1. Does it **occur at** a cysteine position? (e.g., C151S mutation = loss of a biologically important KEAP1 cysteine)
2. Does it **create** a new cysteine? (e.g., R320C = gain of cysteine in Kelch domain)
3. Is it **adjacent to** a cysteine? (within ±3 residues, may affect microenvironment)

Flag these overlaps prominently in the detail panel.

---

## 7. Detail Panel Content

When a residue is clicked, show:

### For a cysteine residue:
```
C151 — BTB Domain (residue 151)
Annotations: uncharacterized
─────────────────────────────────
KEAP1-specific note: canonical electrophile sensor. Surrounded by basic residues
(H129, K131, R135, K150, H154) that lower its pKa. Required
for NRF2 stabilization by sulforaphane and oxidative stress.

ClinVar Variants at this position:
  • c.451T>A (p.Cys151Ser) — VUS [VCV000123456]
  • c.452G>A (p.Cys151Tyr) — Likely pathogenic [VCV000789012]

Nearby variants (±3 residues):
  • K150E — Benign (1 residue away)
```

### For a non-cysteine variant:
```
R320C — Kelch Domain (residue 320)
Variant: NM_012289.4:c.958C>T
Significance: Likely Pathogenic
Condition: Lung adenocarcinoma (somatic)
─────────────────────────────────
⚠ This variant CREATES a new cysteine at position 320
  in the Kelch domain (NRF2 binding region).
Nearest annotated cysteine: C319 (1 residue away)
```

---

## 8. File Structure

```
cysvis/
├── index.html          # Main page, includes 3Dmol.js via CDN
├── css/
│   └── style.css       # Layout and theming
├── js/
│   ├── app.js          # Main application logic
│   ├── data.js         # Hardcoded KEAP1 cysteine data
│   ├── viewer.js       # 3Dmol.js wrapper and rendering
│   ├── variants.js     # ClinVar/MyVariant.info fetch + parse
│   └── ui.js           # Sidebar, detail panel, controls
└── README.md           # Setup instructions
```

---

## 9. Implementation Priorities

### Phase 1 (MVP — get this working first)
1. Load AlphaFold structure in 3Dmol.js
2. Color cartoon by domain
3. Highlight all 27 cysteines as colored spheres
4. Support a single general annotation layer for cysteines in the MVP dataset
5. Click-to-select cysteine → show hardcoded annotation + KEAP1-specific notes in detail panel
6. Basic sidebar with layer toggles

### Phase 2 (Add variant layer)
6. Fetch ClinVar variants via MyVariant.info API
7. Parse HGVS to amino acid positions
8. Display variants as markers on structure
9. Click variant → show ClinVar annotation
10. Detect cysteine-variant overlaps

### Phase 3 (Polish)
11. Protein selector (arbitrary UniProt ID)
12. Surface toggle (transparent, to show buried vs exposed)
13. Export view as PNG
14. Responsive layout
15. Loading states and error handling

---

## 10. Key Technical Decisions & Gotchas

### 3Dmol.js
- Use `$3Dmol.createViewer` not the declarative HTML method (need programmatic control)
- AlphaFold PDB files use chain A for everything
- `setStyle` is **additive** — call in order from broad to specific
- For clickable atoms, use `setClickable({}, true, callback)` — the callback receives the atom object with `resi`, `resn`, `atom`, `x`, `y`, `z`
- Sphere sizes: 0.8 for cysteines, 0.5 for variants (visual hierarchy)

### CORS
- AlphaFold API: CORS-enabled, no issues
- RCSB PDB: CORS-enabled
- MyVariant.info: CORS-enabled
- NCBI E-utilities: CORS-enabled but may need `&retmode=json`

### Rate Limits
- NCBI E-utilities: 3 requests/second without API key, 10/sec with. For a prototype this is fine.
- MyVariant.info: 1000 requests/15min. One query per protein load, no issues.

### AlphaFold Residue Numbering
- AlphaFold models use UniProt canonical sequence numbering (1-indexed)
- This matches ClinVar protein-level annotations directly
- No renumbering needed (unlike PDB structures which often have offsets)

### KEAP1-Specific Notes
- No full-length experimental structure exists. The IVR domain (180-314) has NO crystal structure — AlphaFold is the only option for visualizing C273/C288 in structural context.
- The AlphaFold model confidence (pLDDT) for the IVR domain is moderate — worth showing confidence coloring as an option.
- KEAP1 functions as a **homodimer** — the AlphaFold model is a monomer. Note this in the UI.

---

## 11. Future Extensions (Out of Scope for Prototype)

- Integration with CysDB for experimental reactivity ratios
- Overlay electrophile-specific reactivity (e.g., HNE, sulforaphane modification sites)
- Co-visualization of KEAP1-NRF2 complex (PDB: 2FLU for Kelch-ETGE interaction)
- Batch protein comparison mode
- Integration with BioThings Explorer for pathway context
- AlphaMissense pathogenicity scores overlay

---

## 12. Future Feature: Mutation Hotspot Analysis for Cysteine Residues

### Concept

For each cysteine residue, compute and display whether it sits in a **mutation hotspot** — a region of the protein with higher-than-expected variant density. This answers the question: "Is this cysteine in a region under mutational pressure, or is it in a quiet stretch?" A protein-specific regulatory cysteine in a somatic mutation hotspot is a qualitatively different drug target than one in a mutationally cold region.

### Approach: Sliding Window Variant Density

1. **Collect all variants** for the gene (not just ClinVar — include gnomAD population variants and COSMIC somatic mutations for cancer context).
2. **Compute variant density** using a sliding window (e.g., ±10 residues) across the protein length:
   ```
   density(i) = count(variants in [i-10, i+10]) / 21
   ```
3. **Normalize** against the protein-wide baseline density to get an enrichment score:
   ```
   enrichment(i) = density(i) / mean_density_genome_wide
   ```
4. **Flag cysteines** with enrichment > 2× as "in hotspot region."

### Data Sources

- **gnomAD** (population variants): Use gnomAD API or MyVariant.info (`fields=gnomad_exome,gnomad_genome`). Provides allele frequencies and constraint metrics.
  ```
  GET https://myvariant.info/v1/query?q=gnomad_exome.gene.symbol:KEAP1&fields=gnomad_exome&size=1000
  ```
- **COSMIC** (somatic cancer mutations): COSMIC API requires registration, but basic gene-level mutation frequency data is available. Alternatively, use cBioPortal API which aggregates TCGA/ICGC data:
  ```
  GET https://www.cbioportal.org/api/genes/KEAP1/mutations?projection=SUMMARY
  ```
  Or the mutations endpoint filtered by gene:
  ```
  GET https://www.cbioportal.org/api/molecular-profiles/{profile_id}/mutations?entrezGeneId=9817
  ```
- **ClinVar** (already fetched in the base prototype).

### Visualization

- **1D track** below or alongside the 3D viewer: A horizontal bar chart or heatmap showing variant density across the protein sequence, with cysteine positions marked. This is a lollipop-plot-like display.
- **3D overlay**: Color the protein backbone by local variant density (blue = cold, red = hotspot) as an optional rendering mode.
- **Detail panel enrichment**: For each cysteine, report:
  ```
  C151 — Mutation Hotspot Analysis
  ────────────────────────────────
  Local variant density (±10 residues): 4.3 variants/residue (2.8× enrichment)
  ⚠ HOTSPOT — This cysteine is in a mutationally active region
  
  Breakdown:
    gnomAD (germline): 12 variants in window (3 missense, 1 LoF)
    COSMIC (somatic):  31 mutations in window (NSCLC: 18, CRC: 7, other: 6)
    ClinVar:           3 variants in window (1 pathogenic, 2 VUS)
  
  Regional constraint (gnomAD): o/e missense = 0.62 (constrained)
  ```

### Advanced: Statistical Hotspot Detection

Instead of a simple sliding window, use a more principled approach:

- **Binomial test per window**: Given N total variants across protein of length L, test whether the observed count in a window of size W exceeds the expected count under a uniform distribution.
- **Correction for sequence composition**: Some amino acids are more mutable than others (CpG context, transition/transversion bias). Normalize for trinucleotide context.
- **COSMIC-specific**: Use the COSMIC Genome-wide Screen (CGS) studies to distinguish driver vs passenger hotspots. The presence of recurrent somatic mutations at or near a cysteine in COSMIC CGS data is a strong signal.

### KEAP1-Specific Notes

KEAP1 is a known tumor suppressor with frequent loss-of-function mutations in NSCLC (KEAP1 is mutated in ~15-20% of lung adenocarcinomas). Somatic mutations cluster heavily in the Kelch domain (disrupting NRF2 binding). The BTB domain around C151 also shows elevated somatic mutation rates. This makes KEAP1 an ideal test case for this feature.

---

## 13. Future Feature: PPI Interface Prediction for Cysteine Residues

### Concept

Determine whether each cysteine residue is located at or near a **protein-protein interaction interface**. A cysteine at a PPI interface is a high-value target for covalent chemistry because modifying it could disrupt the interaction — exactly the kind of mechanism demonstrated in the NR0B1 story from Cravatt's lab (Bar-Peled et al. 2017). Conversely, a cysteine buried in the protein core or far from any interface is less likely to have allosteric PPI-disrupting effects when covalently modified.

### Pipeline Overview

```
┌─────────────────────────────────────────────────┐
│  1. Identify PPI partners (BioGRID + BioPlex)   │
│         ↓                                        │
│  2. Filter to high-confidence physical PPIs      │
│         ↓                                        │
│  3. Check for existing complex structures (PDB)  │
│         ↓                                        │
│  4. If no structure: predict with AF-Multimer/3  │
│         ↓                                        │
│  5. Compute interface residues (distance cutoff)  │
│         ↓                                        │
│  6. Flag cysteines at/near interface             │
└─────────────────────────────────────────────────┘
```

### Step 1: Retrieve PPI Partners

#### BioGRID

Query the BioGRID REST API (requires free API key from https://wiki.thebiogrid.org/):

```
GET https://webservice.thebiogrid.org/interactions/?searchNames=true&geneList=KEAP1&taxId=9606&includeInteractors=true&includeInteractorInteractions=false&format=json&accesskey=[KEY]
```

Returns interaction records with evidence type (physical vs genetic), experimental system (AP-MS, two-hybrid, etc.), and publication support. Filter to physical interactions only.

KEAP1 known interactors in BioGRID include: NRF2 (NFE2L2), CUL3, RBX1, PGAM5, SQSTM1/p62, PALB2, DPP3, WTX/AMER1, and others.

#### BioPlex

BioPlex (Harvard/Gygi lab) provides proteome-scale AP-MS interaction networks for 293T and HCT116 cells. Data access:

- **API**: `https://bioplex.hms.harvard.edu/bioplexDisplay/externalQuery.php?geneQuery=9817` (KEAP1 gene ID)
- **Bulk download**: TSV files from https://bioplex.hms.harvard.edu/
- **Python package**: `pip install bioplexpy` — provides programmatic access:
  ```python
  import bioplexpy
  bp293t = bioplexpy.getBioPlex(cell_line="293T", version="3.0")
  keap1_interactions = [e for e in bp293t if "KEAP1" in (e["SymbolA"], e["SymbolB"])]
  ```
- **R package**: `BiocManager::install("BioPlex")` via Bioconductor

BioPlex is especially relevant because it's AP-MS data — the same experimental technique used in Cravatt's lab — so interaction partners discovered here are physically co-purifying.

#### Combining Sources

Merge BioGRID and BioPlex hits. Prioritize interactions supported by:
- Multiple independent publications
- Physical (not genetic) evidence
- AP-MS or co-IP experimental systems
- Detection in multiple cell lines (BioPlex 293T + HCT116)

Assign a confidence tier:
- **High**: ≥3 publications OR detected in both BioGRID + BioPlex
- **Medium**: 1-2 publications, physical evidence
- **Low**: Single study, or genetic-only evidence

### Step 2: Check for Existing Complex Structures

Query RCSB PDB for solved structures containing KEAP1 and each interaction partner:

```
GET https://search.rcsb.org/rcsbsearch/v2/query
POST body:
{
  "query": {
    "type": "group",
    "logical_operator": "and",
    "nodes": [
      {"type": "terminal", "service": "text", "parameters": {"attribute": "rcsb_entity_source_organism.rcsb_gene_name.value", "operator": "exact_match", "value": "KEAP1"}},
      {"type": "terminal", "service": "text", "parameters": {"attribute": "rcsb_entity_source_organism.rcsb_gene_name.value", "operator": "exact_match", "value": "NFE2L2"}}
    ]
  }
}
```

For KEAP1, there are existing co-crystal structures for:
- KEAP1 Kelch domain + NRF2 ETGE peptide (PDB: 2FLU, 1X2R, etc.)
- KEAP1 Kelch domain + NRF2 DLG peptide
- KEAP1 Kelch domain + p62/SQSTM1 peptide
- KEAP1 BTB domain + CUL3 (modeled from KLHL11-CUL3: PDB 4AP2)

Where co-crystal structures exist, use them directly for interface calculation (much more reliable than prediction).

### Step 3: Predict Interfaces with AlphaFold

For partners without co-crystal structures, use AlphaFold3 Server or local AlphaFold-Multimer:

#### AlphaFold3 Server (alphafoldserver.com)
- Free web interface, accepts multi-chain input
- Provide KEAP1 sequence + partner sequence
- Returns predicted complex with ipTM and pTM confidence scores
- **Limitation**: 20 jobs/day, no batch API (as of early 2025)
- **Interpretation**: ipTM > 0.8 = high confidence interface; 0.6-0.8 = moderate; < 0.6 = unreliable

#### Local AlphaFold-Multimer (ColabFold or COSMIC2)
- ColabFold notebook: `https://colab.research.google.com/github/sokrypton/ColabFold/blob/main/AlphaFold2.ipynb`
  - Set `num_models` to 5, `model_type` to `alphafold2_multimer_v3`
  - Input: KEAP1_sequence:PARTNER_sequence (colon-separated)
- COSMIC2 server: https://cosmic-cryoem.org/tools/alphafoldmultimer/
  - Free, handles larger complexes than ColabFold

#### Pre-computed Predictions
- Check if KEAP1 complexes are already in the AlphaFold-Multimer model archive or published prediction databases before running new jobs.

### Step 4: Compute Interface Residues

From the complex structure (experimental or predicted):

```python
# Pseudocode for interface residue detection
INTERFACE_DISTANCE_CUTOFF = 8.0  # Angstroms (Cα-Cα) or 4.5Å (any heavy atom)

def get_interface_residues(complex_structure, chain_A="A", chain_B="B"):
    interface_A = set()
    interface_B = set()
    for atom_a in chain_A.atoms:
        for atom_b in chain_B.atoms:
            if distance(atom_a, atom_b) < INTERFACE_DISTANCE_CUTOFF:
                interface_A.add(atom_a.residue_number)
                interface_B.add(atom_b.residue_number)
    return interface_A, interface_B
```

Use a two-tier definition:
- **Core interface** (< 4.5 Å any heavy atom): Residues making direct contacts
- **Peripheral interface** (4.5 - 8.0 Å Cα-Cα): Residues near but not directly contacting

### Step 5: Map Interface to Cysteines

For each cysteine, determine:
1. **At interface**: Cysteine SG atom is within 4.5 Å of partner residue → **direct PPI contact**
2. **Near interface**: Cysteine Cα within 8.0 Å of partner → **peripheral, potential allosteric**
3. **Distal**: > 8 Å from any partner residue → **unlikely to directly affect PPI**

### Visualization

- **3D overlay**: Color cysteine spheres with a ring/halo indicating PPI interface status:
  - Inner sphere: cysteine functional class (existing color scheme)
  - Outer ring: PPI interface status (purple = at interface, light purple = peripheral, no ring = distal)
- **Detail panel annotation**:
  ```
  C151 — PPI Interface Analysis
  ──────────────────────────────
  Interface status: PERIPHERAL (6.2 Å from nearest CUL3 contact)
  
  Nearby PPI interfaces:
    • CUL3 binding: Nearest contact at H154 (3.8 Å) — C151 is 6.2 Å away
    • NRF2 binding: NOT at Kelch interface (>30 Å)
    • Homodimer interface: 12.4 Å from dimer contact
  
  Interaction partners (BioGRID + BioPlex):
    • NRF2 (NFE2L2) — 47 publications, Kelch domain interface [HIGH confidence]
    • CUL3 — 32 publications, BTB domain interface [HIGH confidence]
    • SQSTM1/p62 — 18 publications, Kelch domain interface [HIGH confidence]
    • PGAM5 — 8 publications, Kelch domain [MEDIUM confidence]
    • PALB2 — 3 publications [MEDIUM confidence]
  
  ⚠ Covalent modification at C151 could allosterically affect CUL3 binding
    (peripheral to BTB-CUL3 interface)
  ```

- **PPI partner network mini-panel**: Small force-directed graph showing KEAP1's interaction partners, colored by confidence tier, with the relevant interface domain indicated.

### Implementation Considerations

- **Computational cost**: AlphaFold-Multimer predictions are expensive (10-60 min per complex). Pre-compute for known partners and cache results. Don't run on-the-fly.
- **Stoichiometry matters**: KEAP1 is a homodimer. The dimer interface itself contains cysteines (BTB domain). Run KEAP1 homodimer prediction as well as heterodimer predictions.
- **Known KEAP1 complexes to pre-compute**:
  1. KEAP1 homodimer (BTB-BTB)
  2. KEAP1-CUL3 (BTB-NTD)
  3. KEAP1-NRF2 (Kelch-Neh2, has crystal structures)
  4. KEAP1-p62/SQSTM1 (Kelch-KIR, has crystal structures)
  5. KEAP1-PGAM5 (Kelch domain)
  6. KEAP1-DPP3 (Kelch domain)
- **For the web app**: Store pre-computed interface annotations as static JSON. The app doesn't run AlphaFold — it consumes pre-computed results.
- **Validation**: For complexes with experimental structures (NRF2, p62), compare predicted interface to known interface as a sanity check. Report concordance in the UI.

### Connection to Cysteine Chemoproteomics

The PPI interface annotation directly informs covalent drug strategy:

| Cysteine Location | Implication for Covalent Targeting |
|---|---|
| At core PPI interface | Covalent modifier could directly block partner binding (like NR0B1 C-terminal cys in Bar-Peled 2017) |
| At peripheral interface | Covalent modifier could allosterically weaken interaction |
| At homodimer interface | Could disrupt obligate dimerization → loss of E3 ligase function |
| Distal from all interfaces | Modification unlikely to affect PPIs; may still affect enzymatic/sensor function |

This table could be rendered in the detail panel for each cysteine, giving a chemoproteomics researcher immediate actionable context.
