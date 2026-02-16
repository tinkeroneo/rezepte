// src/render/activeFilterChips.js
import { escapeHtml } from "../utils.js";

export function renderActiveFilterChips({ ui }) {
  const chips = [];
  const cats = Array.isArray(ui.cats) ? ui.cats : (ui.cat ? [ui.cat] : []);
  const tags = Array.isArray(ui.tags) ? ui.tags : (ui.tag ? [ui.tag] : []);

  if (ui.q && String(ui.q).trim()) chips.push(chip("q", `Suche: ${ui.q}`));
  cats.forEach((c) => chips.push(chip(`cat:${c}`, `Kategorie: ${c}`)));
  tags.forEach((t) => chips.push(chip(`tag:${t}`, `Tag: ${t}`)));
  if (ui.pendingOnly) chips.push(chip("pendingOnly", "Nur offene"));

  if (ui.sort && ui.sort !== "new") {
    const labelMap = {
      az: "Name",
      time: "Kochdauer",
      lastCooked: "Zuletzt gekocht",
      bestRated: "Bewertung"
    };
    const dir = ui.sortDir === "asc" ? "↑" : "↓";
    chips.push(chip("sort", `Sort: ${labelMap[ui.sort] || ui.sort} ${dir}`));
  }

  return chips.length ? chips.join("") : "";

  function chip(key, label) {
    return `
      <button class="chip" type="button" data-chip="${escapeHtml(key)}" title="Entfernen">
        <span>${escapeHtml(label)}</span>
        <span aria-hidden="true">&times;</span>
      </button>
    `;
  }
}
