import { escapeHtml, qs } from "../utils.js";

export function renderDiagnosticsView({ appEl, state, info, setView }) {
  const errors = info?.recentErrors ?? [];
  appEl.innerHTML = `
    <div class="container">
      <div class="topbar">
        <div class="row" style="justify-content:space-between; gap:.5rem; align-items:center;">
          <button class="btn btn-ghost" id="backBtn">← Zurück</button>
          <div class="title">Diagnostics</div>
          <button class="btn btn-ghost" id="refreshBtn">↻</button>
        </div>
      </div>

      <div class="panel">
        <h3>Status</h3>
        <div class="kv"><span>Mode</span><span>${info?.useBackend ? "Backend (Supabase)" : "Local"}</span></div>
        <div class="kv"><span>Backend Latenz</span><span>${info?.backendMs !== null ? escapeHtml(String(info.backendMs)) + " ms" : "—"}</span></div>
        <div class="kv"><span>Backend</span><span>${info?.backendOk ? "OK" : "FAIL"}</span></div>
        <div class="kv"><span>LocalStorage</span><span>${info?.storageOk ? "OK" : "FAIL"}</span></div>
        <div class="kv"><span>Import-Funktion</span><span>${info?.importOk ? "OK" : "FAIL"}</span></div>
      </div>

      <div class="panel">
        <h3>Letzte Fehler (${errors.length})</h3>
        ${errors.length ? `
          <div class="errlist">
            ${errors.map(e => `
              <div class="erritem">
                <div class="errtime">${new Date(e.ts).toLocaleString()}</div>
                <div class="errmsg">${escapeHtml(e.message)}</div>
                ${e.stack ? `<pre class="errstack">${escapeHtml(e.stack)}</pre>` : ``}
              </div>
            `).join("")}
          </div>
        ` : `<div class="muted">Keine gespeicherten Fehler.</div>`}
        <div class="row" style="margin-top:.75rem; gap:.5rem;">
          <button class="btn btn-ghost" id="clearErrBtn">Fehlerliste leeren</button>
        </div>
      </div>

      <div class="panel muted">
        Tipp: ` + "`/#selftest`" + ` ist der schnelle Gesundheitscheck.
      </div>
    </div>
  `;

  qs(appEl, "#backBtn")?.addEventListener("click", () => setView({ name: "list" }));
  qs(appEl, "#refreshBtn")?.addEventListener("click", () => setView({ name: "diagnostics" }));
  qs(appEl, "#clearErrBtn")?.addEventListener("click", () => {
    info?.onClearErrors?.();
    setView({ name: "diagnostics" });
  });
}
