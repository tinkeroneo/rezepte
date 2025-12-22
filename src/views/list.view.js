import { escapeHtml, norm, qs, qsa } from "../utils.js";
import { KEYS, lsGetStr, lsSetStr, lsSet } from "../storage.js";

export function renderListView({ appEl, state, recipes, setView }) {
  let viewMode = lsGetStr(KEYS.VIEWMODE, "grid");

  appEl.innerHTML = `
    <div class="container">
      <div class="topbar">
        <div class="row" style="justify-content:space-between; gap:.5rem; align-items:center;">
          <input id="q" type="search" placeholder="Suche… (z.B. Bohnen, scharf, Frühstück)" value="${escapeHtml(state.q)}" />
          <button class="btn btn-ghost" id="shoppingBtn" type="button" title="Einkaufsliste">🧺</button>
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <div>
            <h2>Rezepte</h2>
            <div class="muted" id="count"></div>
          </div>

          <div class="toggle" aria-label="Ansicht umschalten">
            <button id="modeList" type="button">Liste</button>
            <button id="modeGrid" type="button">Grid</button>
          </div>

          <div class="row" style="gap:.5rem;">
            <button class="btn btn-ghost" id="importBtn">Import</button>
            <button class="btn btn-ghost" id="exportBtn">Export</button>
          </div>

          <input
            id="importFile"
            type="file"
            accept=".json,.txt,application/json,text/plain"
            style="display:none;"
          />
        </div>
      </div>

      <div id="results"></div>
      <button class="fab" id="addFab" aria-label="Rezept hinzufügen">+</button>
    </div>
  `;

  const qEl = qs(appEl, "#q");
  const resultsEl = qs(appEl, "#results");
  const countEl = qs(appEl, "#count");
  const modeListBtn = qs(appEl, "#modeList");
  const modeGridBtn = qs(appEl, "#modeGrid");

  const applyModeButtons = () => {
    modeListBtn.classList.toggle("active", viewMode === "list");
    modeGridBtn.classList.toggle("active", viewMode === "grid");
  };

  const getFiltered = (q) => {
    const qq = norm(q);
    const sorted = recipes.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return sorted.filter(r => {
      if (!qq) return true;
      const hay = [r.title, r.category, r.time, r.source, ...(r.ingredients ?? []), ...(r.steps ?? [])]
        .map(norm).join(" ");
      return hay.includes(qq);
    });
  };

  function renderResults() {
    const filtered = getFiltered(qEl.value);
    countEl.textContent = `${filtered.length} von ${recipes.length}`;

    if (viewMode === "grid") {
      resultsEl.innerHTML = `
        <div class="grid">
          ${filtered.map(r => `
            <div class="grid-card" data-id="${escapeHtml(r.id)}">
              ${
                r.image_url
                  ? `<img class="grid-img" src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.title)}" loading="lazy" />`
                  : `<div class="grid-img" aria-hidden="true"></div>`
              }
              <div class="grid-body">
                <div class="grid-title">${escapeHtml(r.title)}</div>
                <div class="grid-meta">${escapeHtml(r.category ?? "")}${r.time ? " · " + escapeHtml(r.time) : ""}</div>
              </div>
            </div>
          `).join("")}
        </div>
      `;
      qsa(resultsEl, ".grid-card").forEach(el => {
        el.addEventListener("click", () => setView({ name: "detail", selectedId: el.dataset.id, q: qEl.value }));
      });
    } else {
      resultsEl.innerHTML = filtered.map(r => `
        <div class="card">
          <div class="list-item" data-id="${escapeHtml(r.id)}">
            <div class="list-item-left">
              ${
                r.image_url
                  ? `<img class="thumb" src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.title)}" loading="lazy" />`
                  : `<div class="thumb-placeholder" aria-hidden="true"></div>`
              }
              <div>
                <div style="font-weight:700;">${escapeHtml(r.title)}</div>
                <div class="muted">${escapeHtml(r.category ?? "")}${r.time ? " · " + escapeHtml(r.time) : ""}</div>
              </div>
            </div>
            <div class="muted">›</div>
          </div>
        </div>
      `).join("");

      qsa(resultsEl, ".list-item").forEach(el => {
        el.addEventListener("click", () => setView({ name: "detail", selectedId: el.dataset.id, q: qEl.value }));
      });
    }
  }

  applyModeButtons();
  renderResults();

  modeListBtn.addEventListener("click", () => {
    viewMode = "list";
    lsSetStr(KEYS.VIEWMODE, viewMode);
    applyModeButtons();
    renderResults();
  });
  modeGridBtn.addEventListener("click", () => {
    viewMode = "grid";
    lsSetStr(KEYS.VIEWMODE, viewMode);
    applyModeButtons();
    renderResults();
  });

  qs(appEl, "#shoppingBtn").addEventListener("click", () => setView({ name: "shopping", selectedId: null, q: qEl.value }));
  qs(appEl, "#addFab").addEventListener("click", () => setView({ name: "add", selectedId: null, q: qEl.value }));

  qEl.addEventListener("input", () => {
    // keep in nav
    lsSet(KEYS.NAV, { ...state, q: qEl.value });
    renderResults();
  });

  // Export
  qs(appEl, "#exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(recipes, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rezepte-export.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import: handled in app.js (optional) – lässt sich auch hier machen
}
