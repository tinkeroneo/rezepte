import { qs } from "../utils.js";
import { getSetting, setSetting } from "../domain/settings.js";

// Radio dock is global (mounted once in index.html). Key goal:
// Never load any 3rd‑party iframe before explicit consent.
// Also allow toggling the whole feature from Admin.

const EVT_FEATURE_CHANGED = "tinkeroneo:radioFeatureChanged";

function isFeatureEnabled() {
  return !!getSetting("radio_feature", false);
}

function hasConsent() {
  return !!getSetting("radio_consent", false);
}

function setConsent(v) {
  setSetting("radio_consent", !!v);
}

export function clearRadioConsent() {
  setSetting("radio_consent", false);
  window.dispatchEvent(new window.Event(EVT_FEATURE_CHANGED));
}

function renderDisabled(root) {
  root.innerHTML = "";
  root.style.display = "none";
  delete root.dataset.mounted;
}

export function initRadioDock() {
  // Mounted in index.html as <div id="radioDockRoot"></div>
  const root = document.getElementById("radioDockRoot") || document.getElementById("radioDock");
  if (!root) return;

  // The toggle lives in the global header (menu line), not inside CookView.
  // This keeps Radio as a global feature and avoids view-specific emphasis.
  const headerBtn = document.getElementById("radioHeaderBtn");

  const mountIfNeeded = () => {
    if (!isFeatureEnabled()) {
      if (headerBtn) headerBtn.hidden = true;
      renderDisabled(root);
      return;
    }

    if (headerBtn) headerBtn.hidden = false;

    root.style.display = "block";

    // Guard: mount once while enabled
    if (root.dataset.mounted === "1") return;
    root.dataset.mounted = "1";

    let expanded = false;
    let iframeMounted = false;

    root.innerHTML = `
      <div class="radio-dock" id="radioDockWrap">
        <div class="radio-dock-panel" id="radioPanel" aria-hidden="true">
          <div class="radio-dock-header">
            <div class="radio-dock-title">Radio</div>
            <button class="btn btn--ghost" id="radioClose" type="button" title="Schließen">✕</button>
          </div>
          <div class="radio-panel-body" id="radioPanelBody">
            <div id="radioConsentBlock"></div>
            <div id="radioIframeWrap"></div>
          </div>
        </div>
      </div>
    `;

    const wrap = qs(root, "#radioDockWrap");
    const panel = qs(root, "#radioPanel");
    const consentBlock = qs(root, "#radioConsentBlock");
    const iframeWrap = qs(root, "#radioIframeWrap");
    const closeBtn = qs(root, "#radioClose");

    const ensureIframe = () => {
      if (iframeMounted) return;
      iframeMounted = true;
      const iframe = document.createElement("iframe");
      iframe.src = "https://player.egofm.de/radioplayer/?stream=egofm";
      iframe.width = "100%";
      iframe.height = "140";
      iframe.style.border = "0";
      iframe.style.borderRadius = "12px";
      iframe.loading = "lazy";
      iframe.allow = "autoplay";
      iframe.referrerPolicy = "no-referrer";
      iframe.title = "egoFM Radio Player";
      iframeWrap.appendChild(iframe);
    };

    const renderBody = () => {
      if (!isFeatureEnabled()) {
        // Feature turned off while open
        expanded = false;
        updateUI();
        renderDisabled(root);
        return;
      }

      const consent = hasConsent();
      if (!consent) {
        consentBlock.innerHTML = `
          <div class="muted" style="margin-bottom:.5rem;">
            Der Radio-Player lädt Inhalte von egoFM (externe Domain). Möchtest du das erlauben?
          </div>
          <div class="row" style="gap:.5rem; flex-wrap:wrap;">
            <button class="btn btn--solid" id="radioConsentYes" type="button">Erlauben</button>
            <button class="btn btn--ghost" id="radioConsentNo" type="button">Nein</button>
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
      if (headerBtn) headerBtn.setAttribute("aria-pressed", expanded ? "true" : "false");
      if (expanded) renderBody();
    };

    // Toggle comes from the header
    if (headerBtn && !headerBtn.__wired) {
      headerBtn.__wired = true;
      headerBtn.addEventListener("click", (e) => {
        e.preventDefault();
        expanded = !expanded;
        updateUI();
      });
    }

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      expanded = false;
      updateUI();
    });

    document.addEventListener("click", (e) => {
      if (!expanded) return;
      const t = e.target;
      if (wrap.contains(t)) return;
      expanded = false;
      updateUI();
    });

    updateUI();
  };

  // Initial mount
  mountIfNeeded();

  // React to Admin toggles / consent reset
  window.addEventListener(EVT_FEATURE_CHANGED, () => {
    // If feature disabled → hide + stop loading
    if (!isFeatureEnabled()) {
      renderDisabled(root);
      return;
    }

    // Feature enabled again
    // Remount cleanly to ensure no stale iframe is kept when consent was revoked.
    root.innerHTML = "";
    delete root.dataset.mounted;
    mountIfNeeded();
  });
}
