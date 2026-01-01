// src/ui/importSheet.js
import { qs } from "../utils.js";

export function openImportSheet({ onImportRecipes }) {
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

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="toolbar">
      <div><h3 style="margin:0;">Import</h3></div>
    </div>
    <hr />

    <div class="card" style="padding:.85rem;">
      <div style="font-weight:800;">Quelle</div>
      <button class="btn btn--ghost" id="impPickFile">JSON-Datei wählen</button>
      <input id="impFile" type="file" accept="application/json,.json,text/plain,.txt" hidden />
      <textarea id="impPaste" placeholder='[ { "id": "...", "title": "..."} ]'></textarea>
    </div>

    <div class="card" style="padding:.85rem;">
      <div style="font-weight:800;">Konflikte</div>
      <select id="impMode">
        <option value="backendWins">Backend gewinnt</option>
        <option value="jsonWins">JSON gewinnt</option>
        <option value="mergePreferBackend">Merge (Backend bevorzugt)</option>
        <option value="mergePreferJson">Merge (JSON bevorzugt)</option>
      </select>
    </div>

    <div class="row" style="justify-content:space-between;">
      <div class="muted" id="impHint">0 Einträge erkannt</div>
      <button class="btn btn--solid" id="impDo">Import starten</button>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  const fileBtn = qs(sheet, "#impPickFile");
  const fileInput = qs(sheet, "#impFile");
  const pasteEl = qs(sheet, "#impPaste");
  const modeEl = qs(sheet, "#impMode");
  const hintEl = qs(sheet, "#impHint");
  const doBtn = qs(sheet, "#impDo");

  let parsedItems = [];

  const parsePayload = (text) => {
    try {
      const obj = JSON.parse(text);
      return Array.isArray(obj)
        ? obj
        : Array.isArray(obj?.recipes)
        ? obj.recipes
        : [];
    } catch {
      return [];
    }
  };

  const refreshHint = () => {
    hintEl.textContent = `${parsedItems.length} Einträge erkannt`;
    doBtn.disabled = parsedItems.length === 0;
  };

  fileBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    parsedItems = parsePayload(await f.text());
    refreshHint();
  });

  pasteEl.addEventListener("input", () => {
    parsedItems = parsePayload(pasteEl.value.trim());
    refreshHint();
  });

  doBtn.addEventListener("click", async () => {
    try {
      doBtn.disabled = true;
      doBtn.textContent = "Importiere…";
      await onImportRecipes?.({ items: parsedItems, mode: modeEl.value });
      close();
      location.reload();
    } catch (e) {
      console.error(e);
      alert("Import fehlgeschlagen");
      doBtn.disabled = false;
      doBtn.textContent = "Import starten";
    }
  });

  refreshHint();
}
