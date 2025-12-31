// src/domain/timers.js

const DEFAULT_TIMERS_KEY = "tinkeroneo_timers_v1";
import { formatTime, escapeHtml } from "../utils.js";
import { generateId } from "./id.js";
import { getAudioCtx, unlockAudio, playGongWarm2s, playWoodblockDeep, playSingingBowlWarmLong, playPulseElectronic } from "../services/timerSounds.js";

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

export function createTimer({ title, durationSec, key = null, recipeId = null }) {
  const now = Date.now();
  const dur = normalizeDurationSecFromAny(durationSec);

  const safeTitle =
    (typeof title === "string" && title.trim()) ? title.trim() : "Timer";

  return {
    id: generateId(),
    key, // optional: recipe step key or any identifier
    recipeId, // optional: root recipe id (for jumping back from global timer chip)
    title: safeTitle,
    createdAt: now,
    endsAt: now + dur * 1000,
    dismissed: false,
    // ringing state (for overdue timers)
    ringStartedAt: null,
    lastRingAt: 0,
  };
}

/** Verlängern geht auch nach Ablauf */
export function adjustTimer(timers, timerId, deltaSeconds) {
  const t = timers[timerId];
  if (!t) return timers;

  const d = toFiniteNumber(deltaSeconds);
  if (!Number.isFinite(d) || d === 0) return timers;

  const now = Date.now();
  t.endsAt = t.endsAt + Math.round(d) * 1000;
  t.dismissed = false;
  // reset ringing state so changes apply immediately
  t.ringStartedAt = null;
  t.lastRingAt = 0;
  // if we moved the end into the future, allow a new beep when it hits again
  if (t.endsAt > now) t.beeped = false;

  return timers;
}

export function extendTimer(timers, timerId, seconds) {
  const t = timers[timerId];
  if (!t) return timers;

  const addSec = normalizeDurationSecFromAny(seconds);
  const now = Date.now();
  t.endsAt = Math.max(now, t.endsAt) + addSec * 1000;
  t.dismissed = false;
  // reset ringing state
  t.ringStartedAt = null;
  t.lastRingAt = 0;

  return timers;
}

export function getSortedActiveTimers(timers) {
  return Object.values(timers)
    .filter(t => t && !t.dismissed)
    .map(t => ({
      ...t,
      remainingSec: Math.ceil((t.endsAt - Date.now()) / 1000),
      overdueSec: Math.max(0, Math.floor((Date.now() - t.endsAt) / 1000)),
    }))
    .sort((a, b) => a.remainingSec - b.remainingSec);
}


/* -------------------- beep -------------------- */

// Robust beep helper (works even when AudioContext fails)
export function createBeep({ soundId = "gong", volume = 0.7 } = {}) {
  let enabled = true;
  let warned = false;

  function warnOnce(err) {
    if (warned) return;
    warned = true;
    console.warn("Beep disabled: AudioContext error.", err);
  }

  async function prime() {
    if (!enabled) return false;
    try {
      await unlockAudio();
      return true;
    } catch (err) {
      enabled = false;
      warnOnce(err);
      return false;
    }
  }

  function playOnce() {
    if (!enabled) return false;
    try {
      // try resume if needed (non-async best-effort)
      const ctx = getAudioCtx();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    } catch {
      // ignore
    }

    try {
      const v = Math.max(0, Math.min(1, Number(volume) || 0));
      switch (String(soundId || "gong")) {
        case "wood":
          playWoodblockDeep({ volume: v });
          break;
        case "bowl":
          playSingingBowlWarmLong({ volume: v });
          break;
        case "pulse":
          playPulseElectronic({ volume: v });
          break;
        case "gong":
        default:
          playGongWarm2s({ volume: v });
          break;
      }
      return true;
    } catch (err) {
      enabled = false;
      warnOnce(err);
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
      return false;
    }
  }

  return {
    prime,
    playOnce,
    // legacy name used in cook.view.js
    beep: playOnce,
  };
}

/* -------------------- manager (cook.view.js compatible) -------------------- */


export function createTimerManager({
  storageKey = DEFAULT_TIMERS_KEY,
  onRender = null,
  onFire = null,
  tickMs = 1000,
  ringIntervalMs = 5000,
  // NOTE: maxRingSeconds is kept for backward compatibility but intentionally
  // ignored. If a timer is overdue, it should continue ringing until the user
  // explicitly stops or extends it.
  maxRingSeconds = 120,
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
  function addTimer(a, b, c, d) {
    let key = null;
    let title = "Timer";
    let durationSec = 60;
    let recipeId = null;

    if (a && typeof a === "object") {
      key = a.key ?? null;
      title = a.title ?? "Timer";
      durationSec = a.durationSec ?? a.seconds ?? a.sec ?? 60;
      recipeId = a.recipeId ?? null;
    } else {
      key = a ?? null;
      title = b ?? "Timer";
      durationSec = c ?? 60;
      recipeId = d ?? null;
    }

    const timers = loadTimersRaw(storageKey);
    const t = createTimer({ key, title, durationSec, recipeId });
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

function adjustTimerBy(id, deltaSeconds) {
    const timers = loadTimersRaw(storageKey);
    if (!timers[id]) return false;
    adjustTimer(timers, id, deltaSeconds);
    saveTimersRaw(timers, storageKey);
    renderNow();
    return true;
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
    const now = Date.now();

    for (const t of list) {
      if (t.remainingSec > 0) continue;

      const raw = timers[t.id];
      if (!raw || raw.dismissed) continue;

      // start ringing window
      if (!raw.ringStartedAt) {
        raw.ringStartedAt = now;
        raw.lastRingAt = 0;
        changed = true;
      }

      const due = (now - (raw.lastRingAt || 0)) >= ringIntervalMs;

      // Ring indefinitely until the timer is stopped/dismissed or extended.
      // (maxRingSeconds is intentionally ignored.)
      if (due) {
        raw.lastRingAt = now;
        changed = true;
        try {
          onFire?.(t);
        } catch {
          // ignore (audio may be blocked)
        }
      }
    }

    if (changed) saveTimersRaw(timers, storageKey);

    if (typeof onRender === "function") {
      onRender({ timers, list, now });
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
    adjustTimer: adjustTimerBy,
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
          const over = Math.max(0, t.overdueSec || 0);
          const label = isOverdue
            ? `⏰ abgelaufen · +${formatTime(over)}`
            : `⏱ ${formatTime(t.remainingSec)}`;

          return `
            <div class="timer-pill ${isOverdue ? "is-overdue" : ""}">
              <div class="timer-pill-left" style="min-width:0;">
                <div class="timer-pill-title" title="${escapeHtml(t.title)}">
                  ${escapeHtml(t.title)}
                </div>
                <div class="muted">${label}</div>
              </div>

              <div class="row timer-actions" style="gap:.35rem; flex:0 0 auto;">
                <button type="button" data-timer-dec="${t.id}" data-sec="60">-1m</button>
                <button type="button" data-timer-dec="${t.id}" data-sec="300">-5m</button>
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


