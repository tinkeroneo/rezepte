import { safeJsonParse } from "./utils.js";

// Storage scoping (privacy): isolate user data per user + space.
// Only some keys are scoped (recipes/shopping/favorites etc.).
// If scope is not set, we fall back to the raw key.

const SCOPED_KEYS = new Set([
  // user content
  "tinkeroneo_recipes_v1",
  "tinkeroneo_shopping_v1",
  "tinkeroneo_favorites_v1",
]);

let _scopePrefix = "";

export function setStorageScope({ userId, spaceId } = {}) {
  // If not authenticated/initialized, isolate to a special scope.
  const u = userId ? String(userId) : "unauth";
  const s = spaceId ? String(spaceId) : "nospace";
  _scopePrefix = `tinkeroneo_scope_v1::u=${u}::s=${s}::`;
}

function scopedKey(key) {
  const k = String(key);
  if (!_scopePrefix) return k;
  if (!SCOPED_KEYS.has(k)) return k;
  return _scopePrefix + k;
}

export const KEYS = {
  LOCAL_RECIPES: "tinkeroneo_recipes_v1",
  VIEWMODE: "tinkeroneo_viewmode_v1",
  SHOPPING: "tinkeroneo_shopping_v1",
  NAV: "tinkeroneo_nav_v1",
  LIST_SORT: "tinkeroneo_list_sort_v1",
  LIST_CAT: "tinkeroneo_list_cat_v1",
  LIST_TAG: "tinkeroneo_list_tag_v1",
  USE_BACKEND: "tinkeroneo_use_backend_v1",
  THEME: "tinkeroneo_theme_v1",
  WINTER: "tinkeroneo_winter_overlay_v1",
  CATEGORY_COLORS: "tinkeroneo_category_colors_v1",
  TAG_COLORS: "tinkeroneo_tag_colors_v1",
  FAVORITES: "tinkeroneo_favorites_v1",
  SELFTEST_HISTORY: "tinkeroneo_selftest_history_v1",
  TIMER_RING_INTERVAL_MS: "tinkeroneo_timer_ring_interval_ms_v1",
  TIMER_MAX_RING_SECONDS: "tinkeroneo_timer_max_ring_seconds_v1",
  TIMER_STEP_HIGHLIGHT: "tinkeroneo_timer_step_highlight_v1",
};

export function lsGet(key, fallback = null) {
  const raw = localStorage.getItem(scopedKey(key));
  if (raw === null) return fallback;
  return safeJsonParse(raw, fallback);
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(scopedKey(key), JSON.stringify(value));
  } catch {
    // ignore quota / privacy-mode errors
  }
}
export function lsGetStr(key, fallback = "") {
  const v = localStorage.getItem(scopedKey(key));
  return v === null ? fallback : v;
}

export function lsSetStr(key, value) {
  try {
    localStorage.setItem(scopedKey(key), String(value ?? ""));
  } catch {
    // ignore quota / privacy-mode errors
  }
}
