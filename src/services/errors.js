// src/services/errors.js
// Global error capture + lightweight diagnostics.
// Goals:
// - keep UX calm (banner only for user-relevant errors)
// - keep logs useful (dedupe, context, rate limit)
// - never crash the app while logging

import { logClientEvent } from "../supabase.js";
import { getClientId } from "../domain/clientId.js";

let installed = false;

const recentErrors = []; // newest first via accessor
const MAX_RECENT = 20;

// Persisted (device-local) error log – for diagnostics / bug reports.
// Note: keep small, never store raw recipe data etc.
const ERR_KEY = "tinkeroneo_errors_v1";
const MAX_PERSISTED = 80;

function remember(err, meta = {}) {
  const ts = Date.now();
  const msg = normalizeErr(err);
  const stack = String(err?.stack || "");

  // Dedupe (same message within 10s) -> increment count.
  const prev = recentErrors[0];
  if (prev && prev.message === msg && (ts - prev.ts) < 10_000) {
    prev.count = (prev.count || 1) + 1;
    prev.ts = ts;
    prev.lastMeta = meta;
    return;
  }

  recentErrors.unshift({
    ts,
    message: msg,
    stack,
    count: 1,
    lastMeta: meta,
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
    // Runtime errors should be visible (banner), but still keep it calm.
    showError(ev?.error || ev?.message || "Unbekannter Fehler", { source: "window.error" });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    showError(ev?.reason || "Unhandled Promise Rejection", { source: "unhandledrejection" });
  });
}

export function getStoredErrors() {
  try {
    const list = JSON.parse(localStorage.getItem(ERR_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function clearStoredErrors() {
  try {
    localStorage.removeItem(ERR_KEY);
  } catch {
    // ignore
  }
}

/**
 * Report an error without necessarily showing a banner.
 * - Always adds to recentErrors
 * - Persists to localStorage
 * - Best-effort backend log (rate-limited)
 */
export function reportError(err, meta = {}, opts = {}) {
  const { showBanner = false } = opts || {};
  remember(err, meta);

  const payload = buildLogEntry(err, meta);
  persistLocal(payload);
  sendToBackend(payload);

  if (showBanner) showError(err, meta);
}

export function showError(err, meta = {}) {
  remember(err, meta);

  const entry = buildLogEntry(err, meta);
  persistLocal(entry);
  sendToBackend(entry);

  const msg = entry.message;

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
  if (e === null || e === undefined) return "Unbekannter Fehler";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message || String(e);
  if (typeof e === "object" && typeof e.message === "string") return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

function safeMeta(meta) {
  // Keep meta small and safe (no huge payloads, no full recipe JSON etc.)
  try {
    const out = {};
    const allow = ["scope", "action", "reason", "source", "view", "route", "spaceId", "op", "status"]; // extend if needed
    for (const k of allow) {
      if (meta && meta[k] !== undefined && meta[k] !== null) out[k] = String(meta[k]);
    }
    return out;
  } catch {
    return {};
  }
}

function buildLogEntry(err, meta = {}) {
  const msg = normalizeErr(err);
  const m = safeMeta(meta);
  const metaStr = Object.keys(m).length ? ` | meta=${JSON.stringify(m)}` : "";
  return {
    type: "error",
    message: `${msg}${metaStr}`,
    stack: String(err?.stack || ""),
    href: String(location?.href || ""),
    ua: String(navigator?.userAgent || ""),
    ts: Date.now(),
    clientId: getClientId(),
  };
}

function persistLocal(entry) {
  try {
    const list = JSON.parse(localStorage.getItem(ERR_KEY) || "[]");
    const arr = Array.isArray(list) ? list : [];
    arr.unshift({
      ts: entry.ts,
      type: entry.type,
      message: entry.message,
      stack: entry.stack || null,
      href: entry.href,
    });
    localStorage.setItem(ERR_KEY, JSON.stringify(arr.slice(0, MAX_PERSISTED)));
  } catch {
    // never throw
  }
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

