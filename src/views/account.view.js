// src/views/account.view.js
// Wichtig: benutze deine bestehenden Handler/Imports (auth, theme, admin, space etc.)
// -> hier nur UI + IDs, damit du bestehende Logik weiterverwenden kannst.

import { escapeHtml } from "../utils.js";
// src/views/account.view.js
export function renderAccountView({ appEl }) {
 const s = window.__tinkeroneoSettings || {};
  const auth = s.getAuthContext?.() || null;
  const authedEmail = String(auth?.user?.email || "");
  const cloudEnabled = !!s.readUseBackend?.();
  const activeSpaceId = String(auth?.spaceId || "");
  const mySpaces = Array.isArray(s.getMySpaces?.()) ? s.getMySpaces() : [];
  const activeSpaceName = String((mySpaces.find(x => String(x?.space_id || "") === activeSpaceId)?.name) || "");
  const isAuthed = !!auth?.user?.id || !!authedEmail;
  appEl.innerHTML = `
  <div class="container">
    <section class="card">
      <h1 class="view-title">Account & Einstellungen</h1>

      <div class="card">
        <div class="card-title">Konto</div>
        <div class="row" style="gap:.5rem; flex-wrap:wrap;">
          <button id="authBadge" class="badge badge-btn" type="button">🔐 Login/Logout</button>
          <button id="adminBadge" class="badge badge-btn" type="button" hidden>🛠️ Admin</button>
        </div>
      </div>
    ${isAuthed ? `
      <div class="card">
        <div class="card-title">Space</div>


        <div class="muted" style="font-weight:900; margin-bottom:.35rem;"></div>
        <div class="select-wrapper" style="margin-bottom:.35rem;">
          <span class="icon">⭐ Standard:</span>
          <select id="defaultSpaceSelect" class="badge badge-select" title="Default-Space (beim Login)"></select>
        </div>        

        <div class="muted" style="font-weight:900; margin-bottom:.35rem;"></div>
        <div class="select-wrapper" style="margin-bottom:.35rem;">
          <span class="icon">✎ (Um)benennen</span>
          <input id="spaceNameInput" class="badge badge-select" type="text" placeholder="Space-Name" />
          <button id="saveSpaceNameBtn" class="badge badge-btn" type="button">💾</button>
        </div>  

        <div style="margin-top:.5rem; border-top:1px solid rgba(255,255,255,.08); padding-top:.75rem;">
          <div class="muted" style="font-weight:900; margin-bottom:.35rem;">Profil</div>
          <div class="select-wrapper" style="margin-bottom:.35rem;">
            <span class="icon">🏷️</span>
            <input id="profileDisplayName" class="badge badge-select" type="text" placeholder="Username (Displayname)" />
            <button id="saveProfileBtn" class="badge badge-btn" type="button">💾</button>


          </div>
        </div>



        <div style="margin-top:.75rem;">
          <span id="syncBadge" class="badge" title="Sync-Status" hidden>⟳ Sync-Status</span>
        </div>
      </div>

      <div class="card">
          <div class="card__hd">
            <div>
              <h2 class="card__title">Space teilen</h2>
              <div class="card__subtitle">Einladen per Mail (CLOUD)</div>
            </div>
          </div>
          <div class="card__bd">
            <div class="hint">Einladen per Mail: Die eingeladene Person loggt sich ein und wird automatisch Mitglied. (RLS schützt eure Daten.)</div>

            ${cloudEnabled
      ? `
                <div class="row" style="flex-wrap:wrap; gap:.5rem; align-items:center;">
                  <div class="hint" style="margin:0;">Angemeldet als: <b>${escapeHtml(authedEmail || "-")}</b></div>
                  <div class="hint" style="margin:0;">Aktiver Space: <b>${escapeHtml(activeSpaceName || activeSpaceId || "-")}</b></div>
                  <button class="btn" id="btnRefreshSharing" type="button">Refresh</button>
                </div>

                <div class="row" style="flex-wrap:wrap; gap:.5rem; align-items:flex-end;">
                  <label class="field" style="min-width:120px; flex: 1 1 220px;">
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

                  <button class="btn btn--ghost" id="btnInvite" type="button">Einladen</button>
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
          </div>
        <div id="accShareMsg" class="hint" style="min-height:18px;"></div>
      </div>
     ` : ``}
      <div class="card">
        <div class="card-title">Darstellung</div>
        <div class="row" style="gap:.5rem; flex-wrap:wrap;">
          <button id="themeBadge" class="badge badge-btn" type="button">🌓 THEME</button>
        </div>
        <div class="muted" style="margin-top:.35rem;">System · Hell · Dunkel</div>
      </div>


      <div class="card">
        <div class="card-title">Tools</div>
        <div class="row" style="gap:.5rem; flex-wrap:wrap;">
          <button id="diagnosticsBtn" class="badge badge-btn" type="button">🩺 Diagnostics</button>
        </div>
        <div class="muted" style="margin-top:.35rem;">Import/Export als Sheet · Fehlerliste & Backend-Status</div>
      </div>        
      </div>




    </section>
  </div>  
  `;
}
