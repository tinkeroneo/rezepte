// src/views/login.view.js
import { requestMagicLink, logout, isAuthenticated } from "../supabase.js";

export function renderLoginView({ appEl, state, setView, info, useBackend, setUseBackend }) {
  const authed = !!isAuthenticated?.();
  const emailPrefill = info?.emailPrefill || "";
  const suggested = info?.redirectTo || defaultRedirectToIndex();
  const COOLDOWN_MS = 60_000;
  const COOLDOWN_KEY = "tinkeroneo_magiclink_cooldown_until_v1";

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
          <p class="muted">${authed ? "Du bist aktuell eingeloggt." : "Du bekommst einen Login-Link per E-Mail. Danach bist du eingeloggt."}</p>

          <label class="field">
            <div class="label">E-Mail</div>
            <input id="email" type="email" placeholder="name@example.com" value="${escapeHtml(emailPrefill)}" ${authed ? "disabled" : ""} />
          </label>

          <div class="row">
            <button class="btn primary" id="btnMain" type="button">${authed ? "Logout" : "Magic Link senden"}</button>
          </div>

          <div id="msg" class="msg"></div>
        </div>
      </div>
    </div>
  `;

  const $ = (sel) => appEl.querySelector(sel);
  const msgEl = $("#msg");
  const btnMain = $("#btnMain");
  const defaultBtnLabel = authed ? "Logout" : "Magic Link senden";
  let cooldownTimer = null;

  function setMsg(text, kind = "") {
    msgEl.textContent = text || "";
    msgEl.className = "msg " + (kind || "");
  }

  function setBtnLabel(text) {
    if (btnMain) btnMain.textContent = text;
  }

  function readCooldownUntil() {
    try {
      return Number(localStorage.getItem(COOLDOWN_KEY) || "0");
    } catch {
      return 0;
    }
  }

  function writeCooldownUntil(ts) {
    try {
      localStorage.setItem(COOLDOWN_KEY, String(ts));
    } catch {
      // ignore
    }
  }

  function clearCooldown() {
    try {
      localStorage.removeItem(COOLDOWN_KEY);
    } catch {
      // ignore
    }
  }

  function applyCooldown() {
    if (authed || !btnMain) return;

    const until = readCooldownUntil();
    const leftMs = until - Date.now();

    if (cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }

    if (leftMs <= 0) {
      clearCooldown();
      btnMain.disabled = false;
      setBtnLabel(defaultBtnLabel);
      return;
    }

    const tick = () => {
      const leftSec = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      if (leftSec <= 0) {
        if (cooldownTimer) clearInterval(cooldownTimer);
        cooldownTimer = null;
        clearCooldown();
        btnMain.disabled = false;
        setBtnLabel(defaultBtnLabel);
        return;
      }
      btnMain.disabled = true;
      setBtnLabel(`Erneut senden (${leftSec}s)`);
    };

    tick();
    cooldownTimer = setInterval(tick, 250);
  }

  applyCooldown();

  $("#btnBack")?.addEventListener("click", async () => {
    try {
      if (useBackend && typeof setUseBackend === "function") {
        await setUseBackend(false);
      }
    } catch {
      // ignore
    }
    setView({ name: "list", selectedId: null, q: state?.q });
  });

  btnMain?.addEventListener("click", async () => {
    if (authed) {
      try {
        logout();
      } catch {
        // ignore
      }
      setMsg("Logout: Token lokal geloescht. (Du bist jetzt ausgeloggt)", "ok");
      setTimeout(() => {
        try {
          window.location.replace(location.pathname + "#login");
        } catch {
          setView({ name: "login", selectedId: null, q: "" });
        }
      }, 120);
      return;
    }

    const email = ($("#email").value || "").trim();
    const redirectTo = suggested;
    const confirmRedirect = buildConfirmRedirect(redirectTo);

    if (!email) return setMsg("Bitte E-Mail eingeben.", "bad");
    const normalizedRedirect = normalizeRedirectToIndexHtml(confirmRedirect);

    setMsg("Sende Magic Link...");
    btnMain.disabled = true;

    try {
      await requestMagicLink({ email, redirectTo: normalizedRedirect });
      setMsg("Gesendet. Bitte E-Mail oeffnen und Link klicken.", "ok");
      writeCooldownUntil(Date.now() + COOLDOWN_MS);
      applyCooldown();
    } catch (e) {
      const raw = String(e?.message || e || "");
      const status = Number(e?.status || 0);
      const retryAfterSec = Number(e?.retryAfterSec || 0);
      if (status === 429 || /\b429\b/i.test(raw) || /rate\s*limit/i.test(raw)) {
        const cooldownMs = Math.max(COOLDOWN_MS, retryAfterSec > 0 ? retryAfterSec * 1000 : 0);
        writeCooldownUntil(Math.max(readCooldownUntil(), Date.now() + cooldownMs));
        applyCooldown();
      }
      setMsg(formatMagicLinkError(raw, { status, retryAfterSec }), "bad");
    } finally {
      if (readCooldownUntil() <= Date.now()) {
        btnMain.disabled = false;
        setBtnLabel(defaultBtnLabel);
      }
    }
  });
}

/* =========================
   Redirect helpers
========================= */

function defaultRedirectToIndex() {
  const { origin, pathname } = location;
  const p = pathname || "/";

  if (/\/index\.html$/i.test(p)) return origin + p;
  if (p.endsWith("/")) return origin + p + "index.html";
  if (/\.[a-z0-9]+$/i.test(p)) return origin + p;

  return origin + p.replace(/\/?$/, "/") + "index.html";
}

function normalizeRedirectToIndexHtml(url) {
  try {
    const u = new URL(url);
    const p = u.pathname || "/";

    if (/\/index\.html$/i.test(p)) return u.toString();

    if (p.endsWith("/")) {
      u.pathname = p + "index.html";
      return u.toString();
    }

    if (!/\.[a-z0-9]+$/i.test(p)) {
      u.pathname = p.replace(/\/?$/, "/") + "index.html";
      return u.toString();
    }

    return u.toString();
  } catch {
    return url;
  }
}

function buildConfirmRedirect(finalRedirectTo) {
  const normalizedFinal = normalizeRedirectToIndexHtml(finalRedirectTo);
  try {
    const u = new URL(normalizedFinal);
    const next = normalizedFinal.replace(/#.*$/, "");
    u.hash = "confirm?next=" + encodeURIComponent(next);
    return u.toString();
  } catch {
    const next = String(normalizedFinal || "").replace(/#.*$/, "");
    return String(normalizedFinal || "").replace(/#.*$/, "") + "#confirm?next=" + encodeURIComponent(next);
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMagicLinkError(rawError, details = {}) {
  const raw = String(rawError || "").trim();
  const msg = raw.toLowerCase();
  const retryAfterSec = Number(details?.retryAfterSec || 0);

  if (details?.status === 429 || msg.includes("429") || msg.includes("rate limit")) {
    if (retryAfterSec > 0) {
      const mins = Math.ceil(retryAfterSec / 60);
      return mins > 1
        ? `Zu viele Anfragen. Bitte in ca. ${mins} Minuten erneut versuchen.`
        : "Zu viele Anfragen. Bitte in etwa 1 Minute erneut versuchen.";
    }
    return "Zu viele Anfragen. Bitte kurz warten und dann erneut senden.";
  }
  if (msg.includes("invalid email") || msg.includes("email address")) {
    return "Bitte eine gueltige E-Mail-Adresse eingeben.";
  }
  if (msg.includes("smtp") || msg.includes("email rate")) {
    return "E-Mail-Limit erreicht. Bitte spaeter erneut versuchen.";
  }
  if (msg.includes("failed to fetch") || msg.includes("network")) {
    return "Netzwerkfehler. Bitte Verbindung pruefen und erneut versuchen.";
  }

  return "Magic-Link konnte nicht gesendet werden. Bitte erneut versuchen.";
}
