import { escapeHtml } from "../utils.js";
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
          ${r.image_url
            ? `<img class="li-thumb" src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.title)}" loading="lazy" />`
            : coverFallbackHtml(r, "li-thumb li-thumb--empty")
          }

          ${isPending
            ? `<span class="pill pill-warn pending-overlay" title="Wartet auf Sync">⏳</span>`
            : ""
          }
        </div>

        <div class="li-body">
          <div class="li-title-row">
            <button class="fav-inline" data-fav="${escapeHtml(r.id)}" title="Favorit" type="button">
              ${isFavorite(r.id) ? "★" : "☆"}
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
