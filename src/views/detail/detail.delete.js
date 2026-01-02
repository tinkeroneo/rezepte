// src/views/detail/detail.delete.js
import { qs } from "../../utils.js";
import { ack } from "../../ui/feedback.js";

const BACKDROP_ID = "deleteRecipeBackdrop";
const SHEET_ID = "deleteRecipeSheet";

function removeExisting() {
  document.getElementById(BACKDROP_ID)?.remove();
  document.getElementById(SHEET_ID)?.remove();
}

function openDeleteSheet({ title, onConfirm }) {
  removeExisting();

  const backdrop = document.createElement("div");
  backdrop.id = BACKDROP_ID;
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
        <div style="font-weight:900;">Rezept löschen</div>
        <div class="muted">Diese Aktion kann nicht rückgängig gemacht werden.</div>
      </div>
      <button class="btn btn--ghost" id="delCloseBtn" type="button">✕</button>
    </div>

    <div class="card" style="margin: 0 var(--s-3) var(--s-3); padding: var(--s-3);">
      <div style="font-weight:800; margin-bottom: var(--s-2);">${title || ""}</div>

      <div class="muted" style="margin-bottom: var(--s-3);">
        Wirklich löschen?
      </div>

      <div class="row" style="justify-content:flex-end; gap: var(--s-2);">
        <button class="btn btn--ghost" id="delCancelBtn" type="button">Abbrechen</button>
        <button class="btn btn--solid" id="delConfirmBtn" type="button">LÖSCHEN</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  qs(sheet, "#delCloseBtn")?.addEventListener("click", close);
  qs(sheet, "#delCancelBtn")?.addEventListener("click", close);

  qs(sheet, "#delConfirmBtn")?.addEventListener("click", async () => {
    const btn = qs(sheet, "#delConfirmBtn");
    if (btn) btn.disabled = true;

    try {
      await onConfirm?.();
      close();
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

export function bindDeleteRecipe({
  appEl,
  recipe,
  canWrite,
  useBackend,
  sbDelete,      // async (recipeId) => void
  refreshAll,    // () => void
  setView,       // fn
  state          // { q }
}) {
  const btn = qs(appEl, "#deleteBtn");
  if (!btn) return;

  // Nur wenn Backend + Schreibrechte
  if (!useBackend || !canWrite || typeof sbDelete !== "function") {
    btn.disabled = true;
    btn.title = "Nur Owner/Editor & Backend aktiv";
    btn.style.opacity = "0.5";
    return;
  }

  btn.addEventListener("click", () => {
    openDeleteSheet({
      title: recipe?.title ? `„${recipe.title}“` : "",
      onConfirm: async () => {
        await sbDelete(recipe.id);
        refreshAll?.();
        ack(btn);
        setView({ name: "list", selectedId: null, q: state.q }, { push: false });
      }
    });
  });
}
