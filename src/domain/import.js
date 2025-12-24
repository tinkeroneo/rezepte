// src/domain/import.js
// Import recipes into app (local + optional backend), honoring conflict mode.
//
// modes:
// - backendWins: existing recipes keep their content; only new IDs are added
// - jsonWins: JSON overwrites existing
// - mergePreferBackend: merge, keeping existing fields if present
// - mergePreferJson: merge, preferring JSON fields if present

export async function importRecipesIntoApp({
  items,
  mode = "backendWins",
  useBackend = false,
  listRecipes,
  upsertRecipe,
  toLocalShape,
  saveRecipesLocal,
  loadRecipesLocal,
  setRecipes,
}) {
  const incomingRaw = Array.isArray(items) ? items : [];
  if (!incomingRaw.length) return { imported: 0, skipped: 0, total: 0 };

  const now = Date.now();

  const normalize = (x) => {
    const id = x?.id || crypto.randomUUID();
    return {
      id,
      title: String(x?.title ?? "Ohne Titel"),
      category: String(x?.category ?? ""),
      time: String(x?.time ?? ""),
      source: String(x?.source ?? ""),
      image_url: x?.image_url ?? x?.imageUrl ?? null,
      ingredients: Array.isArray(x?.ingredients) ? x.ingredients : [],
      steps: Array.isArray(x?.steps) ? x.steps : [],
      createdAt: x?.createdAt ?? now,
      updatedAt: now,
    };
  };

  const incoming = incomingRaw
    .filter(x => x && (x.id || x.title))
    .map(normalize);

  // IMPORTANT: use your existing local store (KEYS.LOCAL_RECIPES via loadRecipesLocal)
  const current = Array.isArray(loadRecipesLocal?.()) ? loadRecipesLocal() : [];
  const byId = new Map(current.map(r => [r.id, r]));

  const pickStr = (b, i, preferInc) => {
    const bs = (b ?? "").trim();
    const is = (i ?? "").trim();
    return preferInc ? (is || bs) : (bs || is);
  };
  const pickVal = (b, i, preferInc) => (preferInc ? (i ?? b) : (b ?? i));
  const pickArr = (b, i, preferInc) => {
    const ba = Array.isArray(b) ? b : [];
    const ia = Array.isArray(i) ? i : [];
    return preferInc ? (ia.length ? ia : ba) : (ba.length ? ba : ia);
  };

  const merge = (base, inc, preferInc) => ({
    ...base,
    id: base.id,
    title: pickStr(base.title, inc.title, preferInc),
    category: pickStr(base.category, inc.category, preferInc),
    time: pickStr(base.time, inc.time, preferInc),
    source: pickStr(base.source, inc.source, preferInc),
    image_url: pickVal(base.image_url, inc.image_url, preferInc),
    ingredients: pickArr(base.ingredients, inc.ingredients, preferInc),
    steps: pickArr(base.steps, inc.steps, preferInc),
    createdAt: base.createdAt ?? inc.createdAt ?? now,
    updatedAt: now,
  });

  let imported = 0;
  let skipped = 0;

  for (const inc of incoming) {
    const ex = byId.get(inc.id);

    if (!ex) {
      byId.set(inc.id, inc);
      imported++;
      continue;
    }

    if (mode === "backendWins") {
      skipped++;
      continue;
    }
    if (mode === "jsonWins") {
      byId.set(inc.id, inc);
      imported++;
      continue;
    }
    if (mode === "mergePreferBackend") {
      byId.set(inc.id, merge(ex, inc, false));
      imported++;
      continue;
    }
    if (mode === "mergePreferJson") {
      byId.set(inc.id, merge(ex, inc, true));
      imported++;
      continue;
    }

    skipped++;
  }

  const nextLocal = Array.from(byId.values());

  // local persist + in-memory update
  saveRecipesLocal(nextLocal);
  setRecipes?.(nextLocal);

  if (!useBackend) {
    return { imported, skipped, total: incoming.length };
  }

  // backend sync (based on merged result)
  const ids = new Set(incoming.map(r => r.id));
  const existingIds = new Set(current.map(r => r.id));

  for (const id of ids) {
    if (mode === "backendWins" && existingIds.has(id)) continue; // don't overwrite
    const rec = byId.get(id);
    if (!rec) continue;
    await upsertRecipe(rec);
  }

  // reload from backend and mirror locally (source of truth)
  const fromBackend = await listRecipes();
  const fresh = fromBackend.map(toLocalShape);

  saveRecipesLocal(fresh);
  setRecipes?.(fresh);

  return { imported, skipped, total: incoming.length };
}
