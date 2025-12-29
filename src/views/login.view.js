// src/views/login.view.js
import { requestMagicLink, logout, isAuthenticated } from "../supabase.js";

export function renderLoginView({ appEl, state, setView, info }) {
  // If we already have a session, don't show login again.
  if (isAuthenticated?.()) {
    setView({ name: "list", selectedId: null, q: state?.q });
    return;
  }
  const emailPrefill = info?.emailPrefill || "";

  const suggested = info?.redirectTo || defaultRedirectToIndex();

  appEl.innerHTML = `
    <div class="page">
      <header class="topbar">
        <div class="title">Login</div>
        <div class="spacer"></div>
        <button class="btn" id="btnBack" type="button">← Zurück</button>
      </header>

      <div class="container">
        <div class="card">
          <h2>Magic Link</h2>
          <p class="muted">Du bekommst einen Login-Link per E-Mail. Danach bist du eingeloggt.</p>

          <label class="field">
            <div class="label">E-Mail</div>
            <input id="email" type="email" placeholder="name@example.com" value="${escapeHtml(emailPrefill)}" />
          </label>

          <div class="row">
            <button class="btn primary" id="btnSend" type="button">Magic Link senden</button>
            <button class="btn" id="btnLogout" type="button">Logout</button>
          </div>

          <div id="msg" class="msg"></div>
        </div>
      </div>
    </div>
  `;

  const $ = (sel) => appEl.querySelector(sel);
  const msgEl = $("#msg");

  function setMsg(text, kind = "") {
    msgEl.textContent = text || "";
    msgEl.className = "msg " + (kind || "");
  }

  $("#btnBack")?.addEventListener("click", () => {
    setView({ name: "list", selectedId: null, q: state?.q });
  });

  $("#btnLogout")?.addEventListener("click", () => {
    try { logout(); } catch { /* ignore */ }
    setMsg("Logout: Token lokal gelöscht. (Du bist jetzt ausgeloggt)", "ok");
  });

  $("#btnSend")?.addEventListener("click", async () => {
    const email = ($("#email").value || "").trim();
    const redirectTo = suggested;

    if (!email) return setMsg("Bitte E-Mail eingeben.", "bad");
    // Make sure it points to index.html when using Live Server folder URLs
    const normalizedRedirect = normalizeRedirectToIndexHtml(redirectTo);

    setMsg("Sende Magic Link…");
    $("#btnSend").disabled = true;

    try {
      await requestMagicLink({ email, redirectTo: normalizedRedirect });
      setMsg("Gesendet ✅ Bitte E-Mail öffnen und Link klicken.", "ok");
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
    } finally {
      $("#btnSend").disabled = false;
    }
  });
}

/* =========================
   Redirect helpers
========================= */

function defaultRedirectToIndex() {
  // We want to land on the actual SPA entrypoint (index.html) in DEV and PROD.
  // If already ends with index.html, keep it.
  const { origin, pathname } = location;

  // Typical:
  // DEV: http://127.0.0.1:5500/git-rezepte-main/index.html
  // PROD: https://cook.tinkeroneo.de/ (or /index.html)
  const p = pathname || "/";

  if (/\/index\.html$/i.test(p)) return origin + p;

  // If pathname ends with "/", append "index.html"
  if (p.endsWith("/")) return origin + p + "index.html";

  // If pathname looks like a file (contains a dot), keep it (rare)
  if (/\.[a-z0-9]+$/i.test(p)) return origin + p;

  // Otherwise treat as folder, append "/index.html"
  return origin + p.replace(/\/?$/, "/") + "index.html";
}

function normalizeRedirectToIndexHtml(url) {
  // If user pastes a folder URL (…/git-rezepte-main/), convert to …/git-rezepte-main/index.html
  try {
    const u = new URL(url);
    const p = u.pathname || "/";

    if (/\/index\.html$/i.test(p)) return u.toString();

    if (p.endsWith("/")) {
      u.pathname = p + "index.html";
      return u.toString();
    }

    // if no extension and not ending with slash, treat as folder
    if (!/\.[a-z0-9]+$/i.test(p)) {
      u.pathname = p.replace(/\/?$/, "/") + "index.html";
      return u.toString();
    }

    return u.toString();
  } catch {
    return url;
  }
}

/* =========================
   Debug / utils
========================= */

function buildDebugText(info) {
  const lines = [];
  lines.push(`origin=${location.origin}`);
  lines.push(`path=${location.pathname}`);
  lines.push(`hash=${location.hash}`);
  lines.push(`href=${location.href}`);
  if (info?.debug) lines.push("", String(info.debug));
  return lines.join("\n");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}