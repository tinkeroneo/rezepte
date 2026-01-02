// src/views/detail.view.js
import { qs } from "../utils.js";
import { ack } from "../ui/feedback.js";

import { getLastCooked, getAvgRating, getRatingCount } from "../domain/cooklog.js";
import {
  ensureCooklogPulledOnce,
  renderCooklogCardHtml,
  bindCooklogCard
} from "./detail/detail.cooklog.js";

import {
  applyFocusToImg,
  bindImageFocusPanel,
  normalizeFocus
} from "./detail/detail.focus.js";

import { renderChildrenSectionHtml, bindChildrenSection } from "./detail/detail.parts.js";
import { bindCopyToSpace } from "./detail/detail.spaceCopy.js";
import { bindDeleteRecipe } from "./detail/detail.delete.js";
import { bindDetailActions, bindDetailImageClick } from "./detail/detail.actions.js";

import {
  buildChildrenFromIndex,
  renderDetailHeaderHtml,
  renderDetailImageHtml,
  renderIngredientsSectionHtml,
  renderStepsSectionHtml
} from "./detail/detail.templates.js";

export function renderDetailView({
  appEl,
  state,
  recipes,
  partsByParent,
  setView,
  canWrite,
  useBackend,

  onUpdateRecipe,
  addToShopping,

  refreshAll,
  removeRecipePart,
  rebuildPartsIndexSetter,

  mySpaces,
  copyRecipeToSpace,

  sbDelete
}) {
  const r = recipes.find(x => x.id === state.selectedId);
  if (!r) {
    setView({ name: "list", selectedId: null, q: state.q }, { push: false });
    return;
  }

  ensureCooklogPulledOnce({
    recipeId: r.id,
    onPulled: () => setView({ name: "detail", selectedId: r.id, q: state.q }, { push: false })
  });

  const last = getLastCooked(r.id);
  const avg = getAvgRating(r.id);
  const avgCount = getRatingCount(r.id);
  const avgLabel = avg ? avg.toFixed(1) : "—";
  const lastStr = last
    ? new Date(last.at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })
    : "—";

  const children = buildChildrenFromIndex({ recipeId: r.id, recipes, partsByParent });

  appEl.innerHTML = `
    <div class="container">
      ${renderDetailHeaderHtml({ r, canWrite })}
      ${renderDetailImageHtml({ r })}
      ${renderIngredientsSectionHtml({ r, recipes, partsByParent })}
      ${renderStepsSectionHtml({ r, recipes, partsByParent })}
      ${renderCooklogCardHtml({ recipeId: r.id, lastStr, avgLabel, avgCount })}
      ${renderChildrenSectionHtml({ children, canWrite })}
      <div id="sheetRoot"></div>
    </div>
  `;

  // focus
  const img = qs(appEl, "#detailImg");
  if (img) {
    applyFocusToImg(img, r.image_focus);

    const panel = qs(appEl, "#imgFocusPanel");
    if (panel) panel.style.display = canWrite ? "" : "none";

    bindImageFocusPanel({
      appEl,
      imgEl: img,
      initialFocus: r.image_focus,
      onSaveFocus: async (nextFocus) => {
        if (!canWrite) return;
        if (typeof onUpdateRecipe !== "function") return;
        await onUpdateRecipe({ ...r, image_focus: normalizeFocus(nextFocus) });
      },
      ack
    });
  }

  // actions
  bindDetailActions({
    appEl,
    recipe: r,
    state,
    setView,
    canWrite,
    addToShopping,
    recipes,
    partsByParent
  });

  bindDetailImageClick({ appEl, imageUrl: r.image_url });

  bindCooklogCard({
    appEl,
    recipeId: r.id,
    useBackend,
    onRefresh: () => setView({ name: "detail", selectedId: r.id, q: state.q }, { push: false })
  });

  bindChildrenSection({
    appEl,
    canWrite,
    parentId: r.id,
    state,
    setView,
    removeRecipePart,
    rebuildPartsIndexSetter,
    refreshAll
  });

  bindCopyToSpace({
    appEl,
    useBackend,
    mySpaces,
    recipe: r,
    canWrite,
    copyRecipeToSpace,
    onAfterCopy: () => {}
  });

  bindDeleteRecipe({
    appEl,
    recipe: r,
    canWrite,
    useBackend,
    sbDelete,
    refreshAll,
    setView,
    state
  });
}
