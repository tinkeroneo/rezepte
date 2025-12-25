import { escapeHtml, qs, qsa, norm } from "../utils.js";
import { splitStepsToCards } from "../domain/steps.js";
import { buildMenuIngredients, buildMenuStepSections } from "../domain/menu.js";
import { renderIngredientsHtml } from "./shared.ingredients.js";

export function renderDetailView({
  appEl, state, recipes, partsByParent, recipeParts,
  setView, useBackend,
  sbDelete, removeRecipePart, addRecipePart, listAllRecipeParts,
  addToShopping, rebuildPartsIndexSetter
}) {
  const r = recipes.find(x => x.id === state.selectedId);
  if (!r) return setView({ name: "list", selectedId: null, q: state.q });

  const isMenu = (partsByParent.get(r.id)?.length ?? 0) > 0;
  const stepSections = isMenu ? buildMenuStepSections(r, recipes, partsByParent) : [];

  const childIds = partsByParent.get(r.id) ?? [];
  const children = childIds.map(cid => recipes.find(x => x.id === cid)).filter(Boolean);

  appEl.innerHTML = `
    <div class="container">
      <div class="card">
      <div class="row" style="justify-content:space-between; gap:.5rem;">
        <button class="btn btn-ghost" id="backBtn">← Zurück</button>
        <button class="btn btn-ghost" id="cookBtn">👨‍🍳Kochen</button>
      </div>
        <h2>${escapeHtml(r.title)} 
        <button class="btn btn-ghost" id="copyCookLinkBtn" type="button" title="Link kopieren">🔗</button></h2>
        <div class="muted">${escapeHtml(r.category ?? "")}${r.time ? " · " + escapeHtml(r.time) : ""}</div>
        ${r.source ? `<div class="muted" style="margin-top:.35rem;">Quelle: ${escapeHtml(r.source)}</div>` : ""}

        ${r.image_url ? `
          <div style="margin:.75rem 0;">
            <img id="detailImg" src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.title)}"
                 style="width:100%; max-height:260px; object-fit:contain; background:linear-gradient(135deg,#eef2ff,#f8fafc); border-radius:12px; display:block; cursor:zoom-in;" />
          </div>
        ` : ""}

        <hr />
        <div class="row" style="justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Zutaten</h3>
          <button class="btn btn-ghost" id="addToShoppingBtn" >🧺</button>
        </div>

        ${isMenu
      ? buildMenuIngredients(r, recipes, partsByParent).map(section => `
                <div style="margin-bottom:1rem;">
                  <div class="muted" style="font-weight:800; margin-bottom:.25rem;">${escapeHtml(section.title)}</div>
                  ${renderIngredientsHtml(section.items)}
                </div>
              `).join("")
      : renderIngredientsHtml(r.ingredients ?? [])
    }

        <hr />
        <div class="row" style="justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Bestandteile</h3>
          <button class="btn btn-ghost" id="addPartBtn" type="button">+ Hinzufügen</button>
        </div>

        ${children.length ? `
          <ul>
            ${children.map(c => `
              <li style="display:flex; justify-content:space-between; gap:.5rem; align-items:center;">
                <a href="#" data-open-child="${escapeHtml(c.id)}">${escapeHtml(c.title)}</a>
                <button class="btn btn-ghost" data-remove-child="${escapeHtml(c.id)}" type="button">✕</button>
              </li>
            `).join("")}
          </ul>
        ` : `<div class="muted" style="margin-top:.35rem;">Noch keine Bestandteile.</div>`}

        <hr />
        <h3>Zubereitung</h3>
        ${isMenu ? `
          <div>
            ${stepSections.map(sec => `
              <div style="margin-top:.75rem;">
                <div class="muted" style="font-weight:850; margin-bottom:.25rem;">${escapeHtml(sec.title)}</div>
                ${sec.cards.map((c, i) => `
                  <div class="card" style="margin-top:.45rem;">
                    <div style="font-weight:800;">${escapeHtml(`${i + 1}. ${c.title}`)}</div>
                    ${c.body.length ? `<div class="muted" style="margin-top:.35rem;">${escapeHtml(c.body.join(" "))}</div>` : ""}
                  </div>
                `).join("")}
              </div>
            `).join("")}
          </div>
        ` : `
          <div>
            ${splitStepsToCards(r.steps ?? []).map((c, i) => `
              <div class="card" style="margin-top:.6rem;">
                <div style="font-weight:800;">${escapeHtml(`${i + 1}. ${c.title}`)}</div>
                ${c.body.length ? `<div class="muted" style="margin-top:.35rem;">${escapeHtml(c.body.join(" "))}</div>` : ""}
              </div>
            `).join("")}
          </div>
        `}

        <hr />
        <div class="row" style="justify-content:space-between; gap:.5rem;">
          <button class="btn btn-ghost" id="deleteBtn">Löschen</button>
          <button class="btn btn-primary" id="editBtn">Bearbeiten</button>
        </div>

        <div id="sheetRoot"></div>
      </div>
    </div>
  `;


  const sheetRoot = qs(appEl, "#sheetRoot");

  // Image lightbox
  const img = qs(appEl, "#detailImg");
  if (img) {
    img.addEventListener("click", () => {
      sheetRoot.innerHTML = `
        <div class="sheet-backdrop" id="imgBackdrop"></div>
        <div class="sheet" role="dialog" aria-modal="true">
          <div class="sheet-handle"></div>
          <div class="row" style="justify-content:space-between; align-items:center; gap:.5rem;">
            <h3 style="margin:0;">${escapeHtml(r.title)}</h3>
            <button class="btn btn-ghost" id="closeImg">Schließen</button>
          </div>
          <div style="margin-top:.75rem;">
            <img src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.title)}" style="width:100%; border-radius:12px; display:block;" />
          </div>
        </div>
      `;
      qs(sheetRoot, "#imgBackdrop").addEventListener("click", () => sheetRoot.innerHTML = "");
      qs(sheetRoot, "#closeImg").addEventListener("click", () => sheetRoot.innerHTML = "");
    });
  }


  qs(appEl, "#copyCookLinkBtn")?.addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}#cook?id=${encodeURIComponent(state.selectedId || "")}&q=${encodeURIComponent(state.q || "")}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Kochen", url });
        return;
      } catch { }
    }

    try {
      await navigator.clipboard.writeText(url);
      // alert("Link kopiert ✅");
      const b = qs(appEl, "#copyCookLinkBtn");
      b && ack(b);

    } catch {
      prompt("Link kopieren:", url);
    }
  });
  qs(appEl, "#backBtn").addEventListener("click", () => setView({ name: "list", selectedId: null, q: state.q }));
  qs(appEl, "#cookBtn").addEventListener("click", () => setView({ name: "cook", selectedId: r.id, q: state.q }));
  qs(appEl, "#editBtn").addEventListener("click", () => setView({ name: "add", selectedId: r.id, q: state.q }));

  qs(appEl, "#addToShoppingBtn").addEventListener("click", () => {
    if (isMenu) {
      const sections = buildMenuIngredients(r, recipes, partsByParent);
      sections.forEach(sec => addToShopping(sec.items));
    } else addToShopping(r.ingredients ?? []);
    alert("Zur Einkaufsliste hinzugefügt 🧺");
    setView({ name: "shopping", selectedId: null, q: state.q });
  });

  qs(appEl, "#deleteBtn").addEventListener("click", async () => {
    if (!confirm("Rezept wirklich löschen?")) return;
    // local deletion is handled in app.js via callback — simplest: reload after delete
    await sbDelete?.(r.id).catch(() => { });
    location.reload();
  });

  qsa(appEl, "[data-open-child]").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      setView({ name: "detail", selectedId: a.dataset.openChild, q: state.q });
    });
  });

  // Remove child
  qsa(appEl, "[data-remove-child]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const childId = btn.dataset.removeChild;
      if (!confirm("Bestandteil entfernen?")) return;

      if (!useBackend) {
        // local only: just reload; app.js will rebuild from local
        location.reload();
        return;
      }

      try {
        await removeRecipePart(r.id, childId);
        const fresh = await listAllRecipeParts();
        rebuildPartsIndexSetter(fresh);
        setView({ name: "detail", selectedId: r.id, q: state.q }, { push: false });
      } catch (e) {
        alert(`Konnte nicht entfernen: ${e?.message ?? e}`);
      }
    });
  });

  // Add part sheet
  qs(appEl, "#addPartBtn").addEventListener("click", () => {
    const existing = (partsByParent.get(r.id) ?? []);
    const candidates = recipes
      .filter(x => x.id !== r.id)
      .filter(x => !existing.includes(x.id))
      .slice()
      .sort((a, b) => norm(a.title).localeCompare(norm(b.title)));

    sheetRoot.innerHTML = `
      <div class="sheet-backdrop" id="partBackdrop"></div>
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-handle"></div>

        <div class="row" style="justify-content:space-between; align-items:center; gap:.5rem;">
          <h3 style="margin:0;">Teilrezept hinzufügen</h3>
          <button class="btn btn-ghost" id="closePart">Schließen</button>
        </div>

        <input id="partSearch" type="search" placeholder="Suche… (z.B. Sauce, Reis, Salat)" style="margin-top:.6rem;" />
        <div id="partList" style="margin-top:.6rem; max-height:55vh; overflow:auto;"></div>
      </div>
    `;

    const listEl = qs(sheetRoot, "#partList");
    const searchEl = qs(sheetRoot, "#partSearch");

    const renderList = (q) => {
      const qq = norm(q);
      const filtered = candidates.filter(x => !qq || norm(x.title).includes(qq));

      listEl.innerHTML = filtered.length ? `
        <div>
          ${filtered.slice(0, 60).map(x => `
            <div class="card" style="margin:.5rem 0;">
              <div class="list-item" data-pick="${escapeHtml(x.id)}">
                <div>
                  <div style="font-weight:800;">${escapeHtml(x.title)}</div>
                  <div class="muted">${escapeHtml(x.category ?? "")}${x.time ? " · " + escapeHtml(x.time) : ""}</div>
                </div>
                <div class="muted">+</div>
              </div>
            </div>
          `).join("")}
        </div>
      ` : `<div class="muted">Keine Treffer.</div>`;

      qsa(listEl, "[data-pick]").forEach(el => {
        el.addEventListener("click", async () => {
          const childId = el.dataset.pick;
          if (!useBackend) { alert("Teilrezepte brauchen Backend (Supabase)."); return; }

          try {
            const order = existing.length;
            await addRecipePart(r.id, childId, order);
            const fresh = await listAllRecipeParts();
            rebuildPartsIndexSetter(fresh);
            sheetRoot.innerHTML = "";
            setView({ name: "detail", selectedId: r.id, q: state.q }, { push: false });
          } catch (e) {
            alert(`Konnte nicht hinzufügen: ${e?.message ?? e}`);
          }
        });
      });
    };

    renderList("");
    searchEl.addEventListener("input", () => renderList(searchEl.value));

    qs(sheetRoot, "#partBackdrop").addEventListener("click", () => sheetRoot.innerHTML = "");
    qs(sheetRoot, "#closePart").addEventListener("click", () => sheetRoot.innerHTML = "");
    setTimeout(() => searchEl.focus(), 0);
  });
}
