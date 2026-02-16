import { escapeHtml } from "../utils.js";
import { isIngredientHeader } from "../domain/shopping.js";

export function renderIngredientsHtml(lines, opts = {}) {
  const interactive = !!opts.interactive;
  const counter = interactive
    ? (opts.counter || { i: 0 })
    : null;
  const out = [];
  for (const raw of (lines ?? [])) {
    const line = (raw ?? "").trim();
    if (!line) continue;

    if (isIngredientHeader(line)) {
      out.push(`<li class="ingredient-header muted" style="margin-top:.55rem; font-weight:750; list-style:none; padding-left:0;">${escapeHtml(line.replace(/:$/, ""))}</li>`);
    } else {
      const idx = interactive ? counter.i++ : null;
      const cls = interactive ? ` class="ingredient-item"` : "";
      const data = interactive ? ` data-ing-idx="${idx}"` : "";
      out.push(`<li${cls}${data}>${escapeHtml(line)}</li>`);
    }
  }
  const ulClass = interactive ? ` class="ingredients-list is-interactive"` : "";
  return `<ul${ulClass}>${out.join("")}</ul>`;
}
