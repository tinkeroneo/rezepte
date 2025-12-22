// src/domain/timers.js

const TIMERS_KEY = "tinkeroneo_timers_v1";

export function loadTimers() {
  try {
    return JSON.parse(localStorage.getItem(TIMERS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

export function saveTimers(timers) {
  localStorage.setItem(TIMERS_KEY, JSON.stringify(timers));
}

export function createTimer({ title, durationSec }) {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    endsAt: now + durationSec * 1000,
    dismissed: false,
    beeped: false,
  };
}

/** 🔑 WICHTIG: Verlängern geht auch nach Ablauf */
export function extendTimer(timers, timerId, seconds) {
  const t = timers[timerId];
  if (!t) return timers;

  const now = Date.now();
  t.endsAt = Math.max(now, t.endsAt) + seconds * 1000;
  t.dismissed = false;
  t.beeped = false;

  return timers;
}

export function getSortedActiveTimers(timers) {
  return Object.values(timers)
    .filter(t => !t.dismissed)
    .map(t => ({
      ...t,
      remainingSec: Math.ceil((t.endsAt - Date.now()) / 1000),
    }))
    .sort((a, b) => a.remainingSec - b.remainingSec);
}
