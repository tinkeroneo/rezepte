// src/views/account.view.js
// import { escapeHtml } from "../utils.js"; // falls du sowas hast; sonst entfernen
// Wichtig: benutze deine bestehenden Handler/Imports (auth, theme, admin, space etc.)
// -> hier nur UI + IDs, damit du bestehende Logik weiterverwenden kannst.


// src/views/account.view.js
export function renderAccountView({ appEl }) {
  appEl.innerHTML = `
    <section class="view account-view">
      <h1 class="view-title">Account & Einstellungen</h1>

      <div class="card">
        <div class="card-title">Konto</div>
        <div class="row" style="gap:.5rem; flex-wrap:wrap;">
          <button id="authBadge" class="badge badge-btn" type="button">🔐 Login/Logout</button>
          <button id="adminBadge" class="badge badge-btn" type="button" hidden>🛠️ Admin</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Space</div>
        <div class="select-wrapper" style="margin-bottom:.5rem;">
          <span class="icon">🔀</span>
          <select id="spaceSelect" class="badge badge-select" title="Space wählen"></select>
        </div>

        <div style="margin-top:.5rem; border-top:1px solid rgba(255,255,255,.08); padding-top:.75rem;">
          <div class="muted" style="font-weight:900; margin-bottom:.35rem;">Profil</div>
          <div class="select-wrapper" style="margin-bottom:.35rem;">
            <span class="icon">🏷️</span>
            <input id="profileDisplayName" class="badge badge-select" type="text" placeholder="Username (Displayname)" />
          </div>
          <div class="row" style="gap:.5rem; flex-wrap:wrap;">
            <button id="saveProfileBtn" class="badge badge-btn" type="button">💾 Speichern</button>
            <button id="setDefaultSpaceBtn" class="badge badge-btn" type="button">⭐ Default</button>
          </div>
        </div>

        <div style="margin-top:.75rem; border-top:1px solid rgba(255,255,255,.08); padding-top:.75rem;">
          <div class="muted" style="font-weight:900; margin-bottom:.35rem;">Space-Name</div>
          <div class="select-wrapper" style="margin-bottom:.35rem;">
            <span class="icon">✏️</span>
            <input id="spaceNameInput" class="badge badge-select" type="text" placeholder="Space-Name" />
          </div>
          <div class="row" style="gap:.5rem; flex-wrap:wrap;">
            <button id="saveSpaceNameBtn" class="badge badge-btn" type="button">💾 Space speichern</button>
          </div>
        </div>

        <div style="margin-top:.75rem;">
          <span id="syncBadge" class="badge" title="Sync-Status" hidden>⟳ Sync-Status</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Darstellung</div>
        <div class="row" style="gap:.5rem; flex-wrap:wrap;">
          <button id="themeBadge" class="badge badge-btn" type="button">🌓 THEME</button>
        </div>
        <div class="muted" style="margin-top:.35rem;">System · Hell · Dunkel</div>
      </div>

    </section>
  `;
}
