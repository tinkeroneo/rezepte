// Minimaler Supabase REST-Client (ohne externe Libraries)
// Nutzt: Project URL + anon key aus Supabase
import { getClientId } from "./domain/clientId.js";

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
async function sbJson(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

// CRUD

export async function listRecipes() {
  const url = `${SUPABASE_URL}/rest/v1/recipes?space_id=eq.${encodeURIComponent(SPACE_ID)}&order=created_at.desc`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase list failed: ${res.status} ${await sbJson(res)}`);
  return await res.json();
}

export async function upsertRecipe(recipe) {
  // upsert über Primary Key id
  const res = await fetch(`${SUPABASE_URL}/rest/v1/recipes`, {
    method: "POST",
    headers: { ...sbHeaders(), "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{
      id: recipe.id,
      space_id: SPACE_ID,
      title: recipe.title,
      category: recipe.category ?? "",
      time: recipe.time ?? "",
      ingredients: recipe.ingredients ?? [],
      steps: recipe.steps ?? [],
      image_url: recipe.image_url ?? null,
      source: recipe.source ?? ""
    }])
  });

  if (!res.ok) throw new Error(`Supabase upsert failed: ${res.status} ${await sbJson(res)}`);
  const data = await res.json();
  return data?.[0] ?? null;
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
  const signRes = await fetch(fnUrl, {
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
  const upRes = await fetch(signedUrl, {
    method: "PUT",
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
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`parts list failed: ${res.status} ${await sbJson(res)}`);
  return await res.json();
}

export async function addRecipePart(parentId, childId, sortOrder = 0) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/recipe_parts`, {
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


// Cook Events (client-scoped via client_id)
export async function listCookEventsSb(recipeId) {
  const clientId = getClientId();
  const { data, error } = await sb
    .from("cook_events")
    .select("*")
    .eq("client_id", clientId)
    .eq("recipe_id", recipeId)
    .order("at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function upsertCookEventSb(ev) {
  const clientId = getClientId();
  const payload = { ...ev, client_id: clientId };

  const { data, error } = await sb
    .from("cook_events")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCookEventSb(id) {
  const clientId = getClientId();
  const { error } = await sb
    .from("cook_events")
    .delete()
    .eq("client_id", clientId)
    .eq("id", id);

  if (error) throw error;
}
