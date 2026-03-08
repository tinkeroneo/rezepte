import assert from "node:assert/strict";
import { normalizePdfLines, renderPdfSections } from "./pdfExport.js";

function run() {
  assert.deepEqual(normalizePdfLines([" A ", "", "B"]), ["A", "B"]);
  assert.deepEqual(normalizePdfLines("- Salz\n- Pfeffer"), ["Salz", "Pfeffer"]);

  const html = renderPdfSections([
    "## Sauce",
    "- Tomaten",
    "- Knoblauch",
    "## Finish",
    "- Basilikum"
  ]);

  assert.match(html, /<h3 class="section">Sauce<\/h3>/);
  assert.match(html, /<li>Tomaten<\/li>/);
  assert.match(html, /<h3 class="section">Finish<\/h3>/);
  assert.match(html, /<li>Basilikum<\/li>/);

  console.log("✅ pdfExport tests passed");
}

run();
