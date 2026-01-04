// src/app/errors/uiErrors.js
// Small helpers to keep UI error handling consistent (report + banner + optional alert)

export function makeUiErrorHandler({ reportError, showError } = {}) {
  const rep = typeof reportError === "function" ? reportError : null;
  const show = typeof showError === "function" ? showError : null;

  function normalizeMsg(e) {
    return String(e?.message || e || "Unbekannter Fehler");
  }

  function handle(e, meta = {}) {
    try { rep?.(e, meta); } catch { /* ignore */ }
    try { show?.(normalizeMsg(e)); } catch { /* ignore */ }
  }

  async function run(meta, fn) {
    try {
      return await fn();
    } catch (e) {
      handle(e, meta);
      return null;
    }
  }

  return { handle, run };
}
