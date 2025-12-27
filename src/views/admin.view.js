import { getCategoryColors, setCategoryColor, normalizeCategoryToken } from "../domain/categories.js";
// src/views/admin.view.js

export function renderAdminView({ appEl, recipes, setView }) {
  const s = window.__tinkeroneoSettings || {};

  const useBackend = !!s.readUseBackend?.();
  const theme = (s.readTheme?.() || "system");
  const winter = !!s.readWinter?.();
  const radioFeature = !!s.readRadioFeature?.();
  const radioConsent = !!s.readRadioConsent?.();

  const ringIntervalMs = Number(s.readTimerRingIntervalMs?.() ?? 125);
  const maxRingSeconds = Number(s.readTimerMaxRingSeconds?.() ?? 120);
  const stepHighlight = !!s.readTimerStepHighlight?.();

  const recipeCount = Array.isArray(recipes) ? recipes.length : 0;

  // Category colors (local setting)
  const catColorMap = getCategoryColors();
  const catTokens = Array.from(
    new Set(
      (Array.isArray(recipes) ? recipes : [])
        .map(r => String(r?.category || "").split("/")[0].trim())
        .filter(Boolean)
    )
  ).sort((a,b)=>a.localeCompare(b));

  const catRowsHtml = catTokens.length
    ? catTokens.map(cat => {
        const key = normalizeCategoryToken(cat);
        const col = catColorMap[key] || "#d9e8df";
        return `
          <div class="row row--spread" style="align-items:center; gap:12px;">
            <div style="min-width:160px;">
              <div class="label">${cat}</div>
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
              <input class="catColor" type="color" value="${col}" data-cat="${cat}" />
              <span class="hint" style="min-width:110px;">${col}</span>
            </div>
          </div>`;
      }).join("")
    : `<div class="hint">Noch keine Kategorien gefunden. Sobald Rezepte Kategorien haben, erscheinen sie hier.</div>`;


  appEl.innerHTML = `
    <div class="page">
      <header class="topbar">
        <div class="title">Admin</div>
        <div class="spacer"></div>
        <button class="btn" id="btnBack" type="button">← Zurück</button>
      </header>

      <div class="card">
        <h2>App</h2>

        <div class="row row--spread">
          <div>
            <div class="label">Backend (Supabase)</div>
            <div class="hint">CLOUD nutzt Supabase + RLS/Space. LOCAL nutzt nur LocalStorage.</div>
          </div>
          <label class="toggle">
            <input id="useBackendToggle" type="checkbox" ${useBackend ? "checked" : ""} />
            <span>Use backend</span>
          </label>
        </div>

        <hr />

        <div class="row row--spread">
          <div>
            <div class="label">Theme</div>
            <div class="hint">system | light | dark</div>
          </div>
          <select id="themeSelect">
            <option value="system" ${theme === "system" ? "selected" : ""}>system</option>
            <option value="light" ${theme === "light" ? "selected" : ""}>light</option>
            <option value="dark" ${theme === "dark" ? "selected" : ""}>dark</option>
          </select>
        </div>

        <div class="row row--spread">
          <div>
            <div class="label">Winter Mode</div>
            <div class="hint">Optischer Effekt</div>
          </div>
          <label class="toggle">
            <input id="winterToggle" type="checkbox" ${winter ? "checked" : ""} />
            <span>Winter</span>
          </label>
        </div>

        <div class="row row--spread">
          <div>
            <div class="label">Radio (Drittanbieter)</div>
            <div class="hint">Optional: egoFM Player. Lädt erst nach Consent. Bei OFF wird nichts extern geladen.</div>
          </div>
          <label class="toggle">
            <input id="radioToggle" type="checkbox" ${radioFeature ? "checked" : ""} />
            <span>Radio</span>
          </label>
        </div>

        <div class="row" style="gap:.5rem; flex-wrap:wrap;">
          <button class="btn" id="btnRadioResetConsent" type="button" ${radioConsent ? "" : "disabled"}>
            Consent zurücksetzen
          </button>
          <div class="hint" style="margin:0;">
            Status: ${radioFeature ? "aktiv" : "aus"} / Consent: ${radioConsent ? "ja" : "nein"}
          </div>
        </div>

        <hr />

        <h3>Kategorien – Farben</h3>
        <div class="hint">Farben werden in der Listenansicht als Akzent genutzt.</div>
        <div id="catColors" class="form" style="margin-top:8px; display:flex; flex-direction:column; gap:8px;">
          ${catRowsHtml || `<div class="hint">Noch keine Kategorien vorhanden.</div>`}
        </div>


        <hr />

        <h3>Timer</h3>

        <label class="field">
          <div class="label">Ring Interval (ms)</div>
          <input id="ringInterval" type="number" min="125" max="5000" step="25" value="${escapeHtml(ringIntervalMs)}" />
          <div class="hint">125…5000 ms</div>
        </label>

        <label class="field">
          <div class="label">Max Ring Duration (s)</div>
          <input id="maxRingSeconds" type="number" min="10" max="600" step="5" value="${escapeHtml(maxRingSeconds)}" />
          <div class="hint">10…600 s</div>
        </label>

        <div class="row row--spread">
          <div>
            <div class="label">Step Highlight</div>
            <div class="hint">Schritt wird hervorgehoben wenn Timer abläuft</div>
          </div>
          <label class="toggle">
            <input id="stepHighlightToggle" type="checkbox" ${stepHighlight ? "checked" : ""} />
            <span>Highlight</span>
          </label>
        </div>

        <hr />

        <h3>Tools</h3>
        <div class="row">
          <button class="btn" id="btnDiagnostics" type="button">Diagnostics</button>
          <button class="btn" id="btnSelftest" type="button">Selftest</button>
          <button class="btn" id="btnLogin" type="button">Login</button>
        </div>

        <div class="row">
          <button class="btn" id="btnReload" type="button">Reload</button>
        </div>

        <div class="msg" id="msg"></div>

        <details class="details">
          <summary>Info</summary>
          <pre class="pre">${escapeHtml(
            [
              `recipes=${recipeCount}`,
              `useBackend=${useBackend}`,
              `theme=${theme}`,
              `winter=${winter}`,
              `ringIntervalMs=${ringIntervalMs}`,
              `maxRingSeconds=${maxRingSeconds}`,
              `stepHighlight=${stepHighlight}`,
              `href=${location.href}`,
            ].join("\n")
          )}</pre>
        </details>
      </div>
    </div>
  `;

  const qs = (sel) => appEl.querySelector(sel);
  const msgEl = qs("#msg");

  const setMsg = (text, kind = "") => {
    msgEl.textContent = text || "";
    msgEl.className = "msg " + (kind || "");
  };

  qs("#btnBack")?.addEventListener("click", () => {
    setView({ name: "list", selectedId: null, q: "" });
  });

  // --- Backend toggle (NO reload, awaits setUseBackend) ---
  const useBackendToggle = qs("#useBackendToggle");
  if (useBackendToggle) {
    useBackendToggle.addEventListener("change", async () => {
      const on = !!useBackendToggle.checked;
      useBackendToggle.disabled = true;
      setMsg("Switching…");

      try {
        if (typeof s.setUseBackend !== "function") {
          throw new Error("setUseBackend fehlt in window.__tinkeroneoSettings");
        }
        await s.setUseBackend(on);
        setMsg("OK ✅", "ok");
      } catch (e) {
        setMsg(String(e?.message || e), "bad");
        // revert checkbox if failed
        useBackendToggle.checked = !on;
      } finally {
        useBackendToggle.disabled = false;
      }
    });
  }

  // Theme
  const themeSelect = qs("#themeSelect");
  if (themeSelect) {
    themeSelect.addEventListener("change", () => {
      try {
        s.setTheme?.(themeSelect.value);
        location.reload();
      } catch (e) {
        setMsg(String(e?.message || e), "bad");
      }
    });
  }

  // Winter
  const winterToggle = qs("#winterToggle");
  if (winterToggle) {
    winterToggle.addEventListener("change", () => {
      try {
        s.setWinter?.(!!winterToggle.checked);
        location.reload();
      } catch (e) {
        setMsg(String(e?.message || e), "bad");
      }
    });
  }

  // Radio (feature + consent)
  const radioToggle = qs("#radioToggle");
  if (radioToggle) {
    radioToggle.addEventListener("change", () => {
      try {
        s.setRadioFeature?.(!!radioToggle.checked);
        setMsg("Gespeichert ✅", "ok");
        location.reload();
      } catch (e) {
        setMsg(String(e?.message || e), "bad");
      }
    });
  }

  qs("#btnRadioResetConsent")?.addEventListener("click", () => {
    try {
      s.clearRadioConsent?.();
      setMsg("Consent zurückgesetzt ✅", "ok");
      location.reload();
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
    }
  });

  // Timer settings
  qs("#ringInterval")?.addEventListener("change", () => {
    try {
      s.setTimerRingIntervalMs?.(Number(qs("#ringInterval").value));
      setMsg("Gespeichert ✅", "ok");
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
    }
  });

  qs("#maxRingSeconds")?.addEventListener("change", () => {
    try {
      s.setTimerMaxRingSeconds?.(Number(qs("#maxRingSeconds").value));
      setMsg("Gespeichert ✅", "ok");
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
    }
  });

  qs("#stepHighlightToggle")?.addEventListener("change", () => {
    try {
      s.setTimerStepHighlight?.(!!qs("#stepHighlightToggle").checked);
      setMsg("Gespeichert ✅", "ok");
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
    }
  });

  // Tools
  qs("#btnDiagnostics")?.addEventListener("click", () => setView({ name: "diagnostics" }));
  qs("#btnSelftest")?.addEventListener("click", () => setView({ name: "selftest" }));
  qs("#btnLogin")?.addEventListener("click", () => setView({ name: "login" }));
  qs("#btnReload")?.addEventListener("click", () => location.reload());

  // category colors
  const cc = qs("#catColors");
  if (cc) {
    cc.addEventListener("input", (ev) => {
      const el = ev.target;
      if (!(el instanceof window.HTMLInputElement)) return;
      if (el.type !== "color") return;
      const cat = el.getAttribute("data-cat") || "";
      const col = el.value;
      setCategoryColor(cat, col);

      // update immediately (no reload)
      try { window.dispatchEvent(new window.Event("category-colors-changed")); } catch { /* ignore */ }
    });
  }

}

/* ---------- helpers ---------- */

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}