// supabase.js
// Minimaler Supabase REST Client mit Auth + Space Support
// Voraussetzung: RLS aktiv, space_id = UUID (text), user_spaces gepflegt

import { getClientId } from "./domain/clientId.js"; // used as stable device id (not user identity)

/* =========================
   CONFIG
========================= */

const SUPABASE_URL = "https://iwpqodzaedprukqotckb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3cHFvZHphZWRwcnVrcW90Y2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMzI2MjEsImV4cCI6MjA4MTkwODYyMX0.v7JHkz-g4lKtTW-emaH3L4KNOyAKOy19FihdNiz0NQY";

const DEFAULT_TIMEOUT_MS = 12000;
const UPLOAD_TIMEOUT_MS = 45000;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const BUCKET = "recipe-images";

/* =========================
   AUTH / SPACE STATE
========================= */

const LS_AUTH_KEY = "tinkeroneo_sb_auth_v1";
const LS_ACTIVE_SPACE_PREFIX = "tinkeroneo_active_space_v1::u=";

let _session = null; // { access_token, refresh_token, expires_at }
let _user = null; // { id, email }
let _spaces = []; // [{ space_id, role, name? }]
let _activeSpaceId = null;

/* ---------- helpers ---------- */

function readAuthFromHash() {
  const raw = location.hash || "";
  if (!raw.includes("access_token=") || !raw.includes("refresh_token=")) {
    return null;
  }

  const h = raw.replace(/^#/, "");
  const p = new URLSearchParams(h);

  const access_token = p.get("access_token");
  const refresh_token = p.get("refresh_token");
  const expires_in = Number(p.get("expires_in") || "0");

  if (!access_token || !refresh_token) return null;

  const expires_at =
    Math.floor(Date.now() / 1000) +
    (Number.isFinite(expires_in) && expires_in > 0 ? expires_in : 3600);

  // Hash bereinigen (Router bleibt sauber)
  window.history.replaceState(null, "", location.pathname + location.search);

  return { access_token, refresh_token, expires_at };
}


function loadAuth() {
  try {
    const raw = localStorage.getItem(LS_AUTH_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj?.access_token || !obj?.refresh_token) return null;
    return obj;
  } catch {
    return null;
  }
}

function storeAuth(auth) {
  try {
    localStorage.setItem(LS_AUTH_KEY, JSON.stringify(auth));
  } catch {
    /* ignore */
  }
}

/**
 * Resolve current user from an access token.
 * Supabase endpoint: GET /auth/v1/user
 */
async function getUserFromAccessToken(accessToken) {
  if (!accessToken) return null;
  const res = await sbFetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
  if (!res.ok) return null;
  const json = await res.json();
  // supabase returns { id, email, ... }
  if (!json?.id) return null;
  return { id: json.id, email: json.email || null };
}

async function refreshAccessToken(refresh_token) {
  const res = await sbFetch(
    `${SUPABASE_URL}/auth/v1/token`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token,
      }),
      timeoutMs: 12000,
    }
  );

  if (!res.ok) return null;
  const json = await res.json();
  if (!json?.access_token || !json?.refresh_token) return null;

  const expires_at =
    Math.floor(Date.now() / 1000) +
    Number(json.expires_in || 3600);

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at,
  };
}

// Backwards-compatible alias
async function refreshSession(refresh_token) {
  return refreshAccessToken(refresh_token);
}





async function listUserSpaces(access_token) {
  const res = await sbFetch(
    `${SUPABASE_URL}/rest/v1/user_spaces?select=space_id,role`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${access_token}`,
      },
      timeoutMs: 12000,
    }
  );

  if (!res.ok) {
    throw new Error(
      `Failed to list spaces: ${res.status} ${await sbJson(res)}`
    );
  }

  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

function readActiveSpaceForUser(userId) {
  if (!userId) return "";
  try {
    return String(localStorage.getItem(LS_ACTIVE_SPACE_PREFIX + userId) || "");
  } catch {
    return "";
  }
}

function storeActiveSpaceForUser(userId, spaceId) {
  if (!userId) return;
  try {
    localStorage.setItem(LS_ACTIVE_SPACE_PREFIX + userId, String(spaceId || ""));
  } catch {
    /* ignore */
  }
}

function pickActiveSpaceId(userId, spaces) {
  const preferred = readActiveSpaceForUser(userId);
  if (preferred && spaces.some((s) => String(s.space_id) === preferred)) return preferred;
  const first = spaces?.[0]?.space_id;
  return first ? String(first) : null;
}

/* ---------- public auth API ---------- */


export async function initAuthAndSpaces() {
  // 1) Magic-Link Hash
  const fromHash = readAuthFromHash();
  if (fromHash) {
    _session = fromHash;
    storeAuth(_session);
    // Cleanup URL hash to avoid leaking tokens
    try {
      window.history.replaceState(null, "", location.pathname + location.search);
    } catch {
      /* ignore */
    }
  } else {
    // 2) Load stored session
    _session = loadAuth();
  }

  // 3) Refresh if needed
  if (_session?.refresh_token) {
    const exp = Number(_session.expires_at || 0);
    const now = Math.floor(Date.now() / 1000);
    const needsRefresh = !exp || exp - now < 60;

    if (needsRefresh) {
      const refreshed = await refreshSession(_session.refresh_token);
      if (!refreshed?.access_token) {
        logout();
        return null;
      }
      _session = refreshed;
      storeAuth(_session);
    }
  }

  if (!_session?.access_token) {
    _user = null;
    _spaces = [];
    _activeSpaceId = null;
    return null;
  }

  // 4) Resolve user (for per-user scoping) + spaces
  _user = await getUserFromAccessToken(_session.access_token);
  const userId = _user?.id || null;

  _spaces = await listUserSpaces(_session.access_token);
  _activeSpaceId = pickActiveSpaceId(userId, _spaces);
  if (_activeSpaceId && userId) {
    storeActiveSpaceForUser(userId, _activeSpaceId);
  }

  return { session: _session, user: _user, spaces: _spaces, activeSpaceId: _activeSpaceId };
}

export async function initAuthAndSpace() {
  // Backwards compatible wrapper
  const ctx = await initAuthAndSpaces();
  if (!ctx) return null;
  return { session: ctx.session, spaceId: ctx.activeSpaceId };
}

export function getAuthContext() {
  return { session: _session, user: _user, spaces: _spaces, activeSpaceId: _activeSpaceId };
}

export function setActiveSpaceId(spaceId) {
  const sid = spaceId ? String(spaceId) : null;
  _activeSpaceId = sid;
  const userId = _user?.id || null;
  if (userId && sid) storeActiveSpaceForUser(userId, sid);
}

export function getActiveSpaceId() {
  return _activeSpaceId;
}

export function logout() {
  _session = null;
  _user = null;
  _spaces = [];
  _activeSpaceId = null;
  try {
    localStorage.removeItem(LS_AUTH_KEY);
  } catch {
    /* ignore */
  }
}

function normalizeRedirectTo(redirectTo) {
  // Falls leer -> aktuelle Seite ohne hash/query
  const raw = (redirectTo && String(redirectTo).trim()) || (location.origin + location.pathname);

  // Wenn jemand aus Versehen "origin + fullUrl" gemacht hat, reparieren wir das:
  // Beispiel: "http://127.../http://127.../git-rezepte-main/index.html"
  const doubled = raw.match(/^(https?:\/\/[^/]+)\/(https?:\/\/.+)$/i);
  const fixedRaw = doubled ? doubled[2] : raw;

  const u = new URL(fixedRaw); // muss absolute URL sein
  u.hash = "";
  // optional: query killen (ich empfehle ja, weil du q/id in hash hast)
  u.search = "";

  // wenn auf Ordner gezeigt wird -> index.html erzwingen
  if (u.pathname.endsWith("/")) u.pathname += "index.html";

  return u.toString();
}

export async function requestMagicLink({ email, redirectTo }) {
  // IMPORTANT:
  // - Never hardcode dev folders (users may run from different subfolders).
  // - Use the redirectTo provided by the Login view (already normalized to /index.html).
  // - Fallback: current directory's index.html.
  const fallback = new URL("index.html", location.href).toString();
  const safeRedirect = normalizeRedirectTo(redirectTo || fallback);

  const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      create_user: true,
      options: { emailRedirectTo: safeRedirect },
    }),
  });

  if (!res.ok) throw new Error(`Magic link failed: ${res.status} ${await res.text()}`);
  return true;
}




export function getSpaceId() {
  return _activeSpaceId;
}

/* ---------- guards ---------- */

function requireSpace() {
  if (!_activeSpaceId) {
    throw new Error("Space not initialized. Call initAuthAndSpace() first.");
  }
}

function sbHeaders() {
  if (!_session?.access_token) {
    throw new Error("Not authenticated");
  }
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${_session.access_token}`,
    "Content-Type": "application/json",
  };
}

/* =========================
   FETCH HELPERS
========================= */

async function sbFetch(url, { timeoutMs = DEFAULT_TIMEOUT_MS, ...opts } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error("Timeout: Backend antwortet nicht rechtzeitig.");
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function sbJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

/* =========================
   RECIPES
========================= */

export async function listRecipes() {
  requireSpace();
  const url = `${SUPABASE_URL}/rest/v1/recipes?space_id=eq.${encodeURIComponent(
    _activeSpaceId
  )}&order=created_at.desc`;

  const res = await sbFetch(url, { headers: sbHeaders() });
  if (!res.ok)
    throw new Error(`listRecipes failed: ${res.status} ${await sbJson(res)}`);
  return res.json();
}

export async function upsertRecipe(recipe) {
  requireSpace();
  const row = {
    id: recipe.id,
    space_id: _activeSpaceId,
    title: recipe.title,
    category: recipe.category ?? "",
    time: recipe.time ?? "",
    ingredients: recipe.ingredients ?? [],
    steps: recipe.steps ?? [],
    image_url: recipe.image_url ?? null,
    source: recipe.source ?? "",
    tags: recipe.tags ?? [],
    image_focus: recipe.image_focus ?? { x: 50, y: 50 },
  };

  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/recipes`, {
    method: "POST",
    headers: {
      ...sbHeaders(),
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([row]),
  });

  if (!res.ok)
    throw new Error(`upsertRecipe failed: ${res.status} ${await sbJson(res)}`);
  return (await res.json())[0];
}

export async function deleteRecipe(id) {
  requireSpace();
  const url = `${SUPABASE_URL}/rest/v1/recipes?id=eq.${encodeURIComponent(
    id
  )}&space_id=eq.${encodeURIComponent(_activeSpaceId)}`;

  const res = await sbFetch(url, { method: "DELETE", headers: sbHeaders() });
  if (!res.ok)
    throw new Error(`deleteRecipe failed: ${res.status} ${await sbJson(res)}`);
  return true;
}

/* =========================
   RECIPE PARTS
========================= */

export async function listAllRecipeParts() {
  requireSpace();
  const url = `${SUPABASE_URL}/rest/v1/recipe_parts?space_id=eq.${encodeURIComponent(
    _activeSpaceId
  )}&order=sort_order.asc`;

  const res = await sbFetch(url, { headers: sbHeaders() });
  if (!res.ok)
    throw new Error(`listParts failed: ${res.status} ${await sbJson(res)}`);
  return res.json();
}

export async function addRecipePart(parentId, childId, sortOrder = 0) {
  requireSpace();
  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/recipe_parts`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([
      {
        space_id: _activeSpaceId,
        parent_id: parentId,
        child_id: childId,
        sort_order: sortOrder,
      },
    ]),
  });

  if (!res.ok)
    throw new Error(`addRecipePart failed: ${res.status} ${await sbJson(res)}`);
  return true;
}

export async function removeRecipePart(parentId, childId) {
  requireSpace();
  const url =
    `${SUPABASE_URL}/rest/v1/recipe_parts?space_id=eq.${encodeURIComponent(
      _activeSpaceId
    )}` +
    `&parent_id=eq.${encodeURIComponent(
      parentId
    )}&child_id=eq.${encodeURIComponent(childId)}`;

  const res = await sbFetch(url, { method: "DELETE", headers: sbHeaders() });
  if (!res.ok)
    throw new Error(
      `removeRecipePart failed: ${res.status} ${await sbJson(res)}`
    );
  return true;
}

/* =========================
   COOK EVENTS
========================= */

export async function listCookEventsSb(recipeId) {
  requireSpace();
  const clientId = getClientId();
  const url =
    `${SUPABASE_URL}/rest/v1/cook_events?space_id=eq.${encodeURIComponent(
      _activeSpaceId
    )}` +
    `&recipe_id=eq.${encodeURIComponent(recipeId)}` +
    `&client_id=eq.${encodeURIComponent(clientId)}` +
    `&order=at.desc`;

  const res = await sbFetch(url, { headers: sbHeaders() });
  if (!res.ok)
    throw new Error(
      `listCookEvents failed: ${res.status} ${await sbJson(res)}`
    );
  return res.json();
}

export async function upsertCookEventSb(ev) {
  requireSpace();
  const payload = {
    ...ev,
    space_id: _activeSpaceId,
    client_id: getClientId(),
  };

  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/cook_events`, {
    method: "POST",
    headers: {
      ...sbHeaders(),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([payload]),
  });

  if (!res.ok)
    throw new Error(
      `upsertCookEvent failed: ${res.status} ${await sbJson(res)}`
    );
  return true;
}

export async function deleteCookEventSb(id) {
  requireSpace();
  const clientId = getClientId();
  const url =
    `${SUPABASE_URL}/rest/v1/cook_events?id=eq.${encodeURIComponent(
      id
    )}&space_id=eq.${encodeURIComponent(
      _activeSpaceId
    )}&client_id=eq.${encodeURIComponent(clientId)}`;

  const res = await sbFetch(url, { method: "DELETE", headers: sbHeaders() });
  if (!res.ok)
    throw new Error(
      `deleteCookEvent failed: ${res.status} ${await sbJson(res)}`
    );
  return true;
}

/* =========================
   CLIENT LOGS
========================= */

export async function logClientEvent(evt) {
  if (!_activeSpaceId) return; // ⬅️ DAS
  requireSpace();
  const payload = {
    ...evt,
    space_id: _activeSpaceId,
    client_id: evt.client_id ?? getClientId(),
  };

  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/client_logs`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify([payload]),
    timeoutMs: 8000,
  });

  if (!res.ok)
    throw new Error(
      `client log failed: ${res.status} ${await sbJson(res)}`
    );
  return true;
}

/* =========================
   IMAGE UPLOAD
========================= */

export async function uploadRecipeImage(file, recipeId) {
  requireSpace();

  if (!file) throw new Error("Kein File ausgewählt.");
  if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Ungültiger Bildtyp. Erlaubt: JPG, PNG, WEBP.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Bild ist zu groß (max. 3 MB).");
  }

  const ext =
    file.name?.split(".").pop()?.toLowerCase() ||
    (file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
      ? "webp"
      : "jpg");

  const path = `${_activeSpaceId}/${recipeId}-${Date.now()}.${ext}`;

  const signRes = await sbFetch(
    `${SUPABASE_URL}/functions/v1/sign-upload`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path,
        contentType: file.type || "application/octet-stream",
      }),
    }
  );

  if (!signRes.ok)
    throw new Error(`sign-upload failed: ${await signRes.text()}`);

  const { signedUrl } = await signRes.json();

  const upRes = await sbFetch(signedUrl, {
    method: "PUT",
    timeoutMs: UPLOAD_TIMEOUT_MS,
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!upRes.ok)
    throw new Error(`upload failed: ${await upRes.text()}`);

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}