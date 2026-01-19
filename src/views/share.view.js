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

  const img = recipeImageOrDefault(r);

  const ingredientsHtml = renderIngredientsHtml(r.ingredients || []);
  const cards = splitStepsToCards(r.steps || []);
  const stepsHtml = (cards?.length ? cards : [])
    .map((c) => {
      const title = c.title ? `<div class="label" style="margin:0 0 .35rem 0;">${escapeHtml(c.title)}</div>` : "";
      const lines = (c.lines || []).map((l) => `<div style="margin:.25rem 0;">${escapeHtml(l)}</div>`).join("");
      return `<div class="card" style="margin-top:.65rem;"><div class="card__bd">${title}${lines}</div></div>`;
    })
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
          ${img ? `<img src="${escapeHtml(img)}" alt="" style="width:100%; max-height:320px; object-fit:cover; border-radius:14px;" />` : ""}
          <h2 style="margin:1rem 0 .5rem 0;">Zutaten</h2>
          <div>${ingredientsHtml || `<div class="hint">Keine Zutaten.</div>`}</div>

          <h2 style="margin:1rem 0 .5rem 0;">Schritte</h2>
          <div>${stepsHtml || `<div class="hint">Keine Schritte.</div>`}</div>
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
