import { renderSelftestView } from "../views/selftest.view.js";
import { renderDiagnosticsView } from "../views/diagnostics.view.js";
import { renderAccountView } from "../views/account.view.js";
import { renderAdminView } from "../views/admin.view.js";
import { renderVegan101View } from "../views/vegan101.view.js";
import { renderShoppingView } from "../views/shopping.view.js";

export async function renderAuxRoute({
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
  renderAccountCtx,
  renderAdminCtx,
  renderVegan101Ctx,
  renderShoppingCtx,
}) {
  if (view.name === "selftest") {
    const results = [];

    try {
      const key = "__selftest__" + Math.random().toString(16).slice(2);
      localStorage.setItem(key, "1");
      const value = localStorage.getItem(key);
      localStorage.removeItem(key);
      results.push({ name: "LocalStorage read/write", ok: value === "1" });
    } catch (e) {
      renderAccountCtx.reportError(e, { scope: "app.js", action: String(e?.message) });
      renderAccountCtx.showError(String(e?.message));
      results.push({ name: "LocalStorage read/write", ok: false, detail: String(e?.message || e) });
    }

    if (useBackend) {
      try {
        await listRecipes();
        results.push({ name: "Backend erreichbar (listRecipes)", ok: true });
      } catch (e) {
        renderAccountCtx.reportError(e, { scope: "app.js", action: String(e?.message) });
        renderAccountCtx.showError(String(e?.message));
        results.push({ name: "Backend erreichbar (listRecipes)", ok: false, detail: String(e?.message || e) });
      }
    } else {
      results.push({ name: "Backend erreichbar (übersprungen)", ok: true, detail: "useBackend=false" });
    }

    results.push({ name: "Import-Funktion geladen", ok: typeof importRecipesIntoApp === "function" });
    renderSelftestView({ appEl, state: view, results, setView });
    return true;
  }

  if (view.name === "diagnostics") {
    let storageOk = true;
    try {
      const key = "__diag__" + Math.random().toString(16).slice(2);
      localStorage.setItem(key, "1");
      const value = localStorage.getItem(key);
      localStorage.removeItem(key);
      storageOk = value === "1";
    } catch {
      storageOk = false;
    }

    let backendOk = true;
    let backendMs = null;

    if (useBackend) {
      const startedAt = performance.now();
      try {
        await listRecipes();
        backendMs = Math.round(performance.now() - startedAt);
      } catch {
        backendOk = false;
        backendMs = Math.round(performance.now() - startedAt);
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
      storedErrors: getStoredErrors?.() || [],
      magicLinkDiag: getLastMagicLinkDiag?.() || null,
      onClearErrors: () => clearRecentErrors(),
      onClearStoredErrors: () => clearStoredErrors?.(),
    };

    renderDiagnosticsView({ appEl, state: view, info, setView });
    return true;
  }

  if (view.name === "account") {
    renderAccountView({ appEl, state: view, setView });
    await renderAccountCtx.refreshSpaceSelect();
    await renderAccountCtx.refreshProfileUi();
    renderAccountCtx.wireAccountControls();
    return true;
  }

  if (view.name === "admin") {
    renderAdminView(renderAdminCtx);
    return true;
  }

  if (view.name === "vegan101") {
    renderVegan101View(renderVegan101Ctx);
    return true;
  }

  if (view.name === "shopping") {
    renderShoppingView(renderShoppingCtx);
    return true;
  }

  return false;
}
