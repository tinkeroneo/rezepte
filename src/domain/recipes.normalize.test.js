import assert from "node:assert/strict";
import { normalizeEditorLines, normalizeRecipeTitleInput } from "./recipes.js";

function run() {
  assert.equal(normalizeRecipeTitleInput("  Chili   sin   Carne  "), "Chili sin Carne");

  assert.deepEqual(normalizeEditorLines("- Salz\n • Pfeffer\n\nTomaten"), [
    "Salz",
    "Pfeffer",
    "Tomaten",
  ]);

  assert.deepEqual(
    normalizeEditorLines("1. Zwiebel schneiden\n2) Anbraten\n3. Servieren", {
      stripLeadingNumbers: true,
    }),
    ["Zwiebel schneiden", "Anbraten", "Servieren"],
  );

  assert.deepEqual(
    normalizeEditorLines("- Unterpunkt A\n- Unterpunkt B", { stripLeadingBullets: false }),
    ["- Unterpunkt A", "- Unterpunkt B"],
  );

  console.log("✅ recipes normalize tests passed");
}

run();
