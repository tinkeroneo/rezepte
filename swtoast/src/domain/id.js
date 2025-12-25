// src/domain/id.js
// Central ID generator (browser-safe). Use for recipes, timers, etc.

export function generateId(prefix = "") {
  const base =
    (globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`);

  return prefix ? `${prefix}${base}` : base;
}

export function ensureUniqueId(desiredId, taken) {
  // taken: Set<string> or Map<string, any>
  const has = (id) => (taken instanceof Map ? taken.has(id) : taken?.has?.(id));
  let id = String(desiredId || "").trim();
  if (!id || has(id)) {
    do {
      id = generateId("");
    } while (has(id));
  }
  return id;
}
