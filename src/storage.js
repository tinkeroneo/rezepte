import { safeJsonParse } from "./utils.js";

export const KEYS = {
  LOCAL_RECIPES: "tinkeroneo_recipes_v1",
  VIEWMODE: "tinkeroneo_viewmode_v1",
  SHOPPING: "tinkeroneo_shopping_v1",
  NAV: "tinkeroneo_nav_v1",
  LIST_SORT: "tinkeroneo_list_sort_v1",
  LIST_SORT_DIR: "tinkeroneo_list_sort_dir_v1",
  LIST_CAT: "tinkeroneo_list_cat_v1",
  LIST_TAG: "tinkeroneo_list_tag_v1",
  OFFLINE_QUEUE: "tinkeroneo_offline_queue_v1",
  USE_BACKEND: "tinkeroneo_use_backend_v1",
  THEME: "tinkeroneo_theme_v1",
  WINTER: "tinkeroneo_winter_overlay_v1",
  RADIO_FEATURE: "tinkeroneo_radio_feature_v1",
  RADIO_CONSENT: "tinkeroneo_radio_consent_v1",
  CATEGORY_COLORS: "tinkeroneo_category_colors_v1",
  TAG_COLORS: "tinkeroneo_tag_colors_v1",
  FAVORITES: "tinkeroneo_favorites_v1",
  SELFTEST_HISTORY: "tinkeroneo_selftest_history_v1",
  TIMER_RING_INTERVAL_MS: "tinkeroneo_timer_ring_interval_ms_v1",
  TIMER_MAX_RING_SECONDS: "tinkeroneo_timer_max_ring_seconds_v1",
  TIMER_STEP_HIGHLIGHT: "tinkeroneo_timer_step_highlight_v1",
  TIMER_SOUND_ID: "tinkeroneo_timer_sound_id_v1",
  TIMER_SOUND_ENABLED: "tinkeroneo_timer_sound_enabled_v1",
  TIMER_SOUND_VOLUME: "tinkeroneo_timer_sound_volume_v1",
  LIST_EXTRA_OPEN: "list_extra_open",
LIST_PENDING_ONLY: "list_pending_only",

};

export function lsGet(key, fallback = null) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return safeJsonParse(raw, fallback);
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / privacy-mode errors
  }
}
export function lsGetStr(key, fallback = "") {
  const v = localStorage.getItem(key);
  return v === null ? fallback : v;
}

export function lsSetStr(key, value) {
  try {
    localStorage.setItem(key, String(value ?? ""));
  } catch {
    // ignore quota / privacy-mode errors
  }
}
