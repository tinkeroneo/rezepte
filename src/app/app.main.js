// Enable verbose logs by setting: localStorage.setItem("debug", "1")
const DEBUG = (() => {
  try {
    return localStorage.getItem("debug") === "1";
  } catch {
    return false;
  }
})();
// src/app/app.main.js

import { reportError, showError } from "../services/errors.js";
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
  declineInvite,
  getProfile,
  upsertProfile,
  updateSpaceName,
  moveRecipeToSpace,
  copyRecipeToSpace,
  deleteRecipe
} from "../supabase.js";

import { initRouter } from "../state.js";
import { saveRecipesLocal, loadRecipesLocal, toLocalShape } from "../domain/recipes.js";
import { importRecipesIntoApp } from "../domain/import.js";
import { createRecipeRepo } from "../domain/recipeRepo.js";
import { rebuildPartsIndex } from "../domain/parts.js";
import { addToShopping } from "../domain/shopping.js";

import { renderListView } from "../views/list.view.js";
import { renderDetailView } from "../views/detail.view.js";
import { renderCookView } from "../views/cook.view.js";
import { renderAddView } from "../views/add.view.js";
import { renderShoppingView } from "../views/shopping.view.js";
import { renderVegan101View } from "../views/vegan101.view.js";
import { renderAdminView } from "../views/admin.view.js";
import { renderSelftestView } from "../views/selftest.view.js";
import { renderDiagnosticsView } from "../views/diagnostics.view.js";
import { renderTimersOverlay } from "../views/timers.view.js";
import { renderLoginView } from "../views/login.view.js";
import { renderInvitesView } from "../views/invites.view.js";
import { renderAccountView } from "../views/account.view.js";
import { setOfflineQueueScope, getOfflineQueue, getPendingRecipeIds, compactOfflineQueue, dequeueOfflineAction } from "../domain/offlineQueue.js";

import { initRadioDock } from "../ui/radioDock.js";
import { Wake } from "../services/wakeLock.js";
import { installGlobalErrorHandler } from "../services/errors.js";
import { getRecentErrors, clearRecentErrors } from "../services/errors.js";
import { runExclusive } from "../services/locks.js";

import { appState } from "./appState.js";
import {
  readUseBackend,
  writeUseBackend,
  readTheme,
  readWinter,
  setTheme,
  setWinter,
  readRadioFeature,
  setRadioFeature,
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
  setTimerSoundVolume
} from "./localSettings.js";

import { applyThemeAndOverlay } from "./ui/theme.js";
import { installHeaderWiring } from "./ui/header.js";
import { wireHeaderSpaceSelect } from "./ui/headerSpaceSelect.js";
import { wireHeaderSpaceToggle } from "./ui/headerSpaceToggle.js";
import { createDirtyIndicator } from "./ui/dirty.js";
import { wireAccountControls } from "./ui/accountControls.js";
import { createHeaderBadgesUpdater } from "./ui/headerBadges.js";
import { installAdminCorner } from "./adminCorner.js";
import { refreshSpaceSelect, getActiveSpaceRole } from "./spaces/spaces.js";
import {



  ensureProfileLoaded,
  refreshProfileUi,
  getProfileCache,
  setProfileCache,
} from "./profile/profile.js";
/* =========================
   CONFIG / STATE
========================= */

let useBackend = readUseBackend();
appState.useBackend = useBackend;
let recipeRepo = null;

let __permBootstrapInFlight = false;
let __permBootstrapAttempts = 0;


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

// --- Global navigation guards / cleanup (Back + unsaved changes) ---
function setDirtyGuard(fn) {
  appState.dirtyGuard = typeof fn === "function" ? fn : null;
}

function setViewCleanup(fn) {
  appState.viewCleanup = typeof fn === "function" ? fn : null;
}

/* =========================
   BACKEND SWITCH
========================= */

// Expose a single backend switch implementation (used by admin.view.js)
export async function setUseBackend(next) {
  const on = !!next;

  // 1) persist
  writeUseBackend(on);

  // 2) runtime state
  useBackend = on;
  appState.useBackend = useBackend;

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
  getMySpaces: () => {
    try { return appState.mySpaces || []; } catch { return []; }
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
   UI / BADGES / THEME
========================= */


const appEl = document.getElementById("app");

const updateHeaderBadges = createHeaderBadgesUpdater({
  getUseBackend: () => useBackend,
  isAuthenticated,
  getOfflineQueue,
  getMySpaces: () => appState.mySpaces,
});

async function drainOfflineQueue({ reason = "auto" } = {}) {
  // Only relevant when backend is enabled + online + authenticated
  if (!useBackend) return { ok: true, skipped: "useBackendOff" };
  if (navigator.onLine === false) return { ok: true, skipped: "offline" };
  if (!isAuthenticated?.()) return { ok: true, skipped: "notAuthed" };

  // Compact queue first to avoid duplicate upserts.
  compactOfflineQueue();
  const q = getOfflineQueue() || [];
  if (q.length === 0) return { ok: true, skipped: "empty" };

  updateHeaderBadges({ syncing: true, syncError: false });
  let anyError = false;

  for (const a of q) {
    try {
      if (a.kind === "recipe_upsert" && a.recipe?.id) {
        await upsertRecipe(a.recipe);
        dequeueOfflineAction(a.id);
      } else if (a.kind === "recipe_delete" && a.recipeId) {
        await deleteRecipe(a.recipeId);
        dequeueOfflineAction(a.id);
      } else {
        // Unknown action -> keep (avoid data loss)
      }
    } catch (e) {
      anyError = true;
      reportError(e, { scope: "offlineSync", action: a?.kind || "unknown", reason });
      // Stop early; backend might be down; keep remaining actions.
      break;
    }
  }

  updateHeaderBadges({ syncing: false, syncError: anyError });
  return { ok: !anyError };
}

function wireOnlineOfflineHandlers() {
  const onOnline = () => {
    updateHeaderBadges();
    // Try to drain queued actions whenever connection comes back.
    drainOfflineQueue({ reason: "online" });
  };
  const onOffline = () => updateHeaderBadges();

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
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
  const ctx = (() => { try { return getAuthContext?.(); } catch { return null; } })();
  const activeSid = String(ctx?.spaceId || "");
  recipes = (await recipeRepo.getAll()).map((r) => ({
    ...r,
    space_id: r.space_id || activeSid || r.spaceId || "",
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
  const activeSpaceId = getAuthContext?.()?.spaceId;

  // "write" is determined by the SPACE of the entity you act on, not by the currently selected space.
  // Active-space write is still useful for list/create defaults:
  const canWrite = !useBackend || canWriteActiveSpace({ spaces: appState.mySpaces, spaceId: activeSpaceId });

  // helper for per-recipe permission (fixes "I must switch space to edit")
  const canWriteForSpace = (spaceId) => !useBackend || canWriteActiveSpace({ spaces: appState.mySpaces, spaceId });

  // Permissions bootstrap: after refresh/auth, spaceId/mySpaces can be temporarily missing.
  // Avoid rendering read-only UI during this transient state.
  if (useBackend && isAuthenticated?.()) {
    const ctx = (() => { try { return getAuthContext?.(); } catch { return null; } })();
    const sid = String(ctx?.spaceId || "").trim();
    const spacesMissing = !Array.isArray(appState.mySpaces) || appState.mySpaces.length === 0;

    // If permissions/space context are still missing right after refresh, bootstrap them once or twice.
    // IMPORTANT: never loop indefinitely — otherwise the app can appear to "hang".
    if ((!sid || spacesMissing) && !__permBootstrapInFlight) {
      if (__permBootstrapAttempts >= 2) {
        // Give up and render normally (read-only may be temporary, but app must remain usable).
        if (DEBUG) console.warn("perm bootstrap: giving up", { sid, spacesMissing, attempts: __permBootstrapAttempts });
      } else {
        __permBootstrapInFlight = true;
        __permBootstrapAttempts++;

        try {
          appEl.innerHTML = `
          <div class="container">
            <div class="card" style="padding:1rem; text-align:center;">
              <div style="font-weight:800;">Lade Space-Rechte…</div>
              <div class="muted" style="margin-top:.35rem;">Einen Moment</div>
            </div>
          </div>`;
        } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }

        try { await refreshSpaceSelect({ listMySpaces, getAuthContext, isAuthenticated }); } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }
        __permBootstrapInFlight = false;

        // Recompute and only re-render if we actually got something new.
        const ctx2 = (() => { try { return getAuthContext?.(); } catch { return null; } })();
        const sid2 = String(ctx2?.spaceId || "").trim();
        const spacesMissing2 = !Array.isArray(appState.mySpaces) || appState.mySpaces.length === 0;
        if (sid2 && !spacesMissing2) {
          // Await to keep render serialized and avoid recursive storms.
          await runExclusive("render", () => render(view, setView));
          return;
        }

        // Still missing → fall through and render normally (no infinite loop).
        if (DEBUG) console.warn("perm bootstrap: still missing", { sid2, spacesMissing2 });
      }
    }
  }



  if (DEBUG) console.log("RENDER VIEW:", view);

  if (view.name === "cook") Wake.enable();
  else Wake.disable();

  // Login view (no timers overlay)
  if (view.name === "login") {
    if (DEBUG) console.log("RENDER LOGIN VIEW");

    const info = {
      redirectTo: new URL("index.html", location.href).toString().replace(/#.*$/, ""),
      debug: `origin=${location.origin}\npath=${location.pathname}\nhash=${location.hash}`,
    };

    return renderLoginView({
      appEl,
      state: view,
      setView,
      useBackend,
      setUseBackend,
      info
    });
  }

  // Invites confirmation view
  if (view.name === "invites") {
    const inv = window.__tinkeroneoPendingInvites || [];
    return renderInvitesView({
      appEl,
      invites: inv,
      onAccept: async (inviteId) => {
        try { await acceptInvite(inviteId); } catch (e) { alert(String(e?.message || e)); }
        try {
          const ctx = await initAuthAndSpace();
          try { await ensureProfileLoaded({ getProfile, upsertProfile, isAuthenticated }); } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }
      // Apply default space (profile.default_space_id) on login/session init
      try {
        const p = getProfileCache?.();
        const defSid = String(p?.default_space_id || "").trim();
        if (defSid && String(ctx?.spaceId || "") !== defSid) {
          setActiveSpaceId(defSid);
          // keep offline queue scoped to new active space
          setOfflineQueueScope({ userId: ctx?.user?.id || null, spaceId: defSid });
          // refresh ctx reference if callers use it later
          try { ctx.spaceId = defSid; } catch (e) { 
        reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message));
           }
        }
      } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }

          try {
            if (useBackend && isAuthenticated?.() && ctx?.spaceId) {
              try {
                await listRecipes();
                await upsertProfile({ last_space_id: ctx.spaceId });
              } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }
            }
          } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }
          window.__tinkeroneoPendingInvites = ctx?.pendingInvites || [];
        } catch {
          window.__tinkeroneoPendingInvites = [];
        }
        if (!(window.__tinkeroneoPendingInvites || []).length) {
          await drainOfflineQueue({ reason: "boot" });
          await runExclusive("loadAll", () => loadAll());
          setView({ name: "list", selectedId: null, q: "" });
          return;
        }
        render({ name: "invites" }, setView);
      },
      onDecline: async (inviteId) => {
        try { await declineInvite(inviteId); } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message));
        alert(String(e?.message || e)); }
        try {
          const ctx = await initAuthAndSpace();
          try { await ensureProfileLoaded({ getProfile, upsertProfile, isAuthenticated }); } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }
      // Apply default space (profile.default_space_id) on login/session init
      try {
        const p = getProfileCache?.();
        const defSid = String(p?.default_space_id || "").trim();
        if (defSid && String(ctx?.spaceId || "") !== defSid) {
          setActiveSpaceId(defSid);
          // keep offline queue scoped to new active space
          setOfflineQueueScope({ userId: ctx?.user?.id || null, spaceId: defSid });
          // refresh ctx reference if callers use it later
          try { ctx.spaceId = defSid; } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }
        }
      } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }

          try {
            if (useBackend && isAuthenticated?.() && ctx?.spaceId) {
              try {
                await listRecipes();
                await upsertProfile({ last_space_id: ctx.spaceId });
              } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }
            }
          } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }
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
              reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message));
      results.push({ name: "LocalStorage read/write", ok: false, detail: String(e?.message || e) });
    }

    if (useBackend) {
      try {
        await listRecipes();
        results.push({ name: "Backend erreichbar (listRecipes)", ok: true });
      } catch (e) {
                reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message));
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
      queueLen: (getOfflineQueue?.() || []).length,
      onRetrySync: () => drainOfflineQueue({ reason: "diagnostics" }),
      recentErrors: getRecentErrors(),
      onClearErrors: () => clearRecentErrors(),
    };

    return renderDiagnosticsView({ appEl, state: view, info, setView });
  }


const onImportRecipesHandler = async ({ items, mode, targetSpaceId }) =>
  runExclusive("importRecipes", async () => {
    // optional: import into selected space (backend only)
    const sid = String(targetSpaceId || "").trim();
    if (useBackend && sid) {
      try {
        setActiveSpaceId(sid);
        const ctx = (() => { try { return getAuthContext(); } catch { return null; } })();
        setOfflineQueueScope({ userId: ctx?.user?.id || null, spaceId: ctx?.spaceId || null });
        await refreshSpaceSelect({ listMySpaces, getAuthContext, isAuthenticated });
        await refreshProfileUi({ getAuthContext, getProfile, upsertProfile, isAuthenticated });
        updateHeaderBadges?.();
      } catch (e) {
        reportError(e, { scope: "app.main", action: "importSwitchSpace" });
        showError(String(e?.message || e));
      }
    }

    await importRecipesIntoApp({
      items,
      mode,
      repo: appState.repo,
      useBackend,
      spaceId: String(getAuthContext?.()?.spaceId || ""),
    });

    await loadAll();
  });


  if (view.name === "account") {
    renderAccountView({ appEl, state: view, setView });
    await refreshSpaceSelect({ listMySpaces, getAuthContext, isAuthenticated });
    await refreshProfileUi({ getAuthContext, getProfile, upsertProfile, isAuthenticated });
    wireAccountControls({
      readTheme,
      setTheme,
      applyThemeAndOverlay,
      isAuthenticated,
      sbLogout,
      setUseBackend,
      getUseBackend: () => useBackend,
      router,
      setActiveSpaceId,
      getAuthContext,
      getMySpaces: () => appState.mySpaces,
      inviteToSpace,
      listPendingInvites,
      listSpaceMembers,
      revokeInvite,
      setOfflineQueueScope,
      updateHeaderBadges,
      runExclusive,
      loadAll,
      reportError,
      showError,
      upsertProfile,
      getProfileCache,
      setProfileCache,

      refreshSpaceSelect: () => refreshSpaceSelect({ listMySpaces, getAuthContext, isAuthenticated }),
      refreshProfileUi: () => refreshProfileUi({ getAuthContext, getProfile, upsertProfile, isAuthenticated }),
      updateSpaceName,
      installAdminCorner,

      onImportRecipes: onImportRecipesHandler,
      getExportData: () => ({ recipes, partsByParent }),
    });

    return;
  }


  if (view.name === "list") {
    return renderListView({
      appEl,
      state: view,
      recipes,
      partsByParent,
      setView,
      useBackend,
      canWrite,
      mySpaces: appState.mySpaces,
      activeSpaceId,
      onImportRecipes: onImportRecipesHandler,
      });
  }

  if (view.name === "detail") {
    const r = recipes.find(x => x.id === view.selectedId);
    const detailCanWrite = canWriteForSpace(r?.space_id || activeSpaceId);

    return renderDetailView({
      appEl,
      state: view,
      recipes,
      partsByParent,
      recipeParts,
      setView,
      useBackend,
      canWrite: detailCanWrite,
      mySpaces: appState.mySpaces,
      copyRecipeToSpace,
      refreshAll: async () => runExclusive("loadAll", () => loadAll()),
      sbDelete: async (id) => {
        await recipeRepo.remove(id);
        await runExclusive("loadAll", () => loadAll());
      },
      removeRecipePart,
      addRecipePart,
      listAllRecipeParts,
      onUpdateRecipe: async (rec) => {
        return runExclusive(`upsert:${rec.id}`, async () => {
          recipes = await recipeRepo.upsert(rec, { refresh: useBackend });
          runExclusive("render", () => render(router.getView(), router.setView));
        });
      },
      addToShopping,
      rebuildPartsIndexSetter: (freshParts) => setParts(freshParts),
    });
  }

  if (view.name === "cook") {
    return renderCookView({
      canWrite, appEl, state: view, recipes, partsByParent, setView, setViewCleanup, setDirtyGuard
    });
  }

  if (view.name === "add") {
    const existing = view.selectedId ? recipes.find(r => r.id === view.selectedId) : null;
    const addCanWrite = canWriteForSpace(existing?.space_id || activeSpaceId);

    return renderAddView({
      appEl,
      state: view,
      recipes,
      activeSpaceId,
      setView,
      useBackend,
      canWrite: addCanWrite,
      setDirtyGuard,
      setDirtyIndicator,
      setViewCleanup,
      mySpaces: appState.mySpaces,
      moveRecipeToSpace,
      upsertProfile,
      listRecipes,
      refreshSpaceSelect: () => refreshSpaceSelect({ listMySpaces, getAuthContext, isAuthenticated }),
      upsertSpaceLast: async (sid) => {
        try {
          await listRecipes();
          await upsertProfile({ last_space_id: sid });
        } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }
      },
      upsertRecipe: async (rec) => {
        const key = `upsert:${rec.id || "new"}`;
        return runExclusive(key, async () => {
          await recipeRepo.upsert(rec, { refresh: useBackend });
          await runExclusive("loadAll", () => loadAll());
        });
      },
      uploadRecipeImage,
    });
  }

  if (view.name === "admin") {
    return renderAdminView({ canWrite, appEl, recipes, setView });
  }

  if (view.name === "vegan101") {
    return renderVegan101View({ canWrite, appEl, setView });
  }

  if (view.name === "shopping") {
    return renderShoppingView({ appEl, state: view, setView });
  }

  setView({ name: "list", selectedId: null, q: view.q });
}


/* =========================
   DIRTY INDICATOR
========================= */

const setDirtyIndicator = createDirtyIndicator();

export function startApp() {
  installHeaderWiring();
  wireOnlineOfflineHandlers();
  // Keep behavior: don't await boot() here (boot does its own async work)
  boot();
}

/* =========================
   BOOT
========================= */

async function boot() {
  installGlobalErrorHandler();
  installAdminCorner();
  applyThemeAndOverlay();
  updateHeaderBadges();

  initRadioDock();

  window.addEventListener("online", () => updateHeaderBadges());
  window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => applyThemeAndOverlay());

  window.__tinkeroneoUpdateBadges = () => updateHeaderBadges();


  // If page was opened via Supabase magic link, consume auth hash BEFORE router touches location.hash.
  if (useBackend && typeof location !== 'undefined') {
    const h = String(location.hash || '');
    if (h.includes('access_token=') && h.includes('refresh_token=')) {
      try { await initAuthAndSpace(); } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }
    }
  }

  router = initRouter({
    canNavigate: ({ reason }) => {
      if (!appState.dirtyGuard) return true;
      return appState.dirtyGuard({ reason }) !== false;
    },
    onViewChange: (view) => {
      if (appState.viewCleanup) {
        try { appState.viewCleanup(); } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message));
        console.warn("viewCleanup failed", e); }
        appState.viewCleanup = null;
      }
      appState.dirtyGuard = null;
      setDirtyIndicator(false);

      // Serialize renders to avoid permission/UI flicker due to overlapping async renders.
      runExclusive("render", () => render(view, router.setView));

      try {
        const cb = document.querySelector(".cookbar");
        if (cb) {
          const h = Math.ceil(cb.getBoundingClientRect().height);
          document.documentElement.style.setProperty("--cookbar-h", `${h}px`);
        } else {
          document.documentElement.style.removeProperty("--cookbar-h");
        }
      } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }
    },
  });

  // Share router for modules (header/back, etc.)
  appState.router = router;

  // Header: Space selector (always visible)
  wireHeaderSpaceSelect({
    router,
    setActiveSpaceId,
    getAuthContext,
    setOfflineQueueScope,
    updateHeaderBadges,
    runExclusive,
    loadAll,
    reportError,
  });
  wireHeaderSpaceToggle();


  // Header controls
  const modeBtn = document.getElementById("modeBadge");
  if (modeBtn && !modeBtn.__installed) {
    modeBtn.__installed = true;
    modeBtn.addEventListener("click", async () => {
      await setUseBackend(!useBackend);
      updateHeaderBadges();
    });
  }

  const accountBtn = document.getElementById("accountBtn");
  if (accountBtn && !accountBtn.__installed) {
    accountBtn.__installed = true;
    accountBtn.addEventListener("click", () => {
      location.hash = "#account";
    });
  }

  const shoppingBtn = document.getElementById("shopBadge");
  if (shoppingBtn && !shoppingBtn.__installed) {
    shoppingBtn.__installed = true;
    shoppingBtn.addEventListener("click", () => router.setView({ name: "shopping" }));
  }

  // If backend enabled: init auth before backend calls
  if (useBackend) {
    try {
      const ctx = await initAuthAndSpace();

      // Load spaces (network, with local cache fallback) before any permission-dependent UI.
      try { await refreshSpaceSelect({ listMySpaces, getAuthContext, isAuthenticated }); } catch (e) {
        reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message));
      }

      let p = null;
      try { p = await ensureProfileLoaded({ getProfile, upsertProfile, isAuthenticated }); } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }
      // Apply default space (profile.default_space_id) on login/session init
      try {
        const defSid = String(p?.default_space_id || "").trim();
        if (defSid && String(ctx?.spaceId || "") !== defSid) {
          setActiveSpaceId(defSid);
          // keep offline queue scoped to new active space
          setOfflineQueueScope({ userId: ctx?.user?.id || null, spaceId: defSid });
          // refresh ctx reference if callers use it later
          try { ctx.spaceId = defSid; } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }

          // refresh spaces/UI after switching space
          try { await refreshSpaceSelect({ listMySpaces, getAuthContext, isAuthenticated }); } catch (e) {
            reportError(e, { scope: "app.js", action: String(e?.message) });
            showError(String(e?.message));
          }
        }
      } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }

      try {
        if (useBackend && isAuthenticated?.() && ctx?.spaceId) {
          try {
            await listRecipes();
            await upsertProfile({ last_space_id: ctx.spaceId });
          } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }
        }
      } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }
      if (ctx?.user?.id || ctx?.spaceId) {
        setOfflineQueueScope({ userId: ctx.user?.id || null, spaceId: ctx.spaceId || null });
      }
      if (Array.isArray(ctx?.pendingInvites) && ctx.pendingInvites.length) {
        window.__tinkeroneoPendingInvites = ctx.pendingInvites;
        router.setView({ name: "invites" });
      } else if (!ctx?.spaceId && !isAuthenticated?.()) {
        router.setView({ name: "login" });
      } else if (!ctx?.spaceId && isAuthenticated?.()) {
        try { await setUseBackend(false); } catch (e) { 
                  reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message)); }
      }

      await refreshSpaceSelect({ listMySpaces, getAuthContext, isAuthenticated });
    } catch (e) {
              reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message));
      console.error("Auth/Space init failed:", e);
      try {
        if (!navigator.onLine) {
          await setUseBackend(false);
        }
      } catch (err) { 
                  reportError(err, { scope: "app.js", action: String(err?.message) });
        showError(String(err?.message)); }
      if (!isAuthenticated?.()) {
        router.setView({ name: "login" });
      }
    }
  }

  updateHeaderBadges({ syncing: true });
  await runExclusive("loadAll", () => loadAll());
  updateHeaderBadges({ syncing: false });

  await runExclusive("render", () => render(router.getView(), router.setView));
}
function canWriteActiveSpace({ spaces, spaceId }) {
  const role = getActiveSpaceRole({ spaces, spaceId });
  return role === "owner" || role === "editor";
}