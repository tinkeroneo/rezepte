import assert from "node:assert/strict";
import { normalizeSharedLines, normalizeSharedPayload } from "./share.normalize.js";

function run() {
  assert.deepEqual(normalizeSharedLines([" A ", "", "B"]), ["A", "B"]);
  assert.deepEqual(normalizeSharedLines('["A"," B "]'), ["A", "B"]);
  assert.deepEqual(normalizeSharedLines("A\nB"), ["A", "B"]);

  const payload = normalizeSharedPayload({
    result: {
      recipe: {
        id: "r1",
        title: "Main",
        ingredients: '["Salt","Pepper"]',
        steps: "Cook.\nServe."
      },
      parts: [
        {
          childRecipe: {
            id: "c1",
            title: "Child",
            ingredients: ["One", " Two "],
            steps: '["Mix.","Bake."]'
          }
        }
      ]
    }
  });

  assert.equal(payload.recipe.id, "r1");
  assert.deepEqual(payload.recipe.ingredients, ["Salt", "Pepper"]);
  assert.deepEqual(payload.recipe.steps, ["Cook.", "Serve."]);
  assert.equal(payload.parts.length, 1);
  assert.equal(payload.parts[0].recipe.id, "c1");
  assert.deepEqual(payload.parts[0].recipe.ingredients, ["One", "Two"]);
  assert.deepEqual(payload.parts[0].recipe.steps, ["Mix.", "Bake."]);

  console.log("✅ share normalize tests passed");
}

run();
