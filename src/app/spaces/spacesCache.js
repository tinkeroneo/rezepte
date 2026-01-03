// src/app/spaces/spacesCache.js
// Cache 'mySpaces' per-user to avoid permission flicker on refresh/offline/transient errors.

function keyFor(userId) {
  const uid = String(userId || "").trim();
  return `tinkeroneo:mySpaces:${uid || "anon"}`;
}

export function readSpacesCache(userId) {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSpacesCache(userId, spaces) {
  try {
    if (!Array.isArray(spaces)) return;
    localStorage.setItem(keyFor(userId), JSON.stringify(spaces));
  } catch {
    /* ignore */
  }
}
