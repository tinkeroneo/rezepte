// src/domain/timers.js

const DEFAULT_TIMERS_KEY = "tinkeroneo_timers_v1";
import { formatTime, escapeHtml } from "../utils.js";
import { generateId } from "./id.js";

/* -------------------- duration normalization -------------------- */

function toFiniteNumber(x) {
  const n = typeof x === "string" ? Number(x.trim()) : Number(x);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeDurationSecFromAny(x) {
  const sec = toFiniteNumber(x);
  if (!Number.isFinite(sec) || sec <= 0) return 60;
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

export function createTimer({ title, durationSec, key = null }) {
  const now = Date.now();
  const dur = normalizeDurationSecFromAny(durationSec);

  const safeTitle =
    (typeof title === "string" && title.trim()) ? title.trim() : "Timer";

  return {
    id: generateId(),
    key, // optional: recipe step key or any identifier
    title: safeTitle,
    createdAt: now,
    endsAt: now + dur * 1000,
    dismissed: false,
    beeped: false,
  };
}

/** Verlängern geht auch nach Ablauf */
export function extendTimer(timers, timerId, seconds) {
  const t = timers[timerId];
  if (!t) return timers;

  const addSec = normalizeDurationSecFromAny(seconds);
  const now = Date.now();
  t.endsAt = Math.max(now, t.endsAt) + addSec * 1000;
  t.dismissed = false;
  t.beeped = false;

  return timers;
}

export function getSortedActiveTimers(timers) {
  return Object.values(timers)
    .filter(t => t && !t.dismissed)
    .map(t => ({
      ...t,
      remainingSec: Math.ceil((t.endsAt - Date.now()) / 1000),
    }))
    .sort((a, b) => a.remainingSec - b.remainingSec);
}


/* -------------------- beep -------------------- */

// Robust beep helper (works even when AudioContext fails)
export function createBeep() {
  let ctx = null;
  let enabled = true;
  let warned = false;

  function warnOnce(err) {
    if (warned) return;
    warned = true;
    console.warn("Beep disabled: AudioContext error.", err);
  }

  function ensureCtx() {
    if (!enabled) return null;

    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) {
          enabled = false;
          return null;
        }
        ctx = new AC();

        // if device/renderer errors out, permanently disable
        ctx.onstatechange = () => {
          if (ctx && ctx.state === "closed") enabled = false;
        };
      }

      // If the context is already errored/suspended badly, disable
      if (ctx.state === "closed") {
        enabled = false;
        return null;
      }

      return ctx;
    } catch (e) {
      enabled = false;
      warnOnce(e);
      return null;
    }
  }

  async function prime() {
    const c = ensureCtx();
    if (!c) return false;
    try {
      if (c.state === "suspended") await c.resume();
      return true;
    } catch (e) {
      enabled = false;
      warnOnce(e);
      return false;
    }
  }

  function beep({ ms = 120, freq = 880 } = {}) {
    if (!enabled) {
      // fallback: vibration if available
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
      return false;
    }

    const c = ensureCtx();
    if (!c) {
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
      return false;
    }

    try {
      // do NOT create beep if context is not running and can't be resumed
      if (c.state === "suspended") {
        // best effort resume, but don't spam; if fails -> disable
        c.resume().catch((e) => { enabled = false; warnOnce(e); });
        return false;
      }

      const o = c.createOscillator();
      const g = c.createGain();

      o.type = "sine";
      o.frequency.value = freq;

      // gentle envelope (avoid clicks)
      const t0 = c.currentTime;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);

      o.connect(g);
      g.connect(c.destination);

      o.start(t0);
      o.stop(t0 + ms / 1000 + 0.02);

      return true;
    } catch (e) {
      enabled = false;
      warnOnce(e);
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
      return false;
    }
  }

  return { prime, beep };
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

  /**
   * Overload:
   * - addTimer({ key, title, durationSec })
   * - addTimer(key, title, durationSec)  <-- cook.view.js uses this
   */
  function addTimer(a, b, c) {
    let key = null;
    let title = "Timer";
    let durationSec = 60;

    if (a && typeof a === "object") {
      key = a.key ?? null;
      title = a.title ?? "Timer";
      durationSec = a.durationSec ?? a.seconds ?? a.sec ?? 60;
    } else {
      key = a ?? null;
      title = b ?? "Timer";
      durationSec = c ?? 60;
    }

    const timers = loadTimersRaw(storageKey);
    const t = createTimer({ key, title, durationSec });
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

  const total = list.length;
  const showToggle = total > 1;

  const visible = expanded ? list : list.slice(0, Math.max(1, maxCollapsed));

  return `
    <div class="timerbar" data-timerbar>
      <div class="row" style="justify-content: space-between;">
        <div style="font-weight:800; display:flex; gap:.5rem; align-items:center;">
          <span>Timer</span>
          <span class="timer-count" title="${total} Timer aktiv">${total}</span>
        </div>

        ${showToggle ? `
          <button type="button"
                  class="timer-toggle"
                  data-timer-toggle="1"
                  aria-expanded="${expanded ? "true" : "false"}">
            ${expanded ? "Weniger" : "Alle anzeigen"}
          </button>
        ` : `
          <div class="muted" style="font-size:.9rem;">top</div>
        `}
      </div>

      <div class="timer-list">
        ${visible.map(t => {
          const isOverdue = t.remainingSec <= 0;
          const label = isOverdue ? "⏰ abgelaufen" : `⏱ ${formatTime(t.remainingSec)}`;

          return `
            <div class="timer-pill ${isOverdue ? "is-overdue" : ""}">
              <div class="timer-pill-left" style="min-width:0;">
                <div class="timer-pill-title" title="${escapeHtml(t.title)}">
                  ${escapeHtml(t.title)}
                </div>
                <div class="muted">${label}</div>
              </div>

              <div class="row timer-actions" style="gap:.35rem; flex:0 0 auto;">
                <button type="button" data-timer-ext="${t.id}" data-sec="60">+1m</button>
                <button type="button" data-timer-ext="${t.id}" data-sec="300">+5m</button>
                <button type="button" data-timer-stop="${t.id}" aria-label="Stop timer">✕</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      ${!expanded && total > visible.length ? `
        <div class="timer-more-hint">
          +${total - visible.length} weitere … tippe „Alle anzeigen“
        </div>
      ` : ``}
    </div>
  `;
}


