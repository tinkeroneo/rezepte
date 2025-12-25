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
import { initRadioDock } from "./ui/radioDock.js";
import { Wake } from "./services/wakeLock.js";
import { KEYS, lsGetStr, lsSetStr } from "./storage.js";
import { installGlobalErrorHandler } from "./services/errors.js";
import { getRecentErrors, clearRecentErrors } from "./services/errors.js";
import { runExclusive } from "./services/locks.js";
import { ensureRadioDock } from "./services/radio.js"; // oder wo es liegt


const DEFAULT_USE_BACKEND = true;
//

ensureRadioDock();

function readUseBackend() {
  const v = lsGetStr(KEYS.USE_BACKEND, "");
  if (v === "0") return false;
  if (v === "1") return true;
  return DEFAULT_USE_BACKEND;
}

function setUseBackend(next) {
  lsSetStr(KEYS.USE_BACKEND, next ? "1" : "0");
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
  // Default: 125ms (short beep interval); keep within sensible bounds
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
  // Default: 120s; keep within sensible bounds
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

// Allow admin view to change simple settings without circular imports
window.__tinkeroneoSettings = {
  readUseBackend,
  setUseBackend: (v) => setUseBackend(v),
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

// Admin access: URL param (?admin=1) OR hidden "easter egg" flag in localStorage
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

const appEl = document.getElementById("app");

function applyThemeAndOverlay() {
  const theme = readTheme();
  const wantsDark = theme === "dark" || (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)")?.matches);
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
      sync.textContent = "OFFLINE";
      sync.classList.add("badge--warn");
      sync.classList.remove("badge--ok", "badge--bad");
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

const recipeRepo = createRecipeRepo({
  useBackend,
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


function installAdminCorner() {
  // Hidden unless enabled (param or easter-egg)
  const mount = () => {
    document.getElementById("admin-corner")?.remove();
    if (!isAdminEnabled()) return;

    const el = document.createElement("div");
    el.id = "admin-corner";
    el.innerHTML = `
      <button class="admin-btn" type="button" title="Admin">🛠️</button>
    `;
    document.body.appendChild(el);

    const btn = el.querySelector(".admin-btn");
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Direct jump to admin; Selftest/Diagnostics are accessible there.
      location.hash = "admin";
    });
  };

  // Easter egg: 7 taps on header toggles admin flag.
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
    if (useBackend) {
      try {
        await listRecipes(); // supabase.js has timeouts/abort
        results.push({ name: "Backend erreichbar (listRecipes)", ok: true });
      } catch (e) {
        results.push({ name: "Backend erreichbar (listRecipes)", ok: false, detail: String(e?.message || e) });
      }
    } else {
      results.push({ name: "Backend erreichbar (übersprungen)", ok: true, detail: "useBackend=false" });
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
    if (useBackend) {
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

async function boot() {
  installGlobalErrorHandler();
  installAdminCorner();
  applyThemeAndOverlay();
  updateHeaderBadges();

  // persistent mini radio (does not reset on route changes)
  initRadioDock();

  window.addEventListener("online", () => updateHeaderBadges());
  window.addEventListener("offline", () => updateHeaderBadges());
  window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => applyThemeAndOverlay());

  // expose for other modules that want to trigger a quick refresh of badges
  window.__tinkeroneoUpdateBadges = () => updateHeaderBadges();

  // show syncing badge while initial load runs
  updateHeaderBadges({ syncing: true });
  await runExclusive("loadAll", () => loadAll());
  updateHeaderBadges({ syncing: false });

  const router = initRouter({
    onViewChange: (view) => render(view, router.setView)
  });

  render(router.getView(), router.setView);
}

boot();
