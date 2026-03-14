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
import { markBackendOffline, markBackendOnline } from "../services/backendStatus.js";
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
  getSharedRecipe,
  deleteRecipe,
  createRecipeShare,
  getLastMagicLinkDiag
} from "../supabase.js";
import { __debugAuthSnapshot } from "../supabase.js";

import { initRouter } from "../state.js";
import { saveRecipesLocal, loadRecipesLocal, toLocalShape } from "../domain/recipes.js";
import { importRecipesIntoApp } from "../domain/import.js";
import { createRecipeRepo } from "../domain/recipeRepo.js";
import { rebuildPartsIndex } from "../domain/parts.js";
import { addToShopping } from "../domain/shopping.js";

import { renderListView } from "../views/list.view.js";
import { renderDetailView } from "../views/detail.view.js";
import { renderTimersOverlay } from "../views/timers.view.js";
import { renderLoginView } from "../views/login.view.js";
import { renderConfirmView } from "../views/confirm.view.js";
import { renderShareView } from "../views/share.view.js";
import { setOfflineQueueScope, getOfflineQueue, getPendingRecipeIds, compactOfflineQueue, dequeueOfflineAction } from "../domain/offlineQueue.js";

import { initRadioDock } from "../ui/radioDock.js";
import { Wake } from "../services/wakeLock.js";
import { installGlobalErrorHandler } from "../services/errors.js";
import { getRecentErrors, clearRecentErrors, getStoredErrors, clearStoredErrors } from "../services/errors.js";
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
  setTimerSoundVolume,
  readImageModeDebug,
  setImageModeDebug
} from "./localSettings.js";
import { withLoader } from "../ui/loader.js";
import { applyThemeAndOverlay } from "./ui/theme.js";
import { installHeaderWiring } from "./ui/header.js";
import { wireHeaderSpaceSelect } from "./ui/headerSpaceSelect.js";
import { wireHeaderSpaceToggle } from "./ui/headerSpaceToggle.js";
import { createDirtyIndicator } from "./ui/dirty.js";
import { wireAccountControls } from "./ui/accountControls.js";
import { createHeaderBadgesUpdater } from "./ui/headerBadges.js";
import { installAdminCorner } from "./adminCorner.js";
import { refreshSpaceSelect, getActiveSpaceRole } from "./spaces/spaces.js";
import { renderInvitesRoute } from "./invitesRoute.js";
import { createReloadAllAndRender, wireOnlineOfflineHandlers } from "./lifecycle.js";
import { installSettingsBridge } from "./settingsBridge.js";
import { createOfflineQueueDrainer } from "./offlineSync.js";
import { createLoadAll, createPartsStore } from "./dataLoader.js";
import { renderAuxRoute } from "./renderAuxRoutes.js";
import { renderEditorRoute } from "./renderEditorRoutes.js";
import { ensureRenderPermissions } from "./renderPermissions.js";
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

installSettingsBridge({
  readUseBackend,
  setUseBackend,
  getAuthContext,
  getMySpaces: () => appState.mySpaces,
  inviteToSpace,
  listPendingInvites,
  listSpaceMembers,
  revokeInvite,
  readTheme,
  setTheme,
  readWinter,
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
  setTimerSoundVolume,
  readImageModeDebug,
  setImageModeDebug,
});

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

const drainOfflineQueue = createOfflineQueueDrainer({
  getUseBackend: () => useBackend,
  isAuthenticated,
  compactOfflineQueue,
  getOfflineQueue,
  dequeueOfflineAction,
  updateHeaderBadges,
  withLoader,
  upsertRecipe,
  deleteRecipe,
  reportError,
});

/* =========================
   DATA STATE
========================= */

let recipes = [];
const partsStore = createPartsStore({ rebuildPartsIndex });
const loadAll = createLoadAll({
  getRecipeRepo: () => recipeRepo,
  rebuildRecipeRepo,
  getUseBackend: () => useBackend,
  getPendingRecipeIds,
  getAuthContext,
  getPartsStore: () => partsStore,
  listAllRecipeParts,
  markBackendOnline,
  markBackendOffline,
  setRecipes: (nextRecipes) => {
    recipes = nextRecipes;
  },
});


const reloadAllAndRender = createReloadAllAndRender({
  getUseBackend: () => useBackend,
  initAuthAndSpace,
  runExclusive,
  loadAll,
  render,
  getRouter: () => router,
  updateHeaderBadges,
  reportError,
  showError,
});

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
    const permissionRenderHandled = await ensureRenderPermissions({
      useBackend,
      isAuthenticated,
      getAuthContext,
      getMySpaces: () => appState.mySpaces,
      appEl,
      reportError,
      showError,
      refreshSpaceSelect: () => refreshSpaceSelect({ listMySpaces, getAuthContext, isAuthenticated }),
      runExclusive,
      render,
      view,
      setView,
      getBootstrapState: () => ({
        inFlight: __permBootstrapInFlight,
        attempts: __permBootstrapAttempts,
      }),
      setBootstrapState: ({
        inFlight = __permBootstrapInFlight,
        attempts = __permBootstrapAttempts,
      } = {}) => {
        __permBootstrapInFlight = inFlight;
        __permBootstrapAttempts = attempts;
      },
      debug: DEBUG,
    });
    if (permissionRenderHandled) return;

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


  // Confirm view (magic-link token_hash flow)
  if (view.name === "confirm") {
    return renderConfirmView({
      appEl,
      state: view,
      setView: router.setView,
    });
  }

  // Share view (public read-only recipe)
  if (view.name === "share") {
    renderShareView({
      appEl,
      state: view,
      setView,
      getSharedRecipe,
      isAuthenticated,
      recipes: appState.recipes,
    });
    return;
  }


  // Invites confirmation view
  if (view.name === "invites") {
    return renderInvitesRoute({
      appEl,
      setView,
      render,
      acceptInvite,
      declineInvite,
      initAuthAndSpace,
      ensureProfileLoaded,
      getProfile,
      upsertProfile,
      isAuthenticated,
      useBackend,
      listRecipes,
      reportError,
      showError,
      drainOfflineQueue,
      runExclusive,
      loadAll,
    });
  }

  // Global overlay always (except login)
  renderTimersOverlay({ appEl, state: view, setView });

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
        repo: recipeRepo,
        useBackend,
        spaceId: String(getAuthContext?.()?.spaceId || ""),
      });

      await loadAll();
    });

  const handledAuxRoute = await renderAuxRoute({
    view,
    appEl,
    setView,
    useBackend,
    listRecipes,
    importRecipesIntoApp,
    getOfflineQueue,
    drainOfflineQueue,
    getRecentErrors,
    getStoredErrors,
    getLastMagicLinkDiag,
    clearRecentErrors,
    clearStoredErrors,
    renderAccountCtx: {
      refreshSpaceSelect: () => refreshSpaceSelect({ listMySpaces, getAuthContext, isAuthenticated }),
      refreshProfileUi: () => refreshProfileUi({ getAuthContext, getProfile, upsertProfile, isAuthenticated }),
      wireAccountControls: () =>
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
          getExportData: () => ({ recipes, partsByParent: partsStore.getPartsByParent() }),
        }),
      reportError,
      showError,
    },
    renderAdminCtx: { canWrite, appEl, recipes, setView },
    renderVegan101Ctx: { canWrite, appEl, setView },
    renderShoppingCtx: { appEl, state: view, setView },
  });
  if (handledAuxRoute) return;


  if (view.name === "list") {
    return renderListView({
      appEl,
      state: view,
      recipes,
      partsByParent: partsStore.getPartsByParent(),
      setView,
      useBackend,
      canWrite,
      mySpaces: appState.mySpaces,
      activeSpaceId,
      onImportRecipes: onImportRecipesHandler,
      onSyncNow: () => drainOfflineQueue({ reason: "listManual" }),
    });
  }

  if (view.name === "detail") {
    const r = recipes.find(x => x.id === view.selectedId);
    const detailCanWrite = canWriteForSpace(r?.space_id || activeSpaceId);

    return renderDetailView({
      appEl,
      state: view,
      recipes,
      partsByParent: partsStore.getPartsByParent(),
      recipeParts: partsStore.getRecipeParts(),
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
      createRecipeShare,
      listAllRecipeParts,
      onUpdateRecipe: async (rec) => {
        return runExclusive(`upsert:${rec.id}`, async () => {
          recipes = await recipeRepo.upsert(rec, { refresh: useBackend });
          runExclusive("render", () => render(router.getView(), router.setView));
        });
      },
      addToShopping,
      rebuildPartsIndexSetter: (freshParts) => partsStore.setParts(freshParts),
    });
  }

  const handledEditorRoute = renderEditorRoute({
    view,
    appEl,
    recipes,
    partsByParent: partsStore.getPartsByParent(),
    activeSpaceId,
    setView,
    useBackend,
    canWrite,
    canWriteForSpace,
    setDirtyGuard,
    setDirtyIndicator,
    setViewCleanup,
    mySpaces: appState.mySpaces,
    moveRecipeToSpace,
    upsertProfile,
    listRecipes,
    refreshSpaceSelect: () => refreshSpaceSelect({ listMySpaces, getAuthContext, isAuthenticated }),
    reportError,
    showError,
    recipeRepo,
    runExclusive,
    loadAll,
    uploadRecipeImage,
  });
  if (handledEditorRoute) return handledEditorRoute;

  setView({ name: "list", selectedId: null, q: view.q });
}


/* =========================
   DIRTY INDICATOR
========================= */

const setDirtyIndicator = createDirtyIndicator();

export function startApp() {
  installHeaderWiring();
  wireOnlineOfflineHandlers({
    updateHeaderBadges,
    drainOfflineQueue,
    reloadAllAndRender,
  });

  // Retry handler used by offline banner.
  window.addEventListener("backend:retry", () => {
    // If router not ready yet, boot() will do the initial load.
    try { reloadAllAndRender({ reason: "banner" }); } catch { /* ignore */ }
  });

  // Keep behavior: don't await boot() here (boot does its own async work)
  boot();
  function installDebugOverlay() {
    window.__forceRefresh = true;

    const el = document.createElement("div");
    el.id = "authDebug";
    el.style.cssText =
      "position:fixed;left:8px;bottom:8px;z-index:99999;" +
      "background:rgba(0,0,0,.75);color:#fff;padding:8px;" +
      "border-radius:10px;font:12px/1.2 monospace;" +
      "max-width:92vw;white-space:pre-wrap;";
    document.body.appendChild(el);

    const tick = () => {
      const s = __debugAuthSnapshot();
      el.textContent =
        `AUTH DBG\n` +
        `lsAuth: ${s.lsAuthPresent} (len ${s.lsAuthLen})\n` +
        `hasSession: ${s.hasSession} hasRefresh: ${s.hasRefresh}\n` +
        `expires_at: ${s.expires_at}\n` +
        `userId: ${s.userId}\n` +
        `spaceId: ${s.spaceId}\n` +
        `lastEvent: ${s.lastEvent}\n` +
        `lastErr: ${s.lastErr}\n`;
      setTimeout(tick, 1500);
    };
    tick();
  }

  // Debug overlay (only when enabled)
  try {
    if (localStorage.getItem("debugAuth") === "1") installDebugOverlay();
  } catch { /* ignore */ }

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

  // When the app returns from background (mobile sleep), refresh auth once (best-effort).
  // This prevents "looks logged out" behavior when the access token expired while the app was paused.
  let __authResumeInflight = false;
  async function __resumeRefreshAuth() {
    if (!useBackend || __authResumeInflight) return;
    __authResumeInflight = true;
    try { await initAuthAndSpace(); } catch { /* ignore */ }
    finally { __authResumeInflight = false; }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") __resumeRefreshAuth();
  });
  window.addEventListener("focus", () => __resumeRefreshAuth());



  // If page was opened via Supabase magic link, consume auth hash BEFORE router touches location.hash.
  if (useBackend && typeof location !== 'undefined') {
    const h = String(location.hash || '');
    if (h.includes('access_token=') && h.includes('refresh_token=')) {
      try { await initAuthAndSpace(); } catch (e) {
        reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message));
      }
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
          console.warn("viewCleanup failed", e);
        }
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
        showError(String(e?.message));
      }
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
      try {
        await refreshSpaceSelect({ listMySpaces, getAuthContext, isAuthenticated });
      } catch (e) {
        reportError(e, { scope: "app.main", action: "refreshSpaceSelect" });
      }

      // Ensure profile exists/loaded (non-fatal if it fails temporarily).
      try {
        await ensureProfileLoaded({ getProfile, upsertProfile, isAuthenticated });
      } catch (e) {
        reportError(e, { scope: "app.main", action: "ensureProfileLoaded" });
      }

      // Persist last used space server-side (helps multi-device), but never override client choice on refresh.
      if (isAuthenticated?.() && ctx?.spaceId) {
        try {
          await upsertProfile({ last_space_id: ctx.spaceId });
        } catch (e) {
          reportError(e, { scope: "app.main", action: "upsertProfile:last_space_id" });
        }
      }

      // Scope offline queue to current user/space
      if (ctx?.user?.id || ctx?.spaceId) {
        setOfflineQueueScope({ userId: ctx.user?.id || null, spaceId: ctx.spaceId || null });
      }

      // Clear stale pending invites (important: invite view uses this global)
      if (!Array.isArray(ctx?.pendingInvites) || ctx.pendingInvites.length === 0) {
        try { delete window.__tinkeroneoPendingInvites; } catch { 
          //
        }
        // If we are currently on invites view, leave it (otherwise it can "stick")
        const v = router?.getView?.() || null;
        const name =
          v?.name ||
          (String(location.hash || "").replace(/^#/, "").split("?")[0].split("/")[0] || "");

        if (name === "invites") {
          // go somewhere sensible depending on auth/space
          if (!isAuthenticated?.()) router.setView({ name: "login" });
          else if (ctx?.spaceId) router.setView({ name: "list", selectedId: null, q: "" });
          else router.setView({ name: "account" }); // or "list" if you prefer
        }
      }

      // Route handling
      if (Array.isArray(ctx?.pendingInvites) && ctx.pendingInvites.length) {
        // 👉 Nur wenn es wirklich Einladungen gibt, zeigen wir die Invite-View
        window.__tinkeroneoPendingInvites = ctx.pendingInvites;
        router.setView({ name: "invites" });
        return;
      }

      if (!ctx?.spaceId && !isAuthenticated?.()) {
        // 👉 Nicht eingeloggt: Login erzwingen
        //    (confirm darf durch, damit Magiclink funktioniert)
        const v = router?.getView?.() || null;
        const name =
          v?.name ||
          (String(location.hash || "").replace(/^#/, "").split("?")[0].split("/")[0] || "");

        if (name !== "confirm" && name !== "share") {
          router.setView({ name: "login" });
        }
        return;
      }

      if (!ctx?.spaceId && isAuthenticated?.()) {
        // 👉 Eingeloggt, aber:
        //    - keine Einladungen
        //    - kein Space
        //    => einfach nichts erzwingen
        //    (App bleibt stabil, kein Local-Fallback, kein Invite-UI)
        return;
      }



      // Final refresh of space UI after potential routing changes.
      try {
        await refreshSpaceSelect({ listMySpaces, getAuthContext, isAuthenticated });
      } catch (e) {
        reportError(e, { scope: "app.main", action: "refreshSpaceSelect:final" });
      }
    } catch (e) {
      reportError(e, { scope: "app.main", action: "initAuthAndSpace" });
      console.error("Auth/Space init failed:", e);

      // If offline, degrade gracefully
      try {
        if (!navigator.onLine) await setUseBackend(false);
      } catch (err) {
        reportError(err, { scope: "app.main", action: "setUseBackend:offline" });
      }

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
