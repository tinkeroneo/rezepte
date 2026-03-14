// src/views/detail/detail.templates.js
import { escapeHtml, parseSourceLink, recipeImageOrDefault } from "../../utils.js";
import { splitStepsToCards } from "../../domain/steps.js";
import { buildMenuIngredients, buildMenuStepSections } from "../../domain/menu.js";
import { encodeImageFocusAttr } from "../../services/recipeImagePresentation.js";
import { renderIngredientsHtml } from "../shared.ingredients.js";

function formatStepCardTitle(title, index) {
  const raw = String(title ?? "").trim();
  if (/^\d+\.\s/.test(raw)) return raw;
  return `${index + 1}. ${raw}`;
}

export function buildChildrenFromIndex({ recipeId, recipes, partsByParent }) {
  const childIds = partsByParent.get(recipeId) ?? [];
  return childIds.map(cid => recipes.find(x => x.id === cid)).filter(Boolean);
}

export function renderDetailHeaderHtml({ r, canWrite }) {
  const isPending = !!r?._pending;
  const sourceLink = parseSourceLink(r.source);
  return `
    <section class="card">
      <div class="card__hd">
      
        <div class="row" style="justify-content:space-between; gap:.5rem; align-items:center;">
          <div class="row" style="gap:.5rem; flex-wrap:wrap;">
            <button class="btn btn--ghost" id="cookBtn" type="button">👨‍🍳 Kochen</button>

           

            
            ${canWrite ? `<button class="btn btn--ghost" id="deleteBtn" type="button" title="Rezept löschen">🗑️</button>` : ``}
          </div>

          <button class="btn btn--ghost" id="shareLinkBtn" type="button" title="Link kopieren">🔗</button>
        </div>
      </div>  

      <div class="card__bd">
        <h2 style="margin:0;">${escapeHtml(r.title)} 
                              <button class="btn btn--ghost" id="copyBtn" type="button" title="In anderen Space kopieren">⧉</button>
                              ${canWrite ? `<button class="btn btn--ghost" id="editBtn" type="button" title="Rezept bearbeiten">✎</button>` : ``}
                              </h2>
        ${r.time ? `<div class="muted">${escapeHtml(r.time)}</div>` : ""}
        ${r.source ? `<div class="muted" style="margin-top:.35rem;">Quelle: ${sourceLink ? `<a href="${escapeHtml(sourceLink.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceLink.label)}</a>` : escapeHtml(r.source)}</div>` : ""}
        <div class="muted" style="margin-top:.35rem;">
          Sync-Status: ${isPending ? "&#9888; Ausstehend (lokal geaendert)" : "&#9989; Synchron"}
        </div>
      </div>
    </section>
  `;
}

export function renderDetailImageHtml({ r, showImageModeDebug = false }) {

  return `
    <div style="margin:.75rem 0;">
      <div class="img-focus-frame">
        <img 
          id="detailImg" 
          class="detail-img" 
          src="${escapeHtml(recipeImageOrDefault(r.image_url))}" 
          data-image-focus="${encodeImageFocusAttr(r.image_focus)}"
          data-auto-alpha="1"
          data-default-img="" 
          alt="${escapeHtml(r.title)}" 
        />
      </div>    
      ${showImageModeDebug ? `<div id="imageModeDebug" class="hint" style="margin-top:.45rem;">Bildmodus: pruefe...</div>` : ``}
    </div>
  `;
}

export function renderIngredientsSectionHtml({ r, recipes, partsByParent }) {
  const isMenu = (partsByParent.get(r.id)?.length ?? 0) > 0;

  return `
    <hr />

    <div class="row" style="justify-content:space-between; align-items:center;">
      <h3 style="margin:0;">Zutaten</h3>
      <button class="btn btn--ghost" id="addToShoppingBtn" type="button">🧺</button>
    </div>
    <div class="card" style="margin-top:.6rem;">
    ${
      isMenu
        ? buildMenuIngredients(r, recipes, partsByParent)
            .map(section => `
              <div style="margin-bottom:1rem;">
                <div class="muted" style="font-weight:800; margin-bottom:.25rem;">${escapeHtml(section.title)}</div>
                ${renderIngredientsHtml(section.items)}
              </div>
            `)
            .join("")
        : renderIngredientsHtml(r.ingredients ?? [])
    }
    </div>
  `;
}

export function renderStepsSectionHtml({ r, recipes, partsByParent }) {
  const isMenu = (partsByParent.get(r.id)?.length ?? 0) > 0;
  const stepSections = isMenu ? buildMenuStepSections(r, recipes, partsByParent) : [];

  return `
    <hr />

    <h3>Zubereitung</h3>
    ${
      isMenu
        ? `
          <div>
            ${stepSections
              .map(sec => `
                <div style="margin-top:.75rem;">
                  <div class="muted" style="font-weight:850; margin-bottom:.25rem;">${escapeHtml(sec.title)}</div>
                  ${sec.cards
                    .map((c, i) => `
                      <div class="card" style="margin-top:.45rem;">
                        <div style="font-weight:800;">${escapeHtml(formatStepCardTitle(c.title, i))}</div>
                        ${c.body.length ? `<div class="muted" style="margin-top:.35rem;">${escapeHtml(c.body.join(" "))}</div>` : ""}
                      </div>
                    `)
                    .join("")}
                </div>
              `)
              .join("")}
          </div>
        `
        : `
          <div>
            ${splitStepsToCards(r.steps ?? [])
              .map((c, i) => `
                <div class="card" style="margin-top:.6rem;">
                  <div style="font-weight:800;">${escapeHtml(formatStepCardTitle(c.title, i))}</div>
                  ${c.body.length ? `<div class="muted" style="margin-top:.35rem;">${escapeHtml(c.body.join(" "))}</div>` : ""}
                </div>
              `)
              .join("")}
          </div>
        `
    }
  `;
}
