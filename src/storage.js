import { safeJsonParse } from "./utils.js";

export const KEYS = {
  LOCAL_RECIPES: "tinkeroneo_recipes_v1",
  VIEWMODE: "tinkeroneo_viewmode_v1",
  SHOPPING: "tinkeroneo_shopping_v1",
  NAV: "tinkeroneo_nav_v1",
  LIST_SORT: "tinkeroneo_list_sort_v1",
  LIST_CAT: "tinkeroneo_list_cat_v1",
  LIST_TAG: "tinkeroneo_list_tag_v1",
  USE_BACKEND: "tinkeroneo_use_backend_v1",
  ACTIVE_SPACE: "tinkeroneo_active_space_v1",
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


/* =========================
   STORAGE SCOPES (User/Space)
   - Prevent data leaks across users
   - Keep offline cache per user+space
========================= */

let _storageScope = { userId: null, spaceId: null };

// Keys that must be isolated by BOTH user + space
const SPACE_SCOPED_KEYS = new Set([
  KEYS.LOCAL_RECIPES,
  KEYS.SHOPPING,
  KEYS.FAVORITES,
]);

// Keys that must be isolated by user only
const USER_SCOPED_KEYS = new Set([
  KEYS.ACTIVE_SPACE,
]);

export function setStorageScope({ userId = null, spaceId = null } = {}) {
  _storageScope = { userId, spaceId };
}

function scopedKey(key) {
  // Avoid leaking across users/spaces by never using the bare key for scoped entries
  if (SPACE_SCOPED_KEYS.has(key)) {
    const u = _storageScope.userId || "anonymous";
    const s = _storageScope.spaceId || "nospace";
    return `${key}::u=${u}::s=${s}`;
  }
  if (USER_SCOPED_KEYS.has(key)) {
    const u = _storageScope.userId || "anonymous";
    return `${key}::u=${u}`;
  }
  return key;
}

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
