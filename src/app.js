// src/app.js


import {
  listRecipes,
  upsertRecipe,
  deleteRecipe as sbDelete,
  uploadRecipeImage,
  listAllRecipeParts,
  addRecipePart,
  removeRecipePart,
  initAuthAndSpace,
  getAuthContext,
  inviteToSpace,
  listPendingInvites,
  listSpaceMembers,
  revokeInvite,
  logout as sbLogout,
  isAuthenticated,
  listMySpaces,
  setActiveSpaceId,
  acceptInvite,
  declineInvite
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
import { renderInvitesView } from "./views/invites.view.js";

import { setOfflineQueueScope, getOfflineQueue, getPendingRecipeIds } from "./domain/offlineQueue.js";

import { initRadioDock } from "./ui/radioDock.js";
import { Wake } from "./services/wakeLock.js";
import { KEYS, lsGetStr, lsSetStr } from "./storage.js";
import { installGlobalErrorHandler } from "./services/errors.js";
import { getRecentErrors, clearRecentErrors } from "./services/errors.js";
import { runExclusive } from "./services/locks.js";
/* =========================
   CONFIG / STATE
========================= */

// Default should be local-first (offline friendly). User can switch to CLOUD anytime.
const DEFAULT_USE_BACKEND = false;

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

// Radio (feature + consent)
function readRadioFeature() {
  const v = lsGetStr(KEYS.RADIO_FEATURE, "");
  if (v === "1") return true;
  if (v === "0") return false;
  return true; // default ON
}
function setRadioFeature(on) {
  lsSetStr(KEYS.RADIO_FEATURE, on ? "1" : "0");
  window.dispatchEvent(new window.Event("tinkeroneo:radioFeatureChanged"));
}
function readRadioConsent() {
  const v = lsGetStr(KEYS.RADIO_CONSENT, "");
  if (v === "1") return true;
  if (v === "0") return false;
  return false;
}
function clearRadioConsent() {
  lsSetStr(KEYS.RADIO_CONSENT, "0");
  window.dispatchEvent(new window.Event("tinkeroneo:radioFeatureChanged"));
}

// Timer settings (ring + step highlight)
function readTimerRingIntervalMs() {
  const raw = lsGetStr(KEYS.TIMER_RING_INTERVAL_MS, "");
  const n = Number(raw);
  if (!Number.isFinite(n)) return 2800;
  return Math.max(250, Math.min(10000, Math.round(n)));
}
function setTimerRingIntervalMs(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return;
  const clamped = Math.max(250, Math.min(10000, Math.round(n)));
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

// Timer sound settings
function readTimerSoundEnabled() {
  const raw = lsGetStr(KEYS.TIMER_SOUND_ENABLED, "");
  if (raw === "0") return false;
  if (raw === "1") return true;
  return true; // default ON
}
function setTimerSoundEnabled(on) {
  lsSetStr(KEYS.TIMER_SOUND_ENABLED, on ? "1" : "0");
  window.dispatchEvent(new window.Event("tinkeroneo:timerSoundChanged"));
}

function readTimerSoundId() {
  const raw = lsGetStr(KEYS.TIMER_SOUND_ID, "");
  const v = String(raw || "").trim();
  if (!v) return "gong"; // default
  const allowed = new Set(["gong", "wood", "pulse", "bowl"]);
  return allowed.has(v) ? v : "gong";
}
function setTimerSoundId(id) {
  const v = String(id || "").trim();
  const allowed = new Set(["gong", "wood", "pulse", "bowl"]);
  const safe = allowed.has(v) ? v : "gong";
  lsSetStr(KEYS.TIMER_SOUND_ID, safe);
  window.dispatchEvent(new window.Event("tinkeroneo:timerSoundChanged"));
}

function readTimerSoundVolume() {
  const raw = lsGetStr(KEYS.TIMER_SOUND_VOLUME, "");
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0.7;
  return Math.max(0, Math.min(1, n));
}
function setTimerSoundVolume(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return;
  const clamped = Math.max(0, Math.min(1, n));
  lsSetStr(KEYS.TIMER_SOUND_VOLUME, String(clamped));
  window.dispatchEvent(new window.Event("tinkeroneo:timerSoundChanged"));
}


let useBackend = readUseBackend();
let recipeRepo = null;
let mySpaces = [];

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

  // auth/space context (only meaningful in CLOUD)
  getAuthContext: () => {
    try { return getAuthContext(); } catch { return null; }
  },
  inviteToSpace: async ({ email, role, spaceId }) => inviteToSpace({ email, role, spaceId }),
  listPendingInvites: async ({ spaceId } = {}) => listPendingInvites({ spaceId }),
  listSpaceMembers: async ({ spaceId } = {}) => listSpaceMembers({ spaceId }),
  revokeInvite: async (inviteId) => revokeInvite(inviteId),

  readTheme,
  setTheme: (v) => setTheme(v),

  readWinter,
  setWinter: (on) => setWinter(on),

  readRadioFeature,
  setRadioFeature: (on) => setRadioFeature(on),
  readRadioConsent,
  clearRadioConsent,

  readTimerRingIntervalMs,
  setTimerRingIntervalMs,

  readTimerMaxRingSeconds,
  setTimerMaxRingSeconds,

  readTimerStepHighlight,
  setTimerStepHighlight,

  readTimerSoundEnabled,
  setTimerSoundEnabled,

  readTimerSoundId,
  setTimerSoundId,

  readTimerSoundVolume,
  setTimerSoundVolume,
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
    const btn = document.getElementById("adminBadge");
    if (!btn) return;

    btn.hidden = !isAdminEnabled();
    if (!btn.__wired) {
      btn.__wired = true;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        location.hash = "admin";
      });
    }
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

  // Preferred: drive theming via tokens on :root[data-theme].
  // Back-compat: also toggle body.dark (older selectors).
  const resolved = wantsDark ? "dark" : "light";
  document.documentElement.dataset.theme = resolved;
  document.body.classList.toggle("dark", !!wantsDark);

  // Overlay
  document.body.classList.toggle("winter", readWinter());
}

function updateHeaderBadges({ syncing = false, syncError = false } = {}) {
  const mode = document.getElementById("modeBadge");
  if (mode) {
    mode.textContent = useBackend ? "☁️" : "🖥️";
    mode.classList.toggle("badge--ok", useBackend);
    mode.classList.toggle("badge--warn", !useBackend);
    mode.title = useBackend
      ? "☁️CLOUD: Sync + Teilen im Space (Supabase). Klick = auf LOCAL (nur dieses Gerät)."
      : "🖥️LOCAL: nur auf diesem Gerät (offline). Klick = auf CLOUD (Sync + Teilen).";
  }

  const authBtn = document.getElementById("authBadge");
  if (authBtn) {
    const authed = isAuthenticated?.();
    authBtn.textContent = authed ? "🔐 LOGOUT" : "🔐 LOGIN";
    authBtn.classList.toggle("badge--ok", authed);
    authBtn.classList.toggle("badge--warn", !authed);
    authBtn.title = authed ? "Abmelden" : (useBackend ? "Anmelden per Magic Link" : "Für Login/Sharing: erst auf CLOUD umschalten");
  }

  const sync = document.getElementById("syncBadge");
  if (sync) {
    const pending = (getOfflineQueue?.() || []).length;
    const showPending = navigator.onLine && !syncing && !syncError && pending > 0;

    // Visible when syncing, error, offline, or pending actions exist
    sync.hidden = !syncing && !syncError && navigator.onLine && pending === 0;

    if (!navigator.onLine) {
      sync.textContent = "OFFLINE";
      sync.classList.add("badge--warn");
      sync.classList.remove("badge--ok", "badge--bad");
    } else if (syncError) {
      sync.textContent = "SYNC";
      sync.classList.add("badge--bad");
      sync.classList.remove("badge--ok", "badge--warn");
    } else if (showPending) {
      sync.textContent = `PENDING ${pending}`;
      sync.classList.add("badge--warn");
      sync.classList.remove("badge--ok", "badge--bad");
    } else {
      sync.textContent = "⟳";
      sync.classList.add("badge--ok");
      sync.classList.remove("badge--warn", "badge--bad");
    }

    if (!navigator.onLine) sync.title = "Offline: Änderungen bleiben lokal und werden später synchronisiert";
    else if (syncError) sync.title = "Sync-Fehler: bitte später nochmal";
    else if (showPending) sync.title = `${pending} Änderung(en) warten auf Sync`;
    else sync.title = "Sync ok";
  }

  // Space selector (only meaningful in CLOUD + authed)
  const spaceSel = document.getElementById("spaceSelect");
  if (spaceSel) {
    const authed = isAuthenticated?.();
    spaceSel.hidden = !authed || !Array.isArray(mySpaces) || mySpaces.length === 0;
  }
}

async function refreshSpaceSelect() {
  const sel = document.getElementById("spaceSelect");
  if (!sel) return;

  if (!(useBackend && isAuthenticated?.())) {
    mySpaces = [];
    sel.innerHTML = "";
    sel.hidden = true;
    return;
  }

  try {
    mySpaces = await listMySpaces();
  } catch {
    mySpaces = [];
  }

  const ctx = (() => {
    try { return getAuthContext(); } catch { return null; }
  })();
  const active = String(ctx?.spaceId || "");

  if (!Array.isArray(mySpaces) || mySpaces.length === 0) {
    sel.innerHTML = "";
    sel.hidden = true;
    return;
  }

  // Show the current space even if there is only one (better UX than an empty/hidden selector)
  if (mySpaces.length === 1) {
    const s = mySpaces[0];
    const sid = String(s?.space_id || "");
    const name = String(s?.name || sid);
    const role = String(s?.role || "viewer");
    const esc = (x) => String(x).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
    sel.innerHTML = `<option value="${esc(sid)}" selected>${esc(`${name} (${role})`)}</option>`;
    sel.disabled = true;
    sel.hidden = false;
    return;
  }

  sel.disabled = false;

  sel.innerHTML = mySpaces
    .map(s => {
      const sid = String(s?.space_id || "");
      const name = String(s?.name || sid);
      const role = String(s?.role || "viewer");
      const label = `${name} (${role})`;
      const esc = (x) => String(x).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
      return `<option value="${esc(sid)}" ${sid === active ? "selected" : ""}>${esc(label)}</option>`;
    })
    .join("");

  sel.hidden = false;
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

  const pendingIds = getPendingRecipeIds?.() || new Set();
  recipes = (await recipeRepo.getAll()).map((r) => ({
    ...r,
    _pending: pendingIds.has(r.id),
  }));


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
      // redirect should always land on index.html (avoid directory listing)
      redirectTo: new URL("index.html", location.href).toString().replace(/#.*$/, ""),
      debug: `origin=${location.origin}\npath=${location.pathname}\nhash=${location.hash}`,
    };
    return renderLoginView({ appEl, state: view, setView, info });
  }

  // Invites confirmation view
  if (view.name === "invites") {
    const inv = window.__tinkeroneoPendingInvites || [];
    return renderInvitesView({
      appEl,
      invites: inv,
      onAccept: async (inviteId) => {
        try {
          await acceptInvite(inviteId);
        } catch (e) {
          alert(String(e?.message || e));
        }
        // reload invites list
        try {
          const ctx = await initAuthAndSpace();
          window.__tinkeroneoPendingInvites = ctx?.pendingInvites || [];
        } catch {
          window.__tinkeroneoPendingInvites = [];
        }
        // if none left, continue
        if (!(window.__tinkeroneoPendingInvites || []).length) {
          await runExclusive("loadAll", () => loadAll());
          setView({ name: "list", selectedId: null, q: "" });
          return;
        }
        render({ name: "invites" }, setView);
      },
      onDecline: async (inviteId) => {
        try {
          await declineInvite(inviteId);
        } catch (e) {
          alert(String(e?.message || e));
        }
        try {
          const ctx = await initAuthAndSpace();
          window.__tinkeroneoPendingInvites = ctx?.pendingInvites || [];
        } catch {
          window.__tinkeroneoPendingInvites = [];
        }
        if (!(window.__tinkeroneoPendingInvites || []).length) {
          await runExclusive("loadAll", () => loadAll());
          setView({ name: "list", selectedId: null, q: "" });
          return;
        }
        render({ name: "invites" }, setView);
      },
      onSkip: async () => {
        await runExclusive("loadAll", () => loadAll());
        setView({ name: "list", selectedId: null, q: "" });
      },
    });
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
      onUpdateRecipe: async (rec) => {
        return runExclusive(`upsert:${rec.id}`, async () => {
          recipes = await recipeRepo.upsert(rec, { refresh: useBackend });
          // ensure current view keeps updated recipe
          render(router.getView(), router.setView);
        });
      },
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

  // Header controls: mode toggle + login/logout (router now available)
  const modeBtn = document.getElementById("modeBadge");
  if (modeBtn && !modeBtn.__installed) {
    modeBtn.__installed = true;
    modeBtn.addEventListener("click", async () => {
      await setUseBackend(!useBackend);
      updateHeaderBadges();
    });
  }


const userBadge = document.getElementById("userBadge");
const userMenu = document.getElementById("userMenu");

userBadge.addEventListener("click", (e) => {
  e.stopPropagation();
  userMenu.hidden = !userMenu.hidden;

  // Positionieren relativ zum Badge
  const rect = userBadge.getBoundingClientRect();
  userMenu.style.position = "absolute";
  userMenu.style.top = rect.bottom + 6 + "px";
  userMenu.style.left = rect.right - userMenu.offsetWidth + "px";
});
// Klick außerhalb schließt das Menü
document.addEventListener("click", (e) => {
  if (!userMenu.contains(e.target)) {
    userMenu.hidden = true;
  } 
});







const shoppingBtn = document.getElementById("shopBadge");
shoppingBtn.addEventListener("click", () => router.setView({ name: "shopping" }));

  const themeBtn = document.getElementById("themeBadge");
  if (themeBtn && !themeBtn.__installed) {
    themeBtn.__installed = true;
    const applyThemeBtn = () => {
      const t = readTheme();
      themeBtn.title = `Theme wechseln (aktuell: ${t})`;
      themeBtn.textContent = t === "dark" ? "🌙 THEME" : (t === "light" ? "☀️THEME" : "🌓 THEME");
    };
    applyThemeBtn();
    themeBtn.addEventListener("click", () => {
      const t = readTheme();
      const next = t === "system" ? "dark" : (t === "dark" ? "light" : "system");
      setTheme(next);
      applyThemeAndOverlay();
      applyThemeBtn();
    });
    window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => {
      if (readTheme() === "system") {
        applyThemeAndOverlay();
        applyThemeBtn();
      }
    });
  }

  const authBtn = document.getElementById("authBadge");
  if (authBtn && !authBtn.__installed) {
    authBtn.__installed = true;
    authBtn.addEventListener("click", async () => {
      const authed = isAuthenticated?.();

      // If already authenticated, allow logout regardless of LOCAL/CLOUD.
      if (authed) {
        try { sbLogout(); } catch { /* ignore */ }
        updateHeaderBadges();
        router.setView({ name: "login" });
        return;
      }

      // Not authenticated:
      // If we're local-only, switch to cloud and open login.
      if (!useBackend) {
        await setUseBackend(true);
      }

      router.setView({ name: "login" });
      updateHeaderBadges();
    });
  }

  const spaceSel = document.getElementById("spaceSelect");
  if (spaceSel && !spaceSel.__installed) {
    spaceSel.__installed = true;
    spaceSel.addEventListener("change", async () => {
      const sid = String(spaceSel.value || "").trim();
      if (!sid) return;
      try {
        setActiveSpaceId(sid);
        const ctx = (() => { try { return getAuthContext(); } catch { return null; } })();
        setOfflineQueueScope({ userId: ctx?.user?.id || null, spaceId: ctx?.spaceId || null });

        updateHeaderBadges({ syncing: true });
        await runExclusive("loadAll", () => loadAll());
        updateHeaderBadges({ syncing: false });
        router.setView({ name: "list", selectedId: null, q: "" });
      } catch (e) {
        alert(String(e?.message || e));
      }
    });
  }

  // Now that router exists, we can init auth.
  // Important: do NOT bounce users to Login just because network/RLS is temporarily failing.
  // We keep LOCAL usable offline and keep auth tokens in storage.
  if (useBackend) {
    try {
      const ctx = await initAuthAndSpace();
      if (ctx?.userId || ctx?.spaceId) {
        setOfflineQueueScope({ userId: ctx.userId || null, spaceId: ctx.spaceId || null });
      }
      // pending invites -> user must confirm
      if (Array.isArray(ctx?.pendingInvites) && ctx.pendingInvites.length) {
        window.__tinkeroneoPendingInvites = ctx.pendingInvites;
        router.setView({ name: "invites" });
      } else if (!ctx?.spaceId && !isAuthenticated?.()) {
        router.setView({ name: "login" });
      } else if (!ctx?.spaceId && isAuthenticated?.()) {
        // Session ok but space unresolved => stay usable in LOCAL
        try { await setUseBackend(false); } catch { /* ignore */ }
      }

      await refreshSpaceSelect();
    } catch (e) {
      console.error("Auth/Space init failed:", e);
      // If offline or backend hiccup: fall back to LOCAL but keep session.
      try {
        if (!navigator.onLine) {
          await setUseBackend(false);
        }
      } catch { /* ignore */ }
      // Only force login when we truly have no session.
      if (!isAuthenticated?.()) {
        router.setView({ name: "login" });
      }
    }
  }

  updateHeaderBadges({ syncing: true });
  await runExclusive("loadAll", () => loadAll());
  updateHeaderBadges({ syncing: false });

  render(router.getView(), router.setView);
}

boot();
