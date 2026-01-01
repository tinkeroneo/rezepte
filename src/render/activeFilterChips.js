// src/render/activeFilterChips.js
import { escapeHtml } from "../utils.js";

export function renderActiveFilterChips({ ui }) {
  const chips = [];

  if (ui.q && String(ui.q).trim()) chips.push(chip("q", `Suche: ${ui.q}`));
  if (ui.cat) chips.push(chip("cat", `Kategorie: ${ui.cat}`));
  if (ui.tag) chips.push(chip("tag", `Tag: ${ui.tag}`));
  if (ui.pendingOnly) chips.push(chip("pendingOnly", "⏳ Nur offene"));

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
        <span aria-hidden="true">×</span>
      </button>
    `;
  }
}
