// src/domain/listQuery.js
import { norm } from "../utils.js";
import { buildCookStatsByRecipeId } from "./cooklog.js";

/**
 * Parse human time strings into minutes.
 * Examples:
 *  - "10 Minuten", "45 min", "1 h", "1h 20m", "1 Std 10 Min", "15"
 */
export function parseMinutes(timeStr) {
  const s = String(timeStr ?? "").toLowerCase();

  let min = 0;

  // hours
  const h = s.match(/(\d+)\s*(h|std|stunde|stunden)/);
  if (h) min += parseInt(h[1], 10) * 60;

  // minutes
  const m = s.match(/(\d+)\s*(m|min|minute|minuten)/);
  if (m) min += parseInt(m[1], 10);

  // fallback: only number
  if (!h && !m) {
    const n = s.match(/(\d+)/);
    if (n) min += parseInt(n[1], 10);
  }

  return Number.isFinite(min) ? min : 0;
}

/**
 * Normalize titles for A-Z sorting, removing emojis/pictographs so they don't dominate.
 */
export function sortTitle(v) {
  const s = String(v ?? "");
  try {
    return s
      .replace(/\p{Extended_Pictographic}/gu, "")
      .replace(/\u200D/g, "")
      .replace(/\uFE0F/g, "")
      .trim()
      .toLowerCase();
  } catch {
    // Fallback for older JS engines
    return s.replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim().toLowerCase();
  }
}

/**
 * Apply list filters + sorting.
 *
 * @param {Object} args
 * @param {Array} args.recipes
 * @param {string} [args.query]
 * @param {string} [args.cat]
 * @param {string} [args.tag]
 * @param {"new"|"az"|"time"|"lastCooked"|"bestRated"} [args.sort]
 * @param {"asc"|"desc"} [args.sortDir]
 * @param {boolean} [args.pendingOnly]
 * @param {Set<string>} [args.pendingIds]
 *
 * @returns {Array} filtered & sorted recipes
 */
export function applyListQuery({
  recipes,
  query = "",
  cat = "",
  tag = "",
  cats = [],
  tags = [],
  sort = "new",
  sortDir = "desc",
  pendingOnly = false,
  pendingIds = new Set()
}) {
  const listIn = Array.isArray(recipes) ? recipes : [];
  const qq = norm(query);
  const catList = Array.isArray(cats) && cats.length
    ? cats
    : (cat ? [cat] : []);
  const tagList = Array.isArray(tags) && tags.length
    ? tags
    : (tag ? [tag] : []);

  // 1) filter
  let list = listIn.filter((r) => {
    if (pendingOnly && !pendingIds.has(r.id)) return false;

    if (catList.length) {
      const rc = String(r.category ?? "");
      if (!catList.includes(rc)) return false;
    }

    if (tagList.length) {
      const rt = Array.isArray(r.tags) ? r.tags : [];
      // OR within selected tags: recipe must contain at least one selected tag
      if (!tagList.some((t) => rt.includes(t))) return false;
    }

    if (!qq) return true;

    const hay = [
      r.title,
      r.category,
      r.time,
      r.source,
      ...(Array.isArray(r.tags) ? r.tags : []),
      ...(r.ingredients ?? []),
      ...(r.steps ?? [])
    ]
      .map(norm)
      .join(" ");

    return hay.includes(qq);
  });

  // Stats only need IDs of current list
  const stats = buildCookStatsByRecipeId(list.map((r) => r.id));

  // 2) sort
  const dir = sortDir === "asc" ? 1 : -1;

  if (sort === "az") {
    list.sort((a, b) => dir * sortTitle(a.title).localeCompare(sortTitle(b.title), "de"));
  } else if (sort === "time") {
    list.sort((a, b) => dir * (parseMinutes(a.time) - parseMinutes(b.time)));
  } else if (sort === "lastCooked") {
    list.sort((a, b) => dir * ((stats.get(a.id)?.lastAt ?? 0) - (stats.get(b.id)?.lastAt ?? 0)));
  } else if (sort === "bestRated") {
    // avg: default -1 so unrated are stable at one end depending on direction
    list.sort((a, b) => dir * ((stats.get(a.id)?.avg ?? -1) - (stats.get(b.id)?.avg ?? -1)));
  } else {
    // "new" (createdAt)
    list.sort((a, b) => dir * ((a.createdAt ?? 0) - (b.createdAt ?? 0)));
  }

  return list;
}

/**
 * Default sort direction per field (matches your list.view logic).
 */
export function defaultDirFor(sort) {
  if (sort === "az") return "asc";
  if (sort === "time") return "asc";
  if (sort === "bestRated") return "desc";
  if (sort === "lastCooked") return "desc";
  return "desc"; // "new"
}
