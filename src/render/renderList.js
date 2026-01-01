import { qs } from "../utils.js";

function renderChunked(containerEl, items, renderHtml, { chunkSize = 60 } = {}) {
  containerEl.innerHTML = "";
  let i = 0;

  const pump = () => {
    const frag = document.createDocumentFragment();
    const end = Math.min(i + chunkSize, items.length);

    for (; i < end; i++) {
      const html = renderHtml(items[i]);
      if (!html) continue;
      const div = document.createElement("div");
      div.innerHTML = html;
      const node = div.firstElementChild;
      if (node) frag.appendChild(node);
    }

    containerEl.appendChild(frag);

    if (i < items.length) requestAnimationFrame(pump);
  };

  pump();
}

/**
 * @param {Object} p
 * @param {HTMLElement} p.resultsEl
 * @param {Array} p.filtered
 * @param {"grid"|"list"} p.viewMode
 * @param {boolean} p.useChunking
 * @param {(r:any)=>string} p.renderGridItemHtml
 * @param {(r:any)=>string} p.renderListItemHtml
 */
export function renderListResults({
  resultsEl,
  filtered,
  viewMode,
  useChunking,
  renderGridItemHtml,
  renderListItemHtml
}) {
  if (!resultsEl) return;

  if (viewMode === "grid") {
    if (!useChunking) {
      resultsEl.innerHTML = `
        <div class="grid">
          ${filtered.map(renderGridItemHtml).join("")}
        </div>
      `;
      return;
    }

    resultsEl.innerHTML = `<div class="grid" id="gridRoot"></div>`;
    const root = qs(resultsEl, "#gridRoot");
    renderChunked(root, filtered, renderGridItemHtml);
    return;
  }

  // list
  if (!useChunking) {
    resultsEl.innerHTML = `
      <div class="list">
        ${filtered.map(renderListItemHtml).join("")}
      </div>
    `;
    return;
  }

  resultsEl.innerHTML = `<div class="list" id="listRoot"></div>`;
  const root = qs(resultsEl, "#listRoot");
  renderChunked(root, filtered, renderListItemHtml);
}
