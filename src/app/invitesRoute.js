import { renderInvitesView } from "../views/invites.view.js";

async function refreshPendingInvites({
  initAuthAndSpace,
  ensureProfileLoaded,
  getProfile,
  upsertProfile,
  isAuthenticated,
  useBackend,
  listRecipes,
  reportError,
  showError,
}) {
  try {
    const ctx = await initAuthAndSpace();

    try {
      await ensureProfileLoaded({ getProfile, upsertProfile, isAuthenticated });
    } catch (e) {
      reportError(e, { scope: "app.js", action: String(e?.message) });
      showError(String(e?.message));
    }

    try {
      if (useBackend && isAuthenticated?.() && ctx?.spaceId) {
        try {
          await listRecipes();
          await upsertProfile({ last_space_id: ctx.spaceId });
        } catch (e) {
          reportError(e, { scope: "app.js", action: String(e?.message) });
          showError(String(e?.message));
        }
      }
    } catch (e) {
      reportError(e, { scope: "app.js", action: String(e?.message) });
      showError(String(e?.message));
    }

    window.__tinkeroneoPendingInvites = ctx?.pendingInvites || [];
  } catch {
    window.__tinkeroneoPendingInvites = [];
  }
}

export function renderInvitesRoute({
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
}) {
  const invites = window.__tinkeroneoPendingInvites || [];

  return renderInvitesView({
    appEl,
    invites,
    onAccept: async (inviteId) => {
      try {
        await acceptInvite(inviteId);
      } catch (e) {
        showError(String(e?.message || e));
      }

      await refreshPendingInvites({
        initAuthAndSpace,
        ensureProfileLoaded,
        getProfile,
        upsertProfile,
        isAuthenticated,
        useBackend,
        listRecipes,
        reportError,
        showError,
      });

      if (!(window.__tinkeroneoPendingInvites || []).length) {
        await drainOfflineQueue({ reason: "boot" });
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
        reportError(e, { scope: "app.js", action: String(e?.message) });
        showError(String(e?.message));
      }

      await refreshPendingInvites({
        initAuthAndSpace,
        ensureProfileLoaded,
        getProfile,
        upsertProfile,
        isAuthenticated,
        useBackend,
        listRecipes,
        reportError,
        showError,
      });

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
