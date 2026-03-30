/* global console, process */
// src/domain/listQuery.test.cjs
const assert = require("assert/strict");
const LQ = require("./listQuery.cjs");

(async function run() {
  // parseMinutes
  assert.equal(await LQ.parseMinutes("10 Minuten"), 10);
  assert.equal(await LQ.parseMinutes("1 h"), 60);
  assert.equal(await LQ.parseMinutes("1h 20m"), 80);
  assert.equal(await LQ.parseMinutes("45 min"), 45);

  // sortTitle strips emojis
  assert.equal(await LQ.sortTitle("🍕 Pizza"), "pizza");

  // defaultDirFor
  assert.equal(await LQ.defaultDirFor("az"), "asc");
  assert.equal(await LQ.defaultDirFor("new"), "desc");

  // applyListQuery basic filter/sort
  const recipes = [
    { id: "1", title: "Bohnen Chili", category: "Abend", tags: ["scharf"], createdAt: 2 },
    { id: "2", title: "Pancakes", category: "Frühstück", tags: ["süß"], createdAt: 1 },
  ];

  const r1 = await LQ.applyListQuery({
    recipes,
    query: "bohnen",
    sort: "new",
    sortDir: "desc",
  });
  assert.equal(r1.length, 1);
  assert.equal(r1[0].id, "1");

  const r2 = await LQ.applyListQuery({
    recipes,
    cat: "Frühstück",
    sort: "az",
    sortDir: "asc",
  });
  assert.equal(r2.length, 1);
  assert.equal(r2[0].id, "2");

  const r3 = await LQ.applyListQuery({
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

  const r4 = await LQ.applyListQuery({
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

  console.log("✅ listQuery CJS tests passed");
})().catch((e) => {
  console.error("❌ listQuery CJS tests failed");
  console.error(e);
  process.exit(1);
});
