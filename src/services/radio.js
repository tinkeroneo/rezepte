 export function ensureRadioDock() {
  const root = document.getElementById("radioDockRoot");
  if (!root) return;

  // schon gemountet? dann NICHT neu bauen
  if (root.dataset.mounted === "1") return;
  root.dataset.mounted = "1";

  root.innerHTML = `
    <div class="radio-dock" id="radioDock">
      <button class="radio-dock-btn" id="radioDockToggle" type="button" aria-expanded="false" title="Radio">🎧</button>

      <div class="radio-panel" id="radioPanel" hidden>
        <div class="radio-panel-head">
          <div class="muted" style="font-weight:800;">egoFM</div>
          <button class="btn btn-ghost" id="radioCloseBtn" type="button">✕</button>
        </div>
        <iframe
          id="radioIframe"
          src="https://player.egofm.de/radioplayer/?stream=egofm"
          width="100%"
          height="140"
          style="border:0; border-radius:12px;"
          loading="lazy"
          allow="autoplay"
        ></iframe>
      </div>
    </div>
  `;

  const dock = document.getElementById("radioDock");
  const panel = document.getElementById("radioPanel");
  const toggle = document.getElementById("radioDockToggle");
  const close = document.getElementById("radioCloseBtn");

  const open = () => {
    panel.hidden = false;
    dock.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
  };

  const shut = () => {
    dock.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    // panel bleibt im DOM, nur hidden => iframe bleibt erhalten
    panel.hidden = true;
  };

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = dock.classList.contains("is-open");
    isOpen ? shut() : open();
  });

  close.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    shut();
  });

  // Interaktionen im Panel dürfen NICHT zum "outside click" führen
  panel.addEventListener("click", (e) => e.stopPropagation());

  // optional: outside click schließt, aber nicht auf Interaktionen innerhalb
  document.addEventListener("click", (e) => {
    if (!dock.classList.contains("is-open")) return;
    if (dock.contains(e.target)) return;
    shut();
  });
}