import { ensureUniqueId } from "./id.js";

/**
 * Import recipes into the app.
 *
 * Supported call styles:
 * 1) repo-style (preferred):
 *    { items, mode, useBackend, repo, toLocalShape }
 *
 * 2) legacy explicit deps:
 *    { items, mode, useBackend, listRecipes, upsertRecipe, toLocalShape, saveRecipesLocal, loadRecipesLocal, setRecipes }
 */

function normalizeLines(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeImportedRecipe(raw, toLocalShape) {
  const base = raw && typeof raw === "object" ? { ...raw } : {};

  // Accept common German field aliases in JSON imports.
  if (base.title === null || base.title === undefined) {
    if (base.titel !== null && base.titel !== undefined) base.title = base.titel;
  }
  if (base.ingredients === null || base.ingredients === undefined) {
    if (base.zutaten !== null && base.zutaten !== undefined) base.ingredients = base.zutaten;
  }
  if (base.steps === null || base.steps === undefined) {
    if (base.schritte !== null && base.schritte !== undefined) base.steps = base.schritte;
  }

  const normalized = toLocalShape ? toLocalShape(base) : base;
  const out = {
    ...normalized,
    ingredients: normalizeLines(normalized?.ingredients),
    steps: normalizeLines(normalized?.steps),
  };

  // Import must not carry runtime sync markers from JSON.
  delete out._pending;
  return out;
}

const hasText = (value) => (
  typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined
);

function uniqMergeLines(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  const seen = new Set();
  const out = [];

  for (const item of [...left, ...right]) {
    const line = String(item ?? "").trim();
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

function mergeRecipe(base, patch, prefer) {
  const preferJson = prefer === "json";

  const pick = (key) => {
    const bv = base?.[key];
    const pv = patch?.[key];
    if (preferJson) return hasText(pv) ? pv : bv;
    return hasText(bv) ? bv : pv;
  };

  const pickArr = (key) => {
    const ba = Array.isArray(base?.[key]) ? base[key] : [];
    const pa = Array.isArray(patch?.[key]) ? patch[key] : [];
    if (!ba.length && pa.length) return pa;
    if (!pa.length && ba.length) return ba;
    return uniqMergeLines(ba, pa);
  };

  const merged = {
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
  delete merged._pending;
  return merged;
}

function applyConflictMode({ existing, patch, mode }) {
  if (!existing) return patch;
  if (mode === "backendWins") return existing;
  if (mode === "jsonWins") return { ...existing, ...patch, id: existing.id };
  if (mode === "mergePreferBackend") return mergeRecipe(existing, patch, "backend");
  if (mode === "mergePreferJson") return mergeRecipe(existing, patch, "json");
  return patch;
}

export async function importRecipesIntoApp({
  items,
  mode,
  useBackend,
  repo,
  listRecipes,
  upsertRecipe,
  toLocalShape,
  saveRecipesLocal,
  loadRecipesLocal,
  setRecipes,
}) {
  const incomingRaw = Array.isArray(items) ? items : [];
  if (!incomingRaw.length) return;

  const incoming = incomingRaw.map((raw) => normalizeImportedRecipe(raw, toLocalShape));

  // Hard validation before any write: title is mandatory for every imported item.
  const firstMissingTitle = incoming.findIndex((recipe) => !String(recipe?.title ?? "").trim());
  if (firstMissingTitle >= 0) {
    throw new Error(`Import abgebrochen: Eintrag ${firstMissingTitle + 1} hat keinen Titel.`);
  }

  const repoMode = repo && typeof repo.getAll === "function" && typeof repo.upsert === "function";
  if (repoMode) {
    const current = (await repo.getAll()).map((recipe) => normalizeImportedRecipe(recipe, toLocalShape));
    const byId = new Map(current.map((recipe) => [recipe.id, recipe]));
    const toUpsert = [];

    for (const patchCandidate of incoming) {
      const patch = { ...patchCandidate };
      patch.id = ensureUniqueId(patch.id, byId);
      const existing = byId.get(patch.id);
      const next = applyConflictMode({ existing, patch, mode });
      if (next === existing) continue;

      byId.set(patch.id, next);
      toUpsert.push(next);
    }

    const limit = 5;
    for (let i = 0; i < toUpsert.length; i += limit) {
      const chunk = toUpsert.slice(i, i + limit);
      await Promise.all(chunk.map((recipe) => repo.upsert(recipe, { refresh: false })));
    }

    // Ensure local cache and UI state are in sync after import.
    if (useBackend) await repo.getAll();
    return;
  }

  // ---- Legacy dependency path ----
  if (!useBackend) {
    const current = (loadRecipesLocal?.() ?? []).map((recipe) => normalizeImportedRecipe(recipe, toLocalShape));
    const byId = new Map(current.map((recipe) => [recipe.id, recipe]));

    for (const patchCandidate of incoming) {
      const patch = { ...patchCandidate };
      patch.id = ensureUniqueId(patch.id, byId);
      const existing = byId.get(patch.id);
      const next = applyConflictMode({ existing, patch, mode });
      byId.set(patch.id, next);
    }

    const merged = Array.from(byId.values()).map((recipe) => normalizeImportedRecipe(recipe, toLocalShape));
    saveRecipesLocal?.(merged);
    setRecipes?.(merged);
    return;
  }

  const backendNow = (await listRecipes()).map((recipe) => normalizeImportedRecipe(recipe, toLocalShape));
  const byId = new Map(backendNow.map((recipe) => [recipe.id, recipe]));
  const toUpsert = [];

  for (const patchCandidate of incoming) {
    const patch = { ...patchCandidate };
    patch.id = ensureUniqueId(patch.id, byId);
    const existing = byId.get(patch.id);
    const next = applyConflictMode({ existing, patch, mode });
    if (next === existing) continue;
    toUpsert.push(next);
    byId.set(patch.id, next);
  }

  const limit = 5;
  for (let i = 0; i < toUpsert.length; i += limit) {
    const chunk = toUpsert.slice(i, i + limit);
    await Promise.all(chunk.map((recipe) => upsertRecipe(recipe)));
  }

  const refreshed = (await listRecipes()).map((recipe) => normalizeImportedRecipe(recipe, toLocalShape));
  saveRecipesLocal?.(refreshed);
  setRecipes?.(refreshed);
}
