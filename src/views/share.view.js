// src/views/share.view.js
import { escapeHtml } from "../utils.js";
import { renderIngredientsHtml } from "./shared.ingredients.js";
import { splitStepsToCards } from "../domain/steps.js";
import { recipeImageOrDefault } from "../utils.js";
import { canReadRecipeAuthed } from "../supabase.js";



export async function renderShareView({
  appEl,
  state,
  setView,
  getSharedRecipe,
  isAuthenticated,
  recipes
}) {
  
  const token = String(state?.token || "").trim();
  
  if (!token) {
    appEl.innerHTML = `
      <div class="container">
        <section class="card">
          <div class="card__bd">
            <h1 class="view-title">Geteiltes Rezept</h1>
            <div class="hint">Kein Share-Token gefunden.</div>
            <div class="row" style="justify-content:flex-end; margin-top:1rem;">
              <button class="btn" id="btnBack" type="button">Zurück</button>
            </div>
          </div>
        </section>
      </div>`;
    appEl.querySelector("#btnBack")?.addEventListener("click", () => setView({ name: "list", selectedId: null, q: state?.q || "" }));
    return;
  }

  appEl.innerHTML = `
    <div class="container">
      <section class="card">
        <div class="card__bd">
          <div class="hint">Lade geteiltes Rezept…</div>
        </div>
      </section>
    </div>`;

  let data;
  try {
    data = await getSharedRecipe({ token });
  } catch (e) {
    appEl.innerHTML = `
      <div class="container">
        <section class="card">
          <div class="card__bd">
            <h1 class="view-title">Geteiltes Rezept</h1>
            <div class="hint">Link ungültig oder abgelaufen.</div>
            <div class="hint" style="margin-top:.5rem; white-space:pre-wrap;">${escapeHtml(String(e?.message || e))}</div>
            <div class="row" style="justify-content:flex-end; margin-top:1rem;">
              <button class="btn" id="btnBack" type="button">Zurück</button>
            </div>
          </div>
        </section>
      </div>`;
    appEl.querySelector("#btnBack")?.addEventListener("click", () => setView({ name: "list", selectedId: null, q: state?.q || "" }));
    return;
  }

  const r = data?.recipe || null;
  if (isAuthenticated?.() && (await canReadRecipeAuthed(r.id))) {
  setView({ name: "detail", selectedId: r.id, q: state?.q || "" });
  return;
}
  if (!r?.id) {
    appEl.innerHTML = `
      <div class="container">
        <section class="card"><div class="card__bd">
          <h1 class="view-title">Geteiltes Rezept</h1>
          <div class="hint">Rezept nicht gefunden.</div>
        </div></section>
      </div>`;
    return;
  }

  // image_url ist das Standardfeld in diesem Projekt
  const imgUrl = recipeImageOrDefault(r?.image_url || r?.imageUrl || r?.img || "");

  const ingredientsHtml = renderIngredientsHtml(r.ingredients || []);
  const cards = splitStepsToCards(r.steps || []);
  const stepsHtml = (cards?.length ? cards : [])
    .map((c) => {
      const title = c.title ? `<div class="label" style="margin:0 0 .35rem 0;">${escapeHtml(c.title)}</div>` : "";
      const body = (c.body || []).map((l) => `<div style="margin:.25rem 0;">${escapeHtml(l)}</div>`).join("");
      return `<div class="card" style="margin-top:.65rem;"><div class="card__bd">${title}${body}</div></div>`;
    })
    .join("");

  const parts = Array.isArray(data?.parts) ? data.parts : [];
  const partsHtml = parts
    .map((p) => {
      const pr = p?.recipe || null;
      if (!pr?.id) return "";
      const pImg = recipeImageOrDefault(pr?.image_url || pr?.imageUrl || pr?.img || "");
      const pIngr = renderIngredientsHtml(pr.ingredients || []);
      const pCards = splitStepsToCards(pr.steps || []);
      const pSteps = (pCards?.length ? pCards : [])
        .map((c) => {
          const t = c.title ? `<div class="label" style="margin:0 0 .35rem 0;">${escapeHtml(c.title)}</div>` : "";
          const b = (c.body || []).map((l) => `<div style="margin:.25rem 0;">${escapeHtml(l)}</div>`).join("");
          return `<div class="card" style="margin-top:.55rem;"><div class="card__bd">${t}${b}</div></div>`;
        })
        .join("");
      return `
        <div class="card" style="margin-top:1rem;">
          <div class="card__bd">
            <div class="row" style="justify-content:space-between; gap:.75rem; align-items:flex-start; flex-wrap:wrap;">
              <div style="flex:1 1 240px; min-width:240px;">
                <div class="label" style="margin:0; font-size:1.05rem;">${escapeHtml(pr.title || "Teil")}</div>
                ${pr.time ? `<div class="hint" style="margin:.25rem 0 0 0;">⏱️ ${escapeHtml(pr.time)}</div>` : ""}
              </div>
              ${pImg ? `<img src="${escapeHtml(pImg)}" alt="" style="width:120px; height:80px; object-fit:cover; border-radius:12px;" />` : ""}
            </div>

            <div style="margin-top:.75rem;">
              <div class="label" style="margin:0 0 .35rem 0;">Zutaten</div>
              ${pIngr || `<div class="hint">Keine Zutaten.</div>`}
            </div>

            <div style="margin-top:.75rem;">
              <div class="label" style="margin:0 0 .35rem 0;">Schritte</div>
              ${pSteps || `<div class="hint">Keine Schritte.</div>`}
            </div>
          </div>
        </div>
      `;
    })
    .filter(Boolean)
    .join("");

  // If user is logged in and recipe exists in current repo, offer opening the full view.
  const hasLocalAccess = Array.isArray(recipes) && recipes.some((x) => x?.id === r.id);
  const canOpenFull = !!isAuthenticated?.() && hasLocalAccess;

  // Wenn der Nutzer eingeloggt ist UND Zugriff hat: direkt in die normale Detail-Ansicht.
  if (canOpenFull) {
    setView({ name: "detail", selectedId: r.id, q: state?.q || "" });
    return;
  }

  appEl.innerHTML = `
    <div class="container">
      <section class="card">
        <div class="card__hd">
          <div class="row" style="justify-content:space-between; gap:.5rem; align-items:center;">
            <h1 class="view-title" style="margin:0;">${escapeHtml(r.title || "Rezept")}</h1>
            <div class="row" style="gap:.5rem; align-items:center;">
              <span class="badge" title="Geteiltes Rezept">Geteilt</span>
              <button class="btn btn--ghost" id="btnPrint" type="button" title="Drucken">🖨️</button>
              ${canOpenFull ? `<button class="btn btn--ghost" id="btnOpenFull" type="button" title="Vollansicht öffnen">↗</button>` : ""}
              <button class="btn btn--ghost" id="btnBack" type="button" title="Zurück">←</button>
            </div>
          </div>
          ${r.time ? `<div class="hint" style="margin-top:.35rem;">⏱️ ${escapeHtml(r.time)}</div>` : ""}
        </div>
        <div class="card__bd">
          ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="" data-default-img="${r.image_url ? "" : "1"}" style="width:100%; max-height:320px; object-fit:cover; border-radius:14px;" />` : ""}
          <h2 style="margin:1rem 0 .5rem 0;">Zutaten</h2>
          <div>${ingredientsHtml || `<div class="hint">Keine Zutaten.</div>`}</div>

          <h2 style="margin:1rem 0 .5rem 0;">Schritte</h2>
          <div>${stepsHtml || `<div class="hint">Keine Schritte.</div>`}</div>

          ${parts.length ? `
            <h2 style="margin:1.25rem 0 .5rem 0;">Teile</h2>
            <div>${partsHtml}</div>
          ` : ""}
        </div>
      </section>
    </div>
  `;

  appEl.querySelector("#btnPrint")?.addEventListener("click", () => window.print());

  appEl.querySelector("#btnBack")?.addEventListener("click", () => {
    if (window.history.length > 1) window.history.back();
    else setView({ name: "list", selectedId: null, q: state?.q || "" });
  });

  appEl.querySelector("#btnOpenFull")?.addEventListener("click", () => {
    setView({ name: "detail", selectedId: r.id, q: state?.q || "" });
  });
}
