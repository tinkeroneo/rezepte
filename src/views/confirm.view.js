// src/views/confirm.view.js
import { verifyOtpAndStore, isAuthenticated } from "../supabase.js";
import { readUseBackend, writeUseBackend } from "../app/localSettings.js";

// View: #confirm?token_hash=...&type=magiclink&next=...
export function renderConfirmView({ appEl, state, setView }) {
  const nav = typeof setView === "function" ? setView : null;
  // If already authed, just continue
  if (isAuthenticated?.()) {
    const next = state?.next || null;
    if (next) return hardNavigate(next);
    if (nav) nav({ name: "list", selectedId: null, q: state?.q }); else hardNavigate("#list");
    return;
  }

  const token_hash = state?.token_hash || "";
  const type = state?.type || "magiclink";
  const next = state?.next || "";

  appEl.innerHTML = `
    <div class="page">
      <header class="topbar">
        <div class="topbar-title">Login bestätigen</div>
      </header>

      <main class="content" style="max-width:520px;margin:0 auto;">
        <div class="card" style="padding:1rem;">
          <p style="margin-top:0;">
            Bitte bestätige den Login
          </p>

          ${token_hash ? "" : `
            <div class="msg bad">
              In diesem Link fehlt <code>token_hash</code>. Bitte fordere einen neuen Login-Link an.
            </div>
          `}

          <div style="display:flex; gap:.5rem; flex-wrap:wrap; margin-top:1rem;">
            <button id="btnConfirm" class="btn primary" ${token_hash ? "" : "disabled"}>Jetzt anmelden</button>
            <button id="btnCancel" class="btn" type="button">Abbrechen</button>
          </div>

          <div id="msg" class="msg" style="margin-top:1rem; display:none;"></div>
        </div>
      </main>
    </div>
  `;

  const $ = (sel) => appEl.querySelector(sel);
  const msgEl = $("#msg");

  function setMsg(text, kind) {
    if (!msgEl) return;
    msgEl.style.display = "block";
    msgEl.textContent = text;
    msgEl.className = "msg " + (kind || "");
  }

  $("#btnCancel")?.addEventListener("click", () => {
    if (nav) nav({ name: "login" });
    else hardNavigate("#login");
  });

  $("#btnConfirm")?.addEventListener("click", async () => {
    try {
      $("#btnConfirm").disabled = true;
      setMsg("Bestätige Login…");

      await verifyOtpAndStore({ token_hash, type });

      // After a successful cloud login we default to backend mode, so the user
      // immediately sees their default space instead of staying in local mode.
      // (User can still toggle back to local later.)
      try {
        if (!readUseBackend?.()) writeUseBackend(true);
      } catch {
        // ignore
      }

      // After storing the session, jump to next (full URL) or back into the app.
      if (next) return hardNavigate(next);

      if (nav) nav({ name: "list", selectedId: null, q: state?.q }); else hardNavigate("#list");
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
      $("#btnConfirm").disabled = false;
    }
  });
}

function hardNavigate(url) {
  try {
    window.location.href = url;
  } catch {
    // fallback
    window.location.assign(url);
  }
}
