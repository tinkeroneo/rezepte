import { safeJsonParse } from "./utils.js";

export const KEYS = {
  LOCAL_RECIPES: "tinkeroneo_recipes_v1",
  VIEWMODE: "tinkeroneo_viewmode_v1",
  SHOPPING: "tinkeroneo_shopping_v1",
  NAV: "tinkeroneo_nav_v1",
  LIST_SORT: "tinkeroneo_list_sort_v1",
  LIST_CAT: "tinkeroneo_list_cat_v1",
};

export function lsGet(key, fallback = null) {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
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
  return v == null ? fallback : v;
}

export function lsSetStr(key, value) {
  try {
    localStorage.setItem(key, String(value ?? ""));
  } catch {
    // ignore quota / privacy-mode errors
  }
}
