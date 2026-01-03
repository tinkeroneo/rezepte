// src/app/ui/accountControls.js
// Bind account-related controls after the view is rendered.
// Everything here is "bind once" (via __installed flags), safe to call repeatedly.

export function wireAccountControls(ctx) {
  const {
    readTheme,
    setTheme,
    applyThemeAndOverlay,

    isAuthenticated,
    sbLogout,
    setUseBackend,
    getUseBackend,

    router,
    setActiveSpaceId,
    getAuthContext,
    setOfflineQueueScope,

    updateHeaderBadges,
    runExclusive,
    loadAll,

    reportError,
    showError,

    upsertProfile,
    getProfileCache,
    setProfileCache,

    installAdminCorner,
  } = ctx;

  // THEME
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

  // LOGIN / LOGOUT
  const authBtn = document.getElementById("authBadge");
  if (authBtn && !authBtn.__installed) {
    authBtn.__installed = true;
    authBtn.addEventListener("click", async () => {
      const authed = isAuthenticated?.();

      if (authed) {
        try { sbLogout(); } catch (e) {
          reportError?.(e, { scope: "accountControls", action: String(e?.message || e) });
          showError?.(String(e?.message || e));
        }
        updateHeaderBadges?.();
        router?.setView?.({ name: "login" });
        return;
      }

      if (!getUseBackend()) {
        await setUseBackend(true);
      }

      router?.setView?.({ name: "login" });
      updateHeaderBadges?.();
    });
  }

  // SPACE SELECT
  const spaceSel = document.getElementById("spaceSelect");
  if (spaceSel && !spaceSel.__installed) {
    spaceSel.__installed = true;
    spaceSel.addEventListener("change", async () => {
      const sid = String(spaceSel.value || "").trim();
      if (!sid) return;

      try {
        setActiveSpaceId(sid);
        const ctxAuth = (() => { try { return getAuthContext?.(); } catch { return null; } })();
        setOfflineQueueScope?.({ userId: ctxAuth?.user?.id || null, spaceId: ctxAuth?.spaceId || null });

        updateHeaderBadges?.({ syncing: true });
        await runExclusive?.("loadAll", () => loadAll());
        updateHeaderBadges?.({ syncing: false });

        router?.setView?.({ name: "list", selectedId: null, q: "" });
      } catch (e) {
        reportError?.(e, { scope: "accountControls", action: String(e?.message || e) });
        showError?.(String(e?.message || e));
        alert(String(e?.message || e));
      }
    });
  }

  // DEFAULT SPACE SELECT (Profile)
  const defSel = document.getElementById("defaultSpaceSelect");
  if (defSel && !defSel.__installed) {
    defSel.__installed = true;
    defSel.addEventListener("change", async () => {
      if (!(getUseBackend() && isAuthenticated?.())) return;

      const sid = String(defSel.value || "").trim();
      const nextDefault = sid ? sid : null;

      try {
        updateHeaderBadges?.({ syncing: true });
        const p = await upsertProfile({ default_space_id: nextDefault });
        setProfileCache?.(p);
        updateHeaderBadges?.({ syncing: false });
      } catch (e) {
        reportError?.(e, { scope: "accountControls", action: String(e?.message || e) });
        showError?.(String(e?.message || e));
        updateHeaderBadges?.({ syncing: false });
        alert(`Default-Space speichern fehlgeschlagen: ${String(e?.message || e)}`);
      }
    });
  }

  // ADMIN NAV (badge may be hidden unless enabled)
  const adminBtn = document.getElementById("adminBadge");
  if (adminBtn && !adminBtn.__wiredNav) {
    adminBtn.__wiredNav = true;
    adminBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      location.hash = "admin";
    });
  }

  // ensures text/icons are current + wires profile buttons (safe)
  updateHeaderBadges?.();
  installAdminCorner?.({ reportError, showError }); // safe no-op if not enabled
}
