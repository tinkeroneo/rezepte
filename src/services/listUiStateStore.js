// src/services/listUiStateStore.js
import { lsGetStr, lsSetStr } from "../storage.js";

function parseArrayStr(raw) {
  try {
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => String(x || "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function loadListUiState({ KEYS, defaultDirFor }) {
  const viewMode = lsGetStr(KEYS.VIEWMODE, "grid");
  const cat = lsGetStr(KEYS.LIST_CAT, "");
  const tag = lsGetStr(KEYS.LIST_TAG, "");
  const catsRaw = parseArrayStr(lsGetStr(KEYS.LIST_CATS, "[]"));
  const tagsRaw = parseArrayStr(lsGetStr(KEYS.LIST_TAGS, "[]"));
  const cats = catsRaw.length ? catsRaw : (cat ? [cat] : []);
  const tags = tagsRaw.length ? tagsRaw : (tag ? [tag] : []);
  const sort = lsGetStr(KEYS.LIST_SORT, "new");

  let sortDir = lsGetStr(KEYS.LIST_SORT_DIR, "");
  if (sortDir !== "asc" && sortDir !== "desc") sortDir = defaultDirFor(sort);

  // extra filters open
  const extraRaw = lsGetStr(KEYS.LIST_EXTRA_OPEN, "");
  let extraOpen;
  if (extraRaw === "true") extraOpen = true;
  else if (extraRaw === "false") extraOpen = false;
  else extraOpen = !!(cats.length || tags.length);

  // pendingOnly
  const pendingRaw = lsGetStr(KEYS.LIST_PENDING_ONLY, "");
  const pendingOnly = pendingRaw === "true";

  return {
    viewMode,
    cat,
    tag,
    cats,
    tags,
    sort,
    sortDir,
    extraOpen,
    pendingOnly
  };
}

export function saveListUiState({ KEYS }, next) {
  if (!next) return;

  if (typeof next.viewMode === "string") lsSetStr(KEYS.VIEWMODE, next.viewMode);
  if (typeof next.cat === "string") lsSetStr(KEYS.LIST_CAT, next.cat);
  if (typeof next.tag === "string") lsSetStr(KEYS.LIST_TAG, next.tag);
  if (Array.isArray(next.cats)) lsSetStr(KEYS.LIST_CATS, JSON.stringify(next.cats));
  if (Array.isArray(next.tags)) lsSetStr(KEYS.LIST_TAGS, JSON.stringify(next.tags));
  if (typeof next.sort === "string") lsSetStr(KEYS.LIST_SORT, next.sort);
  if (typeof next.sortDir === "string") lsSetStr(KEYS.LIST_SORT_DIR, next.sortDir);

  if (typeof next.extraOpen === "boolean") {
    lsSetStr(KEYS.LIST_EXTRA_OPEN, next.extraOpen ? "true" : "false");
  }
  if (typeof next.pendingOnly === "boolean") {
    lsSetStr(KEYS.LIST_PENDING_ONLY, next.pendingOnly ? "true" : "false");
  }
}

export function patchListUiState({ KEYS }, patch) {
  saveListUiState({ KEYS }, patch);
}
