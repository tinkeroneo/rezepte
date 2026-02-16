import { escapeHtml, qs } from "../utils.js";

export function renderDiagnosticsView({ appEl, state: _state, info, setView }) {
  const errors = info?.recentErrors ?? [];
  const stored = info?.storedErrors ?? [];
  const magic = info?.magicLinkDiag || null;
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
          <h3>Magic-Link Diagnose</h3>
          ${magic
            ? `
            <div class="kv"><span>Zeit</span><span>${escapeHtml(new Date(Number(magic.ts || 0)).toLocaleString())}</span></div>
            <div class="kv"><span>Status</span><span>${escapeHtml(String(magic.status || "-"))}</span></div>
            <div class="kv"><span>Retry-After</span><span>${escapeHtml(String(magic.retryAfterSec || 0))} s</span></div>
            <div class="kv"><span>Email-Domain</span><span>${escapeHtml(String(magic.emailDomain || "-"))}</span></div>
            <div class="kv"><span>Redirect</span><span style="word-break:break-all;">${escapeHtml(String(magic.redirectTo || "-"))}</span></div>
            <pre class="errstack" style="margin-top:.5rem;">${escapeHtml(String(magic.body || ""))}</pre>
          `
            : `<div class="muted">Noch kein Magic-Link Fehler gespeichert.</div>`}

          <div class="row" style="margin-top:.75rem; gap:.5rem;">
            <button class="btn btn--ghost" id="copyMagicDiagBtn" ${magic ? "" : "disabled"}>Magic-Diagnose kopieren</button>
          </div>
        </div>

        <div class="panel">
          <h3>Letzte Fehler (Session) (${errors.length})</h3>
          ${errors.length
            ? `
            <div class="errlist">
              ${errors
                .map((e) => `
                  <div class="erritem">
                    <div class="errtime">${new Date(e.ts).toLocaleString()}</div>
                    <div class="errmsg">${escapeHtml(e.message)}${e.count && e.count > 1 ? ` <span class="muted">(x${escapeHtml(String(e.count))})</span>` : ""}</div>
                    ${e.stack ? `<pre class="errstack">${escapeHtml(e.stack)}</pre>` : ``}
                  </div>
                `)
                .join("")}
            </div>
          `
            : `<div class="muted">Keine gespeicherten Fehler.</div>`}

          <div class="row" style="margin-top:.75rem; gap:.5rem;">
            <button class="btn btn--ghost" id="clearErrBtn">Fehlerliste leeren</button>
            <button class="btn btn--ghost" id="copyErrBtn" ${errors.length ? "" : "disabled"}>Letzten kopieren</button>
          </div>
        </div>

        <div class="panel">
          <h3>Persistente Fehler (Device) (${stored.length})</h3>
          ${stored.length
            ? `
            <div class="errlist">
              ${stored
                .slice(0, 30)
                .map((e) => `
                  <div class="erritem">
                    <div class="errtime">${new Date(e.ts).toLocaleString()}</div>
                    <div class="errmsg">${escapeHtml(String(e.message || ""))}</div>
                    ${e.stack ? `<pre class="errstack">${escapeHtml(String(e.stack))}</pre>` : ``}
                  </div>
                `)
                .join("")}
            </div>
            <div class="muted" style="margin-top:.5rem;">Es werden max. 30 angezeigt (für Performance). Zum Teilen: Export kopieren.</div>
          `
            : `<div class="muted">Keine persistenten Fehler.</div>`}

          <div class="row" style="margin-top:.75rem; gap:.5rem; flex-wrap:wrap;">
            <button class="btn btn--ghost" id="clearStoredErrBtn">Persistente Logs löschen</button>
            <button class="btn btn--ghost" id="exportStoredErrBtn" ${stored.length ? "" : "disabled"}>Export JSON kopieren</button>
          </div>
        </div>

        <div class="panel muted">
          Tipp: <code>/#selftest</code> prüft zentrale Funktionen (Storage/Backend/Import).
        </div>
    </div>
  `;

  // Wire actions
  qs("#refreshBtn")?.addEventListener("click", () => setView({ name: "diagnostics" }));
  qs("#clearErrBtn")?.addEventListener("click", () => {
    info?.onClearErrors?.();
    setView({ name: "diagnostics" });
  });

  qs("#copyErrBtn")?.addEventListener("click", async () => {
    try {
      const last = errors?.[0];
      if (!last) return;
      const text = JSON.stringify(last, null, 2);
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  });

  qs("#clearStoredErrBtn")?.addEventListener("click", () => {
    info?.onClearStoredErrors?.();
    setView({ name: "diagnostics" });
  });

  qs("#exportStoredErrBtn")?.addEventListener("click", async () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        ua: navigator.userAgent,
        href: location.href,
        errors: stored,
      };
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    } catch {
      // ignore
    }
  });
  qs("#syncRetryBtn")?.addEventListener("click", async () => {
    try {
      await info?.onRetrySync?.();
    } finally {
      setView({ name: "diagnostics" });
    }
  });

  qs("#copyMagicDiagBtn")?.addEventListener("click", async () => {
    try {
      if (!magic) return;
      await navigator.clipboard.writeText(JSON.stringify(magic, null, 2));
    } catch {
      // ignore
    }
  });
}
