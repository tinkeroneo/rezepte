export const norm = (s) => (s ?? "").toString().trim().toLowerCase();

export function escapeHtml(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const qs = (root, sel) => (root ?? document).querySelector(sel);
export const qsa = (root, sel) => Array.from((root ?? document).querySelectorAll(sel));

export function safeJsonParse(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
