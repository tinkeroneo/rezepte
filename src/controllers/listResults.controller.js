// src/controllers/listResults.controller.js

/**
 * Bind delegated click handlers for list/grid results exactly once.
 *
 * Expected markup:
 * - Favorite buttons: [data-fav="<id>"]
 * - Item cards:      [data-id="<id>"]
 */
export function bindListResultsEvents({
  resultsEl,
  onToggleFavorite,
  onOpenRecipe
}) {
  if (!resultsEl) return;

  // prevent double wiring
  if (resultsEl.__listResultsWired) return;
  resultsEl.__listResultsWired = true;

  resultsEl.addEventListener("click", (ev) => {
    const fav = ev.target?.closest?.("[data-fav]");
    if (fav) {
      ev.preventDefault();
      ev.stopPropagation();
      const id = fav.getAttribute("data-fav");
      if (id) onToggleFavorite?.(id);
      return;
    }

    const card = ev.target?.closest?.("[data-id]");
    const id = card?.dataset?.id;
    if (id) onOpenRecipe?.(id);
  });
}
