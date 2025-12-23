// src/domain/timers.js

const DEFAULT_TIMERS_KEY = "tinkeroneo_timers_v1";

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
    id: crypto.randomUUID(),
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
          const label = isOverdue ? "⏰ abgelaufen" : `⏱ ${formatTimeLocal(t.remainingSec)}`;

          return `
            <div class="timer-pill ${isOverdue ? "is-overdue" : ""}">
              <div class="timer-pill-left" style="min-width:0;">
                <div class="timer-pill-title" title="${escapeHtmlLocal(t.title)}">
                  ${escapeHtmlLocal(t.title)}
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
