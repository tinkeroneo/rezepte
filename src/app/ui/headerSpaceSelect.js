// src/app/ui/headerSpaceSelect.js
// Bind the header space selector (always visible) once.
// Keeps in sync with the account space selector.

export function wireHeaderSpaceSelect(ctx) {
  const {
    router,
    setActiveSpaceId,
    getAuthContext,
    setOfflineQueueScope,
    updateHeaderBadges,
    runExclusive,
    loadAll,
    reportError,
  } = ctx || {};

  const headerSel = document.getElementById("headerSpaceSelect");
  if (!headerSel || headerSel.__installed) return;
  headerSel.__installed = true;

  const applySpace = async (sid) => {
    if (!sid) return;

    // keep account select (if present) in sync
    const accountSel = document.getElementById("spaceSelect");
    if (accountSel && String(accountSel.value || "") !== sid) accountSel.value = sid;

    try {
      setActiveSpaceId?.(sid);
      const ctxAuth = (() => { try { return getAuthContext?.(); } catch { return null; } })();
      setOfflineQueueScope?.({ userId: ctxAuth?.user?.id || null, spaceId: ctxAuth?.spaceId || null });

      updateHeaderBadges?.({ syncing: true });
      await runExclusive?.("loadAll", () => loadAll?.());
      updateHeaderBadges?.({ syncing: false });

      router?.setView?.({ name: "list", selectedId: null, q: "" });
    } catch (err) {
      updateHeaderBadges?.({ syncing: false });
      reportError?.(err, { scope: "headerSpaceSelect", action: "change" });
      // revert UI to current active space if possible
      try {
        const ctxAuth = getAuthContext?.();
        const active = String(ctxAuth?.spaceId || "");
        if (active) headerSel.value = active;
      } catch { /* ignore */ }
    }
  };

  headerSel.addEventListener("change", () => {
    const sid = String(headerSel.value || "").trim();
    void applySpace(sid);
  });
}
