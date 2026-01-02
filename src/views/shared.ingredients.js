import { escapeHtml } from "../utils.js";
import { isIngredientHeader } from "../domain/shopping.js";

export function renderIngredientsHtml(lines) {
  const out = [];
  for (const raw of (lines ?? [])) {
    const line = (raw ?? "").trim();
    if (!line) continue;

    if (isIngredientHeader(line)) {
      out.push(`<li class="muted" style="margin-top:.55rem; font-weight:750; list-style:none; padding-left:0;">${escapeHtml(line.replace(/:$/, ""))}</li>`);
    } else {
      out.push(`<li>${escapeHtml(line)}</li>`);
    }
  }
  return `<ul>${out.join("")}</ul>`;
}
