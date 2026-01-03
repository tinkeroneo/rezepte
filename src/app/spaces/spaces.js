// src/app/spaces/spaces.js

import { appState } from "../appState.js";
import { readSpacesCache, writeSpacesCache } from "./spacesCache.js";

function escHtml(x) {
  return String(x)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function getActiveSpaceRole({ spaces, spaceId }) {
  const sid = String(spaceId || "").trim();
  const spacesList = Array.isArray(spaces) ? spaces : [];
  const row = spacesList.find((s) => String(s?.space_id || "") === sid);
  return String(row?.role || "viewer");
}

export async function refreshSpaceSelect({
  listMySpaces,
  getAuthContext,
  isAuthenticated,
} = {}) {
  const sels = [
    document.getElementById("spaceSelect"),
    document.getElementById("headerSpaceSelect"),
  ].filter(Boolean);

  if (sels.length === 0) return;

  const hideAll = () => {
    for (const sel of sels) {
      sel.innerHTML = "";
      sel.hidden = true;
    }
  };

  if (!(appState.useBackend && isAuthenticated?.())) {
    appState.mySpaces = [];
    hideAll();
    return;
  }

  let nextSpaces = null;
  try {
    nextSpaces = await listMySpaces?.();
  } catch {
    nextSpaces = null; // keep previous
  }

  const ctxUser = (() => {
    try { return getAuthContext?.(); } catch { return null; }
  })();

  if (Array.isArray(nextSpaces)) {
    appState.mySpaces = nextSpaces;
    writeSpacesCache(ctxUser?.user?.id, appState.mySpaces);
  } else {
    if (!Array.isArray(appState.mySpaces) || appState.mySpaces.length === 0) {
      const cached = readSpacesCache(ctxUser?.user?.id);
      if (Array.isArray(cached) && cached.length) appState.mySpaces = cached;
    }
  }

  const active = String(ctxUser?.spaceId || "");
  const mySpaces = appState.mySpaces;

  if (!Array.isArray(mySpaces) || mySpaces.length === 0) {
    hideAll();
    return;
  }

  const setSelectHtml = (sel) => {
    if (mySpaces.length === 1) {
      const s = mySpaces[0];
      const sid = String(s?.space_id || "");
      const name = String(s?.name || sid);
      const role = String(s?.role || "viewer");
      sel.innerHTML = `<option value="${escHtml(sid)}" selected>${escHtml(`${name} (${role})`)}</option>`;
      sel.disabled = true;
      sel.hidden = false;
      return;
    }

    sel.disabled = false;
    sel.innerHTML = mySpaces
      .map((s) => {
        const sid = String(s?.space_id || "");
        const name = String(s?.name || sid);
        const role = String(s?.role || "viewer");
        const label = `${name} (${role})`;
        return `<option value="${escHtml(sid)}" ${sid === active ? "selected" : ""}>${escHtml(label)}</option>`;
      })
      .join("");
    sel.hidden = false;
  };

  for (const sel of sels) setSelectHtml(sel);
}

