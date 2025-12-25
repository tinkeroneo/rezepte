import { qs } from "../utils.js";
import { getSetting, setSetting } from "../domain/settings.js";

// Radio dock is global (mounted once in index.html). Key goal:
// Never remove/recreate the iframe after it started playing, otherwise
// browsers will stop audio on DOM rebuilds/collapse/navigation.

const CONSENT_KEY = "radio_consent";

function hasConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

function setConsent(v) {
  try {
    localStorage.setItem(CONSENT_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function getWinterEnabled() {
  // stored in app_settings under key "winter_overlay" (bool)
  const v = getSetting?.("winter_overlay");
  return !!v;
}

function setWinterEnabled(v) {
  setSetting?.("winter_overlay", !!v);
  document.documentElement.classList.toggle("winter", !!v);
}

export function initRadioDock() {
  const root = document.getElementById("radioDock");
  if (!root) return;

  // Guard: mount once
  if (root.dataset.mounted === "1") return;
  root.dataset.mounted = "1";

  let expanded = false;
  let consent = hasConsent();
  let iframeMounted = false;

  // Build DOM once
  root.innerHTML = `
    <div class="radio-dock" id="radioDockWrap">
      <button class="radio-dock-btn" id="radioDockToggle" type="button" title="Radio">🎧</button>
      <div class="radio-dock-panel" id="radioPanel" aria-hidden="true">
        <div class="radio-dock-header">
          <div class="radio-dock-title">Radio</div>
          <button class="btn btn-ghost" id="radioClose" type="button" title="Schließen">✕</button>
        </div>
        <div class="radio-panel-body" id="radioPanelBody">
          <div class="radio-setting" id="radioWinterRow"></div>
          <div id="radioConsentBlock"></div>
          <div id="radioIframeWrap"></div>
        </div>
      </div>
    </div>
  `;

  const wrap = qs(root, "#radioDockWrap");
  const toggleBtn = qs(root, "#radioDockToggle");
  const panel = qs(root, "#radioPanel");
  const winterRow = qs(root, "#radioWinterRow");
  const consentBlock = qs(root, "#radioConsentBlock");
  const iframeWrap = qs(root, "#radioIframeWrap");
  const closeBtn = qs(root, "#radioClose");

  const ensureIframe = () => {
    if (iframeMounted) return;
    iframeMounted = true;
    // IMPORTANT: create once and keep.
    const iframe = document.createElement("iframe");
    iframe.src = "https://player.egofm.de/radioplayer/?stream=egofm";
    iframe.width = "100%";
    iframe.height = "140";
    iframe.style.border = "0";
    iframe.style.borderRadius = "12px";
    iframe.loading = "lazy";
    iframe.allow = "autoplay";
    iframe.referrerPolicy = "no-referrer";
    iframeWrap.appendChild(iframe);
  };

  const renderBody = () => {
    consent = hasConsent();

    // Winter toggle (always shown)
    winterRow.innerHTML = `
      <label class="row" style="justify-content:space-between; align-items:center; gap:.6rem; margin:.35rem 0;">
        <span class="muted">Winter Overlay</span>
        <input id="winterToggle" type="checkbox" ${getWinterEnabled() ? "checked" : ""} />
      </label>
    `;
    qs(winterRow, "#winterToggle")?.addEventListener("change", (e) => {
      setWinterEnabled(e.target.checked);
    });

    // Consent vs player
    if (!consent) {
      consentBlock.innerHTML = `
        <div class="muted" style="margin-bottom:.5rem;">
          Der Radio-Player lädt Inhalte von egoFM (externe Domain). Möchtest du das erlauben?
        </div>
        <div class="row" style="gap:.5rem; flex-wrap:wrap;">
          <button class="btn btn-primary" id="radioConsentYes" type="button">Erlauben</button>
          <button class="btn btn-ghost" id="radioConsentNo" type="button">Nein</button>
        </div>
      `;
      iframeWrap.innerHTML = "";
      iframeMounted = false;

      qs(consentBlock, "#radioConsentYes")?.addEventListener("click", () => {
        setConsent(true);
        renderBody();
      });
      qs(consentBlock, "#radioConsentNo")?.addEventListener("click", () => {
        setConsent(false);
        expanded = false;
        updateUI();
      });
      return;
    }

    consentBlock.innerHTML = "";
    ensureIframe();
  };

  const updateUI = () => {
    wrap.classList.toggle("is-open", expanded);
    panel.setAttribute("aria-hidden", expanded ? "false" : "true");

    // Render body when opening; this does NOT destroy the iframe.
    if (expanded) renderBody();
  };

  // Toggle open/close
  toggleBtn.addEventListener("click", (e) => {
    e.preventDefault();
    expanded = !expanded;
    updateUI();
  });

  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    expanded = false;
    updateUI();
  });

  // Clicking outside closes the panel, but DOES NOT destroy iframe.
  document.addEventListener("click", (e) => {
    if (!expanded) return;
    const t = e.target;
    if (wrap.contains(t)) return;
    expanded = false;
    updateUI();
  });

  // Initialize winter flag on load
  document.documentElement.classList.toggle("winter", getWinterEnabled());

  updateUI();
}
