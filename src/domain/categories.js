import { KEYS, lsGet, lsSet } from "../storage.js";

// Local-only for now. Later: move to settings table / variants.
const KEY = KEYS.CATEGORY_COLORS || "tinkeroneo_category_colors_v1";

export function normalizeCategoryToken(s) {
  return String(s || "").trim();
}

export function getCategoryColors() {
  return lsGet(KEY, {});
}

function hashString(text) {
  let hash = 0;
  const input = String(text || "");
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function hslToHex(h, s, l) {
  const hue = ((Number(h) % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, Number(s))) / 100;
  const light = Math.max(0, Math.min(100, Number(l))) / 100;

  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - chroma / 2;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) [red, green, blue] = [chroma, x, 0];
  else if (hue < 120) [red, green, blue] = [x, chroma, 0];
  else if (hue < 180) [red, green, blue] = [0, chroma, x];
  else if (hue < 240) [red, green, blue] = [0, x, chroma];
  else if (hue < 300) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];

  const toHex = (value) => Math.round((value + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

export function deriveCategoryColor(cat) {
  const token = normalizeCategoryToken(cat).toLowerCase();
  if (!token) return "#d9e8df";

  const hash = hashString(token);
  const hue = (hash * 137.508) % 360;
  const saturation = 56 + (hash % 10);
  const lightness = 74 + ((hash >> 3) % 8);
  return hslToHex(hue, saturation, lightness);
}

export function setCategoryColor(cat, color) {
  const key = normalizeCategoryToken(cat);
  if (!key) return;
  const map = getCategoryColors();
  map[key] = String(color || "").trim() || "#d9e8df";
  lsSet(KEY, map);
}

export function removeCategoryColor(cat) {
  const key = normalizeCategoryToken(cat);
  if (!key) return;
  const map = getCategoryColors();
  if (!Object.prototype.hasOwnProperty.call(map, key)) return;
  delete map[key];
  lsSet(KEY, map);
}

export function getColorForCategory(categoryStr) {
  const map = getCategoryColors();
  const token = normalizeCategoryToken(String(categoryStr || "").split("/")[0]);
  return map[token] || deriveCategoryColor(token);
}
