// Minimaler Supabase REST-Client (ohne externe Libraries)
// Nutzt: Project URL + anon key aus Supabase
import { getClientId } from "./domain/clientId.js";

// Upload limits (client-side). Server-side rules should also exist (Supabase Storage policies).
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg","image/png","image/webp"]);
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3 MB

const SUPABASE_URL = "https://iwpqodzaedprukqotckb.supabase.co";

// ⛔ HIER deinen anon public key einsetzen (nicht service_role!)
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3cHFvZHphZWRwcnVrcW90Y2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMzI2MjEsImV4cCI6MjA4MTkwODYyMX0.v7JHkz-g4lKtTW-emaH3L4KNOyAKOy19FihdNiz0NQY";

// Dein “Raum” (Option A). Kannst du später ändern.
const SPACE_ID = "tinkeroneo-main";

function sbHeaders() {
  return {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
  };
}

// Helper für Fehlertexte

const DEFAULT_TIMEOUT_MS = 12000;
const UPLOAD_TIMEOUT_MS = 45000;

async function sbFetch(url, { timeoutMs = DEFAULT_TIMEOUT_MS, ...opts } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return res;
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
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

// CRUD

export async function listRecipes() {
  const url = `${SUPABASE_URL}/rest/v1/recipes?space_id=eq.${encodeURIComponent(SPACE_ID)}&order=created_at.desc`;
  const res = await sbFetch(url, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase list failed: ${res.status} ${await sbJson(res)}`);
  return await res.json();
}

export async function upsertRecipe(recipe) {
  // upsert über Primary Key id
  const baseRow = {
    id: recipe.id,
    space_id: SPACE_ID,
    title: recipe.title,
    category: recipe.category ?? "",
    time: recipe.time ?? "",
    ingredients: recipe.ingredients ?? [],
    steps: recipe.steps ?? [],
    image_url: recipe.image_url ?? null,
    source: recipe.source ?? ""
  };

  // tags are optional (may not exist yet in DB schema)
  const tryRows = [
    { ...baseRow, tags: recipe.tags ?? [] },
    baseRow
  ];

  let lastErr = null;
  for (const row of tryRows) {
    const res = await sbFetch(`${SUPABASE_URL}/rest/v1/recipes`, {
      method: "POST",
      headers: { ...sbHeaders(), "Prefer": "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([row])
    });

    if (res.ok) return (await sbJson(res))[0];

    const body = await sbJson(res);
    const msg = typeof body === "string" ? body : JSON.stringify(body);
    lastErr = new Error(`Supabase upsert failed: ${res.status} ${msg}`);

    // If schema doesn't have 'tags', retry without it (second attempt)
    if (row.tags !== undefined && /column\s+"tags"/i.test(msg)) continue;

    break;
  }
  throw lastErr ?? new Error("Supabase upsert failed.");
}

export async function deleteRecipe(id) {
  const url = `${SUPABASE_URL}/rest/v1/recipes?id=eq.${encodeURIComponent(id)}&space_id=eq.${encodeURIComponent(SPACE_ID)}`;
  const res = await fetch(url, { method: "DELETE", headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase delete failed: ${res.status} ${await sbJson(res)}`);
  return true;
}
const BUCKET = "recipe-images";

export async function uploadRecipeImage(file, recipeId) {
  if (!file) throw new Error("Kein File ausgewählt.");
  if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Ungültiger Bildtyp. Erlaubt: JPG, PNG, WEBP.");
  }
  if (typeof file.size === "number" && file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Bild ist zu groß (max. 3 MB). Bitte kleiner exportieren.");
  }

  const extFromName = (file.name?.split(".").pop() || "").toLowerCase();
  const ext =
    extFromName ||
    (file.type === "image/png" ? "png" :
     file.type === "image/webp" ? "webp" :
     file.type === "image/jpeg" ? "jpg" : "img");

const ts = Date.now();
const path = `${SPACE_ID}/${recipeId}-${ts}.${ext}`;


  // 1) Signed Upload URL holen (Edge Function)
  const fnUrl = `${SUPABASE_URL}/functions/v1/sign-upload`;
  const signRes = await sbFetch(fnUrl, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path, contentType: file.type || "application/octet-stream" }),
  });

  if (!signRes.ok) {
    const txt = await signRes.text();
    throw new Error(`Sign failed: ${signRes.status} ${txt}`);
  }

  const signed = await signRes.json();
  // signed enthält: signedUrl + token (je nach SDK-Version)
  // createSignedUploadUrl liefert: { signedUrl, path, token }
  const signedUrl = signed.signedUrl;

  // 2) Upload an signed URL (PUT)
  const upRes = await sbFetch(signedUrl, { timeoutMs: UPLOAD_TIMEOUT_MS, method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!upRes.ok) {
    const txt = await upRes.text();
    throw new Error(`Upload failed: ${upRes.status} ${txt}`);
  }

  // 3) Public URL (Bucket public)
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  return publicUrl;
}

export async function listAllRecipeParts() {
  const url = `${SUPABASE_URL}/rest/v1/recipe_parts?space_id=eq.${encodeURIComponent(SPACE_ID)}&order=sort_order.asc`;
  const res = await sbFetch(url, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`parts list failed: ${res.status} ${await sbJson(res)}`);
  return await res.json();
}

export async function addRecipePart(parentId, childId, sortOrder = 0) {
  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/recipe_parts`, {
    method: "POST",
    headers: { ...sbHeaders(), "Prefer": "resolution=merge-duplicates" },
    body: JSON.stringify([{
      space_id: "tinkeroneo-main",
      parent_id: parentId,
      child_id: childId,
      sort_order: sortOrder
    }])
  });
  if (!res.ok) throw new Error(`add part failed: ${res.status} ${await sbJson(res)}`);
  return true;
}


export async function removeRecipePart(parentId, childId) {
  const url =
    `${SUPABASE_URL}/rest/v1/recipe_parts?space_id=eq.${encodeURIComponent(SPACE_ID)}` +
    `&parent_id=eq.${encodeURIComponent(parentId)}&child_id=eq.${encodeURIComponent(childId)}`;
  const res = await fetch(url, { method: "DELETE", headers: sbHeaders() });
  if (!res.ok) throw new Error(`remove part failed: ${res.status} ${await sbJson(res)}`);
  return true;
}


// Cook Events (client-scoped via client_id) – REST (kein supabase-js)
export async function listCookEventsSb(recipeId) {
  const clientId = getClientId();
  const urlWithClient =
    `${SUPABASE_URL}/rest/v1/cook_events?space_id=eq.${encodeURIComponent(SPACE_ID)}` +
    `&client_id=eq.${encodeURIComponent(clientId)}` +
    `&recipe_id=eq.${encodeURIComponent(recipeId)}` +
    `&order=at.desc`;

  const urlNoClient =
    `${SUPABASE_URL}/rest/v1/cook_events?space_id=eq.${encodeURIComponent(SPACE_ID)}` +
    `&recipe_id=eq.${encodeURIComponent(recipeId)}` +
    `&order=at.desc`;

  let res = await sbFetch(urlWithClient, { headers: sbHeaders(), timeoutMs: 12000 });
  if (!res.ok) {
    // Some setups don't have a client_id column in cook_events. If that happens, fall back.
    if (res.status === 400) {
      res = await sbFetch(urlNoClient, { headers: sbHeaders(), timeoutMs: 12000 });
    }
  }
  if (!res.ok) throw new Error(`cook_events list failed: ${res.status} ${await sbJson(res)}`);
  return await res.json();
}

export async function upsertCookEventSb(ev) {
  const clientId = getClientId();
  const payloadWithClient = { ...ev, client_id: clientId, space_id: SPACE_ID };
  const payloadNoClient = { ...ev, space_id: SPACE_ID };

  let res = await sbFetch(`${SUPABASE_URL}/rest/v1/cook_events`, {
    method: "POST",
    headers: { ...sbHeaders(), "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([payloadWithClient]),
    timeoutMs: 12000,
  });

  if (!res.ok && res.status === 400) {
    // fallback if client_id column doesn't exist
    res = await sbFetch(`${SUPABASE_URL}/rest/v1/cook_events`, {
      method: "POST",
      headers: { ...sbHeaders(), "Prefer": "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([payloadNoClient]),
      timeoutMs: 12000,
    });
  }

  if (!res.ok) throw new Error(`cook_events upsert failed: ${res.status} ${await sbJson(res)}`);
  return true;
}

export async function deleteCookEventSb(id) {
  const clientId = getClientId();
  const urlWithClient =
    `${SUPABASE_URL}/rest/v1/cook_events?space_id=eq.${encodeURIComponent(SPACE_ID)}` +
    `&client_id=eq.${encodeURIComponent(clientId)}` +
    `&id=eq.${encodeURIComponent(id)}`;

  const urlNoClient =
    `${SUPABASE_URL}/rest/v1/cook_events?space_id=eq.${encodeURIComponent(SPACE_ID)}` +
    `&id=eq.${encodeURIComponent(id)}`;

  let res = await sbFetch(urlWithClient, {
    method: "DELETE",
    headers: sbHeaders(),
    timeoutMs: 12000,
  });

  if (!res.ok && res.status === 400) {
    res = await sbFetch(urlNoClient, {
      method: "DELETE",
      headers: sbHeaders(),
      timeoutMs: 12000,
    });
  }

  if (!res.ok) throw new Error(`cook_events delete failed: ${res.status} ${await sbJson(res)}`);
  return true;
}

// Client logs (optional)
export async function logClientEvent(evt) {
  const payload = {
    ...evt,
    client_id: evt.client_id ?? getClientId(),
    space_id: SPACE_ID,
  };
  const res = await sbFetch(`${SUPABASE_URL}/rest/v1/client_logs`, {
    method: "POST",
    headers: { ...sbHeaders(), "Prefer": "return=minimal" },
    body: JSON.stringify([payload]),
    timeoutMs: 8000,
  });
  // Ignore failures; do not crash app
  if (!res.ok) {
    const body = await sbJson(res);
    throw new Error(`Supabase log failed: ${res.status} ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return true;
}
