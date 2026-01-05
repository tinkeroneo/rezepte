// src/utils.js

function isDomRoot(x) {
  return x && typeof x.querySelector === "function";
}
export function recipeImageOrDefault(imageUrl) {
  if (imageUrl && String(imageUrl).trim()) return imageUrl;

  return defaultRecipeImageUrl();
}

function isDarkThemeForDefaults() {
  const t = (document.documentElement?.dataset?.theme || "").toLowerCase();
  // dataset wins (prevents "sticky" dark when a class is left behind)
  if (t === "dark") return true;
  if (t === "light") return false;
  return document.documentElement?.classList?.contains("dark") ||
    document.body?.classList?.contains("dark") ||
    false;
}

export function defaultRecipeImageUrl() {
  return isDarkThemeForDefaults() ? "/faviconDark.svg" : "/favicon.svg";
}

// Replaces already-rendered fallback images after a theme switch.
// Relies on the markup: <img data-default-img="1" ...>
export function refreshDefaultRecipeImages(root = document) {
  const next = defaultRecipeImageUrl();
  root.querySelectorAll('img[data-default-img="1"]').forEach((img) => {
    // Always set; browsers won't update unless src changes.
    img.setAttribute("src", next);
  });
}

function normalizeArgs(a, b) {
  // Standard: (selector, root)
  // Unterstützt auch: (root, selector)
  // und: (selector) oder (root) -> sinnvoller Fallback
  if (typeof a === "string") {
    const selector = a;
    const root = isDomRoot(b) ? b : document;
    return { selector, root };
  }

  if (isDomRoot(a) && typeof b === "string") {
    return { selector: b, root: a };
  }

  // Falls komplett falsch genutzt:
  // - a ist root -> selector fehlt -> leere Auswahl
  // - a ist irgendwas -> fallback
  return { selector: null, root: document };
}

/**
 * querySelector helper (robust, supports arg order)
 * Usage:
 *   qs(".x")                 -> document.querySelector(".x")
 *   qs(".x", rootEl)         -> rootEl.querySelector(".x")
 *   qs(rootEl, ".x")         -> rootEl.querySelector(".x")  (supported)
 */
export function qs(a, b) {
  const { selector, root } = normalizeArgs(a, b);
  if (!selector) return null;
  return root.querySelector(selector);
}

/**
 * querySelectorAll helper (array!, robust, supports arg order)
 */
export function qsa(a, b) {
  const { selector, root } = normalizeArgs(a, b);
  if (!selector) return [];
  return Array.from(root.querySelectorAll(selector));
}

/**
 * Escapes HTML special chars to prevent injection.
 */
export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Format seconds as mm:ss
 * Example: 125 -> "02:05"
 */
export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/**
 * Safely parse JSON with fallback.
 * Never throws.
 */
export function safeJsonParse(raw, fallback = null) {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Normalize string for comparisons / search:
 * - lowercase
 * - trim
 * - remove diacritics (ä -> a, é -> e, etc.)
 */
export function norm(str) {
  return String(str ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
