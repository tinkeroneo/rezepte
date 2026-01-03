// src/app/profile/profile.js

import { appState } from "../appState.js";

function escHtml(x) {
  return String(x)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function ensureProfileLoaded({ getProfile, upsertProfile, isAuthenticated } = {}) {
  if (!(appState.useBackend && isAuthenticated?.())) return null;
  try {
    appState.profileCache = await getProfile?.();
    if (!appState.profileCache) {
      appState.profileCache = await upsertProfile?.({});
    }
    return appState.profileCache;
  } catch {
    return null;
  }
}

export function getProfileCache() {
  return appState.profileCache;
}

export function setProfileCache(p) {
  appState.profileCache = p || null;
}

export async function refreshDefaultSpaceSelect({
  getAuthContext,
  isAuthenticated,
  ensureProfileLoaded: ensureFn,
} = {}) {
  const sel = document.getElementById("defaultSpaceSelect");
  if (!sel) return;

  if (!(appState.useBackend && isAuthenticated?.())) {
    sel.innerHTML = "";
    sel.hidden = true;
    return;
  }

  const ctx = (() => {
    try { return getAuthContext?.(); } catch { return null; }
  })();
  const activeSpaceId = String(ctx?.spaceId || "");
  const spaces = Array.isArray(appState.mySpaces) ? appState.mySpaces : [];

  const p = await (ensureFn?.() ?? null);
  const def = String(p?.default_space_id || "");

  const opts = [];
  opts.push(`<option value="">${escHtml("(keiner)")}</option>`);
  for (const s of spaces) {
    const sid = String(s?.space_id || "");
    const name = String(s?.name || sid);
    const role = String(s?.role || "viewer");
    const label = `${name} (${role})`;
    opts.push(`<option value="${escHtml(sid)}">${escHtml(label)}</option>`);
  }
  sel.innerHTML = opts.join("");
  sel.value = def || "";
  sel.hidden = false;
  sel.title = def ? `Default-Space: ${def}` : "Kein Default-Space";

  // small UX: if only one space exists and is active, preselect it (but do not write)
  if (!def && spaces.length === 1 && String(spaces[0]?.space_id || "") === activeSpaceId) {
    sel.value = activeSpaceId;
  }
}

export async function refreshProfileUi({
  getAuthContext,
  getProfile,
  upsertProfile,
  isAuthenticated,
} = {}) {
  const authed = appState.useBackend && isAuthenticated?.();
  const dn = document.getElementById("profileDisplayName");
  const spaceName = document.getElementById("spaceNameInput");

  if (!authed) {
    if (dn) dn.value = "";
    if (spaceName) spaceName.value = "";
    const defSel = document.getElementById("defaultSpaceSelect");
    if (defSel) { defSel.innerHTML = ""; defSel.hidden = true; }
    return;
  }

  const p = await ensureProfileLoaded({ getProfile, upsertProfile, isAuthenticated });
  if (dn) dn.value = String(p?.display_name || "");

  // Space-Name input reflects active space
  const activeSpaceId = String(getAuthContext?.()?.spaceId || "");
  const current = (appState.mySpaces || []).find((s) => String(s?.space_id || "") === String(activeSpaceId || ""));
  if (spaceName) spaceName.value = String(current?.name || "");

  // default space select
  await refreshDefaultSpaceSelect({
    getAuthContext,
    isAuthenticated,
    ensureProfileLoaded: async () => p,
  });
}
