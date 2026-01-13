// src/views/invites.view.js

export function renderInvitesView({ appEl, invites, onAccept, onDecline, onSkip }) {
  const rows = Array.isArray(invites) ? invites : [];

  // Wenn keine Einladungen: Invite-Screen gar nicht anzeigen
  if (!rows.length) {
    onSkip?.();          // verlässt die View (deine bestehende Logik)
    return;
  }

  appEl.innerHTML = `
   <div class="container">
      <section class="card">
        <div class="page">
          <h1 class="view-title">Einladungen</h1>
          <h2>Spaces, zu denen du eingeladen wurdest</h2>
          <div class="hint">Du kannst Einladungen annehmen oder ablehnen.</div>

          <div id="invRows" style="display:flex; flex-direction:column; gap: 1.65rem; margin-top: 1.75rem;">
            ${rows.map(r => renderRow(r)).join("")}
          </div>
        </div>
        <div class="row" style="margin-top:1rem; justify-content:flex-end;">
          <button class="btn" id="btnSkip" type="button">Später</button>
        </div>
      </section>
    </div>
  `;

  const qs = (sel) => appEl.querySelector(sel);

  qs("#btnSkip")?.addEventListener("click", () => onSkip?.());

  appEl.querySelectorAll("[data-accept]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-accept");
      if (!id) return;
      btn.disabled = true;
      await onAccept?.(id);
    });
  });
  appEl.querySelectorAll("[data-decline]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-decline");
      if (!id) return;
      btn.disabled = true;
      await onDecline?.(id);
    });
  });
}

function renderRow(inv) {
  const id = esc(inv?.id || "");
  const spaceName = esc(inv?.space_name || inv?.space_id || "Space");
  const role = esc(inv?.role || "viewer");
  const email = esc(inv?.email || "");

  return `
    <div class="row row--spread" style="gap:.75rem; align-items:center; flex-wrap:wrap;">
      <div style="min-width: 220px; flex: 1 1 220px;">
        <div class="label" style="margin:0;">${spaceName}</div>
        <div class="hint" style="margin:0;">Rolle: <b>${role}</b>${email ? ` · ${email}` : ""}</div>
      </div>
      <div class="row" style="gap:.5rem; justify-content:flex-end;">
        <button class="btn" type="button" data-decline="${id}" title="Ablehnen">Ablehnen</button>
        <button class="btn" type="button" data-accept="${id}" title="Annehmen">Annehmen</button>
      </div>
    </div>
  `;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
