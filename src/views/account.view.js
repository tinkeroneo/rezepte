import { escapeHtml } from "../utils.js";

function renderAccountHint(text, label = "Hinweis") {
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

export function renderAccountView({ appEl }) {
  const s = window.__tinkeroneoSettings || {};
  const auth = s.getAuthContext?.() || null;
  const authedEmail = String(auth?.user?.email || "");
  const cloudEnabled = !!s.readUseBackend?.();
  const activeSpaceId = String(auth?.spaceId || "");
  const mySpaces = Array.isArray(s.getMySpaces?.()) ? s.getMySpaces() : [];
  const activeSpace = mySpaces.find((space) => String(space?.space_id || "") === activeSpaceId) || null;
  const activeSpaceName = String(activeSpace?.name || "");
  const activeSpaceRole = String(activeSpace?.role || "").toLowerCase();
  const isOwnerInActiveSpace = activeSpaceRole === "owner" || activeSpaceRole === "admin";
  const isAuthed = !!auth?.user?.id || !!authedEmail;

  const shareState = !isAuthed
    ? { text: "Login nötig", ghost: true, info: "Bitte logge dich zuerst ein, um deinen Space zu teilen." }
    : !cloudEnabled
      ? { text: "CLOUD aus", ghost: true, info: "Aktiviere CLOUD, damit Einladungen und Sharing verfügbar sind." }
      : !isOwnerInActiveSpace
        ? { text: "Nur für Owner", ghost: true, info: "Einladungen, Mitgliederliste und offene Freigaben sind nur für Owner sichtbar." }
        : { text: "Freigabe bereit", ghost: false, info: "" };

  appEl.innerHTML = `
    <div class="container">
      <section class="card">
        <h1 class="view-title">Account & Einstellungen</h1>

        <div class="card">
          <div class="card-title">Konto</div>
          <div class="row" style="gap:.5rem; flex-wrap:wrap;">
            <button id="authBadge" class="badge badge-btn" type="button">Login/Logout</button>
            <button id="adminBadge" class="badge badge-btn" type="button" hidden>Admin</button>
          </div>
        </div>

        ${isAuthed
          ? `
            <div class="card">
              <div class="card-title">Space</div>

              <div class="select-wrapper" style="margin-bottom:.35rem;">
                <span class="icon">⭐ Standard:</span>
                <select id="defaultSpaceSelect" class="badge badge-select" title="Default-Space (beim Login)"></select>
              </div>

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
            </div>
          `
          : ""}

        <div class="card">
          <div class="card__hd">
            <div class="row" style="align-items:center; gap:.45rem;">
              <h2 class="card__title" style="margin:0;">Space teilen</h2>
              ${renderAccountHint("Die eingeladene Person meldet sich an und wird dann automatisch Mitglied im aktuellen Space.")}
            </div>
            ${isAuthed && cloudEnabled && isOwnerInActiveSpace
              ? `<button class="btn btn--ghost" id="btnRefreshSharing" type="button">Aktualisieren</button>`
              : ``}
          </div>
          <div class="card__hd" style="padding-top:0;">
            <div>
              <div class="card__subtitle">Einladungen per E-Mail</div>
            </div>
          </div>
          <div class="card__bd account-share">
            <div class="account-share__top">
              <div class="account-share__state">
                <span class="pill ${shareState.ghost ? "pill-ghost" : ""}">${escapeHtml(shareState.text)}</span>
              </div>
            </div>

            ${shareState.info
              ? `<div class="account-share__info">${escapeHtml(shareState.info)}</div>`
              : `
                <div class="account-share__meta">
                  <div class="pill pill-ghost">Account: ${escapeHtml(authedEmail || "-")}</div>
                  <div class="pill pill-ghost">Space: ${escapeHtml(activeSpaceName || activeSpaceId || "-")}</div>
                </div>

                <div class="account-share__form">
                  <label class="field" style="min-width:120px; flex: 1 1 220px;">
                    <div class="label">E-Mail</div>
                    <input id="shareEmail" type="email" placeholder="freundin@example.com" />
                  </label>

                  <label class="field" style="min-width:160px;">
                    <div class="label">Zugriff</div>
                    <select id="shareRole">
                      <option value="viewer">Lesen</option>
                      <option value="editor">Bearbeiten</option>
                      <option value="owner">Verwalten</option>
                    </select>
                  </label>

                  <button class="btn btn--ghost account-share__invite-btn" id="btnInvite" type="button">Einladen</button>
                </div>

                <div class="account-share__columns">
                  <div class="account-share__panel">
                    <div class="label">Mitglieder</div>
                    <div id="membersList" class="account-share__list hint">Lade…</div>
                  </div>
                  <div class="account-share__panel">
                    <div class="label">Offene Einladungen</div>
                    <div id="invitesList" class="account-share__list hint">Lade…</div>
                  </div>
                </div>
              `}
          </div>
          <div id="accShareMsg" class="hint" style="min-height:18px;"></div>
        </div>

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
      </section>
    </div>
  `;
}
