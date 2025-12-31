import { escapeHtml, qs, qsa, norm } from "../utils.js";
import { splitStepsToCards } from "../domain/steps.js";
import { buildMenuIngredients, buildMenuStepSections } from "../domain/menu.js";
import { renderIngredientsHtml } from "./shared.ingredients.js";
import { ack } from "../ui/feedback.js";
import {
  addCookEvent,
  getLastCooked,
  getAvgRating,
  getRatingCount,
  listCookEvents,
  updateCookEvent,
  deleteCookEvent,
  pullCookEventsFromBackend,
  pushCookEventToBackend,
  removeCookEventFromBackend
} from "../domain/cooklog.js";

const __pulledCookEvents = new Set(); // recipeId

export function renderDetailView({
  appEl, state, recipes, partsByParent, recipeParts,
  setView, useBackend,
  sbDelete, removeRecipePart, addRecipePart, listAllRecipeParts,
  onUpdateRecipe,
  addToShopping, rebuildPartsIndexSetter
}) {
  const r = recipes.find(x => x.id === state.selectedId);
  if (!r) return setView({ name: "list", selectedId: null, q: state.q });

  const normalizeFocus = (focus) => {
    const f = (focus && typeof focus === "object") ? { ...focus } : {};
    const x = Number.isFinite(Number(f.x)) ? Number(f.x) : 50;
    const y = Number.isFinite(Number(f.y)) ? Number(f.y) : 50;
    const zoom = Number.isFinite(Number(f.zoom)) ? Math.max(1, Math.min(3, Number(f.zoom))) : 1;
    const mode = (f.mode === "cover" || f.mode === "manual" || f.mode === "crop") ? "cover" : "auto";
    return { x, y, zoom, mode };
  };

  const applyFocusToImg = (img, focus) => {
    if (!img) return;
    const f = normalizeFocus(focus);
    const pos = `${f.x}% ${f.y}%`;
    img.style.objectPosition = pos;
    if (f.mode === "cover") {
      img.style.objectFit = "cover";
      img.style.transform = `scale(${f.zoom})`;
      img.style.transformOrigin = pos;
    } else {
      img.style.objectFit = "contain";
      img.style.transform = "scale(1)";
      img.style.transformOrigin = "50% 50%";
    }
  };

  // pull cook events once per recipe (best effort)
  if (!__pulledCookEvents.has(r.id)) {
    __pulledCookEvents.add(r.id);
    pullCookEventsFromBackend(r.id)
      .then(() => setView({ name: "detail", selectedId: r.id, q: state.q }, { push: false }))
      .catch(() => { }); // offline ok
  }

  const last = getLastCooked(r.id);
  const avg = getAvgRating(r.id);
  const avgCount = getRatingCount(r.id);
  const avgRounded = avg ? Math.round(avg) : 0; // 0..5

  const focus0 = normalizeFocus(r.image_focus);
  const avgLabel = avg ? avg.toFixed(1) : "—";
  const lastStr = last
    ? new Date(last.at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })
    : "—";
  // Kochverlauf: bewusst unauffällig. Default: eingeklappt (persistiert pro Rezept).
  const events = listCookEvents(r.id).slice(0, 30);
  const cookLogKey = `tinkeroneo_cooklog_open_${r.id}`;
  const cookLogOpen = (() => {
    try { return localStorage.getItem(cookLogKey) === "1"; } catch { return false; }
  })();

  const isMenu = (partsByParent.get(r.id)?.length ?? 0) > 0;
  const stepSections = isMenu ? buildMenuStepSections(r, recipes, partsByParent) : [];

  const childIds = partsByParent.get(r.id) ?? [];
  const children = childIds.map(cid => recipes.find(x => x.id === cid)).filter(Boolean);

  appEl.innerHTML = `
    <div class="container">
      <section class="card">
        <div class="card__hd">
          <div class="row" style="justify-content:space-between; gap:.5rem; align-items:center;">
            <div class="row" style="gap:.5rem;">
              <button class="btn btn--ghost" id="cookBtn">👨‍🍳 Kochen</button>
              <button class="btn btn--ghost" id="editBtn" title="Rezept bearbeiten">✏️ Bearbeiten</button>
            </div>
          </div>
        </div>
        <div class="card__bd">
          <h2>${escapeHtml(r.title)} 
        <button class="btn btn--ghost" id="copyCookLinkBtn" type="button" title="Link kopieren">🔗</button></h2>
        ${r.time ? `<div class="muted">${escapeHtml(r.time)}` : ""}
        ${r.source ? `<div class="muted" style="margin-top:.35rem;">Quelle: ${escapeHtml(r.source)}</div>` : ""}

        </div>
      </section>

      

        ${r.image_url ? `
          <div style="margin:.75rem 0;">

            <div class="img-focus-frame">
              <img id="detailImg" class="detail-img" src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.title)}" />
            </div>

            <div class="row" style="justify-content:space-between; align-items:center; margin-top:.45rem;">
              <button class="btn btn--ghost" id="imgFocusToggle" type="button">🖼️ Bild anpassen</button>
            </div>

            <div id="imgFocusPanel" class="card" style="margin-top:.5rem; padding:.75rem; display:none;">
              <div class="row" style="justify-content:space-between; gap:.75rem; flex-wrap:wrap;">
                <label class="muted" style="display:flex; gap:.5rem; align-items:center;">
                  Modus
                  <select id="imgFocusMode" class="input" style="min-width:140px;">
                    <option value="auto">Auto (ganzes Bild)</option>
                    <option value="cover">Cover (Zuschnitt)</option>
                  </select>
                </label>
                <label class="muted" style="display:flex; gap:.5rem; align-items:center;">
                  Zoom
                  <input id="imgFocusZoom" type="range" min="1" max="3" step="0.05" />
                  <span id="imgFocusZoomVal" class="muted" style="min-width:3ch; text-align:right;"></span>
                </label>
              </div>

              <div class="row" style="gap:.75rem; align-items:center; margin-top:.5rem; flex-wrap:wrap;">
                <label class="muted" style="display:flex; gap:.5rem; align-items:center;">
                  X
                  <input id="imgFocusX" type="range" min="0" max="100" step="1" />
                  <span id="imgFocusXVal" class="muted" style="min-width:3ch; text-align:right;"></span>
                </label>
                <label class="muted" style="display:flex; gap:.5rem; align-items:center;">
                  Y
                  <input id="imgFocusY" type="range" min="0" max="100" step="1" />
                  <span id="imgFocusYVal" class="muted" style="min-width:3ch; text-align:right;"></span>
                </label>
              </div>

              <div class="row" style="justify-content:flex-end; margin-top:.75rem; gap:.5rem;">
                <button class="btn btn--ghost" id="imgFocusReset" type="button">Reset</button>
                <button class="btn" id="imgFocusSave" type="button">Speichern</button>
              </div>
            </div>
          </div>
        ` : ""}

        <hr />
        
        <div class="row" style="justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Zutaten</h3>
          <button class="btn btn--ghost" id="addToShoppingBtn" >🧺</button>
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
          <button class="btn btn--ghost" id="addPartBtn" type="button">+ Hinzufügen</button>
        </div>

        ${children.length ? `
          <ul>
            ${children.map(c => `
              <li style="display:flex; justify-content:space-between; gap:.5rem; align-items:center;">
                <a href="#" data-open-child="${escapeHtml(c.id)}">${escapeHtml(c.title)}</a>
                <button class="btn btn--ghost" data-remove-child="${escapeHtml(c.id)}" type="button">✕</button>
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

<section class="card card--tight" style="margin-top:.75rem;">
        <div class="card__hd"><div class="toolbar">
            <div>
              <h3 style="margin:0;">Kochverlauf</h3>
              <div class="muted">Zuletzt gekocht: <b>${escapeHtml(lastStr)}</b> · Ø ${escapeHtml(avgLabel)} (${avgCount})</div>
            </div>
            <div class="row" style="gap:.35rem;">
              <button class="btn btn--ghost" id="cookLogToggle" type="button"
                      title="Verlauf ein-/ausklappen"
                      aria-expanded="${cookLogOpen ? "true" : "false"}">
                ${cookLogOpen ? "▾" : "▸"} Verlauf (${events.length})
              </button>
              <button class="btn btn--ghost" id="cookLogNowBtn" type="button" title="Heute gekocht">✅</button>
            </div>
          </div></div>

        <div class="card__bd">
          <div class="row" id="cookStars" style="gap:.15rem; align-items:center; flex-wrap:wrap; margin-top:.35rem;">
            ${[1, 2, 3, 4, 5].map(n => `
              <button type="button"
                      class="btn btn--ghost"
                      data-cook-rate="${n}"
                      title="${n} Sterne"
                      style="padding:.35rem .5rem;">
                ${n <= avgRounded ? "★" : "☆"}
              </button>
            `).join("")}
          </div>

          <div id="cookLogList" style="margin-top:.5rem; ${cookLogOpen ? "" : "display:none;"}">
            ${events.length ? `
              ${events.map(ev => `
                <div class="row" style="justify-content:space-between; align-items:flex-start; padding:.45rem 0; border-top:1px solid #eee;">
                  <div style="min-width:0;">
                    <div style="font-weight:650;">
                      ${new Date(ev.at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
                      ${ev.rating ? `<span class="muted" style="margin-left:.35rem;">(${ev.rating}/5)</span>` : ``}
                    </div>
                    ${ev.note ? `<div class="muted" style="margin-top:.2rem; white-space:pre-wrap;">${escapeHtml(ev.note)}</div>` : ``}
                  </div>
                  <div class="row" style="gap:.35rem;">
                    <button class="btn btn--ghost" data-ev-edit="${escapeHtml(ev.id)}" title="Bearbeiten">✎</button>
                    <button class="btn btn--ghost" data-ev-del="${escapeHtml(ev.id)}" title="Löschen">🗑</button>
                  </div>
                </div>
              `).join("")}
            ` : `<div class="muted" style="margin-top:.35rem;">Noch nichts geloggt.</div>`}
          </div>
        </div>
      </section>

      <div id="sheetRoot"></div>
      </div>
    </div>
  `;


  const sheetRoot = qs(appEl, "#sheetRoot");

  // Image lightbox
  const img = qs(appEl, "#detailImg");
  if (img) {
    // Apply stored focus/zoom to preview image
    applyFocusToImg(img, r.image_focus);

    // Focus controls
    const toggle = qs(appEl, "#imgFocusToggle");
    const panel = qs(appEl, "#imgFocusPanel");
    const hint = qs(appEl, "#imgFocusHint");
    const modeEl = qs(appEl, "#imgFocusMode");
    const xEl = qs(appEl, "#imgFocusX");
    const yEl = qs(appEl, "#imgFocusY");
    const zoomEl = qs(appEl, "#imgFocusZoom");
    const xVal = qs(appEl, "#imgFocusXVal");
    const yVal = qs(appEl, "#imgFocusYVal");
    const zVal = qs(appEl, "#imgFocusZoomVal");
    const resetBtn = qs(appEl, "#imgFocusReset");
    const saveBtn = qs(appEl, "#imgFocusSave");

    const stateFocus = { ...focus0 };
    const syncLabels = () => {
      if (xVal) xVal.textContent = String(Math.round(stateFocus.x));
      if (yVal) yVal.textContent = String(Math.round(stateFocus.y));
      if (zVal) zVal.textContent = stateFocus.zoom.toFixed(2);
      if (hint) hint.textContent = stateFocus.mode === "cover" ? "Zuschnitt: positionieren + zoomen" : "Auto: ganzes Bild";
    };

    const applyPreview = () => {
      applyFocusToImg(img, stateFocus);
      syncLabels();
    };

    if (modeEl) modeEl.value = stateFocus.mode;
    if (xEl) xEl.value = String(stateFocus.x);
    if (yEl) yEl.value = String(stateFocus.y);
    if (zoomEl) zoomEl.value = String(stateFocus.zoom);
    syncLabels();

    toggle?.addEventListener("click", () => {
      if (!panel) return;
      panel.style.display = panel.style.display === "none" ? "block" : "none";
      // small UX: when opening, switch to cover automatically if image is currently auto
      if (panel.style.display !== "none" && stateFocus.mode === "auto") {
        stateFocus.mode = "cover";
        if (modeEl) modeEl.value = "cover";
        applyPreview();
      }
    });

    modeEl?.addEventListener("change", () => {
      stateFocus.mode = modeEl.value === "cover" ? "cover" : "auto";
      applyPreview();
    });
    xEl?.addEventListener("input", () => {
      stateFocus.x = Number(xEl.value) || 50;
      applyPreview();
    });
    yEl?.addEventListener("input", () => {
      stateFocus.y = Number(yEl.value) || 50;
      applyPreview();
    });
    zoomEl?.addEventListener("input", () => {
      stateFocus.zoom = Math.max(1, Math.min(3, Number(zoomEl.value) || 1));
      applyPreview();
    });

    resetBtn?.addEventListener("click", () => {
      stateFocus.x = 50; stateFocus.y = 50; stateFocus.zoom = 1; stateFocus.mode = "auto";
      if (modeEl) modeEl.value = "auto";
      if (xEl) xEl.value = "50";
      if (yEl) yEl.value = "50";
      if (zoomEl) zoomEl.value = "1";
      applyPreview();
    });

    saveBtn?.addEventListener("click", async () => {
      if (typeof onUpdateRecipe !== "function") return;
      const next = { ...r, image_focus: normalizeFocus(stateFocus) };
      saveBtn.disabled = true;
      try {
        await onUpdateRecipe(next);
        ack(saveBtn);
      } finally {
        saveBtn.disabled = false;
      }
    });

    img.addEventListener("click", () => {
      if (panel && panel.style.display !== "none") return;
      sheetRoot.innerHTML = `
        <div class="sheet-backdrop" id="imgBackdrop"></div>
        <div class="sheet" role="dialog" aria-modal="true">
          <div class="sheet-handle"></div>
          <div class="row" style="justify-content:space-between; align-items:center; gap:.5rem;">
            <h3 style="margin:0;">${escapeHtml(r.title)}</h3>
            <button class="btn btn--ghost" id="closeImg">Schließen</button>
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
      } catch { /* ignore */ }
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

  // Kochverlauf: Schnell-Log
  qs(appEl, "#cookLogNowBtn")?.addEventListener("click", () => {
    const ev = addCookEvent(r.id, { at: Date.now() });
    if (ev) pushCookEventToBackend(r.id, ev).catch(() => { });
    ack(qs(appEl, "#cookLogNowBtn"));
    renderDetailView({ appEl, state, recipes, partsByParent, recipeParts, setView, useBackend, sbDelete, removeRecipePart, addRecipePart, listAllRecipeParts, onUpdateRecipe, addToShopping, rebuildPartsIndexSetter });
  });

  // Kochverlauf: default eingeklappt (persistiert)
  qs(appEl, "#cookLogToggle")?.addEventListener("click", () => {
    const listEl = qs(appEl, "#cookLogList");
    if (!listEl) return;
    const open = listEl.style.display === "none";
    listEl.style.display = open ? "" : "none";

    const btn = qs(appEl, "#cookLogToggle");
    if (btn) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.innerHTML = `${open ? "▾" : "▸"} Verlauf (${events.length})`;
    }

    try { localStorage.setItem(cookLogKey, open ? "1" : "0"); } catch { /* ignore */ }
  });

  qsa(appEl, "[data-cook-rate]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rating = parseInt(btn.dataset.cookRate, 10);
      openCookRatingDialog({ recipeId: r.id, rating, onDone: () => renderDetailView({ appEl, state, recipes, partsByParent, recipeParts, setView, useBackend, sbDelete, removeRecipePart, addRecipePart, listAllRecipeParts, onUpdateRecipe, addToShopping, rebuildPartsIndexSetter }) });
    });
  });

  // delete event
  qsa(appEl, "[data-ev-del]").forEach(b => {
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = b.getAttribute("data-ev-del");
      if (!id) return;

      const row = b.closest(".row");
      if (row) row.remove();

      deleteCookEvent(r.id, id);

      // Keep backend in sync (otherwise the next pull will restore the old entry)
      if (useBackend) {
        removeCookEventFromBackend(id).catch(() => { });
      }

      requestAnimationFrame(() => {
        renderDetailView({ appEl, state, recipes, partsByParent, recipeParts, setView, useBackend, sbDelete, removeRecipePart, addRecipePart, listAllRecipeParts, onUpdateRecipe, addToShopping, rebuildPartsIndexSetter });
      });
    });
  });

  // edit event
  qsa(appEl, "[data-ev-edit]").forEach(b => {
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = b.dataset.evEdit;
      const ev = listCookEvents(r.id).find(x => x.id === id);
      if (!ev) return;
      openEditCookEventDialog({
        ev,
        onSave: (patch) => {
          updateCookEvent(r.id, id, patch);

          // Push updated entry to backend so edits (date/time, rating, note) persist
          if (useBackend) {
            const updated = listCookEvents(r.id).find(x => x.id === id);
            if (updated) pushCookEventToBackend(r.id, updated).catch(() => { });
          }

          renderDetailView({ appEl, state, recipes, partsByParent, recipeParts, setView, useBackend, sbDelete, removeRecipePart, addRecipePart, listAllRecipeParts, onUpdateRecipe, addToShopping, rebuildPartsIndexSetter });
        }
      });
    });
  });
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
          <button class="btn btn--ghost" id="closePart">Schließen</button>
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

// ------------------ Cooklog dialogs (Detail-View) ------------------
let __cookRatingDialogOpen = false;
let __cookRatingLastOpenAt = 0;

function openCookRatingDialog({ recipeId, rating, onDone }) {
  const now = Date.now();
  if (now - __cookRatingLastOpenAt < 350) return;
  __cookRatingLastOpenAt = now;

  if (__cookRatingDialogOpen) return;
  __cookRatingDialogOpen = true;

  document.getElementById("cookRatingBackdrop")?.remove();
  document.getElementById("cookRatingSheet")?.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "cookRatingBackdrop";
  backdrop.className = "sheet-backdrop";

  const sheet = document.createElement("div");
  sheet.id = "cookRatingSheet";
  sheet.className = "sheet";
  sheet.style.maxHeight = "55vh";
  sheet.addEventListener("click", (e) => e.stopPropagation());

  const close = () => {
    sheet.remove();
    backdrop.remove();
    __cookRatingDialogOpen = false;
  };

  backdrop.addEventListener("click", close);

  sheet.innerHTML = `
    <div class="toolbar">
      <div>
        <h3 style="margin:0;">Bewertung</h3>
        <div class="muted">${"⭐".repeat(rating)} (${rating}/5)</div>
      </div>
      <button class="btn btn--ghost" id="cookRateCancel" type="button" title="Abbrechen">✕</button>
    </div>

    <div class="card" style="padding:.85rem; margin-top:.75rem;">
      <div class="muted" style="margin-bottom:.35rem;">Optional: kurze Notiz</div>
      <textarea id="cookRateNote" placeholder="z.B. mehr Zitrone, weniger Salz, statt Reis: Bulgur"></textarea>
      <div class="row" style="justify-content:space-between; margin-top:.6rem;">
        <div class="muted" id="cookRateHint">Enter = speichern (ohne Text)</div>
        <button class="btn btn--solid" id="cookRateSave" type="button" title="Speichern">💾 Speichern</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  sheet.querySelector("#cookRateCancel").addEventListener("click", close);

  const noteEl = sheet.querySelector("#cookRateNote");
  const hintEl = sheet.querySelector("#cookRateHint");
  const saveBtn = sheet.querySelector("#cookRateSave");

  const updateHint = () => {
    const hasText = (noteEl.value || "").trim().length > 0;
    hintEl.textContent = hasText ? "Speichern nur über 💾" : "Enter = speichern (ohne Text)";
  };

  const doSave = () => {
    const note = (noteEl.value || "").trim();
    const ev = addCookEvent(recipeId, { at: Date.now(), rating, note });
    if (ev) pushCookEventToBackend(recipeId, ev).catch(() => { });
    close();
    onDone?.();
  };

  updateHint();
  noteEl.addEventListener("input", updateHint);
  saveBtn.addEventListener("click", doSave);

  sheet.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  noteEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const hasText = (noteEl.value || "").trim().length > 0;
      if (hasText) return;
      e.preventDefault();
      doSave();
    }
  });

  requestAnimationFrame(() => noteEl.focus());
}

function openEditCookEventDialog({ ev, onSave }) {
  document.getElementById("cookEditBackdrop")?.remove();
  document.getElementById("cookEditSheet")?.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "cookEditBackdrop";
  backdrop.className = "sheet-backdrop";

  const sheet = document.createElement("div");
  sheet.id = "cookEditSheet";
  sheet.className = "sheet";
  sheet.addEventListener("click", (e) => e.stopPropagation());

  const close = () => { sheet.remove(); backdrop.remove(); };
  backdrop.addEventListener("click", close);

  const dt = new Date(ev.at);
  const isoLocal = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  sheet.innerHTML = `
    <div class="toolbar">
      <div>
        <h3 style="margin:0;">Eintrag bearbeiten</h3>
        <div class="muted">${new Date(ev.at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</div>
      </div>
      <button class="btn btn--ghost" id="ceClose" type="button" title="Schließen">✕</button>
    </div>

    <hr />

    <div class="card" style="padding:.85rem;">
      <div class="muted" style="margin-bottom:.35rem;">Zeit</div>
      <input id="ceAt" type="datetime-local" value="${isoLocal}" />
    </div>

    <div class="card" style="padding:.85rem;">
      <div class="muted" style="margin-bottom:.35rem;">Rating</div>
      <select id="ceRating">
        <option value="">—</option>
        ${[1,2,3,4,5].map(n => `<option value="${n}" ${ev.rating === n ? "selected" : ""}>${n}</option>`).join("")}
      </select>
    </div>

    <div class="card" style="padding:.85rem;">
      <div class="muted" style="margin-bottom:.35rem;">Notiz</div>
      <textarea id="ceNote" placeholder="…">${escapeHtml(ev.note ?? "")}</textarea>
      <div class="row" style="justify-content:space-between; margin-top:.6rem;">
        <div class="muted">Enter macht Zeilenumbruch</div>
        <button class="btn btn--solid" id="ceSave" type="button">💾 Speichern</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  sheet.querySelector("#ceClose").addEventListener("click", close);
  sheet.querySelector("#ceSave").addEventListener("click", () => {
    const atStr = sheet.querySelector("#ceAt").value;
    // datetime-local returns "YYYY-MM-DDTHH:mm" (no timezone). Parse as local time
    const at = (() => {
      if (!atStr) return ev.at;
      const m = String(atStr).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
      if (!m) return ev.at;
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10) - 1;
      const d = parseInt(m[3], 10);
      const hh = parseInt(m[4], 10);
      const mm = parseInt(m[5], 10);
      return new Date(y, mo, d, hh, mm, 0, 0).getTime();
    })();
    const ratingStr = sheet.querySelector("#ceRating").value;
    const rating = ratingStr ? parseInt(ratingStr, 10) : null;
    const note = sheet.querySelector("#ceNote").value || "";
    onSave?.({ at, rating, note });
    close();
  });

  sheet.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  requestAnimationFrame(() => sheet.querySelector("#ceNote")?.focus());
}
