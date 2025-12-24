import {
  listRecipes,
  upsertRecipe,
  deleteRecipe as sbDelete,
  uploadRecipeImage,
  listAllRecipeParts,
  addRecipePart,
  removeRecipePart
} from "./supabase.js";
import { initRouter } from "./state.js";
import { saveRecipesLocal, loadRecipesLocal, toLocalShape } from "./domain/recipes.js";
import { importRecipesIntoApp } from "./domain/import.js";
import { createRecipeRepo } from "./domain/recipeRepo.js";
import { rebuildPartsIndex } from "./domain/parts.js";
import { addToShopping } from "./domain/shopping.js";

import { renderListView } from "./views/list.view.js";
import { renderDetailView } from "./views/detail.view.js";
import { renderCookView } from "./views/cook.view.js";
import { renderAddView } from "./views/add.view.js";
import { renderShoppingView } from "./views/shopping.view.js";
import { renderAdminView } from "./views/admin.view.js";
import { renderSelftestView } from "./views/selftest.view.js";
import { renderDiagnosticsView } from "./views/diagnostics.view.js";
import { renderTimersOverlay } from "./views/timers.view.js";
import { Wake } from "./services/wakeLock.js";
import { installGlobalErrorHandler } from "./services/errors.js";
import { getRecentErrors, clearRecentErrors } from "./services/errors.js";
import { runExclusive } from "./services/locks.js";

const USE_BACKEND = true;

const appEl = document.getElementById("app");

const recipeRepo = createRecipeRepo({
  useBackend: USE_BACKEND,
  listRecipes,
  upsertRecipe,
  deleteRecipe: sbDelete,
  loadRecipesLocal,
  saveRecipesLocal,
  toLocalShape,
});

let recipes = [];
let recipeParts = [];
let partsByParent = new Map();

function setParts(newParts) {
  recipeParts = newParts ?? [];
  partsByParent = rebuildPartsIndex(recipeParts);
}

async function loadAll() {
  recipes = await recipeRepo.getAll();

  if (!USE_BACKEND) {
    setParts([]);
    return;
  }

  try {
    const parts = await listAllRecipeParts();
    setParts(parts);
  } catch {
    setParts([]);
  }
}


function installAdminCorner() {
  // Hidden unless ?admin=1
  const isEnabled = new URLSearchParams(location.search).get("admin") === "1";
  if (!isEnabled) return;

  const el = document.createElement("div");
  el.id = "admin-corner";
  el.innerHTML = `
    <button class="admin-btn" type="button" title="Admin">🛠️</button>
    <div class="admin-menu" hidden>
      <a href="#admin">Admin</a>
      <a href="#selftest">Selftest</a>
      <a href="#diagnostics">Diagnostics</a>
    </div>
  `;
  document.body.appendChild(el);

  const btn = el.querySelector(".admin-btn");
  const menu = el.querySelector(".admin-menu");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });

  document.addEventListener("click", (e) => {
    if (!el.contains(e.target)) menu.hidden = true;
  });
}

async function render(view, setView) {
  // Keep the screen awake only while cooking
  if (view.name === "cook") {
    Wake.enable();
  } else {
    Wake.disable();
  }

  // Global overlay: immer rendern, unabhängig vom View-State
  renderTimersOverlay({ appEl, state: view, setView });

  if (view.name === "selftest") {
    const results = [];
    // 1) LocalStorage read/write (best effort)
    try {
      const k = "__selftest__" + Math.random().toString(16).slice(2);
      localStorage.setItem(k, "1");
      const v = localStorage.getItem(k);
      localStorage.removeItem(k);
      results.push({ name: "LocalStorage read/write", ok: v === "1" });
    } catch (e) {
      results.push({ name: "LocalStorage read/write", ok: false, detail: String(e?.message || e) });
    }

    // 2) Backend reachable (only if enabled)
    if (USE_BACKEND) {
      try {
        await listRecipes(); // supabase.js has timeouts/abort
        results.push({ name: "Backend erreichbar (listRecipes)", ok: true });
      } catch (e) {
        results.push({ name: "Backend erreichbar (listRecipes)", ok: false, detail: String(e?.message || e) });
      }
    } else {
      results.push({ name: "Backend erreichbar (übersprungen)", ok: true, detail: "USE_BACKEND=false" });
    }

    // 3) Import function present
    results.push({ name: "Import-Funktion geladen", ok: typeof importRecipesIntoApp === "function" });

    return renderSelftestView({ appEl, state: view, results, setView });
  }


  if (view.name === "diagnostics") {
    // best-effort checks (non-throwing)
    let storageOk = true;
    try {
      const k = "__diag__" + Math.random().toString(16).slice(2);
      localStorage.setItem(k, "1");
      const v = localStorage.getItem(k);
      localStorage.removeItem(k);
      storageOk = v === "1";
    } catch {
      storageOk = false;
    }

    let backendOk = true;
    let backendMs = null;
    if (USE_BACKEND) {
      const t0 = performance.now();
      try {
        await listRecipes();
        backendMs = Math.round(performance.now() - t0);
      } catch {
        backendOk = false;
        backendMs = Math.round(performance.now() - t0);
      }
    } else {
      backendMs = null;
    }

    const info = {
      useBackend: USE_BACKEND,
      storageOk,
      backendOk: USE_BACKEND ? backendOk : true,
      backendMs,
      importOk: typeof importRecipesIntoApp === "function",
      recentErrors: getRecentErrors(),
      onClearErrors: () => clearRecentErrors(),
    };

    return renderDiagnosticsView({ appEl, state: view, info, setView });
  }

  if (view.name === "list") {
    return renderListView({
      appEl,
      state: view,
      recipes,
      partsByParent,
      setView,
      useBackend: USE_BACKEND,
      onImportRecipes: async ({ items, mode }) =>
        runExclusive("importRecipes", async () => {
          await importRecipesIntoApp({
            items,
            mode,
            useBackend: USE_BACKEND,
            listRecipes,
            upsertRecipe,
            toLocalShape,
            saveRecipesLocal,
            loadRecipesLocal,
            setRecipes: (next) => {
              recipes = next;
            },
          });
        }),
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
        recipes = await recipeRepo.remove(id);
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
        return runExclusive(`upsert:${rec.id}`, async () => {
          recipes = await recipeRepo.upsert(rec, { refresh: USE_BACKEND });
        });
      },
      uploadRecipeImage,
    });
  }
  if (view.name === "admin") {
    return renderAdminView({ appEl, recipes, setView });
  }
  if (view.name === "shopping") {
    return renderShoppingView({ appEl, state: view, setView });
  }

  // fallback
  setView({ name: "list", selectedId: null, q: view.q });
}

async function boot() {
  installGlobalErrorHandler();
  installAdminCorner();
  await runExclusive("loadAll", () => loadAll());

  const router = initRouter({
    onViewChange: (view) => render(view, router.setView)
  });

  render(router.getView(), router.setView);
}

boot();
