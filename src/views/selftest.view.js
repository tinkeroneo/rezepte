// src/views/selftest.view.js
export function renderSelftestView({ appEl, results, setView }) {
  const items = (results || []).map(r => {
    const icon = r.ok ? "✅" : "❌";
    const detail = r.detail ? `<div class="muted" style="margin-top:.25rem">${escapeHtml(r.detail)}</div>` : "";
    return `<li style="margin:.5rem 0;">
      <div><strong>${icon} ${escapeHtml(r.name)}</strong></div>
      ${detail}
    </li>`;
  }).join("");

  appEl.innerHTML = `
    <div class="page">
        <header class="topbar">
          <div class="title">Selftest</div>
          <button class="btn btn--ghost" id="refreshBtn">↻</button>
          <div class="spacer"></div>
        </header>

        <div class="container">
          <div class="card">

              <div class="muted">Schneller Gesundheitscheck (Storage/Backend/Grundfunktionen).</div>
            

            <div style="padding:1rem;">
              <ul class="list" style="margin-left:1.2rem;">
                ${items || "<li class='muted'>Keine Ergebnisse.</li>"}
              </ul>
              <div class="muted" style="margin-top:1rem;">
                Tipp: Bei Backend-Problemen Netzwerk prüfen oder <code>USE_BACKEND=false</code> setzen.
              </div>
            </div>
          </div>  
        </div>    
    </div>
  `;

  document.getElementById("backBtn")?.addEventListener("click", () => {
    setView({ name: "list" });
  });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
