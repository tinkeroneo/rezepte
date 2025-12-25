import { KEYS, lsGet, lsSet } from "../storage.js";

export function getTagColors() {
  const v = lsGet(KEYS.TAG_COLORS, {});
  return (v && typeof v === "object") ? v : {};
}

export function setTagColor(tag, color) {
  const m = getTagColors();
  if (!tag) return m;
  if (!color) delete m[tag];
  else m[tag] = color;
  lsSet(KEYS.TAG_COLORS, m);
  return m;
}

export function getTagColor(tag) {
  const m = getTagColors();
  return m[tag];
}