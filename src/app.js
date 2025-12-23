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

function render(view, setView) {
  window.__appSetView = setView;
  // Keep the screen awake only while cooking
  if (view.name === "cook") {
    Wake.enable();
  } else {
    Wake.disable();

  }

  
  // Global overlay: immer rendern, unabhängig vom View-State
  renderTimersOverlay({ appEl, state: view, setView });

  if (view.name === "list") {
    return renderListView({ appEl, state: view, recipes, setView });
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
