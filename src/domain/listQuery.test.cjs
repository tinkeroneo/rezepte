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
    { id: "2", title: "Pancakes", category: "Frühstück", tags: ["süß"], createdAt: 1 }
  ];

  const r1 = await LQ.applyListQuery({
    recipes,
    query: "bohnen",
    sort: "new",
    sortDir: "desc"
  });
  assert.equal(r1.length, 1);
  assert.equal(r1[0].id, "1");

  const r2 = await LQ.applyListQuery({
    recipes,
    cat: "Frühstück",
    sort: "az",
    sortDir: "asc"
  });
  assert.equal(r2.length, 1);
  assert.equal(r2[0].id, "2");

//   console.log("✅ listQuery tests passed");
// })().catch((e) => {
//   console.error("❌ listQuery tests failed");
//   console.error(e);
//   process.exit(1);
});
