import {
  listRecipes,
  upsertRecipe,
  deleteRecipe as sbDelete,
  uploadRecipeImage,
  listAllRecipeParts,
  addRecipePart,
  removeRecipePart
} from "./supabase.js";
import { renderIngredientsHtml, isIngredientHeader } from "./domain/ingredients.js";
import { initRouter } from "./state.js";
import { saveRecipesLocal, loadRecipesLocal, toLocalShape } from "./domain/recipes.js";
import { rebuildPartsIndex } from "./domain/parts.js";
import { addToShopping } from "./domain/shopping.js";

import { renderListView } from "./views/list.view.js";
import { renderDetailView } from "./views/detail.view.js";
import { renderCookView } from "./views/cook.view.js";
import { renderAddView } from "./views/add.view.js";
import { renderShoppingView } from "./views/shopping.view.js";
import { renderTimersOverlay } from "./views/timers.view.js";
import { Wake } from "./services/wakeLock.js";

const USE_BACKEND = true;

const appEl = document.getElementById("app");

// Global UI state (view-unabhängig), damit das Timer-Overlay stabil bleibt
const globalState = {
  ui: {
    timerExpanded: false,
  },
};

let recipes = [];
let recipeParts = [];
let partsByParent = new Map();

function setParts(newParts) {
  recipeParts = newParts ?? [];
  partsByParent = rebuildPartsIndex(recipeParts);
}

async function loadAll() {
  if (!USE_BACKEND) {
    recipes = loadRecipesLocal().map(toLocalShape);
    setParts([]);
    return;
  }

  try {
    const fromBackend = await listRecipes();
    recipes = fromBackend.map(toLocalShape);
    saveRecipesLocal(recipes);

    try {
      const parts = await listAllRecipeParts();
      setParts(parts);
    } catch {
      setParts([]);
    }
  } catch {
    recipes = loadRecipesLocal().map(toLocalShape);
    setParts([]);
  }
}
async function importRecipesIntoApp({
  items,
  mode,
  useBackend,
  listRecipes,
  upsertRecipe,
  toLocalShape,
  saveRecipesLocal,
  setRecipes
}) {
  const incoming = Array.isArray(items) ? items : [];
  if (!incoming.length) return;

  // helper: normalize empties
  const hasText = (v) => typeof v === "string" ? v.trim().length > 0 : v != null;

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
      const bj = base?.[k];
      const pj = patch?.[k];
      if (preferJson) return hasText(pj) ? pj : bj;
      return hasText(bj) ? bj : pj;
    };

    const pickArr = (k) => {
      const bj = Array.isArray(base?.[k]) ? base[k] : [];
      const pj = Array.isArray(patch?.[k]) ? patch[k] : [];
      if (!bj.length && pj.length) return pj;
      if (!pj.length && bj.length) return bj;
      // both present -> combine (stable, no dupes)
      return uniqMergeLines(bj, pj);
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
      // image key variants:
      image_url: pick("image_url") ?? pick("imageUrl"),
      ingredients: pickArr("ingredients"),
      steps: pickArr("steps"),
      // keep createdAt if exists; otherwise allow patch
      createdAt: base?.createdAt ?? patch?.createdAt ?? Date.now()
    };
  };

  if (!useBackend) {
    // local only
    const current = JSON.parse(localStorage.getItem("tinkeroneo_recipes_v1") || "[]");
    const byId = new Map((current ?? []).map(r => [r.id, r]));
    for (const raw of incoming) {
      if (!raw?.id) continue;
      const existing = byId.get(raw.id);
      if (!existing) byId.set(raw.id, raw);
      else {
        if (mode === "backendWins") continue;
        if (mode === "jsonWins") byId.set(raw.id, raw);
        if (mode === "mergePreferBackend") byId.set(raw.id, mergeRecipe(existing, raw, "backend"));
        if (mode === "mergePreferJson") byId.set(raw.id, mergeRecipe(existing, raw, "json"));
      }
    }
    const merged = Array.from(byId.values()).map(toLocalShape);
    saveRecipesLocal(merged);
    setRecipes(merged);
    return;
  }

  // backend import
  const backendNow = (await listRecipes()).map(toLocalShape);
  const byId = new Map(backendNow.map(r => [r.id, r]));

  const toUpsert = [];
  for (const raw of incoming) {
    if (!raw?.id) continue;

    const patch = toLocalShape(raw);
    const existing = byId.get(patch.id);

    if (!existing) {
      toUpsert.push(patch);
      continue;
    }

    if (mode === "backendWins") {
      // skip
      continue;
    }

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

  if (!toUpsert.length) {
    // still refresh local from backend
    const refreshed = (await listRecipes()).map(toLocalShape);
    saveRecipesLocal(refreshed);
    setRecipes(refreshed);
    return;
  }

  // small concurrency limit to avoid hammering
  const limit = 5;
  for (let i = 0; i < toUpsert.length; i += limit) {
    const chunk = toUpsert.slice(i, i + limit);
    await Promise.all(chunk.map(r => upsertRecipe(r)));
  }

  const refreshed = (await listRecipes()).map(toLocalShape);
  saveRecipesLocal(refreshed);
  setRecipes(refreshed);
}

function render(view, setView) {
  // Keep the screen awake only while cooking
  if (view.name === "cook") {
    Wake.enable();
  } else {
    Wake.disable();

  }

  
  // Global overlay: immer rendern, unabhängig vom View-State
  renderTimersOverlay({ appEl, state: view, setView });

  if (view.name === "list") {
    return renderListView({
  appEl,
  state: view,
  recipes,
  partsByParent,
  setView,
  useBackend: USE_BACKEND,
  onImportRecipes: async ({ items, mode }) => {
    // items: array of recipes from JSON
    // mode: "backendWins" | "jsonWins" | "mergePreferBackend" | "mergePreferJson"
    await importRecipesIntoApp({
      items,
      mode,
      useBackend: USE_BACKEND,
      listRecipes,
      upsertRecipe,
      toLocalShape,
      saveRecipesLocal,
      // allows updating the in-memory recipes too
      setRecipes: (next) => { recipes = next; }
    });
  }
});

  }
  if (view.name === "detail") {
    return renderDetailView({
      appEl,
      state: view,
      recipes,
      partsByParent,
      recipeParts,
      setView,
      useBackend: USE_BACKEND,
      sbDelete: async (id) => {
        // local update
        recipes = recipes.filter(r => r.id !== id);
        saveRecipesLocal(recipes);
        if (USE_BACKEND) await sbDelete(id);
      },
      removeRecipePart,
      addRecipePart,
      listAllRecipeParts,
      addToShopping,
      rebuildPartsIndexSetter: (freshParts) => setParts(freshParts),
    });
  }
  if (view.name === "cook") {
    return renderCookView({ appEl, state: view, recipes, partsByParent, setView });
  }
  if (view.name === "add") {
    return renderAddView({
      appEl,
      state: view,
      recipes,
      setView,
      useBackend: USE_BACKEND,
      upsertRecipe: async (rec) => {
        // local merge first
        const idx = recipes.findIndex(x => x.id === rec.id);
        if (idx >= 0) recipes[idx] = rec;
        else recipes.push(rec);
        saveRecipesLocal(recipes);

        if (!USE_BACKEND) return;

        await upsertRecipe(rec);
        const fromBackend = await listRecipes();
        recipes = fromBackend.map(toLocalShape);
        saveRecipesLocal(recipes);
      },
      uploadRecipeImage
    });
  }
  if (view.name === "shopping") {
    return renderShoppingView({ appEl, state: view, setView });
  }

  // fallback
  setView({ name: "list", selectedId: null, q: view.q });
}

async function boot() {
  await loadAll();

  const router = initRouter({
    onViewChange: (view) => render(view, router.setView)
  });

  render(router.getView(), router.setView);
}

boot();
