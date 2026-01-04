import { KEYS, lsGet, lsSet } from "../storage.js";

let _userId = null;
let _spaceId = null;

function key() {
  const u = _userId || "anon";
  const s = _spaceId || "nospace";
  return `${KEYS.OFFLINE_QUEUE}::${u}::${s}`;
}

export function setOfflineQueueScope({ userId, spaceId }) {
  _userId = userId || null;
  _spaceId = spaceId || null;
}

export function getOfflineQueue() {
  return lsGet(key(), []);
}

export function enqueueOfflineAction(action) {
  const q = getOfflineQueue();
  q.push({ ...action, ts: Date.now(), id: action.id || crypto.randomUUID() });
  lsSet(key(), q);
  return q.length;
}

export function clearOfflineQueue() {
  lsSet(key(), []);
}

export function dequeueOfflineAction(id) {
  const q = getOfflineQueue();
  const next = q.filter(x => x.id !== id);
  lsSet(key(), next);
  return next;
}

export function getPendingRecipeIds() {
  const q = getOfflineQueue();
  const ids = new Set();
  for (const a of q) {
    if (a.kind === "recipe_upsert" || a.kind === "recipe_delete") {
      if (a.recipeId) ids.add(a.recipeId);
    }
  }
  return ids;
}

// Keep only the latest recipe action per recipeId (dedup).
// Non-recipe actions are kept as-is in their original order.
export function compactOfflineQueue() {
  const q = getOfflineQueue();
  const keepOther = [];
  const byRecipe = new Map();

  for (const a of q) {
    if (a && (a.kind === "recipe_upsert" || a.kind === "recipe_delete") && a.recipeId) {
      const prev = byRecipe.get(a.recipeId);
      if (!prev || (a.ts ?? 0) >= (prev.ts ?? 0)) byRecipe.set(a.recipeId, a);
    } else {
      keepOther.push(a);
    }
  }

  const keepRecipe = Array.from(byRecipe.values()).sort((a, b) => (a?.ts ?? 0) - (b?.ts ?? 0));
  const next = [...keepOther, ...keepRecipe];
  lsSet(key(), next);
  return next;
}
