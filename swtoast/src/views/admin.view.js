import { escapeHtml, qs } from "../utils.js";
import { getCategoryColors, setCategoryColor, normalizeCategoryToken } from "../domain/categories.js";

export function renderAdminView({ appEl, recipes, setView }) {
  const colors = getCategoryColors();

  // derive category tokens from recipes
  const tokens = new Set();
  (recipes || []).forEach(r => {
    const cat = r.category || "";
    cat.split("/").map(s => normalizeCategoryToken(s)).filter(Boolean).forEach(t => tokens.add(t));
  });
  const sorted = Array.from(tokens).sort((a,b)=>a.localeCompare(b, "de"));

  appEl.innerHTML = `
    <div class="page">
      <div class="topbar">
        <button id="backBtn" class="btn">←</button>
        <div style="font-weight:900; font-size:1.35rem;">Admin</div>
      </div>

      <div class="card">
        <div style="font-weight:800; margin-bottom:.4rem;">Tools</div>
        <div class="admin-links">
          <a class="chip" href="#selftest">Selftest</a>
          <a class="chip" href="#diagnostics">Diagnostics</a>
        </div>
      </div>

      <div class="card">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem;">
          <div>
            <div style="font-weight:800;">Kategorien & Farben</div>
            <div class="muted" style="margin-top:.15rem;">Farben werden lokal gespeichert (LocalStorage). Später kann das an eine Settings-Tabelle gekoppelt werden.</div>
          </div>
        </div>

        ${sorted.length ? `
          <div class="admin-cats">
            ${sorted.map(t => {
              const val = colors[t] || "#d9e8df";
              return `
                <div class="admin-cat-row">
                  <div class="admin-cat-name">${escapeHtml(t)}</div>
                  <input class="admin-color" type="color" value="${escapeHtml(val)}" data-cat="${escapeHtml(t)}" />
                </div>
              `;
            }).join("")}
          </div>
        ` : `<div class="muted" style="margin-top:.6rem;">Keine Kategorien gefunden.</div>`}
      </div>
    </div>
  `;

  qs(appEl, "#backBtn").addEventListener("click", () => setView({ name: "list", selectedId: null, q: "" }));

  appEl.querySelectorAll('input[type="color"][data-cat]').forEach(inp => {
    inp.addEventListener("input", () => {
      const cat = inp.dataset.cat;
      setCategoryColor(cat, inp.value);
    });
  });
}
