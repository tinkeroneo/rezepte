import { escapeHtml, norm, qs, qsa } from "../utils.js";
import { KEYS, lsGetStr, lsSetStr, lsSet } from "../storage.js";
import { exportRecipesToPdfViaPrint } from "../services/pdfExport.js";
import { downloadJson } from "../services/exportDownload.js";



export function renderListView({ appEl, state, recipes, partsByParent, setView }) {

  let viewMode = lsGetStr(KEYS.VIEWMODE, "grid");

  appEl.innerHTML = `
    <div class="container">
      <div class="topbar">
        <div class="row" style="justify-content:space-between; gap:.5rem; align-items:center;">
          <input id="q" type="search" placeholder="Suche… (z.B. Bohnen, scharf, Frühstück)" value="${escapeHtml(state.q)}" />
          <button class="btn btn-ghost" id="shoppingBtn" type="button" title="Einkaufsliste">🧺</button>
          <button class="btn btn-ghost" id="exportOpenBtn">Export</button>


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
  ;

const exportOpenBtn = qs(appEl, "#exportOpenBtn");
if (exportOpenBtn) {
  exportOpenBtn.addEventListener("click", () => {
    openExportSheet({ appEl, recipes, partsByParent });
  });
}

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
              ${r.image_url
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
              ${r.image_url
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
//  qs(appEl, "#exportBtn").addEventListener("click", () => {
//    const blob = new Blob([JSON.stringify(recipes, null, 2)], { type: "application/json" });
//    const url = URL.createObjectURL(blob);
//    const a = document.createElement("a");
//    a.href = url;
//    a.download = "rezepte-export.json";
//    a.click();
//    URL.revokeObjectURL(url);
//  });
function openExportSheet({ appEl, recipes, partsByParent }) {
  // backdrop + sheet
  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";
  backdrop.addEventListener("click", () => backdrop.remove());

  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.addEventListener("click", (e) => e.stopPropagation());

  // default: all selected
  const selected = new Set(recipes.map(r => r.id));

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="toolbar">
      <div>
        <h3 style="margin:0;">Export</h3>
        <div class="muted">Wähle Rezepte & Format</div>
      </div>
      <button class="btn btn-ghost" id="exportCloseBtn">Schließen</button>
    </div>

    <hr />

    <div class="card" style="padding:.85rem;">
      <div class="row" style="justify-content:space-between;">
        <div style="font-weight:800;">Rezepte</div>
        <div class="row" style="gap:.5rem;">
          <button class="btn btn-ghost" id="exportSelectAllBtn">Alle</button>
          <button class="btn btn-ghost" id="exportSelectNoneBtn">Keine</button>
        </div>
      </div>

      <div style="margin-top:.6rem; max-height: 38vh; overflow:auto; padding-right:.25rem;">
        ${recipes.map(r => `
          <label class="row" style="justify-content:space-between; padding:.35rem 0;">
            <span style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${escapeHtml(r.title || "Rezept")}
            </span>
            <input type="checkbox" data-exp-id="${escapeHtml(r.id)}" checked />
          </label>
        `).join("")}
      </div>
    </div>

    <div class="card" style="padding:.85rem;">
      <div style="font-weight:800; margin-bottom:.35rem;">Format</div>
      <label class="row" style="gap:.5rem; margin:.25rem 0;">
        <input type="radio" name="exportFmt" value="pdf" checked />
        <span>PDF (Drucken → Als PDF speichern)</span>
      </label>
      <label class="row" style="gap:.5rem; margin:.25rem 0;">
        <input type="radio" name="exportFmt" value="json" />
        <span>JSON</span>
      </label>
    </div>

    <div class="row" style="justify-content:space-between;">
      <div class="muted" id="exportCountHint">${recipes.length} ausgewählt</div>
      <button class="btn btn-primary" id="exportDoBtn">Export starten</button>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  const close = () => { sheet.remove(); backdrop.remove(); };

  qs(sheet, "#exportCloseBtn").addEventListener("click", close);

  const updateCount = () => {
    const count = selected.size;
    qs(sheet, "#exportCountHint").textContent = `${count} ausgewählt`;
    qs(sheet, "#exportDoBtn").disabled = count === 0;
  };

  // checkbox binding
  qsa(sheet, "[data-exp-id]").forEach(cb => {
    cb.addEventListener("change", () => {
      const id = cb.dataset.expId;
      if (cb.checked) selected.add(id);
      else selected.delete(id);
      updateCount();
    });
  });

  // select all/none
  qs(sheet, "#exportSelectAllBtn").addEventListener("click", () => {
    selected.clear();
    recipes.forEach(r => selected.add(r.id));
    qsa(sheet, "[data-exp-id]").forEach(cb => { cb.checked = true; });
    updateCount();
  });

  qs(sheet, "#exportSelectNoneBtn").addEventListener("click", () => {
    selected.clear();
    qsa(sheet, "[data-exp-id]").forEach(cb => { cb.checked = false; });
    updateCount();
  });

  // do export
  qs(sheet, "#exportDoBtn").addEventListener("click", () => {
    const fmt = qs(sheet, 'input[name="exportFmt"]:checked')?.value || "pdf";
    const subset = recipes.filter(r => selected.has(r.id));

    if (fmt === "json") {
      downloadJson(`rezepte-export-${new Date().toISOString().slice(0,10)}.json`, subset);
      close();
      return;
    }

    // PDF via print
    exportRecipesToPdfViaPrint({
      recipes: subset,
      partsByParent,
      includeImages: true
    });
    close();
  });

  updateCount();
}

  // Import: handled in app.js (optional) – lässt sich auch hier machen
}
