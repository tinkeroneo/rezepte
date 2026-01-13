// src/views/detail/detail.parts.js
import { escapeHtml, qsa } from "../../utils.js";

export function renderChildrenSectionHtml({ parentId, children, canWrite }) {
  const hasChildren = (children?.length ?? 0) > 0;
  if (!hasChildren && !canWrite) return "";

  return `
    <hr />
    <h3>Menü-Bestandteile</h3>

    <div class="card card--tight">
      <div class="card__bd">

        ${canWrite ? `
          <div class="row" style="justify-content:space-between; gap:.5rem; align-items:center; padding:.25rem 0;">
            <button id="btnAddChild" class="btn" type="button">➕ Teilrezept hinzufügen</button>
          </div>

          <div id="childPicker" class="card" style="display:none; margin-top:.5rem;">
            <div class="card__bd">
              <input id="childSearch" class="input" placeholder="Rezept suchen…" autocomplete="off"
                     style="width:100%; padding:.6rem .7rem;" />
              <div id="childResults" style="margin-top:.5rem;"></div>
              <div class="muted" style="margin-top:.5rem; font-size:.9rem;">
                Tipp: tippe 2–3 Buchstaben, dann klicken.
              </div>
            </div>
          </div>
        ` : ""}

        ${hasChildren ? children.map((ch, idx) => `
          <div class="row" style="justify-content:space-between; gap:.5rem; align-items:center; padding:.45rem 0; ${idx ? "border-top:1px solid #eee;" : ""}">
            <button class="btn btn--ghost" type="button" data-open-child="${escapeHtml(ch.id)}" style="min-width:0; text-align:left;">
              <div style="font-weight:750; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(ch.title)}</div>
              <div class="muted" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${escapeHtml([ch.category, ch.time].filter(Boolean).join(" · "))}
              </div>
            </button>
            ${canWrite ? `<button class="btn btn--danger" type="button" data-remove-child="${escapeHtml(ch.id)}">✕</button>` : ""}
          </div>
        `).join("") : `
          <div class="muted" style="padding:.25rem 0;">
            Noch keine Bestandteile.
          </div>
        `}
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

  recipes,
  childrenIds,

  addRecipePart,
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
      await refreshAll?.();
      setView({ name: "detail", selectedId: parentId, q: state.q }, { push: false });
    });
  });

  // Add picker
  const btnAdd = appEl.querySelector("#btnAddChild");
  const picker = appEl.querySelector("#childPicker");
  const input = appEl.querySelector("#childSearch");
  const results = appEl.querySelector("#childResults");

  if (!btnAdd || !picker || !input || !results) return;
  if (!canWrite) return;

  const existing = new Set([...(childrenIds || []), parentId]);

  function renderResults(q) {
    const qq = (q || "").trim().toLowerCase();
    if (qq.length < 2) {
      results.innerHTML = `<div class="muted">Mindestens 2 Zeichen…</div>`;
      return;
    }

    const matches = (recipes || [])
      .filter(r => r?.id && !existing.has(r.id))
      .filter(r => (r.title || "").toLowerCase().includes(qq))
      .slice(0, 30);

    if (!matches.length) {
      results.innerHTML = `<div class="muted">Keine Treffer.</div>`;
      return;
    }

    results.innerHTML = matches.map(r => `
      <div class="row" style="justify-content:space-between; gap:.5rem; align-items:center; padding:.35rem 0; border-top:1px solid #eee;">
        <div style="min-width:0;">
          <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(r.title || "")}</div>
          <div class="muted" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHtml([r.category, r.time].filter(Boolean).join(" · "))}
          </div>
        </div>
        <button class="btn" type="button" data-add-child="${escapeHtml(r.id)}">➕</button>
      </div>
    `).join("");

    qsa(results, "[data-add-child]").forEach(b => {
      b.addEventListener("click", async () => {
        const childId = b.getAttribute("data-add-child");
        if (!childId) return;

        await addRecipePart?.(parentId, childId);
        rebuildPartsIndexSetter?.();
        await refreshAll?.();
        setView({ name: "detail", selectedId: parentId, q: state.q }, { push: false });
      });
    });
  }

  btnAdd.addEventListener("click", () => {
    picker.style.display = (picker.style.display === "none" ? "block" : "none");
    if (picker.style.display !== "none") {
      input.value = "";
      renderResults("");
      input.focus();
    }
  });

  input.addEventListener("input", () => renderResults(input.value));
}
