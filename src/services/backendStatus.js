// src/services/backendStatus.js
// Lightweight backend connectivity banner.
// Purpose: when backend requests fail transiently (VPN/offline/sleep),
// keep UX stable by showing local data + a clear "offline" indicator.

let _state = {
  online: true,
  since: null,
  lastMsg: null,
};

/**
 * @param {{online:boolean, message?:string}} next
 */
export function setBackendStatus(next) {
  const online = !!next?.online;
  const message = String(next?.message || "").trim() || null;

  // Deduplicate
  if (_state.online === online && _state.lastMsg === message) return;

  _state.online = online;
  _state.lastMsg = message;

  if (online) {
    _state.since = null;
    hideBanner();
  } else {
    if (!_state.since) _state.since = Date.now();
    showBanner(message);
  }
}

export function markBackendOnline() {
  setBackendStatus({ online: true });
}

export function markBackendOffline(message) {
  setBackendStatus({ online: false, message });
}

export function getBackendStatus() {
  return { ..._state };
}

function showBanner(message) {
  let el = document.getElementById("backendStatusBanner");
  if (!el) {
    el = document.createElement("div");
    el.id = "backendStatusBanner";
    el.innerHTML = `
      <div class="bsb-inner">
        <div class="bsb-dot" aria-hidden="true"></div>
        <div class="bsb-text">
          <div class="bsb-title">Offline/VPN</div>
          <div class="bsb-msg" id="backendStatusBannerMsg"></div>
        </div>
        <button class="bsb-btn" id="backendStatusBannerRetry" type="button">Neu laden</button>
        <button class="bsb-btn" id="backendStatusBannerClose" type="button" aria-label="Schließen">×</button>
      </div>
    `;
    document.body.appendChild(el);

    el.querySelector("#backendStatusBannerClose")?.addEventListener("click", () => {
      // user can hide banner; it will reappear if still offline and another error occurs
      el.remove();
    });

    el.querySelector("#backendStatusBannerRetry")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("backend:retry"));
    });

    // click anywhere triggers retry (mobile-friendly)
    el.addEventListener("click", (e) => {
      const t = e.target;
      if (t && (t.id === "backendStatusBannerClose" || t.id === "backendStatusBannerRetry")) return;
      window.dispatchEvent(new CustomEvent("backend:retry"));
    }, { passive: true });
  }

  const msgEl = el.querySelector("#backendStatusBannerMsg");
  if (msgEl) msgEl.textContent = message || "Backend gerade nicht erreichbar. Lokale Daten werden angezeigt.";
}

function hideBanner() {
  const el = document.getElementById("backendStatusBanner");
  if (el) el.remove();
}
