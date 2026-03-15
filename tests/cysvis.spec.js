const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const fixturePath = path.join(__dirname, "fixtures", "myvariant-keap1.json");
const myVariantFixture = fs.readFileSync(fixturePath, "utf8");
const mockProteinPdb = fs.readFileSync(path.join(__dirname, "fixtures", "mock-protein.pdb"), "utf8");

async function collectPageIssues(page) {
  const issues = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      issues.push(`console:${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    issues.push(`pageerror:${error.message}`);
  });

  return issues;
}

async function mockVariantApi(page) {
  await page.route("https://myvariant.info/v1/query?*", async (route) => {
    const url = route.request().url();
    if (url.includes("BRCA1") || url.includes("EGFR")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ took: 1, total: 0, hits: [] }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: myVariantFixture,
    });
  });
}

async function mockDefaultEgfr(page) {
  const payload = [
    {
      gene: "EGFR",
      uniprotAccession: "P00533",
      uniprotId: "EGFR_HUMAN",
      sequence: "CGS",
      sequenceStart: 1,
      sequenceEnd: 3,
      pdbUrl: "https://example.org/mock-protein.pdb",
    },
  ];

  await page.route("https://alphafold.ebi.ac.uk/api/prediction/P00533", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });

  await page.route("https://example.org/mock-protein.pdb", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: mockProteinPdb,
    });
  });
}

async function mockDynamicAlphaFold(page) {
  const payload = [
    {
      gene: "BRCA1",
      uniprotAccession: "P38398",
      uniprotId: "BRCA1_HUMAN",
      sequence: "CGS",
      sequenceStart: 1,
      sequenceEnd: 3,
      pdbUrl: "https://example.org/mock-protein.pdb",
    },
  ];

  await page.route("https://alphafold.ebi.ac.uk/api/prediction/P38398", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });

  await page.route("https://example.org/mock-protein.pdb", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: mockProteinPdb,
    });
  });
}

async function switchToKeap1(page) {
  await page.locator("#protein-id").fill("Q14145");
  await page.locator("#protein-form button[type='submit']").click();
  await expect.poll(() => page.evaluate(() => window.__cysvisTestApi.getState().protein.uniprotId)).toBe("Q14145");
}

test.describe("CysVis MVP", () => {
  test("loads EGFR by default and clears loading status", async ({ page }) => {
    const issues = await collectPageIssues(page);
    await mockVariantApi(page);
    await mockDefaultEgfr(page);

    await page.goto("/");

    await expect(page.locator("h1")).toHaveText("CysVis");
    await expect(page.locator("#export-png")).toHaveCount(1);
    await expect(page.locator("#annotation-layer-select")).toHaveCount(1);
    await expect(page.locator("#protein-summary")).toContainText("EGFR");
    await expect(page.locator("#protein-summary")).toContainText("P00533");
    await expect(page.locator("#protein-summary")).toContainText("3 aa");
    await expect(page.locator("#protein-summary")).toContainText("1");
    await expect(page.locator("#protein-summary")).toContainText("0 across 0 residues");

    await page.waitForFunction(() => window.__cysvisTestApi?.getState().statusHidden === true);
    await expect.poll(() => page.evaluate(() => window.__cysvisTestApi.getState().protein.uniprotId)).toBe("P00533");
    await expect.poll(() => page.evaluate(() => window.__cysvisTestApi.getState().variants.rawVariantCount)).toBe(0);
    await expect.poll(() => page.evaluate(() => window.__cysvisTestApi.getState().hotspots.ready)).toBe(true);

    expect(issues).toEqual([]);
  });

  test("surface toggle can be enabled and disabled without errors", async ({ page }) => {
    const issues = await collectPageIssues(page);
    await mockVariantApi(page);
    await mockDefaultEgfr(page);

    await page.goto("/");
    await page.waitForFunction(() => window.__cysvisTestApi?.getState().statusHidden === true);

    const surfaceToggle = page.locator("#toggle-surface");
    await surfaceToggle.check();
    await expect(surfaceToggle).toBeChecked();
    await expect.poll(() => page.evaluate(() => window.__cysvisTestApi.hasSurface())).toBe(true);

    await surfaceToggle.uncheck();
    await expect(surfaceToggle).not.toBeChecked();
    await expect.poll(() => page.evaluate(() => window.__cysvisTestApi.hasSurface())).toBe(false);

    expect(issues).toEqual([]);
  });

  test("uses the locked large-cys visual encoding", async ({ page }) => {
    await mockVariantApi(page);
    await mockDefaultEgfr(page);
    await page.goto("/");
    await page.waitForFunction(() => window.__cysvisTestApi?.getState().statusHidden === true);

    await expect(page.locator("#encoding-select")).toHaveCount(0);
    await expect(page.locator("#variant-geometry-select")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => window.__cysvisTestApi.getState().renderState.encodingScheme))
      .toBe("size_split");
    await expect
      .poll(() => page.evaluate(() => window.__cysvisTestApi.getState().renderState.variantGeometry))
      .toBe("sphere");
    await expect
      .poll(() => page.evaluate(() => window.__cysvisTestApi.getState().renderState.annotationLayer))
      .toBe("uncharacterized");
  });

  test("cysteine annotation layer can be changed", async ({ page }) => {
    await mockVariantApi(page);
    await mockDefaultEgfr(page);
    await page.goto("/");
    await page.waitForFunction(() => window.__cysvisTestApi?.getState().statusHidden === true);

    await page.locator("#annotation-layer-select").selectOption("hyperreactive");
    await expect(page.locator("#annotation-layer-note")).toContainText("No curated prototype assignments");
    await expect
      .poll(() => page.evaluate(() => window.__cysvisTestApi.getState().renderState.annotationLayer))
      .toBe("hyperreactive");
  });

  test("shows cysteine detail for a selected annotated residue", async ({ page }) => {
    await mockVariantApi(page);
    await mockDefaultEgfr(page);
    await page.goto("/");
    await switchToKeap1(page);
    await expect.poll(() => page.evaluate(() => window.__cysvisTestApi.getState().variants.rawVariantCount)).toBe(5);
    await expect.poll(() => page.evaluate(() => window.__cysvisTestApi.getState().hotspots.ready)).toBe(true);

    const selected = await page.evaluate(() => window.__cysvisTestApi.selectCysteine(151));
    expect(selected).toBe(true);

    await expect(page.locator("#detail-content")).toContainText("C151");
    await expect(page.locator("#detail-content")).toContainText("Annotations: Uncharacterized");
    await expect(page.locator("#detail-content")).toContainText("BTB domain");
    await expect(page.locator("#detail-content")).toContainText("primary electrophile sensor");
    await expect(page.locator("#detail-content")).toContainText("3D pathogenic hotspot");
    await expect(page.locator("#detail-content")).toContainText("Nearest pathogenic residue");
    await expect(page.locator("#detail-content")).toContainText("Empirical p-value");
    await expect(page.locator("#detail-content")).toContainText("ClinVar variants at this cysteine");
    await expect(page.locator("#detail-content")).toContainText("p.Cys151Ser");
    await expect(page.locator("#detail-content")).toContainText("Likely pathogenic");
    await expect
      .poll(() => page.evaluate(() => window.__cysvisTestApi.getState().renderState.selectedCysteineResi))
      .toBe(151);
  });

  test("shows grouped variant detail for a gain-of-cysteine residue", async ({ page }) => {
    await mockVariantApi(page);
    await mockDefaultEgfr(page);
    await page.goto("/");
    await switchToKeap1(page);
    await expect.poll(() => page.evaluate(() => window.__cysvisTestApi.getState().variants.groupedResidueCount)).toBe(4);

    const selected = await page.evaluate(() => window.__cysvisTestApi.selectVariantResidue(320));
    expect(selected).toBe(true);

    await expect(page.locator("#detail-content")).toContainText("Residue 320 variant cluster");
    await expect(page.locator("#detail-content")).toContainText("creates a cysteine at position 320");
    await expect(page.locator("#detail-content")).toContainText("lung adenocarcinoma");
    await expect
      .poll(() => page.evaluate(() => window.__cysvisTestApi.getState().renderState.selectedVariantResidue))
      .toBe(320);
  });

  test("loads a non-KEAP1 UniProt through the generic AlphaFold path", async ({ page }) => {
    await mockVariantApi(page);
    await mockDefaultEgfr(page);
    await mockDynamicAlphaFold(page);
    await page.goto("/");

    await page.locator("#protein-id").fill("P38398");
    await page.locator("#protein-form button[type='submit']").click();

    await expect.poll(() => page.evaluate(() => window.__cysvisTestApi.getState().protein.uniprotId)).toBe("P38398");
    await expect.poll(() => page.evaluate(() => window.__cysvisTestApi.getState().protein.isCurated)).toBe(false);
    await expect(page.locator("#protein-summary")).toContainText("BRCA1");
    await expect(page.locator("#protein-summary")).toContainText("3 aa");
    await expect(page.locator("#protein-summary")).toContainText("1");
    await expect(page.locator("#detail-content")).toContainText("generic AlphaFold path");
  });
});
