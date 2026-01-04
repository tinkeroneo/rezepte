import { escapeHtml, qs } from "../utils.js";

export function renderDiagnosticsView({ appEl, state: _state, info, setView }) {
  const errors = info?.recentErrors ?? [];
  const backendLatency = info?.useBackend
    ? (Number.isFinite(info?.backendMs) ? `${escapeHtml(String(info.backendMs))} ms` : "—")
    : "—";

  appEl.innerHTML = `

    <div class="page">
      <header class="topbar">
        <div class="title">Diagnostics</div>
        <button class="btn btn--ghost" id="refreshBtn">↻</button>
        <div class="spacer"></div>
      </header>


      <div class="container">
        <div class="card"> 

        <div class="panel">
          <h3>Status</h3>
          <div class="kv"><span>Mode</span><span>${info?.useBackend ? "Backend (Supabase)" : "Local"}</span></div>
          <div class="kv"><span>Backend Latenz</span><span>${backendLatency}</span></div>
          <div class="kv"><span>Backend</span><span>${info?.backendOk ? "OK" : "FAIL"}</span></div>
          <div class="kv"><span>LocalStorage</span><span>${info?.storageOk ? "OK" : "FAIL"}</span></div>
          <div class="kv"><span>Import-Funktion</span><span>${info?.importOk ? "OK" : "FAIL"}</span></div>
          <div class="kv"><span>Queue</span><span>${escapeHtml(String(info?.queueLen ?? 0))}</span></div>

          <div class="row" style="margin-top:.75rem; gap:.5rem; flex-wrap:wrap;">
            ${info?.onRetrySync ? `<button class="btn btn--ghost" id="syncRetryBtn">Sync erneut versuchen</button>` : ``}
          </div>
        </div>

        <div class="panel">
          <h3>Letzte Fehler (${errors.length})</h3>
          ${errors.length
            ? `
            <div class="errlist">
              ${errors
                .map((e) => `
                  <div class="erritem">
                    <div class="errtime">${new Date(e.ts).toLocaleString()}</div>
                    <div class="errmsg">${escapeHtml(e.message)}</div>
                    ${e.stack ? `<pre class="errstack">${escapeHtml(e.stack)}</pre>` : ``}
                  </div>
                `)
                .join("")}
            </div>
          `
            : `<div class="muted">Keine gespeicherten Fehler.</div>`}

          <div class="row" style="margin-top:.75rem; gap:.5rem;">
            <button class="btn btn--ghost" id="clearErrBtn">Fehlerliste leeren</button>
          </div>
        </div>

        <div class="panel muted">
          Tipp: \`/#selftes
        </div>
    </div>
  `;

  // Wire actions
  qs("#refreshBtn")?.addEventListener("click", () => setView({ name: "diagnostics" }));
  qs("#clearErrBtn")?.addEventListener("click", () => {
    info?.onClearErrors?.();
    setView({ name: "diagnostics" });
  });
  qs("#syncRetryBtn")?.addEventListener("click", async () => {
    try {
      await info?.onRetrySync?.();
    } finally {
      setView({ name: "diagnostics" });
    }
  });
}
