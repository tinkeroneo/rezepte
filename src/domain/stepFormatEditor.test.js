import assert from "node:assert/strict";
import { applyStepLineFormatAtCursor, formatStepLine } from "./stepFormatEditor.js";

function run() {
  assert.equal(formatStepLine("## Sauce", "title"), "## Sauce");
  assert.equal(formatStepLine("- Tomaten", "bullet"), "- Tomaten");
  assert.equal(formatStepLine(" - Tomaten ", "plain"), "Tomaten");
  assert.equal(formatStepLine("Gemüse", "ingredientHeader"), "Gemüse:");
  assert.equal(formatStepLine("Tomaten", "ingredientItem"), "- Tomaten");

  const sample = "## Sauce\nTomaten einkochen.\nServieren";
  const pos = sample.indexOf("Tomaten");
  const r1 = applyStepLineFormatAtCursor({ text: sample, cursor: pos, mode: "bullet" });
  assert.match(r1.text, /## Sauce\n- Tomaten einkochen\.\nServieren/);

  const pos2 = r1.text.indexOf("Servieren");
  const r2 = applyStepLineFormatAtCursor({ text: r1.text, cursor: pos2, mode: "title" });
  assert.match(r2.text, /## Sauce\n- Tomaten einkochen\.\n## Servieren/);

  console.log("✅ step format editor tests passed");
}

run();
