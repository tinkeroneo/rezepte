// src/domain/cooklog.js
import { listCookEventsSb, upsertCookEventSb, deleteCookEventSb } from "../supabase.js";
const COOKLOG_KEY = "tinkeroneo_cooklog_v1";

/**
 * Shape:
 * {
 *   [recipeId]: [{ id:string, at:number(ms), rating?:number, note?:string }]
 * }
 */

function uid() {
  return (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

export function loadCookLog() {
  try {
    return JSON.parse(localStorage.getItem(COOKLOG_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

export function saveCookLog(db) {
  localStorage.setItem(COOKLOG_KEY, JSON.stringify(db || {}));
}

export function listCookEvents(recipeId) {
  const db = loadCookLog();
  const arr = Array.isArray(db[recipeId]) ? db[recipeId] : [];
  return arr.slice().sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
}

export function addCookEvent(recipeId, { at = Date.now(), rating = null, note = "" } = {}) {
  if (!recipeId) return null;

  const db = loadCookLog();
  const arr = Array.isArray(db[recipeId]) ? db[recipeId] : [];

  const ev = {
    id: uid(),
    at,
    ...(Number.isFinite(rating) && rating ? { rating } : {}),
    ...(note && String(note).trim() ? { note: String(note).trim() } : {}),
  };

  arr.push(ev);
  db[recipeId] = arr;
  saveCookLog(db);
  return ev;
}

export function updateCookEvent(recipeId, eventId, patch = {}) {
  if (!recipeId || !eventId) return false;
  const db = loadCookLog();
  const arr = Array.isArray(db[recipeId]) ? db[recipeId] : [];
  const idx = arr.findIndex(x => x?.id === eventId);
  if (idx < 0) return false;

  const cur = arr[idx] || {};
  const next = {
    ...cur,
    ...patch,
    id: cur.id,
    at: Number.isFinite(patch.at) ? patch.at : cur.at,
  };

  // normalize
  if (!(Number.isFinite(next.rating) && next.rating >= 1 && next.rating <= 5)) delete next.rating;
  if (!String(next.note ?? "").trim()) delete next.note;

  arr[idx] = next;
  db[recipeId] = arr;
  saveCookLog(db);
  return true;
}

export function deleteCookEvent(recipeId, eventId) {
  if (!recipeId || !eventId) return false;
  const db = loadCookLog();
  const arr = Array.isArray(db[recipeId]) ? db[recipeId] : [];
  const next = arr.filter(x => x?.id !== eventId);
  db[recipeId] = next;
  saveCookLog(db);
  return next.length !== arr.length;
}

export function getLastCooked(recipeId) {
  const arr = listCookEvents(recipeId);
  return arr.length ? arr[0] : null;
}

export function getAvgRating(recipeId) {
  const arr = listCookEvents(recipeId);
  const ratings = arr.map(x => x?.rating).filter(x => Number.isFinite(x) && x >= 1 && x <= 5);
  if (!ratings.length) return null;
  const sum = ratings.reduce((a, b) => a + b, 0);
  return sum / ratings.length;
}

export function getRatingCount(recipeId) {
  const arr = listCookEvents(recipeId);
  return arr.map(x => x?.rating).filter(x => Number.isFinite(x) && x >= 1 && x <= 5).length;
}

/** Quick lookup maps for list sorting */
export function buildCookStatsByRecipeId(recipeIds = []) {
  const db = loadCookLog();
  const out = new Map();

  for (const id of recipeIds) {
    const arr = Array.isArray(db[id]) ? db[id] : [];
    let lastAt = null;
    let sum = 0;
    let cnt = 0;

    for (const ev of arr) {
      if (Number.isFinite(ev?.at)) lastAt = Math.max(lastAt ?? 0, ev.at);
      const r = ev?.rating;
      if (Number.isFinite(r) && r >= 1 && r <= 5) { sum += r; cnt += 1; }
    }

    out.set(id, {
      lastAt: lastAt ?? null,
      avg: cnt ? (sum / cnt) : null,
      cnt,
    });
  }

  return out;
}
// --- Supabase sync (client_id scoped) ---

export async function pullCookEventsFromBackend(recipeId) {
  const rows = await listCookEventsSb(recipeId);
  const db = loadCookLog();

  db[recipeId] = (rows || []).map(r => ({
    id: r.id,
    at: new Date(r.at).getTime(),
    ...(Number.isFinite(r.rating) ? { rating: r.rating } : {}),
    ...(r.note ? { note: r.note } : {}),
  }));

  saveCookLog(db);
  return db[recipeId];
}

export async function pushCookEventToBackend(recipeId, ev) {
  // ev is local shape {id, at(ms), rating?, note?}
  if (!ev?.id) return;

  await upsertCookEventSb({
    id: ev.id,
    recipe_id: recipeId,
    at: new Date(ev.at).toISOString(),
    rating: ev.rating ?? null,
    note: ev.note ?? null,
  });
}

export async function removeCookEventFromBackend(eventId) {
  if (!eventId) return;
  await deleteCookEventSb(eventId);
}
