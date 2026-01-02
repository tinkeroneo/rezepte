// src/views/detail/detail.actions.js
import { qs } from "../../utils.js";
import { ack } from "../../ui/feedback.js";

export function bindDetailActions({
  appEl,
  recipe,
  state,
  setView,
  canWrite,
  addToShopping,
  recipes,
  partsByParent
}) {
  // Kochen
  qs(appEl, "#cookBtn")?.addEventListener("click", () => {
    setView({ name: "cook", selectedId: recipe.id, q: state.q });
  });

  // Bearbeiten
  qs(appEl, "#editBtn")?.addEventListener("click", () => {
    if (!canWrite) return;
    setView({ name: "add", selectedId: recipe.id, q: state.q });
  });

  // Link kopieren (Cook Deep-Link)
  qs(appEl, "#copyCookLinkBtn")?.addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}#cook:${encodeURIComponent(recipe.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      ack(qs(appEl, "#copyCookLinkBtn"));
    } catch {
      prompt("Link kopieren:", url);
    }
  });

  // Einkaufsliste
  qs(appEl, "#addToShoppingBtn")?.addEventListener("click", () => {
    addToShopping?.(recipe, { recipes, partsByParent });
    ack(qs(appEl, "#addToShoppingBtn"));
  });
}

export function bindDetailImageClick({ appEl, imageUrl }) {
  const img = qs(appEl, "#detailImg");
  if (!img || !imageUrl) return;

  img.addEventListener("click", () => {
    try {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    } catch {
      /* ignore */
    }
  });
}
