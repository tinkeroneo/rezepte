import { KEYS, lsGet, lsSet } from "../storage.js";

// Local-only for now. Later: move to settings table / variants.
const KEY = KEYS.CATEGORY_COLORS || "tinkeroneo_category_colors_v1";

export function normalizeCategoryToken(s) {
  return String(s || "").trim();
}

export function getCategoryColors() {
  return lsGet(KEY, {});
}

export function setCategoryColor(cat, color) {
  const key = normalizeCategoryToken(cat);
  if (!key) return;
  const map = getCategoryColors();
  map[key] = String(color || "").trim() || "#d9e8df";
  lsSet(KEY, map);
}

export function getColorForCategory(categoryStr) {
  const map = getCategoryColors();
  const token = normalizeCategoryToken(String(categoryStr || "").split("/")[0]);
  return map[token] || null;
}
