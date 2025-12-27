import { getCategoryColors, setCategoryColor, normalizeCategoryToken } from "../domain/categories.js";
// src/views/admin.view.js

export function renderAdminView({ appEl, recipes, setView }) {
  const s = window.__tinkeroneoSettings || {};

  const useBackend = !!s.readUseBackend?.();
  const auth = s.getAuthContext?.() || null;
  const authedEmail = String(auth?.user?.email || "");
  const activeSpaceId = String(auth?.spaceId || "");
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

        <h3>Space teilen</h3>
        <div class="hint">Einladen per Mail: Die eingeladene Person loggt sich ein und wird automatisch Mitglied. (RLS schützt eure Daten.)</div>

        ${useBackend
          ? `
            <div class="row" style="flex-wrap:wrap; gap:.5rem; align-items:center;">
              <div class="hint" style="margin:0;">Angemeldet als: <b>${escapeHtml(authedEmail || "-")}</b></div>
              <div class="hint" style="margin:0;">Aktiver Space: <b>${escapeHtml(activeSpaceId || "-")}</b></div>
              <button class="btn" id="btnRefreshSharing" type="button">Refresh</button>
            </div>

            <div class="row" style="flex-wrap:wrap; gap:.5rem; align-items:flex-end;">
              <label class="field" style="min-width:220px; flex: 1 1 220px;">
                <div class="label">E-Mail</div>
                <input id="shareEmail" type="email" placeholder="freundin@example.com" />
              </label>

              <label class="field" style="min-width:160px;">
                <div class="label">Rolle</div>
                <select id="shareRole">
                  <option value="viewer">viewer (lesen)</option>
                  <option value="editor">editor (bearbeiten)</option>
                  <option value="owner">owner (verwalten)</option>
                </select>
              </label>

              <button class="btn" id="btnInvite" type="button">Einladen</button>
            </div>

            <div class="row" style="flex-wrap:wrap; gap:1rem; align-items:flex-start;">
              <div style="min-width:260px; flex: 1 1 260px;">
                <div class="label">Mitglieder (user_spaces)</div>
                <div id="membersList" class="hint">Lade…</div>
              </div>
              <div style="min-width:260px; flex: 1 1 260px;">
                <div class="label">Offene Einladungen</div>
                <div id="invitesList" class="hint">Lade…</div>
              </div>
            </div>
          `
          : `<div class="hint">Aktiviere CLOUD, um Sharing zu nutzen.</div>`
        }

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

  // Sharing (space invites)
  async function refreshSharing() {
    const membersEl = qs("#membersList");
    const invitesEl = qs("#invitesList");
    if (!membersEl || !invitesEl) return;

    if (!useBackend) {
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

  qs("#btnRefreshSharing")?.addEventListener("click", () => { refreshSharing(); });

  qs("#btnInvite")?.addEventListener("click", async () => {
    const email = (qs("#shareEmail")?.value || "").trim();
    const role = (qs("#shareRole")?.value || "viewer").trim();
    try {
      if (!s.inviteToSpace) throw new Error("inviteToSpace fehlt");
      await s.inviteToSpace({ email, role, spaceId: activeSpaceId });
      setMsg("Invite gesendet ✅", "ok");
      const inp = qs("#shareEmail");
      if (inp) inp.value = "";
      await refreshSharing();
    } catch (e) {
      setMsg(String(e?.message || e), "bad");
    }
  });

  // initial load
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

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}