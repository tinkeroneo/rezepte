// src/app/boot/bootFlow.js

export async function bootFlow(deps) {
  const {
    appState,
    applyThemeAndOverlay,
    ensureProfileLoaded,
    getAuthContext,
    getProfile,
    initAuthAndSpace,
    initRadioDock,
    initRouter,
    installAdminCorner,
    installGlobalErrorHandler,
    isAuthenticated,
    listMySpaces,
    listRecipes,
    loadAll,
    // on,
    refreshSpaceSelect,
    render,
    reportError,
    runExclusive,
    setActiveSpaceId,
    setDirtyIndicator,
    setOfflineQueueScope,
    setUseBackend,
    showError,
    updateHeaderBadges,
    upsertProfile,
    useBackend,
    wireHeaderSpaceSelect,
    setRouter,
  } = deps;

  // local router ref (also propagated via setRouter)
  let router = null;


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
  if (typeof setRouter === "function") setRouter(router);

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

  return router;
}
