import assert from "node:assert/strict";
import { parseDurationSeconds, splitStepsToCards } from "./steps.js";

function run() {
  const plainSteps = [
    "1. Zwiebeln fein hacken und in Öl anbraten.",
    "Knoblauch kurz mitrösten.",
    "Mit Tomaten ablöschen.",
  ];

  const cards = splitStepsToCards(plainSteps);
  assert.equal(cards.length, 3);
  assert.equal(cards[0].title, "1. Zwiebeln fein hacken und in");
  assert.equal(cards[0].body[0], "Öl anbraten.");
  assert.equal(cards[1].title, "2. Knoblauch kurz mitrösten");
  assert.equal(cards[1].body[0], "Knoblauch kurz mitrösten.");

  const titledSteps = splitStepsToCards(["Sauce", "Tomaten einkochen.", "Abschmecken."]);
  assert.equal(titledSteps.length, 1);
  assert.equal(titledSteps[0].title, "Sauce");
  assert.deepEqual(titledSteps[0].body, ["Tomaten einkochen.", "Abschmecken."]);

  const structured = splitStepsToCards([
    "## Sauce",
    "- Tomaten einkochen.",
    "- Abschmecken.",
    "## Finish",
    "- Basilikum drüber.",
  ]);
  assert.equal(structured.length, 2);
  assert.equal(structured[0].title, "Sauce");
  assert.deepEqual(structured[0].body, ["Tomaten einkochen.", "Abschmecken."]);
  assert.equal(structured[1].title, "Finish");
  assert.deepEqual(structured[1].body, ["Basilikum drüber."]);

  assert.equal(parseDurationSeconds("20 - 30 Minuten"), 20 * 60);
  assert.equal(parseDurationSeconds("20 bis 30 Minuten"), 20 * 60);
  assert.equal(parseDurationSeconds("1-2 h"), 1 * 3600);

  console.log("✅ steps tests passed");
}

run();
