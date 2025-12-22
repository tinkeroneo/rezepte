// src/domain/timers.js

const DEFAULT_TIMERS_KEY = "tinkeroneo_timers_v1";

/* -------------------- duration normalization -------------------- */

function toFiniteNumber(x) {
  const n = typeof x === "string" ? Number(x.trim()) : Number(x);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Accepts various shapes:
 * - { durationSec }
 * - { durationMin } / { minutes }
 * - { durationMs } / { ms }
 * - { seconds } / { sec }
 * - { duration } (assume minutes if small, else seconds if big)
 */
function normalizeDurationSec(input) {
  const obj = input && typeof input === "object" ? input : {};

  // explicit seconds
  let sec = toFiniteNumber(obj.durationSec);
  if (!Number.isFinite(sec)) sec = toFiniteNumber(obj.seconds);
  if (!Number.isFinite(sec)) sec = toFiniteNumber(obj.sec);

  // minutes
  if (!Number.isFinite(sec)) {
    let min = toFiniteNumber(obj.durationMin);
    if (!Number.isFinite(min)) min = toFiniteNumber(obj.minutes);
    if (Number.isFinite(min)) sec = min * 60;
  }

  // milliseconds
  if (!Number.isFinite(sec)) {
    let ms = toFiniteNumber(obj.durationMs);
    if (!Number.isFinite(ms)) ms = toFiniteNumber(obj.ms);
    if (Number.isFinite(ms)) sec = ms / 1000;
  }

  // generic duration heuristic
  if (!Number.isFinite(sec)) {
    const d = toFiniteNumber(obj.duration);
    if (Number.isFinite(d)) {
      // Heuristic: <= 180 looks like minutes, otherwise seconds
      sec = d <= 180 ? d * 60 : d;
    }
  }

  // final guard
  if (!Number.isFinite(sec) || sec <= 0) sec = 60;
  return Math.round(sec);
}

/* -------------------- storage helpers -------------------- */

function loadTimersRaw(storageKey = DEFAULT_TIMERS_KEY) {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "{}") || {};
  } catch {
    return {};
  }
}

function saveTimersRaw(timers, storageKey = DEFAULT_TIMERS_KEY) {
  localStorage.setItem(storageKey, JSON.stringify(timers));
}

/* -------------------- public API (legacy-friendly) -------------------- */

export function loadTimers(storageKey = DEFAULT_TIMERS_KEY) {
  return loadTimersRaw(storageKey);
}

export function saveTimers(timers, storageKey = DEFAULT_TIMERS_KEY) {
  saveTimersRaw(timers, storageKey);
}

export function createTimer(input) {
  const now = Date.now();
  const durationSec = normalizeDurationSec(input);

  const title =
    (input && typeof input === "object" && typeof input.title === "string" && input.title.trim())
      ? input.title.trim()
      : "Timer";

  return {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    endsAt: now + durationSec * 1000,
    dismissed: false,
    beeped: false,
  };
}

/** Verlängern geht auch nach Ablauf */
export function extendTimer(timers, timerId, seconds) {
  const t = timers[timerId];
  if (!t) return timers;

  const addSec = toFiniteNumber(seconds);
  const delta = Number.isFinite(addSec) ? addSec : 0;

  const now = Date.now();
  t.endsAt = Math.max(now, t.endsAt) + delta * 1000;
  t.dismissed = false;
  t.beeped = false;

  return timers;
}

export function getSortedActiveTimers(timers) {
  return Object.values(timers)
    .filter((t) => t && !t.dismissed)
    .map((t) => ({
      ...t,
      remainingSec: Math.ceil((t.endsAt - Date.now()) / 1000),
    }))
    .sort((a, b) => a.remainingSec - b.remainingSec);
}

/* -------------------- beep -------------------- */

export function createBeep() {
  let ctx = null;

  function ensureCtx() {
    if (ctx) return ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    return ctx;
  }

  async function prime() {
    const c = ensureCtx();
    if (!c) return false;
    try {
      if (c.state === "suspended") await c.resume();
      const osc = c.createOscillator();
      const gain = c.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(c.destination);
      const now = c.currentTime;
      osc.start(now);
      osc.stop(now + 0.02);
      return true;
    } catch {
      return false;
    }
  }

  function play({
    frequency = 880,
    durationMs = 180,
    volume = 0.08,
    type = "sine",
  } = {}) {
    const c = ensureCtx();
    if (!c) return;

    if (c.state === "suspended") {
      c.resume().catch(() => {});
    }

    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    const now = c.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    osc.connect(gain);
    gain.connect(c.destination);

    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  }

  return { play, prime };
}

/* -------------------- manager (cook.view.js compatible) -------------------- */

export function createTimerManager({
  storageKey = DEFAULT_TIMERS_KEY,
  onRender = null,
  beep = null,
  tickMs = 1000,
} = {}) {
  let interval = null;

  function getSnapshot() {
    const timers = loadTimersRaw(storageKey);
    const list = getSortedActiveTimers(timers);
    return { timers, list, now: Date.now() };
  }

  function renderNow() {
    if (typeof onRender === "function") {
      onRender(getSnapshot());
    }
  }

  function addTimer(input) {
    const timers = loadTimersRaw(storageKey);
    const t = createTimer(input); // <- now robust
    timers[t.id] = t;
    saveTimersRaw(timers, storageKey);
    renderNow();
    return t;
  }

  function extendTimerBy(id, seconds) {
    const timers = loadTimersRaw(storageKey);
    extendTimer(timers, id, seconds);
    saveTimersRaw(timers, storageKey);
    renderNow();
  }

  function removeTimer(id) {
    const timers = loadTimersRaw(storageKey);
    if (timers[id]) {
      timers[id].dismissed = true;
      saveTimersRaw(timers, storageKey);
      renderNow();
      return true;
    }
    return false;
  }

  function tick() {
    const timers = loadTimersRaw(storageKey);
    const list = getSortedActiveTimers(timers);

    let changed = false;
    for (const t of list) {
      if (t.remainingSec <= 0) {
        const raw = timers[t.id];
        if (raw && !raw.beeped) {
          raw.beeped = true;
          changed = true;
          try { beep?.play?.(); } catch {}
        }
      }
    }

    if (changed) saveTimersRaw(timers, storageKey);

    if (typeof onRender === "function") {
      onRender({ timers, list, now: Date.now() });
    }
  }

  function start() {
    if (interval) return;
    renderNow();
    interval = setInterval(tick, tickMs);
  }

  function dispose() {
    if (interval) clearInterval(interval);
    interval = null;
  }

  start();

  return {
    getSnapshot,
    addTimer,
    extendTimer: extendTimerBy,
    removeTimer,
    tick,
    dispose,
  };
}

/* -------------------- HTML renderer (cookbar) -------------------- */

export function renderTimersBarHtml(snap, { expanded = false, maxCollapsed = 1 } = {}) {
  const list = snap?.list ?? [];
  if (!list.length) return "";

  const visible = expanded ? list : list.slice(0, Math.max(1, maxCollapsed));

  return `
    <div class="timerbar">
      <div class="row" style="justify-content: space-between;">
        <div style="font-weight:800;">Timer</div>
        <div class="muted" style="font-size:.9rem;">
          ${expanded ? "alle" : "top"}
        </div>
      </div>

      <div style="margin-top:.55rem; display:flex; flex-direction:column; gap:.5rem;">
        ${visible.map(t => {
          const isOverdue = t.remainingSec <= 0;
          const label = isOverdue ? "⏰ abgelaufen" : `⏱ ${formatTimeLocal(t.remainingSec)}`;

          return `
            <div class="timer-pill" style="display:flex; justify-content:space-between; gap:.75rem;">
              <div style="min-width:0;">
                <div style="font-weight:750; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  ${escapeHtmlLocal(t.title)}
                </div>
                <div class="muted">${label}</div>
              </div>

              <div class="row" style="gap:.35rem; flex:0 0 auto;">
                <button type="button" data-timer-ext="${t.id}" data-sec="60">+1m</button>
                <button type="button" data-timer-ext="${t.id}" data-sec="300">+5m</button>
                <button type="button" data-timer-stop="${t.id}" aria-label="Stop timer">✕</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

/* ---------- local helpers (no imports) ---------- */

function formatTimeLocal(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function escapeHtmlLocal(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
