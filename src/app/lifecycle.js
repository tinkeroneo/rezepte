export function createReloadAllAndRender({
  getUseBackend,
  initAuthAndSpace,
  runExclusive,
  loadAll,
  render,
  getRouter,
  updateHeaderBadges,
  reportError,
  showError,
}) {
  return async function reloadAllAndRender({ reason = "manual" } = {}) {
    try {
      updateHeaderBadges({ syncing: true });

      if (getUseBackend()) {
        try {
          await initAuthAndSpace();
        } catch {
          // ignore
        }
      }

      await runExclusive("loadAll", () => loadAll());

      const router = getRouter();
      await runExclusive("render", () => render(router.getView(), router.setView));
    } catch (e) {
      reportError(e, { scope: "app.main", action: `reloadAllAndRender:${reason}` });
      showError(String(e?.message || e));
    } finally {
      updateHeaderBadges({ syncing: false });
    }
  };
}

export function wireOnlineOfflineHandlers({
  updateHeaderBadges,
  drainOfflineQueue,
  reloadAllAndRender,
}) {
  const onOnline = () => {
    updateHeaderBadges();
    drainOfflineQueue({ reason: "online" });
    reloadAllAndRender({ reason: "online" });
  };

  const onOffline = () => updateHeaderBadges();

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
}
