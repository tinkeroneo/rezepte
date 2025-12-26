// supabase.js
// Supabase Auth (Magic Link / PKCE) + minimaler REST Client + Space Support
// Voraussetzung: RLS aktiv, user_spaces gepflegt

// IMPORTANT:
// Für Magic Links nutzt Supabase inzwischen i.d.R. PKCE/Code-Flow.
// Der robusteste Weg im Browser (ohne eigenes Verifier-Handling) ist supabase-js.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

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

// Session/Spaces werden von supabase-js persistent gemanagt.
// Wir halten nur eine kleine In-Memory-Sicht für den Rest des Codes.

const LS_ACTIVE_SPACE_PREFIX = "tinkeroneo_active_space_v1::u=";
const LS_CLIENT_ID = "tinkeroneo_client_id_v1";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

let _session = null; // supabase-js session
let _user = null; // supabase user
let _spaces = []; // [{ space_id, role }]
// Legacy name: many parts of the app expect "spaceId" via getSpaceId().
let _spaceId = null;

/* ---------- helpers ---------- */

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

// Device identifier for optional client-side logs/events.
// Not used for ownership / RLS.
function getClientId() {
  try {
    const existing = localStorage.getItem(LS_CLIENT_ID);
    if (existing) return String(existing);
    const id = (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + "_" + Math.random().toString(16).slice(2));
    localStorage.setItem(LS_CLIENT_ID, id);
    return id;
  } catch {
    return "web";
  }
}


async function listUserSpaces() {
  const { data, error } = await supabase
    .from("user_spaces")
    .select("space_id,role");
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function ensureDefaultSpaceForUser(userId) {
  // First-login UX: If the user has no spaces yet, create a personal space.
  // This prevents the app from bouncing back to the login view with an
  // authenticated session but missing authorization scope.
  if (!userId) return null;

  // 1) Create space
  const { data: spaceRow, error: spaceErr } = await supabase
    .from("spaces")
    .insert({ name: "Privat" })
    .select("id")
    .single();
  if (spaceErr) throw spaceErr;

  const spaceId = spaceRow?.id ? String(spaceRow.id) : null;
  if (!spaceId) return null;

  // 2) Link user -> space
  const { error: linkErr } = await supabase
    .from("user_spaces")
    .insert({ user_id: userId, space_id: spaceId, role: "owner" });
  if (linkErr) throw linkErr;

  return spaceId;
}

/* ---------- public auth API ---------- */

export async function initAuthAndSpaces() {
  // 0) PKCE Code Flow: falls Supabase mit ?code=... zurückkommt
  try {
    const u = new URL(location.href);
    const code = u.searchParams.get("code");
    if (code) {
      // exchangeCodeForSession nimmt den Code (supabase-js v2)
      await supabase.auth.exchangeCodeForSession(code);
      // URL bereinigen
      u.searchParams.delete("code");
      window.history.replaceState(null, "", u.pathname + (u.search ? "?" + u.searchParams.toString() : "") + u.hash);
    }
  } catch {
    /* ignore */
  }

  
  // 2) Handle legacy implicit flow (hash tokens) if present
  try {
    const h = String(window.location.hash || "");
    if (h.includes("access_token=") && h.includes("refresh_token=")) {
      const params = new URLSearchParams(h.replace(/^#/, ""));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
        // Clean URL (remove token hash params)
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
  } catch {
    /* ignore */
  }

const { data: sessData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;
  _session = sessData?.session || null;

  if (!_session) {
    _user = null;
    _spaces = [];
    _spaceId = null;
    return null;
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  _user = userData?.user || null;
  const userId = _user?.id || null;

  _spaces = await listUserSpaces();
  if (userId && (!_spaces || _spaces.length === 0)) {
    // Create a default personal space on first login
    const createdId = await ensureDefaultSpaceForUser(userId);
    // Re-load (or synthesize) spaces
    _spaces = await listUserSpaces();
    // If RLS still delays the row, fall back to the created id
    if ((!_spaces || _spaces.length === 0) && createdId) {
      _spaces = [{ space_id: createdId, role: "owner" }];
    }
  }
  _spaceId = pickActiveSpaceId(userId, _spaces);
  if (_spaceId && userId) storeActiveSpaceForUser(userId, _spaceId);

  return { session: _session, user: _user, spaces: _spaces, activeSpaceId: _spaceId };
}

export async function initAuthAndSpace() {
  const ctx = await initAuthAndSpaces();
  if (!ctx) return null;
  return { session: ctx.session, userId: ctx.user?.id || null, spaceId: ctx.activeSpaceId };
}

export async function logout() {
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
  _session = null;
  _user = null;
  _spaces = [];
  _spaceId = null;
}

function normalizeRedirectTo(redirectTo) {
  const raw = (redirectTo && String(redirectTo).trim()) || String(window.location.href);
  let u;
  try {
    u = new URL(raw, window.location.origin);
  } catch {
    u = new URL(window.location.href);
  }
  // strip hash (never include #login etc. in redirectTo)
  u.hash = "";
  // ensure we land on index.html (important for static hosts)
  if (!u.pathname.endsWith("index.html")) {
    u.pathname = u.pathname.replace(/\/+$/, "") + "/index.html";
  }
  return u.toString();
}

export async function requestMagicLink({ email, redirectTo }) {
  const safeRedirect = normalizeRedirectTo(redirectTo);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: safeRedirect,
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
  return true;
}




export function getSpaceId() {
  // backwards compat
  return _spaceId;
}

export function getAuthContext() {
  return { session: _session, user: _user, spaces: _spaces, activeSpaceId: _spaceId };
}

export function setActiveSpaceId(spaceId) {
  const sid = spaceId ? String(spaceId) : null;
  _spaceId = sid;
  const userId = _user?.id || null;
  if (userId) storeActiveSpaceForUser(userId, sid);
}

/* ---------- guards ---------- */

function requireSpace() {
  if (!_spaceId) throw new Error("Space not initialized. Call initAuthAndSpaces() first.");
}

function sbHeaders() {
  const accessToken = _session?.access_token;
  if (!accessToken) throw new Error("Not authenticated");
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
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
