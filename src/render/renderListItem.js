import { escapeHtml, recipeImageOrDefault, recipeImageForCard } from "../utils.js";
import { isFavorite } from "../domain/favorites.js";

export function renderListItem(r, ctx) {
    const {
        catAccent,
        coverFallbackHtml,
        tagChip,
        pendingIds
    } = ctx;

    const isPending = r._pending || (pendingIds && pendingIds.has(r.id));

    return `
    <div class="list-item"
         data-id="${escapeHtml(r.id)}"
         data-category="${escapeHtml(r.category || "")}"
         style="--cat-accent:${catAccent(r.category)}">
      <div class="li-left">
        <div class="li-media">
          ${recipeImageOrDefault(r.image_url)
            ? `<img class="li-thumb" src="${escapeHtml(recipeImageForCard(r.image_url, "list"))}" data-default-img="${r.image_url ? "" : "1"}" alt="${escapeHtml(r.title)}" loading="lazy" decoding="async" fetchpriority="low" />`
            : coverFallbackHtml(r, "li-thumb li-thumb--empty")
        }

          ${isPending
            ? `<span class="pill pill-warn pending-overlay" title="Wartet auf Sync">⏳</span>`
            : ""
        }
        </div>

        <div class="li-body">
          <div class="li-title-row">
            <button
  class="fav-inline ${isFavorite(r.id) ? "is-fav" : ""}"
  data-fav="${escapeHtml(r.id)}"
  title="Favorit"
  type="button"
  aria-pressed="${isFavorite(r.id) ? "true" : "false"}"
>
  ★
</button>

            <div class="li-title">${escapeHtml(r.title)}</div>
          </div>

          <div class="li-sub">${escapeHtml([r.category, r.time].filter(Boolean).join(" · "))}</div>

          ${(Array.isArray(r.tags) && r.tags.length)
            ? `<div class="li-tags">${r.tags.slice(0, 3).map(tagChip).join("")}</div>`
            : ""
        }
        </div>
      </div>

      <div class="li-actions"><div class="li-chev" aria-hidden="true">›</div></div>
    </div>
  `;
}
