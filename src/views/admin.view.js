import {
  deriveCategoryColor,
  getCategoryColors,
  removeCategoryColor,
  setCategoryColor,
  normalizeCategoryToken
} from "../domain/categories.js";
import { createBeep } from "../domain/timers.js";
import { readServiceWorkerVersions } from "../services/swInfo.js";
import { applyThemeAndOverlay } from "../app/ui/theme.js";
import { escapeHtml } from "../utils.js";
// src/views/admin.view.js

function renderAdminHint(text, label = "Hinweis") {
  const safeText = String(text || "").trim();
  if (!safeText) return "";
  const safeLabel = escapeHtml(label);
  return `
    <details class="admin-help">
      <summary class="admin-help__btn" aria-label="${safeLabel}" title="${safeLabel}">?</summary>
      <div class="admin-help__bubble">${escapeHtml(safeText)}</div>
    </details>
  `;
}

function renderAdminSetting({ title, hint = "", controlHtml = "", statusHtml = "" }) {
  return `
    <div class="admin-setting">
      <div class="admin-setting__main">
        <div class="admin-setting__lead">
          <div class="label">${escapeHtml(title)}</div>
          ${renderAdminHint(hint, `${title} Hinweis`)}
        </div>
        ${statusHtml ? `<div class="admin-setting__status">${statusHtml}</div>` : ""}
      </div>
      <div class="admin-setting__control">${controlHtml}</div>
    </div>
  `;
}

export function renderAdminView({ appEl, recipes, setView }) {
  const s = window.__tinkeroneoSettings || {};

  const cloudEnabled = !!s.readUseBackend?.();
  const auth = s.getAuthContext?.() || null;
  const activeSpaceId = String(auth?.spaceId || "");
  const winter = !!s.readWinter?.();
  const radioConsent = !!s.readRadioConsent?.();

  const ringIntervalMs = Number(s.readTimerRingIntervalMs?.() ?? 2800);
  const stepHighlight = !!s.readTimerStepHighlight?.();
  const imageModeDebug = !!s.readImageModeDebug?.();

  const timerSoundEnabled = s.readTimerSoundEnabled ? !!s.readTimerSoundEnabled() : true;
  const timerSoundId = s.readTimerSoundId ? String(s.readTimerSoundId() || "bowl") : "gong";
  const timerSoundVolume = s.readTimerSoundVolume ? Number(s.readTimerSoundVolume(  0.65) ?? 0.65) : 0.65;

  const recipeCount = Array.isArray(recipes) ? recipes.length : 0;


  // Category colors (local setting)
  const catTokens = Array.from(
    new Set(
      (Array.isArray(recipes) ? recipes : [])
        .map(r => String(r?.category || "").split("/")[0].trim())
        .filter(Boolean)
    )
  ).sort((a,b)=>a.localeCompare(b));

  const renderCatRowsHtml = () => {
    const catColorMap = getCategoryColors();
    return catTokens.length
      ? catTokens.map((cat) => {
          const key = normalizeCategoryToken(cat);
          const hasOverride = Object.prototype.hasOwnProperty.call(catColorMap, key);
          const col = hasOverride ? catColorMap[key] : deriveCategoryColor(cat);
          return `
            <div class="admin-cat-row">
              <div class="admin-cat-row__title">
                <div class="label">${escapeHtml(cat)}</div>
              </div>
              <div class="admin-cat-row__controls">
                <input class="catColor" type="color" value="${escapeHtml(col)}" data-cat="${escapeHtml(cat)}" />
                ${hasOverride ? `<button class="btn btn--ghost btn--sm" type="button" data-cat-auto="${escapeHtml(cat)}" title="Automatische Farbe wiederherstellen">↺</button>` : ""}
              </div>
            </div>`;
        }).join("")
      : `<div class="hint">Noch keine Kategorien gefunden. Sobald Rezepte Kategorien haben, erscheinen sie hier.</div>`;
  };


  appEl.innerHTML = `

    <div class="page">
      <header class="topbar">
        <div class="title">Admin</div>
        <div class="spacer"></div>
        <button class="btn" id="btnBack" type="button">← Zurück</button>
      </header>

      <div class="container">

        <section class="card">
          <div class="card__hd">
            <div>
              <h2 class="card__title">App</h2>
              <div class="card__subtitle">Basis-Einstellungen</div>
            </div>
          </div>
          <div class="card__bd">
      


            <div class="row row--spread">
              <div>
                <div class="label" hint="Winter Mode">Winter Mode</div>
                
              </div>
              <label class="toggle">
                <input id="winterToggle" type="checkbox" ${winter ? "checked" : ""} />
              </label>
            </div>

            <div class="row row--spread">
              <div>
                <div class="label">Radio (Drittanbieter)</div>
              </div>
              <div></div>
              <div class="row row--right">
                <button class="btn" id="btnRadioResetConsent" type="button" ${radioConsent ? "" : "disabled"}>
                  Consent zurücksetzen
                </button>
                <div class="hint" style="margin:0;">Consent: ${radioConsent ? "ja" : "nein"}</div>
              </div>

            </div>

            <div class="row row--spread">
              <div>
                <div class="label">Bildmodus-Debug</div>
                <div class="hint">Zeigt in der Detailansicht an, ob cover, auto oder alpha-fit aktiv ist.</div>
              </div>
              <label class="toggle">
                <input id="imageModeDebugToggle" type="checkbox" ${imageModeDebug ? "checked" : ""} />
              </label>
            </div>

            

          </div>
        </section>

        <section class="card">
          <div class="card__hd">
            <div>
              <h2 class="card__title">Timer</h2>
              <div class="card__subtitle">Klingelt bis Bestätigen/Verlängern</div>
            </div>
          </div>
          <div class="card__bd">

            <label class="field">
            <div class="row row--spread">
              <div class="label">Ring Interval (ms)</div>
              <input id="ringInterval" type="number" min="125" max="5000" step="25" value="${escapeHtml(ringIntervalMs)}" />
              <div class="hint">125…5000 ms</div></div>
            </label>
            <label class="field">
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
            </label>
            <label class="field">
            <div class="row row--spread" style="align-items:flex-start; gap: 14px;">
              <div>
                <div class="label">Timer‑Ton</div>
                <div class="hint">Läuft bei Ablauf dauerhaft, bis Bestätigen/Verlängern/Stop.</div>
              </div>
              <label class="toggle">
                <input id="timerSoundEnabled" type="checkbox" ${timerSoundEnabled ? "checked" : ""} />
                <span>Ton</span>
              </label>
            </div>
            </label>
            <div class="row" style="flex-wrap:wrap; gap: 12px; align-items:flex-end;">
              <label class="field" style="min-width:240px;">
                <div class="label">Sound</div>
                <select id="timerSoundId">
                  <option value="gong" ${timerSoundId === "gong" ? "selected" : ""}>A · Küchen‑Gong</option>
                  <option value="wood" ${timerSoundId === "wood" ? "selected" : ""}>B · Holz‑Block</option>
                  <option value="pulse" ${timerSoundId === "pulse" ? "selected" : ""}>C · Elektronisch</option>
                  <option value="bowl" ${timerSoundId === "bowl" ? "selected" : ""}>D · Klangschale</option>
                </select>
              </label>

              <label class="field" style="min-width:240px;">
                <div class="label">Lautstärke</div>
                <div class="row" style="gap:10px; align-items:center;">
                  <input id="timerSoundVolume" type="range" min="0" max="100" step="1" value="${escapeHtml(String(Math.round(timerSoundVolume * 100)))}" style="flex:1;" />
                  <span class="hint" id="timerSoundVolumeLabel" style="min-width:44px; text-align:right;">${escapeHtml(String(Math.round(timerSoundVolume * 100)))}%</span>
                </div>
              </label>

              <button class="btn" id="timerSoundPreview" type="button" title="Sound abspielen">▶︎ Test</button>
            </div>

          </div>  
        </section>

        <section class="card">
          <div class="card__hd">
            <div>
              <h2 class="card__title">Tools</h2>
              <div class="card__subtitle">Diagnose & Wartung</div>
            </div>
          </div>
          <div class="card__bd">
            <div class="panel" style="margin-bottom:12px;">
              <h3 style="margin:0 0 .75rem 0;">Service Worker</h3>
              <div style="display:grid; gap:.55rem;">
                <div class="row row--spread" style="gap:12px;">
                  <div class="label">Aktiver SW</div>
                  <div id="swActiveVersion" class="pill">Pruefe...</div>
                </div>
                <div class="row row--spread" style="gap:12px;">
                  <div class="label">Neueste sw.js</div>
                  <div id="swLatestVersion" class="pill">Pruefe...</div>
                </div>
                <div class="row row--spread" style="gap:12px;">
                  <div class="label">Status</div>
                  <div id="swVersionState" class="pill">Pruefe...</div>
                </div>
              </div>
              <div id="swVersionHint" class="hint" style="margin-top:.75rem;"></div>
            </div>

            <div class="row" style="flex-wrap:wrap;">
              <button class="btn" id="btnDiagnostics" type="button">Diagnostics</button>
              <button class="btn" id="btnSelftest" type="button">Selftest</button>
              <button class="btn" id="btnSwReload" type="button">SW Reload</button>
              <button class="btn" id="btnReload" type="button">Reload</button>
            </div>

            <div class="msg" id="msg"></div>

            <details class="details">
              <summary>Info</summary>
              <pre class="pre">${escapeHtml(
                [
                  `recipes=${recipeCount}`,
                  `winter=${winter}`,
                  `ringIntervalMs=${ringIntervalMs}`,
                  `stepHighlight=${stepHighlight}`,
                  `href=${location.href}`,
                ].join("\n")
              )}</pre>
            </details>
          </div>
        </section>

        <section class="card">
          <div class="card__hd">
            <div>
              <h2 class="card__title">Kategorien</h2>
              <div class="card__subtitle">Selten noetig: Auto-Farben mit optionalem Override</div>
            </div>
          </div>
          <div class="card__bd">
            <details class="details">
              <summary>Kategorie-Farben verwalten (${escapeHtml(String(catTokens.length))})</summary>
              <div id="catColors" class="form" style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
                ${renderCatRowsHtml()}
              </div>
            </details>
          </div>
        </section>

      </div>
    </div>
  
  `;

  const cardBodies = Array.from(appEl.querySelectorAll(".container > .card .card__bd"));
  const appSettingsBody = cardBodies[0] || null;
  const timerSettingsBody = cardBodies[1] || null;
  const toolsBody = cardBodies[2] || null;

  if (appSettingsBody) {
    appSettingsBody.classList.add("admin-settings");
    appSettingsBody.innerHTML = `
      ${renderAdminSetting({
        title: "Winter Mode",
        controlHtml: `
          <label class="toggle">
            <input id="winterToggle" type="checkbox" ${winter ? "checked" : ""} />
          </label>
        `
      })}

      ${renderAdminSetting({
        title: "Radio (Drittanbieter)",
        hint: "Erteilter Consent erlaubt das Laden des externen Radio-Players. Ohne Consent wird kein Drittanbieter-Inhalt eingebunden.",
        statusHtml: `<span id="radioConsentState" class="pill ${radioConsent ? "" : "pill-ghost"}">${radioConsent ? "Consent aktiv" : "Kein Consent"}</span>`,
        controlHtml: `
          <label class="toggle">
            <input id="radioConsentToggle" type="checkbox" ${radioConsent ? "checked" : ""} />
          </label>
        `
      })}

      ${renderAdminSetting({
        title: "Bildmodus-Debug",
        hint: "Zeigt in der Detailansicht an, ob cover, auto oder alpha-fit aktiv ist.",
        controlHtml: `
          <label class="toggle">
            <input id="imageModeDebugToggle" type="checkbox" ${imageModeDebug ? "checked" : ""} />
          </label>
        `
      })}
    `;
  }

  if (timerSettingsBody) {
    timerSettingsBody.classList.add("admin-settings");
    timerSettingsBody.innerHTML = `
      ${renderAdminSetting({
        title: "Ring-Intervall (ms)",
        hint: "Abstand zwischen zwei Klingel-Signalen. Erlaubter Bereich: 125 bis 5000 ms.",
        controlHtml: `<input id="ringInterval" class="admin-input admin-input--short" type="number" min="125" max="5000" step="25" value="${escapeHtml(ringIntervalMs)}" />`
      })}

      ${renderAdminSetting({
        title: "Step Highlight",
        hint: "Hebt den aktuellen Schritt sichtbar hervor, wenn ein Timer abläuft.",
        controlHtml: `
          <label class="toggle">
            <input id="stepHighlightToggle" type="checkbox" ${stepHighlight ? "checked" : ""} />
          </label>
        `
      })}

      ${renderAdminSetting({
        title: "Timer-Ton",
        hint: "Läuft bei Ablauf dauerhaft, bis Bestätigen, Verlängern oder Stoppen.",
        controlHtml: `
          <label class="toggle">
            <input id="timerSoundEnabled" type="checkbox" ${timerSoundEnabled ? "checked" : ""} />
          </label>
        `
      })}

      <div class="admin-timer-panel">
        <div class="admin-timer-panel__row">
          <label class="admin-input-group">
            <div class="label">Sound</div>
            <div class="admin-inline-controls">
              <select id="timerSoundId">
                <option value="gong" ${timerSoundId === "gong" ? "selected" : ""}>A · Küchen-Gong</option>
                <option value="wood" ${timerSoundId === "wood" ? "selected" : ""}>B · Holz-Block</option>
                <option value="pulse" ${timerSoundId === "pulse" ? "selected" : ""}>C · Elektronisch</option>
                <option value="bowl" ${timerSoundId === "bowl" ? "selected" : ""}>D · Klangschale</option>
              </select>
              <button class="btn btn--ghost" id="timerSoundPreview" type="button" title="Sound abspielen">▶</button>
            </div>
          </label>
        </div>

        <div class="admin-timer-panel__row">
          <label class="admin-input-group">
            <div class="label">Lautstärke</div>
            <div class="admin-range-row">
              <input id="timerSoundVolume" type="range" min="0" max="100" step="1" value="${escapeHtml(String(Math.round(timerSoundVolume * 100)))}" />
              <span class="pill" id="timerSoundVolumeLabel">${escapeHtml(String(Math.round(timerSoundVolume * 100)))}%</span>
            </div>
          </label>
        </div>
      </div>
    `;
  }

  if (toolsBody) {
    toolsBody.classList.add("admin-tools");
    toolsBody.innerHTML = `
      <div class="admin-sw-card">
        <div class="admin-sw-summary">
          <div class="admin-sw-summary__main">
            <div class="admin-setting__lead">
              <div class="label">Service Worker</div>
              ${renderAdminHint("Zeigt, ob der aktuell laufende Service Worker zur neuesten sw.js passt.")}
            </div>
            <div id="swVersionHint" class="hint" hidden></div>
          </div>
          <div id="swVersionState" class="pill">Pruefe...</div>
        </div>

        <details class="details admin-sw-details">
          <summary>Versionen</summary>
          <div class="admin-sw-versions">
            <div class="admin-sw-kv">
              <div class="label">Aktiver SW</div>
              <div id="swActiveVersion" class="pill">Pruefe...</div>
            </div>
            <div class="admin-sw-kv">
              <div class="label">Neueste sw.js</div>
              <div id="swLatestVersion" class="pill">Pruefe...</div>
            </div>
          </div>
        </details>
      </div>

      <div class="admin-actions admin-actions--subtle">
        <button class="btn" id="btnSelftest" type="button">Selftest</button>
        <button class="btn btn--ghost" id="btnDiagnostics" type="button">Diagnose</button>
        <button class="btn btn--ghost" id="btnSwReload" type="button">SW neu laden</button>
        <button class="btn btn--ghost" id="btnReload" type="button">Neu laden</button>
      </div>

      <div class="msg" id="msg"></div>

      <details class="details">
        <summary>Info</summary>
        <pre class="pre">${escapeHtml(
          [
            `recipes=${recipeCount}`,
            `winter=${winter}`,
            `ringIntervalMs=${ringIntervalMs}`,
            `stepHighlight=${stepHighlight}`,
            `href=${location.href}`,
          ].join("\n")
        )}</pre>
      </details>
    `;
  }

  const q = (sel) => appEl.querySelector(sel);
  const msgEl = q("#msg");
  const catColorsEl = q("#catColors");
  const swActiveEl = q("#swActiveVersion");
  const swLatestEl = q("#swLatestVersion");
  const swStateEl = q("#swVersionState");
  const swHintEl = q("#swVersionHint");
  const radioConsentToggleEl = q("#radioConsentToggle");
  const radioConsentStateEl = q("#radioConsentState");

  q("#btnDiagnostics")?.parentElement?.classList.add("admin-actions");

  const setMsg = (text, kind = "") => {
    msgEl.textContent = text || "";
    msgEl.className = "msg " + (kind || "");
  };

  const refreshCategoryRows = () => {
    if (!catColorsEl) return;
    catColorsEl.innerHTML = renderCatRowsHtml();
  };

  const syncRadioConsentUi = () => {
    const consent = !!s.readRadioConsent?.();
    if (radioConsentToggleEl) radioConsentToggleEl.checked = consent;
    if (radioConsentStateEl) {
      radioConsentStateEl.textContent = consent ? "Consent aktiv" : "Kein Consent";
      radioConsentStateEl.className = `pill${consent ? "" : " pill-ghost"}`;
    }
  };

  try {
    appEl.__adminRadioConsentListenerCleanup?.();
  } catch {
    // ignore stale cleanup issues
  }
  const onRadioConsentChanged = () => syncRadioConsentUi();
  window.addEventListener("tinkeroneo:radioFeatureChanged", onRadioConsentChanged);
  appEl.__adminRadioConsentListenerCleanup = () => {
    window.removeEventListener("tinkeroneo:radioFeatureChanged", onRadioConsentChanged);
  };
  syncRadioConsentUi();

  async function refreshSwVersionInfo() {
    if (!swActiveEl || !swLatestEl || !swStateEl || !swHintEl) return;

    const info = await readServiceWorkerVersions();
    const activeText = info.activeVersion || (info.registered ? "unbekannt" : "kein SW");
    const latestText = info.latestVersion || (info.isDevHost ? "deaktiviert (localhost)" : "unbekannt");

    let stateText = "ℹ Unbekannt";
    let stateClass = "pill";
    let hintText = "";

    if (!info.supported) {
      stateText = "🚫 Nicht verfügbar";
      hintText = "Service Worker wird in diesem Browser nicht unterstützt.";
    } else if (info.isDevHost) {
      stateText = "🧪 Lokal deaktiviert";
    } else if (!info.registered) {
      stateText = "🚫 Nicht registriert";
      hintText = "Aktuell ist kein Service Worker registriert.";
    } else if (info.hasUpdate || info.mismatch) {
      stateText = "⚠ Update verfügbar";
      stateClass = "pill pill-warn";
      hintText = info.warning || "Aktiver Service Worker weicht von der neuesten sw.js ab.";
    } else if (info.activeVersion && info.latestVersion && info.activeVersion === info.latestVersion) {
      stateText = "✅ Aktuell";
      stateClass = "pill";
    } else {
      stateText = "ℹ Registriert";
    }

    swActiveEl.textContent = activeText;
    swLatestEl.textContent = latestText;
    swStateEl.textContent = stateText;
    swStateEl.className = stateClass;
    swHintEl.textContent = hintText;
    swHintEl.hidden = !hintText;
    swHintEl.className = info.hasUpdate || info.mismatch ? "hint hint-bad" : "hint";
  }

  q("#btnBack")?.addEventListener("click", () => {
    setView({ name: "list", selectedId: null, q: "" });
  });

  // --- Backend toggle (NO reload, awaits setUseBackend) ---

  // Theme

  // Winter
  const winterToggle = q("#winterToggle");
  if (winterToggle) {
    winterToggle.addEventListener("change", () => {
      try {
        s.setWinter?.(!!winterToggle.checked);
        applyThemeAndOverlay();
        setMsg("Gespeichert.", "ok");
      } catch (e) {
        setMsg(String(e?.message || e), "bad");
      }
    });
  }

  q("#imageModeDebugToggle")?.addEventListener("change", () => {
    try {
      s.setImageModeDebug?.(!!q("#imageModeDebugToggle")?.checked);
      setMsg("Gespeichert.", "ok");
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
    }
  });

  // Radio consent

  q("#btnRadioResetConsent")?.addEventListener("click", () => {
    try {
      s.clearRadioConsent?.();
      setMsg("Consent zurückgesetzt ✅", "ok");
      location.reload();
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
    }
  });

  radioConsentToggleEl?.addEventListener("change", () => {
    try {
      const enabled = !!radioConsentToggleEl?.checked;
      if (s.setRadioConsent) s.setRadioConsent(enabled);
      else if (!enabled) s.clearRadioConsent?.();
      syncRadioConsentUi();
      setMsg(enabled ? "Consent gespeichert." : "Consent entfernt.", "ok");
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
    }
  });

  // Timer settings
  q("#ringInterval")?.addEventListener("change", () => {
    try {
      s.setTimerRingIntervalMs?.(Number(q("#ringInterval").value));
      setMsg("Gespeichert ✅", "ok");
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
    }
  });

  // maxRingSeconds is intentionally ignored (timer rings until acknowledged).

  q("#stepHighlightToggle")?.addEventListener("change", () => {
    try {
      s.setTimerStepHighlight?.(!!q("#stepHighlightToggle").checked);
      setMsg("Gespeichert ✅", "ok");
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
    }
  });

  // Timer sound
  q("#timerSoundEnabled")?.addEventListener("change", () => {
    try {
      s.setTimerSoundEnabled?.(!!q("#timerSoundEnabled").checked);
      setMsg("Gespeichert ✅", "ok");
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
    }
  });

  q("#timerSoundId")?.addEventListener("change", () => {
    try {
      s.setTimerSoundId?.(String(q("#timerSoundId").value || "gong"));
      setMsg("Gespeichert ✅", "ok");
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
    }
  });

  q("#timerSoundVolume")?.addEventListener("input", () => {
    try {
      const pct = Number(q("#timerSoundVolume").value) || 0;
      const vol = Math.max(0, Math.min(1, pct / 100));
      s.setTimerSoundVolume?.(vol);
      const label = q("#timerSoundVolumeLabel");
      if (label) label.textContent = `${Math.round(vol * 100)}%`;
    } catch { /* ignore */ }
  });

  q("#timerSoundPreview")?.addEventListener("click", async () => {
    try {
      const sid = String(q("#timerSoundId")?.value || "gong");
      const enabled = !!q("#timerSoundEnabled")?.checked;
      if (!enabled) return;
      const pct = Number(q("#timerSoundVolume")?.value) || 0;
      const vol = Math.max(0, Math.min(1, pct / 100));
      const audio = createBeep({ soundId: sid, volume: vol });
      await audio.prime?.();
      await audio.playOnce?.();
    } catch { /* ignore */ }
  });

  // Tools
  q("#btnDiagnostics")?.addEventListener("click", () => setView({ name: "diagnostics" }));
  q("#btnSelftest")?.addEventListener("click", () => setView({ name: "selftest" }));
  q("#btnSwReload")?.addEventListener("click", async () => {
    try {
      if (!("serviceWorker" in navigator)) {
        setMsg("Service Worker nicht verfügbar.", "bad");
        return;
      }

      const isDevHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
      if (isDevHost) {
        setMsg("SW ist auf localhost deaktiviert.", "bad");
        return;
      }

      setMsg("SW wird aktualisiert …", "");
      const reg =
        (await navigator.serviceWorker.getRegistration("./sw.js")) ||
        (await navigator.serviceWorker.register("./sw.js"));

      await reg.update();

      let reloaded = false;
      const doReload = () => {
        if (reloaded) return;
        reloaded = true;
        location.reload();
      };

      navigator.serviceWorker.addEventListener("controllerchange", doReload, { once: true });

      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      } else if (reg.installing) {
        reg.installing.addEventListener("statechange", () => {
          if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        });
      } else {
        // No new worker waiting; do a normal reload to pick latest network assets.
        doReload();
        return;
      }

      window.setTimeout(doReload, 1800);
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
    }
  });
  q("#btnReload")?.addEventListener("click", () => location.reload());

  // category colors
  if (catColorsEl) {
    catColorsEl.addEventListener("input", (ev) => {
      const el = ev.target;
      if (!(el instanceof window.HTMLInputElement)) return;
      if (el.type !== "color") return;
      const cat = el.getAttribute("data-cat") || "";
      const col = el.value;
      setCategoryColor(cat, col);
      refreshCategoryRows();

      // update immediately (no reload)
      try { window.dispatchEvent(new window.Event("category-colors-changed")); } catch { /* ignore */ }
    });

    catColorsEl.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-cat-auto]");
      if (!btn) return;
      const cat = btn.getAttribute("data-cat-auto") || "";
      removeCategoryColor(cat);
      refreshCategoryRows();
      try { window.dispatchEvent(new window.Event("category-colors-changed")); } catch { /* ignore */ }
    });
  }

  // Sharing (space invites)
  async function refreshSharing() {
    const membersEl = q("#membersList");
    const invitesEl = q("#invitesList");
    if (!membersEl || !invitesEl) return;

    if (!cloudEnabled) {
      membersEl.textContent = "CLOUD deaktiviert";
      invitesEl.textContent = "CLOUD deaktiviert";
      return;
    }

    if (!s.listSpaceMembers || !s.listPendingInvites) {
      membersEl.textContent = "Sharing-API fehlt";
      invitesEl.textContent = "Sharing-API fehlt";
      return;
    }

    membersEl.textContent = "Lade…";
    invitesEl.textContent = "Lade…";

    try {
      const members = await s.listSpaceMembers({ spaceId: activeSpaceId });
      const invites = await s.listPendingInvites({ spaceId: activeSpaceId });

      membersEl.innerHTML = renderMembersHtml(members);
      invitesEl.innerHTML = renderInvitesHtml(invites);

      // wire revoke buttons
      invitesEl.querySelectorAll("[data-revoke]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-revoke");
          if (!id) return;
          try {
            await s.revokeInvite?.(id);
            setMsg("Invite entfernt ✅", "ok");
            await refreshSharing();
          } catch (e) {
            setMsg(String(e?.message || e), "bad");
          }
        });
      });
    } catch (e) {
      membersEl.textContent = "Fehler beim Laden";
      invitesEl.textContent = String(e?.message || e);
    }
  }

  q("#btnRefreshSharing")?.addEventListener("click", () => { refreshSharing(); });

  q("#btnInvite")?.addEventListener("click", async () => {
    const email = (q("#shareEmail")?.value || "").trim();
    const role = (q("#shareRole")?.value || "viewer").trim();
    try {
      if (!s.inviteToSpace) throw new Error("inviteToSpace fehlt");
      await s.inviteToSpace({ email, role, spaceId: activeSpaceId });
      setMsg("Invite gesendet ✅", "ok");
      const inp = q("#shareEmail");
      if (inp) inp.value = "";
      await refreshSharing();
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
    }
  });

  // initial load
  refreshSwVersionInfo();
  refreshSharing();

}

function renderMembersHtml(members) {
  if (!Array.isArray(members) || members.length === 0) {
    return `<div class="hint">Keine Mitglieder gefunden.</div>`;
  }
  const rows = members
    .map(m => {
      const uid = escapeHtml(m?.user_id || "");
      const role = escapeHtml(m?.role || "viewer");
      return `<div class="row row--spread" style="align-items:center; gap:10px;">
        <div class="hint" style="margin:0; overflow:hidden; text-overflow:ellipsis;">${uid}</div>
        <div class="pill">${role}</div>
      </div>`;
    })
    .join("");
  return `<div style="display:flex; flex-direction:column; gap:6px;">${rows}</div>`;
}

function renderInvitesHtml(invites) {
  if (!Array.isArray(invites) || invites.length === 0) {
    return `<div class="hint">Keine offenen Einladungen.</div>`;
  }
  const rows = invites
    .map(inv => {
      const id = escapeHtml(inv?.id || "");
      const mail = escapeHtml(inv?.email || "");
      const role = escapeHtml(inv?.role || "viewer");
      return `<div class="row row--spread" style="align-items:center; gap:10px;">
        <div style="min-width:0; flex:1 1 auto;">
          <div class="hint" style="margin:0; overflow:hidden; text-overflow:ellipsis;">${mail}</div>
        </div>
        <div class="pill">${role}</div>
        <button class="btn" type="button" data-revoke="${id}" title="Einladung entfernen">✖</button>
      </div>`;
    })
    .join("");
  return `<div style="display:flex; flex-direction:column; gap:6px;">${rows}</div>`;
}

/* ---------- helpers ---------- */
