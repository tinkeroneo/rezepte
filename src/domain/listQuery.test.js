// src/domain/listQuery.test.js
import assert from "node:assert/strict";
import { applyListQuery, parseMinutes, sortTitle, defaultDirFor } from "./listQuery.js";

function run() {
  // parseMinutes
  assert.equal(parseMinutes("10 Minuten"), 10);
  assert.equal(parseMinutes("1 h"), 60);
  assert.equal(parseMinutes("1h 20m"), 80);
  assert.equal(parseMinutes("45 min"), 45);

  // sortTitle strips emojis
  assert.equal(sortTitle("🍕 Pizza"), "pizza");

  // defaultDirFor
  assert.equal(defaultDirFor("az"), "asc");
  assert.equal(defaultDirFor("new"), "desc");

  // applyListQuery basic filter
  const recipes = [
    { id: "1", title: "Bohnen Chili", category: "Abend", tags: ["scharf"], createdAt: 2 },
    { id: "2", title: "Pancakes", category: "Frühstück", tags: ["süß"], createdAt: 1 },
  ];

  const r1 = applyListQuery({ recipes, query: "bohnen", sort: "new", sortDir: "desc" });
  assert.equal(r1.length, 1);
  assert.equal(r1[0].id, "1");

  const r2 = applyListQuery({ recipes, cat: "Frühstück", sort: "az", sortDir: "asc" });
  assert.equal(r2.length, 1);
  assert.equal(r2[0].id, "2");

  const r3 = applyListQuery({
    recipes: [
      {
        id: "3",
        title: "Kartoffelauflauf",
        category: "Abend",
        tags: [],
        ingredients: "Kartoffeln\nSahne",
        steps: "Backen\nServieren",
        createdAt: 3,
      },
    ],
    query: "sahne",
    sort: "new",
    sortDir: "desc",
  });
  assert.equal(r3.length, 1);
  assert.equal(r3[0].id, "3");

  const r4 = applyListQuery({
    recipes: [
      {
        id: "4",
        title: "Suppe",
        category: "Abend",
        description: "Schmeckt am nächsten Tag noch besser",
        createdAt: 4,
      },
    ],
    query: "nächsten tag",
    sort: "new",
    sortDir: "desc",
  });
  assert.equal(r4.length, 1);
  assert.equal(r4[0].id, "4");

  console.log("✅ listQuery tests passed");
}

run();
