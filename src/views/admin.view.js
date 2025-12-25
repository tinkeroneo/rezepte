import { escapeHtml, qs } from "../utils.js";
import { getCategoryColors, setCategoryColor, normalizeCategoryToken } from "../domain/categories.js";
import { getTagColors, setTagColor } from "../domain/tagColors.js";
import { getFavoritesMap } from "../domain/favorites.js";

export function renderAdminView({ appEl, recipes, setView }) {
  const colors = getCategoryColors();

  // derive category tokens from recipes
  const tokens = new Set();
  (recipes || []).forEach(r => {
    const cat = r.category || "";
    cat.split("/").map(s => normalizeCategoryToken(s)).filter(Boolean).forEach(t => tokens.add(t));
  });
  const sorted = Array.from(tokens).sort((a,b)=>a.localeCompare(b, "de"));

  appEl.innerHTML = `
    <div class="page">
      <div class="topbar">
        <button id="backBtn" class="btn">←</button>
        <div style="font-weight:900; font-size:1.35rem;">Admin</div>
      </div>

      <div class="card">
        <div style="font-weight:800; margin-bottom:.4rem;">Tools</div>
        <div class="admin-links">
          <a class="chip" href="#selftest">Selftest</a>
          <a class="chip" href="#diagnostics">Diagnostics</a>
        </div>
      </div>

      <div class="card">
        <div style="font-weight:800; margin-bottom:.4rem;">UI & Modus</div>

        <label class="admin-toggle">
          <span>☁️ Backend-Modus (Supabase) verwenden</span>
          <input id="useBackendToggle" type="checkbox" />
        </label>

        <label class="admin-toggle">
          <span>🌙 Dark Mode</span>
          <input id="darkModeToggle" type="checkbox" />
        </label>

        <label class="admin-toggle">
          <span>❄️ Winter-Overlay</span>
          <input id="winterToggle" type="checkbox" />
        </label>

        <div class="muted" style="margin-top:.35rem;">
          Backend/Dark/Winter werden lokal gespeichert. Backend-Wechsel lädt die Seite neu.
        </div>
      </div>

      <div class="card">
        <div style="font-weight:800; margin-bottom:.4rem;">Features</div>

        <label style="display:flex; align-items:center; justify-content:space-between; gap:1rem; cursor:pointer;">
          <span>🎵 Radio im Kochmodus anzeigen</span>
          <input id="radioFeatureToggle" type="checkbox" />
        </label>

        <div class="muted" style="margin-top:.35rem;">
          Lädt Drittanbieter-Inhalte erst nach Consent im Kochmodus.
        </div>

        <div class="row" style="margin-top:.6rem; gap:.5rem; flex-wrap:wrap;">
          <button class="btn btn-ghost" id="radioRevokeConsentBtn" type="button">Consent widerrufen</button>
        </div>
      </div>

      <div class="card">
        <div style="font-weight:800; margin-bottom:.4rem;">Timer</div>

        <label class="admin-toggle">
          <span>✨ Schritt-Highlight bei Timer-Ablauf</span>
          <input id="timerStepHighlightToggle" type="checkbox" />
        </label>

        <div class="admin-grid" style="margin-top:.65rem;">
          <label class="admin-field">
            <div class="muted">Klingel-Intervall (ms)</div>
            <input id="timerRingIntervalMs" type="number" min="125" max="5000" step="25" />
          </label>

          <label class="admin-field">
            <div class="muted">Max. Klingeldauer (Sek.)</div>
            <input id="timerMaxRingSeconds" type="number" min="10" max="600" step="5" />
          </label>
        </div>

        <div class="muted" style="margin-top:.35rem;">
          Änderungen wirken beim nächsten Render/Tick (spätestens beim erneuten Öffnen der Kochansicht).
        </div>

        <div class="row" style="margin-top:.6rem; gap:.5rem; flex-wrap:wrap;">
          <button class="btn btn-ghost" id="timerResetDefaults" type="button">Defaults</button>
        </div>
      </div>

      <div class="card">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem;">
          <div>
            <div style="font-weight:800;">Kategorien & Farben</div>
            <div class="muted" style="margin-top:.15rem;">Farben werden lokal gespeichert (LocalStorage). Später kann das an eine Settings-Tabelle gekoppelt werden.</div>
          </div>
        </div>

        ${sorted.length ? `
          <div class="admin-cats">
            ${sorted.map(t => {
              const val = colors[t] || "#d9e8df";
              return `
                <div class="admin-cat-row">
                  <div class="admin-cat-name">${escapeHtml(t)}</div>
                  <input class="admin-color" type="color" value="${escapeHtml(val)}" data-cat="${escapeHtml(t)}" />
                </div>
              `;
            }).join("")}
          </div>
        ` : `<div class="muted" style="margin-top:.6rem;">Keine Kategorien gefunden.</div>`}
      </div>

      <div class="card">
        <div style="font-weight:800; margin-bottom:.4rem;">Tags & Farben</div>
        <div class="muted" style="margin-bottom:.6rem;">Tag-Farben sind optional – wenn gesetzt, werden sie in der Liste als Chips gezeigt.</div>

        <div class="admin-cats">
          ${(() => {
            const tagColors = getTagColors();
            const tags = new Set();
            (recipes || []).forEach(r => {
              const t = r.tags;
              if (Array.isArray(t)) t.forEach(x => x && tags.add(String(x)));
              else if (typeof t === "string" && t.trim()) {
                t.split(",").map(s => s.trim()).filter(Boolean).forEach(x => tags.add(x));
              }
            });
            const list = Array.from(tags).sort((a,b)=>a.localeCompare(b, "de"));
            if (!list.length) return `<div class="muted">Keine Tags gefunden.</div>`;
            return list.map(tag => {
              const val = tagColors[tag] || "#d9e8df";
              return `
                <div class="admin-cat-row">
                  <div class="admin-cat-name">${escapeHtml(tag)}</div>
                  <input class="admin-color" type="color" value="${escapeHtml(val)}" data-tag="${escapeHtml(tag)}" />
                </div>
              `;
            }).join("");
          })()}
        </div>
      </div>

      <div class="card">
        <div style="font-weight:800; margin-bottom:.4rem;">Favoriten</div>
        <div class="muted">Favoriten werden lokal gespeichert. Aktuell markiert: <b>${Object.keys(getFavoritesMap()).length}</b></div>
      </div>
    </div>
  `;

  qs(appEl, "#backBtn").addEventListener("click", () => setView({ name: "list", selectedId: null, q: "" }));


  // Radio feature toggle + consent reset
  const RADIO_FEATURE_KEY = "tinkeroneo_radio_feature_v1";
  const RADIO_CONSENT_KEY = "tinkeroneo_radio_consent_v1";

  const radioToggle = qs(appEl, "#radioFeatureToggle");
  if (radioToggle) {
    let enabled = true;
    try { enabled = (localStorage.getItem(RADIO_FEATURE_KEY) !== "0"); } catch { enabled = true; }
    radioToggle.checked = enabled;

    radioToggle.addEventListener("change", () => {
      try { localStorage.setItem(RADIO_FEATURE_KEY, radioToggle.checked ? "1" : "0"); } catch { /* ignore */ }
      // small hint: reload current view to reflect
      // no immediate rerender needed; takes effect next time cook view renders
    });
  }

  const revokeBtn = qs(appEl, "#radioRevokeConsentBtn");
  revokeBtn?.addEventListener("click", () => {
    try { localStorage.removeItem(RADIO_CONSENT_KEY); } catch { /* ignore */ }
    alert("Radio-Consent wurde widerrufen.");
  });

  // UI toggles
  const s = window.__tinkeroneoSettings || {};

  const useBackendToggle = qs(appEl, "#useBackendToggle");
  if (useBackendToggle) {
    useBackendToggle.checked = !!s.readUseBackend?.();
    useBackendToggle.addEventListener("change", () => {
      s.setUseBackend?.(useBackendToggle.checked);
      location.reload();
    });
  }

  const darkToggle = qs(appEl, "#darkModeToggle");
  if (darkToggle) {
    darkToggle.checked = (s.readTheme?.() === "dark");
    darkToggle.addEventListener("change", () => {
      s.setTheme?.(darkToggle.checked ? "dark" : "light");
      document.body.classList.toggle("dark", darkToggle.checked);
      window.__tinkeroneoUpdateBadges?.();
    });
  }

  const winterToggle = qs(appEl, "#winterToggle");
  if (winterToggle) {
    winterToggle.checked = !!s.readWinter?.();
    winterToggle.addEventListener("change", () => {
      s.setWinter?.(winterToggle.checked);
      document.body.classList.toggle("winter", winterToggle.checked);
    });
  }

  // Timer settings
  const timerStep = qs(appEl, "#timerStepHighlightToggle");
  if (timerStep) {
    timerStep.checked = !!s.readTimerStepHighlight?.();
    timerStep.addEventListener("change", () => {
      s.setTimerStepHighlight?.(timerStep.checked);
    });
  }

  const ringMsEl = qs(appEl, "#timerRingIntervalMs");
  if (ringMsEl) {
    ringMsEl.value = String(s.readTimerRingIntervalMs?.() ?? 125);
    ringMsEl.addEventListener("change", () => {
      s.setTimerRingIntervalMs?.(ringMsEl.value);
    });
  }

  const maxRingEl = qs(appEl, "#timerMaxRingSeconds");
  if (maxRingEl) {
    maxRingEl.value = String(s.readTimerMaxRingSeconds?.() ?? 120);
    maxRingEl.addEventListener("change", () => {
      s.setTimerMaxRingSeconds?.(maxRingEl.value);
    });
  }

  qs(appEl, "#timerResetDefaults")?.addEventListener("click", () => {
    s.setTimerRingIntervalMs?.(125);
    s.setTimerMaxRingSeconds?.(120);
    s.setTimerStepHighlight?.(true);
    if (ringMsEl) ringMsEl.value = "125";
    if (maxRingEl) maxRingEl.value = "120";
    if (timerStep) timerStep.checked = true;
    alert("Timer-Defaults gesetzt.");
  });


  appEl.querySelectorAll('input[type="color"][data-cat]').forEach(inp => {
    inp.addEventListener("input", () => {
      const cat = inp.dataset.cat;
      setCategoryColor(cat, inp.value);
    });
  });

  appEl.querySelectorAll('input[type="color"][data-tag]').forEach(inp => {
    inp.addEventListener("input", () => {
      const tag = inp.dataset.tag;
      setTagColor(tag, inp.value);
    });
  });
}
