import { ensureUniqueId } from "./id.js";

/**
 * Import recipes into the app (local or backend).
 *
 * modes:
 *  - backendWins: keep existing, only add new
 *  - jsonWins: overwrite existing with imported
 *  - mergePreferBackend: merge arrays, prefer existing scalar fields
 *  - mergePreferJson: merge arrays, prefer imported scalar fields
 */

export async function importRecipesIntoApp({
  items,
  mode,
  useBackend,
  listRecipes,
  upsertRecipe,
  toLocalShape,
  saveRecipesLocal,
  loadRecipesLocal,
  setRecipes,
}) {
  const incoming = Array.isArray(items) ? items : [];
  if (!incoming.length) return;

  const hasText = (v) => (typeof v === "string" ? v.trim().length > 0 : v !== null && v !== undefined);

  const uniqMergeLines = (a, b) => {
    const A = Array.isArray(a) ? a : [];
    const B = Array.isArray(b) ? b : [];
    const seen = new Set();
    const out = [];
    for (const x of [...A, ...B]) {
      const s = String(x ?? "").trim();
      if (!s) continue;
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
    }
    return out;
  };

  const mergeRecipe = (base, patch, prefer) => {
    const preferJson = prefer === "json";

    const pick = (k) => {
      const bv = base?.[k];
      const pv = patch?.[k];
      if (preferJson) return hasText(pv) ? pv : bv;
      return hasText(bv) ? bv : pv;
    };

    const pickArr = (k) => {
      const ba = Array.isArray(base?.[k]) ? base[k] : [];
      const pa = Array.isArray(patch?.[k]) ? patch[k] : [];
      if (!ba.length && pa.length) return pa;
      if (!pa.length && ba.length) return ba;
      return uniqMergeLines(ba, pa);
    };

    return {
      ...base,
      ...patch,
      id: base?.id ?? patch?.id,
      title: pick("title") ?? base?.title ?? patch?.title,
      category: pick("category"),
      time: pick("time"),
      source: pick("source"),
      description: pick("description"),
      image_url: pick("image_url") ?? pick("imageUrl"),
      ingredients: pickArr("ingredients"),
      steps: pickArr("steps"),
      createdAt: base?.createdAt ?? patch?.createdAt ?? Date.now(),
    };
  };

  // ---- Local only ----
  if (!useBackend) {
    const current = (loadRecipesLocal?.() ?? []).map(toLocalShape);
    const byId = new Map(current.map((r) => [r.id, r]));

    for (const raw of incoming) {
      const patch = toLocalShape(raw);
      patch.id = ensureUniqueId(patch.id, byId);
      const existing = byId.get(patch.id);

      if (!existing) {
        byId.set(patch.id, patch);
        continue;
      }

      if (mode === "backendWins") continue;
      if (mode === "jsonWins") byId.set(patch.id, patch);
      if (mode === "mergePreferBackend") byId.set(patch.id, mergeRecipe(existing, patch, "backend"));
      if (mode === "mergePreferJson") byId.set(patch.id, mergeRecipe(existing, patch, "json"));
    }

    const merged = Array.from(byId.values()).map(toLocalShape);
    saveRecipesLocal(merged);
    setRecipes?.(merged);
    return;
  }

  // ---- Backend ----
  // Always compare against the backend state (not the in-memory list)
  const backendNow = (await listRecipes()).map(toLocalShape);
  const byId = new Map(backendNow.map((r) => [r.id, r]));

  const toUpsert = [];
  for (const raw of incoming) {
      const patch = toLocalShape(raw);
      patch.id = ensureUniqueId(patch.id, byId);
    const existing = byId.get(patch.id);

    if (!existing) {
      toUpsert.push(patch);
      continue;
    }

    if (mode === "backendWins") continue;
    if (mode === "jsonWins") {
      toUpsert.push({ ...existing, ...patch, id: existing.id });
      continue;
    }
    if (mode === "mergePreferBackend") {
      toUpsert.push(mergeRecipe(existing, patch, "backend"));
      continue;
    }
    if (mode === "mergePreferJson") {
      toUpsert.push(mergeRecipe(existing, patch, "json"));
      continue;
    }
  }

  // Concurrency limit: prevents hammering / rate limits
  const limit = 5;
  for (let i = 0; i < toUpsert.length; i += limit) {
    const chunk = toUpsert.slice(i, i + limit);
    await Promise.all(chunk.map((r) => upsertRecipe(r)));
  }

  const refreshed = (await listRecipes()).map(toLocalShape);
  saveRecipesLocal(refreshed);
  setRecipes?.(refreshed);
}
