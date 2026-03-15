// src/views/detail.view.js
import { recipeImageOrDefault } from "../utils.js";

import { getLastCooked, getAvgRating, getRatingCount } from "../domain/cooklog.js";
import {
  ensureCooklogPulledOnce,
  renderCooklogCardHtml,
  bindCooklogCard
} from "./detail/detail.cooklog.js";


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

// Optional: vorbereitet für Dirty-Guard (Caller kann diese Props später reinreichen)
// -> bleibt komplett rückwärtskompatibel
import { createDirtyTracker } from "../ui/dirtyTracker.js";
import { analyzeRenderedImageTransparency, bindManagedRecipeImages } from "../services/recipeImagePresentation.js";

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
  addRecipePart,
  removeRecipePart,
  rebuildPartsIndexSetter,

  mySpaces,
  copyRecipeToSpace,
  createRecipeShare,

  sbDelete,

  // optional (nicht zwingend vorhanden)
  setDirtyGuard,
  setDirtyIndicator,
  setViewCleanup,
}) {
  const settings = window.__tinkeroneoSettings || {};
  const showImageModeDebug = !!settings.readImageModeDebug?.();
  const r = recipes.find(x => x.id === state.selectedId);
  if (!r) {
    setView({ name: "list", selectedId: null, q: state.q }, { push: false });
    return;
  }

  // Ensure detail view always starts at the top, regardless of previous view scroll.
  const resetScrollTop = () => {
    try { window.scrollTo(0, 0); } catch { /* ignore */ }
    try { document.documentElement.scrollTop = 0; } catch { /* ignore */ }
    try { document.body.scrollTop = 0; } catch { /* ignore */ }
    try { appEl.scrollTop = 0; } catch { /* ignore */ }
  };
  resetScrollTop();

  const writable = canWrite === true;

  // Pull cooklog once, then refresh current view (push:false to avoid history spam)
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
      ${renderDetailHeaderHtml({ r, canWrite: writable })}
      ${renderDetailImageHtml({ r, showImageModeDebug })}
      ${renderIngredientsSectionHtml({ r, recipes, partsByParent })}
      ${renderStepsSectionHtml({ r, recipes, partsByParent })}
      ${renderCooklogCardHtml({ recipeId: r.id, lastStr, avgLabel, avgCount, canWrite: writable })}
      ${renderChildrenSectionHtml({ parentId: r.id, children, canWrite: writable })}
      <div id="sheetRoot"></div>
    </div>
  `;
  window.requestAnimationFrame(() => resetScrollTop());
  const cleanupManagedImages = bindManagedRecipeImages({ root: appEl, observeMutations: false });
  let cleanupImageModeDebug = null;

  if (showImageModeDebug) {
    const imgEl = appEl.querySelector("#detailImg");
    const debugEl = appEl.querySelector("#imageModeDebug");
    const updateImageModeDebug = async () => {
      if (!imgEl || !debugEl) return;
      const mode = String(imgEl.dataset.imageModeEffective || r?.image_focus?.mode || "auto");
      const analysis = await analyzeRenderedImageTransparency(imgEl);
      if (!analysis?.ok) {
        debugEl.textContent = `Bildmodus: ${mode} | Alpha-Check: ${String(analysis?.reason || "unbekannt")}`;
        return;
      }

      const percent = (value) => `${Math.round(Number(value || 0) * 100)}%`;
      const bounds = analysis.bounds
        ? `${percent(analysis.bounds.width)} x ${percent(analysis.bounds.height)}`
        : "-";
      debugEl.textContent =
        `Bildmodus: ${mode} | Alpha-Check: ${analysis.candidate ? "ja" : "nein"} (${analysis.reason}) | transparent=${percent(analysis.transparentRatio)} | leer=${percent(analysis.emptyRatio)} | bounds=${bounds}`;
    };

    imgEl?.addEventListener("tinkeroneo:image-mode", updateImageModeDebug);
    window.setTimeout(updateImageModeDebug, 0);
    cleanupImageModeDebug = () => {
      imgEl?.removeEventListener("tinkeroneo:image-mode", updateImageModeDebug);
    };
  }

  // Optionaler Dirty-Tracker (aktuell wird hier nichts "halbfertig" editiert,
  // aber wir sind vorbereitet, falls du z.B. Fokusänderungen erst "Apply"en willst).
  // Solange niemand dirty.markDirty() triggert, macht er nix.
  createDirtyTracker({
    setDirtyGuard,
    setDirtyIndicator,
    setViewCleanup,
    beforeUnloadKey: "__tinkeroneo_beforeunload_detail",
    onCleanup: () => {
      cleanupImageModeDebug?.();
      cleanupManagedImages?.();
    },
  });



  // --- actions (intern nutzt canWrite)
  bindDetailActions({
    appEl,
    recipe: r,
    state,
    setView,

    // neu: getrennte Fähigkeiten
    canWrite: writable,   // edit/delete/etc.
    canShop: true,        // 🛒 immer erlaubt

    addToShopping,
    recipes,
    partsByParent,
    createRecipeShare
  });


  // image click always ok (read-only allowed)
  bindDetailImageClick({ appEl, imageUrl: recipeImageOrDefault(r.image_url) });

  // cooklog is view-only / refresh
  bindCooklogCard({
    appEl,
    recipeId: r.id,
    useBackend,
    canWrite: writable,
    onRefresh: () => setView({ name: "detail", selectedId: r.id, q: state.q }, { push: false })
  });

  // --- write actions: nur binden wenn writable (reduziert Risiko & Overhead)
  // copy or move to another space — always allowed, even read-only
  bindCopyToSpace({
    appEl,
    useBackend,
    mySpaces,
    recipe: r,
    canWrite: writable,     // kannst du so lassen oder immer true setzen, je nach UI
    copyRecipeToSpace,
    onAfterCopy: () => { }
  });

  // write actions: nur binden wenn writable
  if (writable) {
    bindChildrenSection({
      appEl,
      canWrite: writable,
      parentId: r.id,
      state,
      setView,

      recipes,
      childrenIds: children?.map(x => x.id) || [],

      addRecipePart,
      removeRecipePart,
      rebuildPartsIndexSetter,
      refreshAll
    });


    bindDeleteRecipe({
      appEl,
      recipe: r,
      canWrite: writable,
      useBackend,
      sbDelete,
      refreshAll,
      setView,
      state
    });
  }

}
