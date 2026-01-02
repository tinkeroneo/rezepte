// src/ui/importSheet.js
import { qs } from "../utils.js";
import { reportError, showError } from "../services/errors.js";
function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function openImportSheet({ onImportRecipes, spaces = [], activeSpaceId = "" }) {
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

  const hasSpaces = Array.isArray(spaces) && spaces.length > 0;
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

    ${hasSpaces ? `
    <div class="card" style="padding:.85rem;">
      <div style="font-weight:800;">Ziel-Space</div>
      <select id="impSpace">
        ${spaces.map(s => {
    const sid = String(s?.space_id || s?.id || "").trim();
    if (!sid) return "";
    const name = String(s?.name || sid);
    const role = String(s?.role || "viewer");
    const label = `${name} (${role})`;
    const sel = sid === String(activeSpaceId || "") ? "selected" : "";
    return `<option value="${esc(sid)}" ${sel}>${esc(label)}</option>`;
  }).join("")}
      </select>
      <div class="muted" style="margin-top:.35rem;">Importiert Rezepte in den ausgewählten Space.</div>
    </div>
    ` : ""}

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
  const spaceEl = qs(sheet, "#impSpace");
  const hintEl = qs(sheet, "#impHint");
  const doBtn = qs(sheet, "#impDo");

  let parsedItems = [];
  let parseError = "";

  const parsePayload = (text) => {
    const raw = String(text ?? "");
    const cleaned = raw
      .replace(/^\uFEFF/, "") // BOM
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();

    // If user pasted surrounding text, try to extract the first JSON object/array.
    const firstBrace = cleaned.indexOf("{");
    const firstBracket = cleaned.indexOf("[");
    let candidate = cleaned;
    const startIdx = (firstBrace === -1) ? firstBracket : (firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket));
    if (startIdx > 0) candidate = cleaned.slice(startIdx);

    try {
      const obj = JSON.parse(candidate);
      if (Array.isArray(obj)) return { items: obj, error: "" };
      if (Array.isArray(obj?.recipes)) return { items: obj.recipes, error: "" };
      if (obj && typeof obj === "object" && (obj.id || obj.title || obj.ingredients || obj.steps)) return { items: [obj], error: "" };
      return { items: [], error: "JSON erkannt, aber kein Recipe-Format." };
    } catch (e) {
      reportError(e, { scope: "importSheet", action: "parse" });
      showError("Import fehlgeschlagen");

      return { items: [], error: "Kein gültiges JSON." };
    }
  };


  const refreshHint = () => {
    hintEl.textContent = parseError
      ? `${parsedItems.length} Einträge erkannt · ${parseError}`
      : `${parsedItems.length} Einträge erkannt`;
    doBtn.disabled = parsedItems.length === 0;
  };

  fileBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    const r = parsePayload(await f.text());
    parsedItems = r.items;
    parseError = r.error;
    refreshHint();
  });

  pasteEl.addEventListener("input", () => {
    const r = parsePayload(pasteEl.value);
    parsedItems = r.items;
    parseError = r.error;
    refreshHint();
  });

  doBtn.addEventListener("click", async () => {
    try {
      doBtn.disabled = true;
      doBtn.textContent = "Importiere…";
      const targetSpaceId = String(spaceEl?.value || "").trim();
      await onImportRecipes?.({ items: parsedItems, mode: modeEl.value, targetSpaceId });
      close();
      location.reload();
    } catch (e) {
      console.error(e);
      reportError(e, { scope: "importSheet", action: "parse" });
      showError("Import fehlgeschlagen");
      alert("Import fehlgeschlagen");
      doBtn.disabled = false;
      doBtn.textContent = "Import starten";
    }
  });

  refreshHint();
}
