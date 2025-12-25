import { KEYS, lsGet, lsSet } from "../storage.js";

export function getFavoritesMap() {
  const v = lsGet(KEYS.FAVORITES, {});
  return (v && typeof v === "object") ? v : {};
}

export function isFavorite(id) {
  const m = getFavoritesMap();
  return !!m[id];
}

export function toggleFavorite(id) {
  const m = getFavoritesMap();
  if (m[id]) delete m[id];
  else m[id] = true;
  lsSet(KEYS.FAVORITES, m);
  return !!m[id];
}
