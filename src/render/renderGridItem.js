import { escapeHtml, recipeImageOrDefault, recipeImageForCard } from "../utils.js";
import { isFavorite } from "../domain/favorites.js";

export function renderGridItem(r, ctx) {
  const { catAccent, coverFallbackHtml, pendingIds } = ctx;

  const isPending = r._pending || (pendingIds && pendingIds.has(r.id));
  const isTodo = Array.isArray(r.tags) && r.tags.some((t) => String(t || "").trim().toLowerCase() === "todo");

  return `
    <div class="grid-card" data-id="${escapeHtml(r.id)}" style="--cat-accent:${catAccent(r.category)}">
      <div class="grid-media">
        ${recipeImageOrDefault(r.image_url)
          ? `<img class="grid-img" src="${escapeHtml(recipeImageForCard(r.image_url, "grid"))}" data-default-img="${r.image_url ? "" : "1"}" alt="${escapeHtml(r.title)}" loading="lazy" decoding="async" fetchpriority="low" />`
          : coverFallbackHtml(r, "grid-img")
        }
        ${isTodo ? `<span class="todo-ribbon" aria-hidden="true">ToDo</span>` : ``}

        <button class="fav-overlay ${isFavorite(r.id) ? "is-fav" : ""}" data-fav="${escapeHtml(r.id)}" title="Favorit" type="button" aria-pressed="${isFavorite(r.id) ? "true" : "false"}">?</button>

        ${isPending
          ? `<span class="pill pill-warn pending-overlay" title="Wartet auf Sync">?</span>`
          : ""
        }
      </div>

      <div class="grid-body">
        <div class="grid-title"><span>${escapeHtml(r.title)}</span></div>
        <div class="grid-meta">
          ${r.category ? `<span class="pill">${escapeHtml(r.category)}</span>` : ""}
          ${r.time ? `<span class="pill pill-ghost">${escapeHtml(r.time)}</span>` : ""}
        </div>
      </div>
    </div>
  `;
}
