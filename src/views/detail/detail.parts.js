// src/views/detail/detail.parts.js
import { escapeHtml, qsa } from "../../utils.js";

export function renderChildrenSectionHtml({ children, canWrite }) {
  if (!children?.length) return "";

  return `
    <hr />
    <h3>Menü-Bestandteile</h3>
    <div class="card card--tight">
      <div class="card__bd">
        ${children.map(ch => `
          <div class="row" style="justify-content:space-between; gap:.5rem; align-items:center; padding:.45rem 0; border-top:1px solid #eee;">
            <div style="min-width:0;">
              <div style="font-weight:750;">${escapeHtml(ch.title)}</div>
              <div class="muted">${escapeHtml([ch.category, ch.time].filter(Boolean).join(" · "))}</div>
            </div>
            <div class="row" style="gap:.25rem;">
              <button class="btn btn--ghost" type="button" data-open-child="${escapeHtml(ch.id)}" title="Öffnen">↗</button>
              ${canWrite ? `<button class="btn btn--ghost" type="button" data-remove-child="${escapeHtml(ch.id)}" title="Entfernen">✕</button>` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

export function bindChildrenSection({
  appEl,
  canWrite,
  parentId,
  state,
  setView,
  removeRecipePart,
  rebuildPartsIndexSetter,
  refreshAll
}) {
  // Open child
  qsa(appEl, "[data-open-child]").forEach(btn => {
    btn.addEventListener("click", () => {
      const childId = btn.getAttribute("data-open-child");
      if (!childId) return;
      setView({ name: "detail", selectedId: childId, q: state.q });
    });
  });

  // Remove child
  qsa(appEl, "[data-remove-child]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!canWrite) return;
      const childId = btn.getAttribute("data-remove-child");
      if (!childId) return;
      if (!confirm("Teilrezept entfernen?")) return;

      await removeRecipePart?.(parentId, childId);
      rebuildPartsIndexSetter?.();
      refreshAll?.();
      setView({ name: "detail", selectedId: parentId, q: state.q }, { push: false });
    });
  });
}
