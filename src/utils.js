// src/utils.js

/**
 * Shorthand for querySelector
 * @param {string} sel
 * @param {ParentNode} root
 */
export function qs(sel, root = document) {
  return root.querySelector(sel);
}

/**
 * Shorthand for querySelectorAll (array!)
 * @param {string} sel
 * @param {ParentNode} root
 */
export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
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
