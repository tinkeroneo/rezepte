import { escapeHtml, qs, qsa } from "../utils.js";
import { loadShopping, loadShoppingUI, saveShopping, saveShoppingUI, shoppingCategory } from "../domain/shopping.js";

export function renderShoppingView({ appEl, state, setView }) {
  const shopping = loadShopping();
  const entries = Object.entries(shopping);
  const ui = loadShoppingUI(); // { collapsedCats: { [cat]: true/false } }
  ui.collapsedCats = ui.collapsedCats || {};

  // sort: category -> done -> name
  entries.sort((a, b) => {
    const A = a[1]?.cat ?? shoppingCategory(a[0]);
    const B = b[1]?.cat ?? shoppingCategory(b[0]);
    if (A !== B) return A.localeCompare(B);

    // ❗ abgehakt nach unten
    const doneA = !!a[1]?.done;
    const doneB = !!b[1]?.done;
    if (doneA !== doneB) return doneA ? 1 : -1;

    return (a[1]?.name ?? a[0]).localeCompare(b[1]?.name ?? b[0]);
  });


  const grouped = new Map();
  for (const [key, obj] of entries) {
    const cat = obj?.cat ?? shoppingCategory(obj?.name ?? key);
    const arr = grouped.get(cat) ?? [];
    arr.push([key, obj]);
    grouped.set(cat, arr);
  }

  const cats = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));

  appEl.innerHTML = `
    <div class="container">
      <div class="card">
        <div class="row" style="justify-content:space-between; align-items:center; gap:.5rem;">
          <button class="btn btn--ghost" id="backBtn">← Zurück</button>
          <h2 style="margin:0;">🧺 Einkaufsliste</h2>
          <button class="btn btn--ghost" id="clearShopping">Leeren</button>
        </div>

        ${entries.length === 0
      ? `<div class="muted" style="margin-top:.75rem;">Noch leer.</div>`
      : cats.map(cat => {
        const items = grouped.get(cat) ?? [];

        const openItems = items.filter(([_, obj]) => !obj?.done);
        const doneItems = items.filter(([_, obj]) => !!obj?.done);

        const hasExplicit = Object.prototype.hasOwnProperty.call(ui.collapsedCats, cat);
        const collapsed = hasExplicit ? !!ui.collapsedCats[cat] : !!ui.collapsedChecked;
        const doneCount = doneItems.length;

        return `
      <div style="margin-top:1rem;">
        <div class="row" style="justify-content:space-between; align-items:center;">
          <div class="muted" style="font-weight:800; margin-bottom:.35rem;">${escapeHtml(cat)}</div>

          ${doneCount
            ? `<button class="btn btn--ghost" type="button" data-toggle-done="${escapeHtml(cat)}">
                   ${collapsed ? `Erledigte anzeigen (${doneCount})` : `Erledigte einklappen (${doneCount})`}
                 </button>`
            : ``
          }
        </div>

        <ul>
          ${openItems.map(([key, obj]) => {
            const name = obj?.name ?? key;
            const count = obj?.count ?? 1;
            return `
              <li>
                <label style="display:flex; gap:.6rem; align-items:center;">
                  <input type="checkbox" ${obj.done ? "checked" : ""} data-item="${escapeHtml(key)}" />
                  <span>${escapeHtml(name)}${count > 1 ? ` <span class="muted">×${count}</span>` : ""}</span>
                </label>
              </li>
            `;
          }).join("")}
        </ul>

        ${doneCount
            ? (collapsed
              ? ``
              : `
                  <div style="margin-top:.35rem;">
                    <ul>
                      ${doneItems.map(([key, obj]) => {
                const name = obj?.name ?? key;
                const count = obj?.count ?? 1;
                return `
                          <li>
                            <label style="display:flex; gap:.6rem; align-items:center;">
                              <input type="checkbox" ${obj.done ? "checked" : ""} data-item="${escapeHtml(key)}" />
                              <span class="step-done">${escapeHtml(name)}${count > 1 ? ` <span class="muted">×${count}</span>` : ""}</span>
                            </label>
                          </li>
                        `;
              }).join("")}
                    </ul>
                  </div>
                `)
            : ``
          }
      </div>
    `;
      }).join("")
    }
      </div>
    </div>
  `;

  qs(appEl, "#backBtn").addEventListener("click", () => setView({ name: "list", selectedId: null, q: state.q }));

  qsa(appEl, "[data-item]").forEach(cb => {
    cb.addEventListener("change", () => {
      const key = cb.dataset.item;
      if (!shopping[key]) return;
      shopping[key].done = cb.checked;
      saveShopping(shopping);
      renderShoppingView({ appEl, state, setView });
    });
  });

  qs(appEl, "#clearShopping").addEventListener("click", () => {
    if (!confirm("Einkaufsliste leeren?")) return;
    saveShopping({});
    renderShoppingView({ appEl, state, setView });
  });
  document.querySelectorAll("[data-toggle-done]").forEach(btn => {
    btn.addEventListener("click", () => {
      const cat = btn.getAttribute("data-toggle-done");
      const uiState = loadShoppingUI();
      uiState.collapsedCats = uiState.collapsedCats || {};
      const hasExplicit = Object.prototype.hasOwnProperty.call(uiState.collapsedCats, cat);
      const current = hasExplicit ? !!uiState.collapsedCats[cat] : !!uiState.collapsedChecked;
      uiState.collapsedCats[cat] = !current;
      saveShoppingUI(uiState);
      renderShoppingView({ appEl, state, setView });
    });
  });

}
