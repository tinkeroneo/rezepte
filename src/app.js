// src/app.js


import {
  listRecipes,
  upsertRecipe,
  deleteRecipe as sbDelete,
  uploadRecipeImage,
  listAllRecipeParts,
  addRecipePart,
  removeRecipePart,
  initAuthAndSpace
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
import { renderLoginView } from "./views/login.view.js";

import { initRadioDock } from "./ui/radioDock.js";
import { Wake } from "./services/wakeLock.js";
import { KEYS, lsGetStr, lsSetStr, setStorageScope } from "./storage.js";
import { installGlobalErrorHandler } from "./services/errors.js";
import { getRecentErrors, clearRecentErrors } from "./services/errors.js";
import { runExclusive } from "./services/locks.js";
import { ensureRadioDock } from "./services/radio.js";

/* =========================
   CONFIG / STATE
========================= */

const DEFAULT_USE_BACKEND = true;
ensureRadioDock();

function readUseBackend() {
  const v = lsGetStr(KEYS.USE_BACKEND, "");
  if (v === "0") return false;
  if (v === "1") return true;
  return DEFAULT_USE_BACKEND;
}

function readTheme() {
  const v = lsGetStr(KEYS.THEME, "");
  return v || "system"; // system | light | dark
}
function setTheme(v) {
  lsSetStr(KEYS.THEME, v || "system");
}

function readWinter() {
  const v = lsGetStr(KEYS.WINTER, "");
  if (v === "1") return true;
  if (v === "0") return false;
  return false;
}
function setWinter(on) {
  lsSetStr(KEYS.WINTER, on ? "1" : "0");
}

// Timer settings (ring + step highlight)
function readTimerRingIntervalMs() {
  const raw = lsGetStr(KEYS.TIMER_RING_INTERVAL_MS, "");
  const n = Number(raw);
  if (!Number.isFinite(n)) return 125;
  return Math.max(125, Math.min(5000, Math.round(n)));
}
function setTimerRingIntervalMs(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return;
  const clamped = Math.max(125, Math.min(5000, Math.round(n)));
  lsSetStr(KEYS.TIMER_RING_INTERVAL_MS, String(clamped));
}

function readTimerMaxRingSeconds() {
  const raw = lsGetStr(KEYS.TIMER_MAX_RING_SECONDS, "");
  const n = Number(raw);
  if (!Number.isFinite(n)) return 120;
  return Math.max(10, Math.min(600, Math.round(n)));
}
function setTimerMaxRingSeconds(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n)) return;
  const clamped = Math.max(10, Math.min(600, Math.round(n)));
  lsSetStr(KEYS.TIMER_MAX_RING_SECONDS, String(clamped));
}

function readTimerStepHighlight() {
  const v = lsGetStr(KEYS.TIMER_STEP_HIGHLIGHT, "");
  if (v === "0") return false;
  if (v === "1") return true;
  return true; // default on
}
function setTimerStepHighlight(on) {
  lsSetStr(KEYS.TIMER_STEP_HIGHLIGHT, on ? "1" : "0");
}

let useBackend = readUseBackend();
let recipeRepo = null;

function rebuildRecipeRepo(on) {
  recipeRepo = createRecipeRepo({
    useBackend: on,
    listRecipes,
    upsertRecipe,
    deleteRecipe: sbDelete,
    loadRecipesLocal,
    saveRecipesLocal,
    toLocalShape,
  });
}

// IMPORTANT: initial repo build (otherwise recipeRepo is null)
rebuildRecipeRepo(useBackend);

// Global router reference (needed by setUseBackend)
let router = null;

// Expose a single backend switch implementation (used by admin.view.js)
export async function setUseBackend(next) {
  const on = !!next;

  // 1) persist
  lsSetStr(KEYS.USE_BACKEND, on ? "1" : "0");

  // 2) runtime state
  useBackend = on;

  // 3) rebuild repo wiring
  rebuildRecipeRepo(useBackend);

  // 4) reload data according to new mode
  updateHeaderBadges({ syncing: true });
  await runExclusive("loadAll", () => loadAll());
  updateHeaderBadges({ syncing: false });

  // 5) rerender current view (only if router exists already)
  if (router?.getView && router?.setView) {
    const current = router.getView() || { name: "list" };
    render(current, router.setView);
  }
}

// Allow admin view to change settings without circular imports
window.__tinkeroneoSettings = {
  readUseBackend,
  setUseBackend: async (v) => setUseBackend(v),

  readTheme,
  setTheme: (v) => setTheme(v),

  readWinter,
  setWinter: (on) => setWinter(on),

  readTimerRingIntervalMs,
  setTimerRingIntervalMs,

  readTimerMaxRingSeconds,
  setTimerMaxRingSeconds,

  readTimerStepHighlight,
  setTimerStepHighlight,
};

/* =========================
   ADMIN CORNER
========================= */

const ADMIN_FLAG_KEY = "tinkeroneo_admin_enabled_v1";

function isAdminEnabled() {
  const url = new URL(location.href);
  const byParam = url.searchParams.get("admin") === "1";
  let byFlag = false;
  try { byFlag = localStorage.getItem(ADMIN_FLAG_KEY) === "1"; } catch { byFlag = false; }
  return byParam || byFlag;
}
function setAdminEnabled(v) {
  try { localStorage.setItem(ADMIN_FLAG_KEY, v ? "1" : "0"); } catch { /* ignore */ }
}

function installAdminCorner() {
  const mount = () => {
    document.getElementById("admin-corner")?.remove();
    if (!isAdminEnabled()) return;

    const el = document.createElement("div");
    el.id = "admin-corner";
    el.innerHTML = `<button class="admin-btn" type="button" title="Admin">🛠️</button>`;
    document.body.appendChild(el);

    el.querySelector(".admin-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      location.hash = "admin";
    });
  };

  const header = document.querySelector("header");
  if (header && !header.__adminEggInstalled) {
    header.__adminEggInstalled = true;
    let taps = 0;
    let t0 = 0;
    header.addEventListener("click", () => {
      const now = Date.now();
      if (!t0 || now - t0 > 2000) { t0 = now; taps = 0; }
      taps++;
      if (taps >= 7) {
        taps = 0;
        const next = !isAdminEnabled();
        setAdminEnabled(next);
        mount();
      }
    });
  }

  mount();
}

/* =========================
   UI / BADGES / THEME
========================= */

const appEl = document.getElementById("app");

function applyThemeAndOverlay() {
  const theme = readTheme();
  const wantsDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)")?.matches);

  document.body.classList.toggle("dark", !!wantsDark);
  document.body.classList.toggle("winter", readWinter());
}

function updateHeaderBadges({ syncing = false, syncError = false } = {}) {
  const mode = document.getElementById("modeBadge");
  if (mode) {
    mode.textContent = useBackend ? "CLOUD" : "LOCAL";
    mode.classList.toggle("badge--ok", useBackend);
    mode.classList.toggle("badge--warn", !useBackend);
  }

  const sync = document.getElementById("syncBadge");
  if (sync) {
    sync.hidden = !syncing && !syncError && navigator.onLine;

    if (!navigator.onLine) {
      // optional: show offline badge
    } else if (syncError) {
      sync.textContent = "SYNC";
      sync.classList.add("badge--bad");
      sync.classList.remove("badge--ok", "badge--warn");
    } else {
      sync.textContent = "⟳";
      sync.classList.add("badge--ok");
      sync.classList.remove("badge--warn", "badge--bad");
    }
  }
}

/* =========================
   DATA STATE
========================= */

let recipes = [];
let recipeParts = [];
let partsByParent = new Map();

function setParts(newParts) {
  recipeParts = newParts ?? [];
  partsByParent = rebuildPartsIndex(recipeParts);
}

async function loadAll() {
  if (!recipeRepo) rebuildRecipeRepo(useBackend);

  recipes = await recipeRepo.getAll();

  if (!useBackend) {
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

/* =========================
   RENDER
========================= */

async function render(view, setView) {
  console.log("RENDER VIEW:", view);
  // Keep the screen awake only while cooking
  if (view.name === "cook") Wake.enable();
  else Wake.disable();

  // Login view (no timers overlay)
  if (view.name === "login") {
    console.log("RENDER LOGIN VIEW");

    const info = {
      // IMPORTANT: redirect should point to the actual index.html in dev
      redirectTo: location.origin + location.pathname,
      debug: `origin=${location.origin}\npath=${location.pathname}\nhash=${location.hash}`,
    };
    return renderLoginView({ appEl, state: view, setView, info });
  }

  // Global overlay always (except login)
  renderTimersOverlay({ appEl, state: view, setView });

  if (view.name === "selftest") {
    const results = [];

    try {
      const k = "__selftest__" + Math.random().toString(16).slice(2);
      localStorage.setItem(k, "1");
      const v = localStorage.getItem(k);
      localStorage.removeItem(k);
      results.push({ name: "LocalStorage read/write", ok: v === "1" });
    } catch (e) {
      results.push({ name: "LocalStorage read/write", ok: false, detail: String(e?.message || e) });
    }

    if (useBackend) {
      try {
        await listRecipes();
        results.push({ name: "Backend erreichbar (listRecipes)", ok: true });
      } catch (e) {
        results.push({ name: "Backend erreichbar (listRecipes)", ok: false, detail: String(e?.message || e) });
      }
    } else {
      results.push({ name: "Backend erreichbar (übersprungen)", ok: true, detail: "useBackend=false" });
    }

    results.push({ name: "Import-Funktion geladen", ok: typeof importRecipesIntoApp === "function" });

    return renderSelftestView({ appEl, state: view, results, setView });
  }

  if (view.name === "diagnostics") {
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

    if (useBackend) {
      const t0 = performance.now();
      try {
        await listRecipes();
        backendMs = Math.round(performance.now() - t0);
      } catch {
        backendOk = false;
        backendMs = Math.round(performance.now() - t0);
      }
    }

    const info = {
      useBackend,
      storageOk,
      backendOk: useBackend ? backendOk : true,
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
      useBackend,
      onImportRecipes: async ({ items, mode }) =>
        runExclusive("importRecipes", async () => {
          await importRecipesIntoApp({
            items,
            mode,
            useBackend,
            listRecipes,
            upsertRecipe,
            toLocalShape,
            saveRecipesLocal,
            loadRecipesLocal,
            setRecipes: (next) => { recipes = next; },
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
      useBackend,
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
      useBackend,
      upsertRecipe: async (rec) => {
        return runExclusive(`upsert:${rec.id}`, async () => {
          recipes = await recipeRepo.upsert(rec, { refresh: useBackend });
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

/* =========================
   BOOT
========================= */

async function boot() {
  installGlobalErrorHandler();
  installAdminCorner();
  applyThemeAndOverlay();
  updateHeaderBadges();

  // persistent mini radio (does not reset on route changes)
  initRadioDock();

  window.addEventListener("online", () => updateHeaderBadges());
  window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => applyThemeAndOverlay());

  window.__tinkeroneoUpdateBadges = () => updateHeaderBadges();

  // If backend enabled: Auth+Space must be initialized BEFORE any backend call
  // router must exist always (even if we end up in login)
  router = initRouter({
    onViewChange: (view) => render(view, router.setView),
  });

  // Now that router exists, we can route to login safely
  if (useBackend) {
    try {
      const ctx = await initAuthAndSpace();
      // Privacy: scope local storage per user+space. If not logged in, isolate.
      setStorageScope({ userId: ctx?.userId || null, spaceId: ctx?.spaceId || null });
      if (!ctx?.spaceId) {
        router.setView({ name: "login" });
      }
    } catch (e) {
      console.error("Auth/Space init failed:", e);
      setStorageScope({ userId: null, spaceId: null });
      router.setView({ name: "login" });
    }
  }

  updateHeaderBadges({ syncing: true });
  await runExclusive("loadAll", () => loadAll());
  updateHeaderBadges({ syncing: false });

  render(router.getView(), router.setView);
}

boot();
