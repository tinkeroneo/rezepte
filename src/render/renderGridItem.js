import { escapeHtml } from "../utils.js";
import { isFavorite } from "../domain/favorites.js";

export function renderGridItem(r, ctx) {
  const {
    catAccent,
    coverFallbackHtml,
    pendingIds
  } = ctx;

  const isPending = r._pending || (pendingIds && pendingIds.has(r.id));

  return `
    <div class="grid-card" data-id="${escapeHtml(r.id)}" style="--cat-accent:${catAccent(r.category)}">
      <div class="grid-media">
        ${r.image_url
          ? `<img class="grid-img" src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.title)}" loading="lazy" />`
          : coverFallbackHtml(r, "grid-img")
        }

        <button class="fav-overlay ${isFavorite(r.id) ? "is-fav" : ""}"  data-fav="${escapeHtml(r.id)}"  title="Favorit"  type="button"  aria-pressed="${isFavorite(r.id) ? "true" : "false"}" >★</button>

        ${isPending
          ? `<span class="pill pill-warn pending-overlay" title="Wartet auf Sync">⏳</span>`
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
