// src/views/detail/detail.spaceCopy.js
import { escapeHtml, qs } from "../../utils.js";
import { ack } from "../../ui/feedback.js";

const SHEET_BACKDROP_ID = "copySpaceBackdrop";
const SHEET_ID = "copySpaceSheet";

function removeExisting() {
  document.getElementById(SHEET_BACKDROP_ID)?.remove();
  document.getElementById(SHEET_ID)?.remove();
}

function buildOptions(mySpaces, currentSid) {
  const spaces = Array.isArray(mySpaces) ? mySpaces : [];
  const cur = String(currentSid || "").trim();

  return spaces
    .map(s => ({
      id: String(s.space_id || s.id || ""),
      name: String(s.space_name || s.name || s.space_id || s.id || "")
    }))
    .filter(s => s.id && s.id !== cur)
    .map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name || s.id)}</option>`)
    .join("");
}

function openCopySheet({
  mySpaces,
  currentSid,
  onConfirm // async ({ targetSid, includeParts }) => void
}) {
  removeExisting();

  const options = buildOptions(mySpaces, currentSid);
  if (!options) {
    alert("Kein anderer Space verfügbar.");
    return;
  }

  const backdrop = document.createElement("div");
  backdrop.id = SHEET_BACKDROP_ID;
  backdrop.className = "sheet-backdrop";

  const sheet = document.createElement("div");
  sheet.id = SHEET_ID;
  sheet.className = "sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");

  const close = () => {
    backdrop.remove();
    sheet.remove();
  };

  backdrop.addEventListener("click", close);

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="toolbar" style="padding: var(--s-3);">
      <div>
        <div style="font-weight:900;">Kopieren nach Space</div>
        <div class="muted">Wähle den Ziel-Space</div>
      </div>
      <button class="btn btn--ghost" id="copyCloseBtn" type="button">✕</button>
    </div>

    <div class="card" style="margin: 0 var(--s-3) var(--s-3); padding: var(--s-3);">
      <div class="row" style="gap:.5rem; flex-wrap:wrap; align-items:flex-end;">
        <select id="copySpaceSelect" class="input" style="flex:1; min-width:220px;">
          ${options}
        </select>

        <label class="muted" style="display:flex; gap:.4rem; align-items:center; white-space:nowrap;">
          <input id="copyIncludeParts" type="checkbox" checked />
          inkl. Parts
        </label>

        <button id="doCopyBtn" class="btn btn--solid" type="button">KOPIEREN</button>
        <button id="cancelCopyBtn" class="btn btn--ghost" type="button">Abbrechen</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  qs(sheet, "#copyCloseBtn")?.addEventListener("click", close);
  qs(sheet, "#cancelCopyBtn")?.addEventListener("click", close);

  qs(sheet, "#doCopyBtn")?.addEventListener("click", async () => {
    const select = qs(sheet, "#copySpaceSelect");
    const cb = qs(sheet, "#copyIncludeParts");
    const targetSid = String(select?.value || "").trim();
    const includeParts = !!cb?.checked;

    if (!targetSid) return;

    const btn = qs(sheet, "#doCopyBtn");
    if (btn) btn.disabled = true;

    try {
      await onConfirm?.({ targetSid, includeParts });
      close();
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

export function bindCopyToSpace({
  appEl,
  useBackend,
  mySpaces,
  recipe,
  canWrite,
  copyRecipeToSpace, // async (recipeId, targetSid, { includeParts }) => void
  onAfterCopy // () => void
}) {
  const btn = qs(appEl, "#copyBtn");
  if (!btn) return;

  if (!useBackend || !canWrite || typeof copyRecipeToSpace !== "function") {
    btn.disabled = true;
    btn.title = "Nur Owner/Editor & Backend aktiv";
    btn.style.opacity = "0.5";
    return;
  }

  btn.addEventListener("click", () => {
    openCopySheet({
      mySpaces,
      currentSid: recipe?.space_id,
      onConfirm: async ({ targetSid, includeParts }) => {
        await copyRecipeToSpace(recipe.id, targetSid, { includeParts });
        ack(btn);
        onAfterCopy?.();
      }
    });
  });
}
