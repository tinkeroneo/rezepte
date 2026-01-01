// src/ui/exportSheet.js
import { escapeHtml, qs, qsa } from "../utils.js";
import { exportRecipesToPdfViaPrint } from "../services/pdfExport.js";
import { downloadJson } from "../services/exportDownload.js";

export function openExportSheet({ list, partsByParent, spaceName }) {
  const safeList = Array.isArray(list) ? list : [];

  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";

  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.addEventListener("click", (e) => e.stopPropagation());

  const close = () => {
    sheet.remove();
    backdrop.remove();
  };
  backdrop.addEventListener("click", close);

  const selected = new Set(safeList.map((r) => r.id));

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="toolbar">
      <div>
        <h3 style="margin:0;">Export</h3>
        <div class="muted">Wähle Rezepte & Format</div>
        <div class="muted">Basis: ${safeList.length} sichtbare Rezepte</div>
      </div>
    </div>

    <hr />

    <div class="card" style="padding:.85rem;">
      <div class="row" style="justify-content:space-between;">
        <div style="font-weight:800;">Rezepte</div>
        <div class="row" style="gap:.5rem;">
          <button class="btn btn--ghost" id="exportSelectAllBtn">Alle</button>
          <button class="btn btn--ghost" id="exportSelectNoneBtn">Keine</button>
        </div>
      </div>

      <div style="margin-top:.6rem; max-height: 38vh; overflow:auto; padding-right:.25rem;">
        ${safeList
          .map(
            (r) => `
          <label class="row" style="justify-content:space-between; padding:.35rem 0;">
            <span style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${escapeHtml(r.title || "Rezept")}
            </span>
            <input type="checkbox" data-exp-id="${escapeHtml(r.id)}" checked />
          </label>
        `
          )
          .join("")}
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
      <div class="muted" id="exportCountHint">${safeList.length} ausgewählt</div>
      <button class="btn btn--solid" id="exportDoBtn">Export starten</button>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  const updateCount = () => {
    const count = selected.size;
    qs(sheet, "#exportCountHint").textContent = `${count} ausgewählt`;
    qs(sheet, "#exportDoBtn").disabled = count === 0;
  };

  qsa(sheet, "[data-exp-id]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = cb.dataset.expId;
      cb.checked ? selected.add(id) : selected.delete(id);
      updateCount();
    });
  });

  qs(sheet, "#exportSelectAllBtn").addEventListener("click", () => {
    selected.clear();
    safeList.forEach((r) => selected.add(r.id));
    qsa(sheet, "[data-exp-id]").forEach((cb) => (cb.checked = true));
    updateCount();
  });

  qs(sheet, "#exportSelectNoneBtn").addEventListener("click", () => {
    selected.clear();
    qsa(sheet, "[data-exp-id]").forEach((cb) => (cb.checked = false));
    updateCount();
  });

  qs(sheet, "#exportDoBtn").addEventListener("click", () => {
    const fmt = qs(sheet, 'input[name="exportFmt"]:checked')?.value || "pdf";
    const subset = safeList.filter((r) => selected.has(r.id));

    if (fmt === "json") {
      downloadJson(
        `rezepte-export-${new Date().toISOString().slice(0, 10)}.json`,
        subset
      );
      close();
      return;
    }

    exportRecipesToPdfViaPrint({
      recipes: subset,
      allRecipes: safeList,
      partsByParent,
      includeImages: true,
      spaceName
    });
    close();
  });

  updateCount();
}
