// src/services/errors.js
// Global error banner for runtime errors & unhandled promise rejections.

let installed = false;

const recentErrors = []; // newest first via accessor
const MAX_RECENT = 20;

function remember(err) {
  const msg = normalizeErr(err);
  recentErrors.unshift({
    ts: Date.now(),
    message: msg,
    stack: String(err?.stack || ""),
  });
  if (recentErrors.length > MAX_RECENT) recentErrors.length = MAX_RECENT;
}

export function getRecentErrors() {
  return recentErrors.slice();
}

export function clearRecentErrors() {
  recentErrors.length = 0;
}

export function installGlobalErrorHandler() {
  if (installed) return;
  installed = true;

  window.addEventListener("error", (ev) => {
    showError(ev?.error || ev?.message || "Unbekannter Fehler");
  });

  window.addEventListener("unhandledrejection", (ev) => {
    showError(ev?.reason || "Unhandled Promise Rejection");
  });
}

function showError(err) {
  remember(err);

  const msg = normalizeErr(err);

  let el = document.getElementById("globalErrorBanner");
  if (!el) {
    el = document.createElement("div");
    el.id = "globalErrorBanner";
    el.innerHTML = `
      <div class="geb-inner">
        <div class="geb-title">Fehler</div>
        <div class="geb-msg" id="globalErrorBannerMsg"></div>
        <button class="btn btn-ghost geb-close" id="globalErrorBannerClose" aria-label="Close">×</button>
      </div>
    `;
    document.body.appendChild(el);

    const closeBtn = el.querySelector("#globalErrorBannerClose");
    closeBtn?.addEventListener("click", () => {
      el.remove();
    });
  }

  const msgEl = el.querySelector("#globalErrorBannerMsg");
  if (msgEl) msgEl.textContent = msg;
}

function normalizeErr(e) {
  if (e == null) return "Unbekannter Fehler";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message || String(e);
  try { return JSON.stringify(e); } catch { return String(e); }
}
async function sendToBackend(entry) {
  try {
    await logClientEvent({
      type: entry.type,
      message: entry.message,
      stack: entry.stack || null,
      href: entry.href,
      ua: entry.ua,
      ts: entry.ts,
      client_id: entry.clientId,
    });
  } catch {
    // ignore
  }
}

