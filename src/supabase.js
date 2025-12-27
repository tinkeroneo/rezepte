// supabase.js
// Minimaler Supabase REST Client mit Auth + Space Support
// Voraussetzung: RLS aktiv, space_id = UUID (text), user_spaces gepflegt

import { getClientId } from "./domain/clientId.js";

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

let _session = null; // { access_token, refresh_token, expires_at }
let _spaceId = null;

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

function loadStoredAuth() {
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

// (redirect helpers removed – keep redirect handling in the login view)


async function resolveSpaceId(access_token) {
  const res = await sbFetch(
    `${SUPABASE_URL}/rest/v1/user_spaces?select=space_id&limit=1`,
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
      `Failed to resolve space: ${res.status} ${await sbJson(res)}`
    );
  }

  const rows = await res.json();
  const sid = rows?.[0]?.space_id;
  if (!sid) throw new Error("No space assigned to user");
  return sid;
}

/* ---------- public auth API ---------- */

export async function initAuthAndSpace() {
  // 1) Magic-Link Hash
  const fromHash = readAuthFromHash();
  if (fromHash) {
    _session = fromHash;
    storeAuth(_session);
  }

  // 2) Stored auth
  if (!_session) {
    _session = loadStoredAuth();
  }

  // 3) Refresh if needed
  if (_session?.refresh_token) {
    const now = Math.floor(Date.now() / 1000);
    const needsRefresh =
      !_session.expires_at || _session.expires_at - now < 60;

    if (needsRefresh) {
      const refreshed = await refreshAccessToken(_session.refresh_token);
      if (!refreshed) {
        logout();
        return null;
      }
      _session = refreshed;
      storeAuth(_session);
    }
  }

  if (!_session?.access_token) {
    _spaceId = null;
    return null;
  }

  // 4) Resolve space
  _spaceId = await resolveSpaceId(_session.access_token);
  return { session: _session, spaceId: _spaceId };
}

export function logout() {
  _session = null;
  _spaceId = null;
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
  const safeRedirect = normalizeRedirectTo(
    redirectTo || (location.hostname === "127.0.0.1"
      ? "http://127.0.0.1:5500/git-rezepte-main/index.html"
      : "https://cook.tinkeroneo.de/index.html")
  );

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
  return _spaceId;
}

/* ---------- guards ---------- */

function requireSpace() {
  if (!_spaceId) {
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
    _spaceId
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
    space_id: _spaceId,
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
  )}&space_id=eq.${encodeURIComponent(_spaceId)}`;

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
    _spaceId
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
        space_id: _spaceId,
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
      _spaceId
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
      _spaceId
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
    space_id: _spaceId,
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
      _spaceId
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
  if (!_spaceId) return; // ⬅️ DAS
  requireSpace();
  const payload = {
    ...evt,
    space_id: _spaceId,
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

  const path = `${_spaceId}/${recipeId}-${Date.now()}.${ext}`;

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
