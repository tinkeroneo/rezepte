// supabase/functions/sign-upload/index.ts
// Edge Function: sign-upload (CORS + user->space membership check + server-side path builder)
//
// Erwartet JSON:
//   { spaceId: string, recipeId: string, ext?: string, contentType?: string }
//
// Antwort (Supabase createSignedUploadUrl):
//   { signedUrl: string, path: string, token?: string, contentType?: string }
//
// HINWEIS: Diese Function nutzt SERVICE_ROLE_KEY um Signed Upload URLs zu erstellen,
// prüft aber davor die Mitgliedschaft in user_spaces anhand des JWT (Authorization: Bearer ...).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://cook.tinkeroneo.de",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = allowedOrigins.has(origin) ? origin : "https://cook.tinkeroneo.de";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const headers = cors(req);

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing env SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Missing Authorization Bearer token" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    const jwt = authHeader.slice(7);

    const body = await req.json().catch(() => ({}));
    const spaceId = body?.spaceId as string | undefined;
    const recipeId = body?.recipeId as string | undefined;
    const extRaw = (body?.ext as string | undefined) ?? "jpg";
    const contentType = (body?.contentType as string | undefined) ?? null;

    if (!spaceId || !recipeId) {
      return new Response(JSON.stringify({ error: "Missing spaceId/recipeId" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // User aus JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Membership prüfen
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: membership, error: memErr } = await admin
      .from("user_spaces")
      .select("role")
      .eq("user_id", userId)
      .eq("space_id", spaceId)
      .maybeSingle();

    if (memErr || !membership) {
      return new Response(JSON.stringify({ error: "Not a member of space" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Path serverseitig bauen
    const ext = extRaw.replace(/[^a-z0-9]/gi, "").slice(0, 10) || "jpg";
    const ts = Date.now();
    const path = `tinkeroneo-main/spaces/${spaceId}/recipes/${recipeId}-${ts}.${ext}`;

    const bucket = "recipe-images";
    const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ...data, path, contentType }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
