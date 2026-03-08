import { escapeHtml } from "../utils.js";

function formatLatency(info) {
  if (!info?.useBackend) return "-";
  return Number.isFinite(info?.backendMs) ? `${escapeHtml(String(info.backendMs))} ms` : "-";
}

function renderSelftestList(results) {
  const items = Array.isArray(results) ? results : [];
  if (!items.length) return `<li class="muted">Keine Ergebnisse.</li>`;
  return items.map((entry) => {
    const ok = !!entry?.ok;
    const label = ok ? "[OK]" : "[FAIL]";
    const detail = entry?.detail
      ? `<div class="muted" style="margin-top:.25rem;">${escapeHtml(String(entry.detail))}</div>`
      : "";
    return `
      <li style="margin:.5rem 0;">
        <div><strong>${label} ${escapeHtml(String(entry?.name || "-"))}</strong></div>
        ${detail}
      </li>
    `;
  }).join("");
}

async function readServiceWorkerInfo() {
  if (!("serviceWorker" in navigator)) return { supported: false, text: "Nicht unterstuetzt" };
  try {
    const reg =
      (await navigator.serviceWorker.getRegistration("./sw.js")) ||
      (await navigator.serviceWorker.getRegistration());
    if (!reg) return { supported: true, text: "Kein Service Worker registriert", hasUpdate: false };

    const active = reg.active?.scriptURL ? "aktiv" : "inaktiv";
    const hasWaiting = !!reg.waiting;
    const installing = !!reg.installing;
    const updateFlag = hasWaiting ? " (Update bereit)" : installing ? " (Update wird geladen)" : "";
    return {
      supported: true,
      text: `Service Worker ${active}${updateFlag}`,
      hasUpdate: hasWaiting,
    };
  } catch (e) {
    return {
      supported: true,
      text: `SW Status nicht lesbar: ${escapeHtml(String(e?.message || e))}`,
      hasUpdate: false,
    };
  }
}

export function renderDiagnosticsView({ appEl, state, info, setView, selftestResults = [] }) {
  const errors = info?.recentErrors ?? [];
  const magic = info?.magicLinkDiag || null;
  const q = state?.q || "";
  const inSelftest = state?.name === "selftest";

  appEl.innerHTML = `
    <div class="page">
      <header class="topbar">
        <div class="title">${inSelftest ? "Selftest" : "Diagnostics"}</div>
        <button class="btn btn--ghost" type="button" id="refreshBtn">Refresh</button>
        <div class="spacer"></div>
        <button class="btn btn--ghost" type="button" id="backBtn">Zur Liste</button>
      </header>

      <div class="container">
        <div class="card">
          <div class="row" style="gap:.5rem; margin-bottom:.75rem; flex-wrap:wrap;">
            <button class="btn ${inSelftest ? "btn--ghost" : "btn--solid"}" type="button" id="tabDiagBtn">Diagnostics</button>
            <button class="btn ${inSelftest ? "btn--solid" : "btn--ghost"}" type="button" id="tabSelftestBtn">Selftest</button>
          </div>

          ${inSelftest
            ? `
              <div class="muted">Schneller Gesundheitscheck (Storage/Backend/Grundfunktionen).</div>
              <div style="padding:1rem 0;">
                <ul class="list" style="margin-left:1.2rem;">
                  ${renderSelftestList(selftestResults)}
                </ul>
              </div>
            `
            : `
              <div class="panel">
                <h3>Status</h3>
                <div class="kv"><span>Mode</span><span>${info?.useBackend ? "Backend (Supabase)" : "Local"}</span></div>
                <div class="kv"><span>Backend Latenz</span><span>${formatLatency(info)}</span></div>
                <div class="kv"><span>Backend</span><span>${info?.backendOk ? "OK" : "FAIL"}</span></div>
                <div class="kv"><span>LocalStorage</span><span>${info?.storageOk ? "OK" : "FAIL"}</span></div>
                <div class="kv"><span>Import-Funktion</span><span>${info?.importOk ? "OK" : "FAIL"}</span></div>
                <div class="kv"><span>Queue</span><span>${escapeHtml(String(info?.queueLen ?? 0))}</span></div>
                <div class="kv"><span>Service Worker</span><span id="swStatusText">Pruefe...</span></div>
                <div id="swUpdateHint" class="muted" style="margin-top:.5rem; display:none;">Ein neuer Service Worker ist bereit. Reload im Header oder Seiten-Reload ausfuehren.</div>
                <div class="row" style="margin-top:.75rem; gap:.5rem; flex-wrap:wrap;">
                  ${info?.onRetrySync ? `<button class="btn btn--ghost" type="button" id="syncRetryBtn">Sync erneut versuchen</button>` : ``}
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
                  <button class="btn btn--ghost" type="button" id="copyMagicDiagBtn" ${magic ? "" : "disabled"}>Magic-Diagnose kopieren</button>
                </div>
              </div>

              <div class="panel">
                <h3>Letzte Fehler (Session) (${errors.length})</h3>
                ${errors.length
                  ? `
                    <div class="errlist">
                      ${errors.map((entry) => `
                        <div class="erritem">
                          <div class="errtime">${new Date(entry.ts).toLocaleString()}</div>
                          <div class="errmsg">${escapeHtml(entry.message)}${entry.count && entry.count > 1 ? ` <span class="muted">(x${escapeHtml(String(entry.count))})</span>` : ""}</div>
                          ${entry.stack ? `<pre class="errstack">${escapeHtml(entry.stack)}</pre>` : ``}
                        </div>
                      `).join("")}
                    </div>
                  `
                  : `<div class="muted">Keine gespeicherten Fehler.</div>`}
                <div class="row" style="margin-top:.75rem; gap:.5rem;">
                  <button class="btn btn--ghost" type="button" id="clearErrBtn">Fehlerliste leeren</button>
                  <button class="btn btn--ghost" type="button" id="copyErrBtn" ${errors.length ? "" : "disabled"}>Letzten kopieren</button>
                </div>
              </div>
            `
          }
        </div>
      </div>
    </div>
  `;

  const root = appEl;
  root.querySelector("#backBtn")?.addEventListener("click", () => setView({ name: "list", selectedId: null, q }));
  root.querySelector("#refreshBtn")?.addEventListener("click", () => setView({ name: state?.name || "diagnostics", q }));
  root.querySelector("#tabDiagBtn")?.addEventListener("click", () => setView({ name: "diagnostics", q }));
  root.querySelector("#tabSelftestBtn")?.addEventListener("click", () => setView({ name: "selftest", q }));

  root.querySelector("#clearErrBtn")?.addEventListener("click", () => {
    info?.onClearErrors?.();
    setView({ name: "diagnostics", q });
  });

  root.querySelector("#copyErrBtn")?.addEventListener("click", async () => {
    try {
      const last = errors?.[0];
      if (!last) return;
      await navigator.clipboard.writeText(JSON.stringify(last, null, 2));
    } catch {
      // ignore clipboard issues
    }
  });

  root.querySelector("#syncRetryBtn")?.addEventListener("click", async () => {
    try {
      await info?.onRetrySync?.();
    } finally {
      setView({ name: "diagnostics", q });
    }
  });

  root.querySelector("#copyMagicDiagBtn")?.addEventListener("click", async () => {
    try {
      if (!magic) return;
      await navigator.clipboard.writeText(JSON.stringify(magic, null, 2));
    } catch {
      // ignore clipboard issues
    }
  });

  if (!inSelftest) {
    const statusEl = root.querySelector("#swStatusText");
    const hintEl = root.querySelector("#swUpdateHint");
    readServiceWorkerInfo().then((sw) => {
      if (statusEl) statusEl.textContent = sw?.text || "-";
      if (hintEl) hintEl.style.display = sw?.hasUpdate ? "" : "none";
    });
  }
}
