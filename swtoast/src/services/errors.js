// src/services/errors.js
// Global error banner for runtime errors & unhandled promise rejections.

import { logClientEvent } from "../supabase.js";
import { getClientId } from "../domain/clientId.js";

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

  // Best-effort: also persist to backend (do not crash app).
  sendToBackend({
    type: "error",
    message: msg,
    stack: String(err?.stack || ""),
    href: String(location?.href || ""),
    ua: String(navigator?.userAgent || ""),
    ts: Date.now(),
    clientId: getClientId(),
  });

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
let __lastSendAt = 0;
let __sentInWindow = 0;

async function sendToBackend(entry) {
  // simple rate limit to avoid loops
  const now = Date.now();
  if (now - __lastSendAt > 30_000) { __lastSendAt = now; __sentInWindow = 0; }
  __sentInWindow++;
  if (__sentInWindow > 4) return;

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

