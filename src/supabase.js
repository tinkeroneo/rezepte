// supabase.js
// Minimaler Supabase REST Client mit Auth + Space Support
// Voraussetzung: RLS aktiv, space_id = UUID, user_spaces gepflegt

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
const LS_FORCE_DEFAULT_ONCE = "tinkeroneo_force_default_space_once_v1";

function markForceDefaultOnce() {
  try { localStorage.setItem(LS_FORCE_DEFAULT_ONCE, "1"); } catch { /* ignore */ }
}
function consumeForceDefaultOnce() {
  try {
    const v = localStorage.getItem(LS_FORCE_DEFAULT_ONCE);
    if (v) localStorage.removeItem(LS_FORCE_DEFAULT_ONCE);
    return !!v;
  } catch {
    return false;
  }
}


let _session = null; // { access_token, refresh_token, expires_at }
let _spaceId = null;
let _user = null; // { id, email }

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
markForceDefaultOnce();

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
  if (!refresh_token) return null;
  try {
    // Supabase GoTrue expects x-www-form-urlencoded for refresh_token grant.
    // Putting grant_type into the query avoids "unsupported_grant_type" parsing issues.
    const res = await sbFetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ refresh_token }),
        timeoutMs: 12000,
      }
    );

    // If Supabase rejects the refresh token, this is not a transient error.
    if (!res.ok) {
      const transient = res.status >= 500 || res.status === 0;
      return transient ? { transient: true } : null;
    }

    const json = await res.json();
    if (!json?.access_token || !json?.refresh_token) return null;

    const expires_at = Math.floor(Date.now() / 1000) + Number(json.expires_in || 3600);

    return {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at,
    };
  } catch (e) {
    // Network / timeout / transient errors: don't force logout.
    return { transient: true, error: String(e?.message || e) };
  }
}

// (redirect helpers removed – keep redirect handling in the login view)


async function listUserSpacesRaw(access_token) {
  const res = await sbFetch(
    `${SUPABASE_URL}/rest/v1/user_spaces?select=space_id,role,is_default,created_at&order=created_at.asc`,

    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${access_token}`,
      },
      timeoutMs: 12000,
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to list user_spaces: ${res.status} ${await sbJson(res)}`);
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}


async function resolveSpaceId({ access_token, userId }) {
  const rows = await listUserSpacesRaw(access_token);
  if (!rows.length) throw new Error("No space assigned to user");

  const has = (id) => !!id && rows.some((r) => r?.space_id === id);

  const prof = userId ? await tryFetchProfile({ access_token, userId }) : null;
  const dbDefault = rows.find((r) => r?.is_default)?.space_id || null;

  // One-shot: after a fresh login, always prefer default (NOT last-used)
  if (consumeForceDefaultOnce()) {
    if (has(prof?.default_space_id)) return prof.default_space_id;
    if (has(dbDefault)) return dbDefault;
    return rows?.[0]?.space_id || null;
  }

  // Normal (refresh / ongoing use): keep last-used on this device
  const stored = userId ? readStoredActiveSpace(userId) : null;
  if (has(stored)) return stored;

  // Cross-device preferences (nice fallback)
  if (has(prof?.last_space_id)) return prof.last_space_id;
  if (has(prof?.default_space_id)) return prof.default_space_id;

  // DB default, otherwise first membership
  if (has(dbDefault)) return dbDefault;
  const first = rows?.[0]?.space_id;
  if (!first) throw new Error("No space assigned to user");
  return first;
}


async function provisionDefaultSpace({ access_token, userId }) {
  if (!userId) throw new Error("Missing userId for space provisioning");

  // 1) create a new space
  const createRes = await sbFetch(`${SUPABASE_URL}/rest/v1/spaces`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ name: "Meine Rezepte" }),
    timeoutMs: 12000,
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create space: ${createRes.status} ${await sbJson(createRes)}`);
  }

  const created = await createRes.json();
  const spaceId = Array.isArray(created) ? created?.[0]?.id : created?.id;
  if (!spaceId) throw new Error("Failed to create space: missing id");

  // 2) assign user as owner
  const memRes = await sbFetch(`${SUPABASE_URL}/rest/v1/user_spaces`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ user_id: userId, space_id: spaceId, role: "owner" }),
    timeoutMs: 12000,
  });

  if (!memRes.ok) {
    throw new Error(`Failed to assign space to user: ${memRes.status} ${await sbJson(memRes)}`);
  }

  return String(spaceId);
}

async function fetchCurrentUser(access_token) {
  const res = await sbFetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${access_token}`,
    },
    timeoutMs: 12000,
  });
  if (!res.ok) throw new Error(`Failed to load user: ${res.status} ${await sbJson(res)}`);
  const u = await res.json();
  return { id: u?.id || null, email: u?.email || null };
}

async function fetchMyInvites({ access_token, email }) {
  // If the project doesn't have space_invites or RLS blocks access, we treat it as "feature not configured".
  const mail = String(email || "").trim();
  if (!mail) return [];

  const url = `${SUPABASE_URL}/rest/v1/space_invites?select=id,space_id,role,email,created_at&email=ilike.${encodeURIComponent(mail)}&order=created_at.desc`;
  const res = await sbFetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${access_token}`,
    },
    timeoutMs: 12000,
  });

  if (!res.ok) {
    // 404 table missing, 403 RLS missing -> ignore
    return [];
  }
  const invites = await res.json();
  return Array.isArray(invites) ? invites : [];
}

async function listSpacesByIds({ access_token, ids }) {
  const uniq = Array.from(new Set((ids || []).filter(Boolean)));
  if (uniq.length === 0) return new Map();
  // Build: id=in.(a,b,c)
  const inList = uniq.join(",");
  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/spaces?select=id,name&id=in.(${inList})`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${access_token}`,
    },
    timeoutMs: 12000,
  });
  if (!res.ok) return new Map();
  const rows = await res.json();
  const m = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r?.id) m.set(r.id, r);
  }
  return m;
}

function activeSpaceLsKey(userId) {
  return `tinkeroneo_active_space_v1:${String(userId || "")}`;
}

function readStoredActiveSpace(userId) {
  try {
    const k = activeSpaceLsKey(userId);
    return localStorage.getItem(k) || null;
  } catch {
    return null;
  }
}

function storeActiveSpace(userId, spaceId) {
  try {
    const k = activeSpaceLsKey(userId);
    localStorage.setItem(k, String(spaceId || ""));
  } catch {
    /* ignore */
  }
}

/* ---------- public auth API ---------- */

export async function initAuthAndSpace() {
  __debugSetAuthEvent?.("initAuthAndSpace:start");

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
      let refreshed = null;
      try {
        refreshed = await refreshAccessToken(_session.refresh_token);
      } catch {
        // treat fetch errors as transient; keep current session
        refreshed = { transient: true };
      }

      if (refreshed && !refreshed.transient) {
        _session = refreshed;
        storeAuth(_session);
        __debugSetAuthEvent?.("refresh ok");

      } else if (!refreshed) {
        // Hard failure (invalid refresh token) -> clear local auth so we don't loop.
        // KEIN logout bei transienten Fehlern (mobile/offline/VPN)
  __debugSetAuthError?.("refresh failed (kept session)");

  return {
    session: null,
    user: null,
    userId: null,
    spaceId: null,
    pendingInvites: [],
    expired: true, // wichtig: UI darf Login zeigen
  };

      } else {
        // Transient failure (timeout/offline/server) -> keep current session and continue.
        // This avoids "getting kicked" on a flaky connection or after long tab sleep.
        
        __debugSetAuthError?.("transient failure");
      }
    }
  }

  

  

  if (!_session?.access_token) {
    _spaceId = null;
    _user = null;
    return null;
  }

  // 3.5) Load user (email) and fetch pending invites (confirmation happens in UI)
  // Be resilient: if network is unavailable, keep the local session so the app
  // can still run in LOCAL mode and not "bounce" to Login on refresh.
  let pendingInvites = [];
  try {
    _user = await fetchCurrentUser(_session.access_token);
    pendingInvites = await fetchMyInvites({
      access_token: _session.access_token,
      email: _user?.email,
    });
  } catch {
    // keep _session; just mark user/space unknown for now
    _user = null;
    _spaceId = null;
    return {
      session: _session,
      user: null,
      userId: null,
      spaceId: null,
      pendingInvites: [],
      offline: true,
    };
  }

  // 4) Resolve space (respect stored active space per user)
  try {
    _spaceId = await resolveSpaceId({ access_token: _session.access_token, userId: _user?.id });
  } catch (e) {
    const msg = String(e?.message || e || "");
    // New users may have no membership yet -> provision a private default space.
    if (msg.includes("No space assigned")) {
      _spaceId = await provisionDefaultSpace({ access_token: _session.access_token, userId: _user?.id });
    } else {
      // Network / transient errors: don't force a logout.
      // Keep last known active space so offline-queue stays scoped correctly.
      const fallbackSpace = _user?.id ? readStoredActiveSpace(_user.id) : null;
      _spaceId = fallbackSpace;

      return {
        session: _session,
        user: _user,
        userId: _user?.id || null,
        spaceId: _spaceId,
        pendingInvites,
        offline: true,
      };

    }
  }

  if (_user?.id && _spaceId) storeActiveSpace(_user.id, _spaceId);

  return {
    session: _session,
    user: _user,
    userId: _user?.id || null,
    spaceId: _spaceId,
    pendingInvites,
  };
}

export function logout() {
  _session = null;
  _spaceId = null;
  _user = null;
  try {
    localStorage.removeItem(LS_AUTH_KEY);
  } catch {
    /* ignore */
  }
}

export function getAuthContext() {
  return { session: _session, spaceId: _spaceId, user: _user };
}

export async function listMySpaces() {
  requireAuth();
  const rows = await listUserSpacesRaw(_session.access_token);
  const ids = rows.map(r => r?.space_id).filter(Boolean);
  const meta = await listSpacesByIds({ access_token: _session.access_token, ids });
  return rows.map(r => {
    const sid = r?.space_id || "";
    const name = meta.get(sid)?.name || sid;
    return { space_id: sid, name, role: r?.role || "viewer" };
  });
}

export function setActiveSpaceId(spaceId) {
  requireAuth();
  const sid = String(spaceId || "").trim();
  if (!sid) throw new Error("Invalid spaceId");
  _spaceId = sid;
  if (_user?.id) storeActiveSpace(_user.id, sid);
  return _spaceId;
}

export async function acceptInvite(inviteId) {
  requireAuth();
  const id = String(inviteId || "").trim();
  if (!id) throw new Error("Invalid invite id");

  // Load invite to get space_id/role (RLS: user reads only their email invites)
  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/space_invites?select=id,space_id,role,email&id=eq.${id}&limit=1`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${_session.access_token}`,
    },
    timeoutMs: 12000,
  });
  if (!res.ok) throw new Error(`Accept invite failed: ${res.status} ${await sbJson(res)}`);
  const rows = await res.json();
  const inv = rows?.[0];
  if (!inv?.space_id) throw new Error("Invite not found");

  // Add membership
  const addRes = await sbFetch(`${SUPABASE_URL}/rest/v1/user_spaces`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${_session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ user_id: _user?.id, space_id: inv.space_id, role: inv.role || "viewer" }),
    timeoutMs: 12000,
  });
  if (!addRes.ok) throw new Error(`Add membership failed: ${addRes.status} ${await sbJson(addRes)}`);

  // Delete invite
  await sbFetch(`${SUPABASE_URL}/rest/v1/space_invites?id=eq.${id}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${_session.access_token}`,
    },
    timeoutMs: 12000,
  });

  return { space_id: inv.space_id, role: inv.role || "viewer" };
}

export async function declineInvite(inviteId) {
  requireAuth();
  const id = String(inviteId || "").trim();
  if (!id) return false;
  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/space_invites?id=eq.${id}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${_session.access_token}`,
    },
    timeoutMs: 12000,
  });
  if (!res.ok) throw new Error(`Decline failed: ${res.status} ${await sbJson(res)}`);
  return true;
}

/* =========================
   SPACE SHARING (INVITES)
========================= */

function requireAuth() {
  if (!_session?.access_token) throw new Error("Not authenticated");
}

export async function inviteToSpace({ email, role = "viewer", spaceId } = {}) {
  requireAuth();
  const sid = spaceId || _spaceId;
  if (!sid) throw new Error("No active space");
  const mail = String(email || "").trim();
  if (!mail || !mail.includes("@")) throw new Error("Invalid email");
  const r = String(role || "viewer").toLowerCase();

  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/space_invites`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${_session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ space_id: sid, email: mail, role: r }),
    timeoutMs: 12000,
  });

  if (!res.ok) throw new Error(`Invite failed: ${res.status} ${await sbJson(res)}`);
  return res.json();
}

export async function listPendingInvites({ spaceId } = {}) {
  requireAuth();
  const sid = spaceId || _spaceId;
  if (!sid) throw new Error("No active space");
  const res = await sbFetch(
    `${SUPABASE_URL}/rest/v1/space_invites?select=id,email,role,created_at&space_id=eq.${sid}&order=created_at.desc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${_session.access_token}`,
      },
      timeoutMs: 12000,
    }
  );
  if (!res.ok) throw new Error(`List invites failed: ${res.status} ${await sbJson(res)}`);
  return res.json();
}

export async function revokeInvite(inviteId) {
  requireAuth();
  const id = String(inviteId || "").trim();
  if (!id) return false;
  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/space_invites?id=eq.${id}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${_session.access_token}`,
    },
    timeoutMs: 12000,
  });
  if (!res.ok) throw new Error(`Revoke failed: ${res.status} ${await sbJson(res)}`);
  return true;
}

export async function listSpaceMembers({ spaceId } = {}) {
  requireAuth();
  const sid = spaceId || _spaceId;
  if (!sid) throw new Error("No active space");
  const res = await sbFetch(
    `${SUPABASE_URL}/rest/v1/user_spaces?select=user_id,role,created_at&space_id=eq.${sid}&order=created_at.asc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${_session.access_token}`,
      },
      timeoutMs: 12000,
    }
  );
  if (!res.ok) throw new Error(`List members failed: ${res.status} ${await sbJson(res)}`);
  return res.json();
}

// Lightweight auth state check for UI (header badges etc.)
export function isAuthenticated() {
  return !!_session?.access_token;
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
    redirectTo || `${location.origin}/index.html`
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

function requireSession() {
  if (!_session || !_session.access_token) {
    throw new Error("Not authenticated. Please log in again.");
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

async function sbFetchAuthed(url, opts = {}, retried = false) {
  const res = await sbFetch(url, opts);

  if (res.status === 401 && !retried && _session?.refresh_token) {
    const refreshed = await refreshAccessToken(_session.refresh_token);
    if (refreshed && !refreshed.transient) {
      _session = refreshed;
      storeAuth(_session);

      const headers = { ...(opts.headers || {}) };
      headers.Authorization = `Bearer ${_session.access_token}`;

      return sbFetchAuthed(url, { ...opts, headers }, true);
    }
  }

  return res;
}


/* =========================
   FETCH HELPERS
========================= */


async function sbFetch(
  url,
  { timeoutMs = DEFAULT_TIMEOUT_MS, signal: externalSignal, ...opts } = {}
) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  // Wenn ein externes Signal existiert → mitziehen
  if (externalSignal) {
    if (externalSignal.aborted) {
      ctrl.abort();
    } else {
      externalSignal.addEventListener(
        "abort",
        () => ctrl.abort(),
        { once: true }
      );
    }
  }

  try {
    return await fetch(url, {
      ...opts,
      signal: ctrl.signal,
    });
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

  const res = await sbFetchAuthed(url, { headers: sbHeaders() });
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
    image_focus: recipe.image_focus ?? { x: 50, y: 50, zoom: 1, mode: "auto" },
  };

  const res = await sbFetchAuthed(`${SUPABASE_URL}/rest/v1/recipes`, {
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

  const res = await sbFetchAuthed(url, { method: "DELETE", headers: sbHeaders() });
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

  const res = await sbFetchAuthed(url, { headers: sbHeaders() });
  if (!res.ok)
    throw new Error(`listParts failed: ${res.status} ${await sbJson(res)}`);
  return res.json();
}

export async function addRecipePart(parentId, childId, sortOrder = 0) {
  requireSpace();
  const res = await sbFetchAuthed(`${SUPABASE_URL}/rest/v1/recipe_parts`, {
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

  const res = await sbFetchAuthed(url, { method: "DELETE", headers: sbHeaders() });
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
  const url =
    `${SUPABASE_URL}/rest/v1/cook_events?space_id=eq.${encodeURIComponent(
      _spaceId
    )}` +
    `&recipe_id=eq.${encodeURIComponent(recipeId)}` +
    `&order=at.desc`;

  const res = await sbFetchAuthed(url, { headers: sbHeaders() });
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

  const res = await sbFetchAuthed(`${SUPABASE_URL}/rest/v1/cook_events`, {
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
  const url =
    `${SUPABASE_URL}/rest/v1/cook_events?id=eq.${encodeURIComponent(
      id
    )}&space_id=eq.${encodeURIComponent(_spaceId)}`;

  const res = await sbFetchAuthed(url, { method: "DELETE", headers: sbHeaders() });
  if (!res.ok)
    throw new Error(
      `deleteCookEvent failed: ${res.status} ${await sbJson(res)}`
    );
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

  const res = await sbFetchAuthed(`${SUPABASE_URL}/rest/v1/client_logs`, {
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
  requireSession();

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

  const signRes = await sbFetch(`${SUPABASE_URL}/functions/v1/sign-upload`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${_session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      spaceId: _spaceId,
      recipeId,
      ext,
      contentType: file.type || "application/octet-stream",
    }),
  });

  if (!signRes.ok) {
    throw new Error(`sign-upload failed: ${await signRes.text()}`);
  }

  const { signedUrl, path } = await signRes.json();

  if (!signedUrl || !path) {
    throw new Error("sign-upload: Antwort unvollständig (signedUrl/path fehlt).");
  }

  const upRes = await sbFetch(signedUrl, {
    method: "PUT",
    timeoutMs: UPLOAD_TIMEOUT_MS,
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!upRes.ok) throw new Error(`upload failed: ${await upRes.text()}`);

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}



/* =========================
   PROFILES (Displayname + Default/Last Space)
========================= */

async function tryFetchProfile({ access_token, userId }) {
  try {
    const uid = String(userId || "").trim();
    if (!uid) return null;
    const res = await sbFetch(`${SUPABASE_URL}/rest/v1/profiles?select=user_id,display_name,default_space_id,last_space_id&user_id=eq.${uid}&limit=1`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${access_token}`,
      },
      timeoutMs: 12000,
    });
    if (!res.ok) return null; // table may not exist yet
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}

export async function getProfile() {
  requireAuth();
  const p = await tryFetchProfile({ access_token: _session.access_token, userId: _user?.id });
  return p;
}

export async function upsertProfile(patch) {
  requireAuth();
  const body = {
    user_id: _user?.id,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${_session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(body),
    timeoutMs: 12000,
  });
  if (!res.ok) throw new Error(`Profile upsert failed: ${res.status} ${await sbJson(res)}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function updateSpaceName({ spaceId, name }) {
  requireAuth();
  const sid = String(spaceId || "").trim();
  const nm = String(name || "").trim();
  if (!sid) throw new Error("Invalid spaceId");
  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/spaces?id=eq.${sid}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${_session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ name: nm }),
    timeoutMs: 12000,
  });
  if (!res.ok) throw new Error(`Space update failed: ${res.status} ${await sbJson(res)}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}


/* =========================
   RECIPE: MOVE/COPY TO SPACE
========================= */




function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchRecipesByIds({ access_token, ids }) {
  const uniq = Array.from(new Set((ids || []).map(x => String(x || "").trim()).filter(Boolean)));
  if (!uniq.length) return [];
  const chunks = chunkArray(uniq, 50);
  const rows = [];
  for (const ch of chunks) {
    const q = ch.map(encodeURIComponent).join(",");
    const res = await sbFetch(`${SUPABASE_URL}/rest/v1/recipes?select=*&id=in.(${q})`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${access_token}` },
      timeoutMs: 20000,
    });
    if (!res.ok) throw new Error(`fetchRecipesByIds failed: ${res.status} ${await sbJson(res)}`);
    rows.push(...(await res.json()));
  }
  return rows;
}

async function fetchRecipePartsEdges({ access_token, spaceId }) {
  const sid = String(spaceId || "").trim();
  if (!sid) return [];
  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/recipe_parts?select=space_id,parent_id,child_id,sort_order&space_id=eq.${encodeURIComponent(sid)}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${access_token}` },
    timeoutMs: 20000,
  });
  if (!res.ok) throw new Error(`fetchRecipePartsEdges failed: ${res.status} ${await sbJson(res)}`);
  return await res.json();
}

function collectDescendants({ rootId, edges }) {
  const start = String(rootId || "").trim();
  if (!start) return [];
  const byParent = new Map();
  for (const e of edges || []) {
    const p = String(e.parent_id || "");
    const list = byParent.get(p) || [];
    list.push(String(e.child_id || ""));
    byParent.set(p, list);
  }
  const visited = new Set();
  const stack = [start];
  while (stack.length) {
    const id = stack.pop();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const kids = byParent.get(id) || [];
    for (const k of kids) if (!visited.has(k)) stack.push(k);
  }
  return Array.from(visited);
}


/* =========================
   RECIPE: MOVE/COPY TO SPACE (with Parts)
========================= */

export async function moveRecipeToSpace({ recipeId, targetSpaceId, includeParts = true }) {
  requireAuth();
  const rid = String(recipeId || "").trim();
  const sid = String(targetSpaceId || "").trim();
  if (!rid || !sid) throw new Error("Invalid recipeId/targetSpaceId");

  const fromSpaceId = getAuthContext()?.spaceId;
  const access_token = _session.access_token;

  let idsToMove = [rid];
  let edgesToMove = [];
  if (includeParts && fromSpaceId) {
    const edges = await fetchRecipePartsEdges({ access_token, spaceId: fromSpaceId });
    idsToMove = collectDescendants({ rootId: rid, edges });
    edgesToMove = edges.filter(e => idsToMove.includes(String(e.parent_id || "")));
  }

  // 1) move recipes
  for (const ch of chunkArray(idsToMove, 50)) {
    const q = ch.map(encodeURIComponent).join(",");
    const res = await sbFetchAuthed(`${SUPABASE_URL}/rest/v1/recipes?id=in.(${q})`, {
      method: "PATCH",
      headers: {
        ...sbHeaders(),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ space_id: sid }),
      timeoutMs: 20000,
    });
    if (!res.ok) throw new Error(`move recipes failed: ${res.status} ${await sbJson(res)}`);
  }

  // 2) move edges where parent is in moved set
  if (includeParts && edgesToMove.length && fromSpaceId) {
    for (const chunkEdges of chunkArray(edgesToMove, 200)) {
      const parentIds = Array.from(new Set(chunkEdges.map(e => String(e.parent_id))));
      const q = parentIds.map(encodeURIComponent).join(",");
      const res = await sbFetchAuthed(`${SUPABASE_URL}/rest/v1/recipe_parts?space_id=eq.${encodeURIComponent(fromSpaceId)}&parent_id=in.(${q})`, {
        method: "PATCH",
        headers: {
          ...sbHeaders(),
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ space_id: sid }),
        timeoutMs: 20000,
      });
      if (!res.ok) throw new Error(`move recipe_parts failed: ${res.status} ${await sbJson(res)}`);
    }
  }

  return { movedIds: idsToMove, targetSpaceId: sid };
}


export async function copyRecipeToSpace({ recipe, targetSpaceId, includeParts = true }) {
  requireAuth();
  const sid = String(targetSpaceId || "").trim();
  if (!sid) throw new Error("Invalid targetSpaceId");
  if (!recipe?.id) throw new Error("Invalid recipe");

  const fromSpaceId = getAuthContext()?.spaceId;
  const access_token = _session.access_token;

  let ids = [String(recipe.id)];
  let edges = [];
  if (includeParts && fromSpaceId) {
    edges = await fetchRecipePartsEdges({ access_token, spaceId: fromSpaceId });
    ids = collectDescendants({ rootId: recipe.id, edges });
  }

  const srcRows = await fetchRecipesByIds({ access_token, ids });
  const byId = new Map(srcRows.map(r => [String(r.id), r]));

  const idMap = new Map();
  for (const id of ids) {
    idMap.set(id, (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));
  }

  const newRows = ids.map(oldId => {
    const r = byId.get(String(oldId));
    if (!r) throw new Error(`Missing source recipe: ${oldId}`);
    const nr = { ...r };
    nr.id = idMap.get(String(oldId));
    nr.space_id = sid;
    delete nr.created_at;
    delete nr.updated_at;
    delete nr.deleted_at;
    delete nr.pending;
    delete nr.is_pending;
    return nr;
  });

  for (const ch of chunkArray(newRows, 50)) {
    const res = await sbFetchAuthed(`${SUPABASE_URL}/rest/v1/recipes`, {
      method: "POST",
      headers: {
        ...sbHeaders(),
        Prefer: "return=minimal",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ch),
      timeoutMs: 20000,
    });
    if (!res.ok) throw new Error(`copy recipes failed: ${res.status} ${await sbJson(res)}`);
  }

  if (includeParts && edges.length) {
    const idsSet = new Set(ids.map(String));
    const edgeRows = edges
      .filter(e => idsSet.has(String(e.parent_id)) && idsSet.has(String(e.child_id)))
      .map(e => ({
        space_id: sid,
        parent_id: idMap.get(String(e.parent_id)),
        child_id: idMap.get(String(e.child_id)),
        sort_order: e.sort_order ?? 0,
      }));

    for (const ch of chunkArray(edgeRows, 200)) {
      const res = await sbFetchAuthed(`${SUPABASE_URL}/rest/v1/recipe_parts`, {
        method: "POST",
        headers: {
          ...sbHeaders(),
          Prefer: "return=minimal",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ch),
        timeoutMs: 20000,
      });
      if (!res.ok) throw new Error(`copy recipe_parts failed: ${res.status} ${await sbJson(res)}`);
    }
  }

  const newRootId = idMap.get(String(recipe.id));
  return { newRecipeId: newRootId };
}

export function __debugAuthSnapshot() {
  let raw = null;
  try { raw = localStorage.getItem(LS_AUTH_KEY); } catch {
    //
  }
  return {
    hasSession: !!_session?.access_token,
    hasRefresh: !!_session?.refresh_token,
    expires_at: _session?.expires_at ?? null,
    userId: _user?.id ?? null,
    spaceId: _spaceId ?? null,
    lsAuthPresent: raw ? true : false,
    lsAuthLen: raw ? raw.length : 0,
    lastErr: _lastAuthError ?? null,
    lastEvent: _lastAuthEvent ?? null,
    now: Date.now()
  };
}

// OPTIONAL: set these in your code where errors happen
let _lastAuthError = null;
let _lastAuthEvent = null;
export function __debugSetAuthEvent(e) { _lastAuthEvent = e; }
export function __debugSetAuthError(e) { _lastAuthError = String(e); }
