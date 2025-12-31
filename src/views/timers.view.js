// src/views/timers.view.js
import {
  loadTimers,
  saveTimers,
  extendTimer,
  adjustTimer,
  getSortedActiveTimers, createBeep
} from "../domain/timers.js";
import { formatTime, escapeHtml, qsa, qs } from "../utils.js";
import { ack } from "../ui/feedback.js";
const s = window.__tinkeroneoSettings || {};
const audio = createBeep({
  soundId: s.readTimerSoundId ? String(s.readTimerSoundId() || 'bowl') : 'gong',
  volume: s.readTimerSoundVolume ? Number(s.readTimerSoundVolume() ?? 0.7) : 0.7,
});

let tickHandle = null;



function ensureRoot() {
  let root = document.getElementById("globalTimersRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "globalTimersRoot";
    document.body.appendChild(root);
  }
  return root;
}

export function renderTimersOverlay({ appEl: _appEl, state, setView: _setView }) {
  const root = ensureRoot();

  const isCook = state?.name === "cook";
  state.ui ||= {};
  // In cook view we already have the cookbar timer UI -> avoid duplicates
  if (isCook) {
    const rootEl = ensureRoot();
    rootEl.innerHTML = "";
    stopTick();
    return;
  }

  // In cook allow expand; outside cook always show compact chip
  const expanded = isCook ? !!state.ui.timerExpanded : false;

  root.classList.toggle("has-cookbar", isCook);
  root.classList.toggle("compact-mode", !isCook);

  const timers = loadTimers();
  const list = getSortedActiveTimers(timers);
  let changed = false;

  // Beep exactly once per timer when it hits <= 0
  for (const t of list) {
    if (t.remainingSec <= 0) {
      const live = timers[t.id];
      if (live && !live.beeped) {
        live.beeped = true;
        changed = true;
        audio.beep();
      }
    }
  }

  if (changed) saveTimers(timers);


  if (!list.length) {
    root.innerHTML = "";
    stopTick();
    return;
  }

  startTick(() => renderTimersOverlay({ appEl: _appEl, state }));

  const top = list[0];
  const total = list.length;
  const hiddenCount = Math.max(0, total - 1);

  // --- OUTSIDE COOK: compact chip only ---
  if (!isCook) {
    const label = top.remainingSec <= 0 ? "⏰" : "⏱";
    const time = top.remainingSec <= 0 ? "abgelaufen" : formatTime(top.remainingSec);

    root.innerHTML = `
  <button type="button"
          class="timer-chip ${top.remainingSec <= 0 ? "overdue" : ""}"
          data-timer-chip="1"
          title="${escapeHtml(top.title)}">
    <span class="timer-chip-time">${label} ${time}</span>
    <span class="timer-chip-title">${escapeHtml(top.title)}</span>
    ${top.recipeId ? `<span class="timer-chip-open" data-open-recipe="${escapeHtml(top.recipeId)}" title="Zum Rezept">🍳</span>` : ``}
    ${hiddenCount > 0 ? `<span class="timer-chip-more">+${hiddenCount}</span>` : ``}
  </button>
`;


    const chip = qs(root, "[data-timer-chip]");
    if (chip) {

      chip.addEventListener("click", (e) => {
        const open = e.target.closest("[data-open-recipe]");
        if (open) {
          const id = open.dataset.openRecipe;
          window.location.href = `/cook/${id}`;
          return;
        }

        // Normaler Chip-Klick
        ack(chip);
        chip.classList.toggle("show-title");
      });


    }

    // jump back to recipe (outside cook view)
    const open = qs(root, "[data-open-recipe]");
    if (open) {
      open.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const id = open.getAttribute("data-open-recipe");
        if (!id) return;

        // Prefer router/setView if available; otherwise fall back to hash
        if (typeof _setView === "function") {
          _setView({ name: "cook", selectedId: id, q: state?.q || "" });
        } else {
          location.hash = `#cook?id=${encodeURIComponent(id)}&q=${encodeURIComponent(state?.q || "")}`;
        }
      }, true);
    }
    return;


  }


  // --- COOK VIEW: full overlay ---
  const visible = expanded ? list : list.slice(0, 1);
  const hidden = Math.max(0, total - visible.length);

  root.innerHTML = `
    <div class="timer-overlay">
      <div class="timer-overlay-head">
        <div class="timer-overlay-title">
          <span style="font-weight:800;">Timer</span>
          <span class="timer-count" title="${total} Timer aktiv">${total}</span>
        </div>

        ${total > 1 ? `
          <button type="button"
                  class="timer-toggle"
                  data-timer-toggle="1"
                  aria-expanded="${expanded ? "true" : "false"}">
            ${expanded ? "Weniger" : "Alle anzeigen"}
          </button>
        ` : ``}
      </div>

      <div class="timer-stack ${expanded ? "expanded" : ""}" id="timerStack">
        ${visible.map((t, idx) => {
    const offset = expanded ? 0 : Math.min(idx, 2) * 8;
    const isOverdue = t.remainingSec <= 0;
    const label = isOverdue ? "⏰ abgelaufen" : `⏱ ${formatTime(t.remainingSec)}`;

    return `
            <div class="timer-card ${isOverdue ? "overdue" : ""}"
                 style="transform: translate(${offset}px, ${offset}px)"
                 data-timer-card="${t.id}">
              <div class="timer-card-main">
                <div style="min-width:0;">
                  <div class="timer-card-title" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>
                  <div class="muted">${label}</div>
                </div>
                <div class="row" style="gap:.35rem; flex:0 0 auto;">
                  <button type="button" data-dec="${t.id}" data-sec="60">-1m</button>
                  <button type="button" data-dec="${t.id}" data-sec="300">-5m</button>
                  <button type="button" data-ext="${t.id}" data-sec="60">+1m</button>
                  <button type="button" data-ext="${t.id}" data-sec="300">+5m</button>
                  <button type="button" data-dismiss="${t.id}" aria-label="Dismiss timer">✕</button>
                </div>
              </div>
            </div>
          `;
  }).join("")}
      </div>

      ${!expanded && hidden > 0 ? `
        <div class="timer-more-hint">
          +${hidden} weitere … tippe „Alle anzeigen“
        </div>
      ` : ``}
    </div>
  `;

  const toggleBtn = qs(root, "[data-timer-toggle]");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.ui.timerExpanded = !expanded;
      ack(toggleBtn);
      renderTimersOverlay({ appEl: _appEl, state });
    });
  }

  qsa(root, "[data-dec]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.dec;
      const sec = parseInt(btn.dataset.sec, 10) || 0;
      if (!id || !sec) return;
      // const timers = loadTimers();
      if (!timers[id]) return;
      ack(btn.closest(".timer-card") || btn);
      adjustTimer(timers, id, -sec);
      saveTimers(timers);
      renderTimersOverlay({ appEl: _appEl, state });
    });
  });

  qsa(root, "[data-ext]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.ext;
      const sec = parseInt(btn.dataset.sec, 10) || 0;
      if (!id || !sec) return;
      ack(btn.closest(".timer-card") || btn);
      extendTimer(timers, id, sec);
      saveTimers(timers);
      renderTimersOverlay({ appEl: _appEl, state });
    });
  });

  qsa(root, "[data-dismiss]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.dismiss;
      if (!id || !timers[id]) return;
      ack(btn.closest(".timer-card") || btn);
      timers[id].dismissed = true;
      saveTimers(timers);
      renderTimersOverlay({ appEl: _appEl, state });
    });
  });
}

function startTick(cb) {
  if (tickHandle) return;
  tickHandle = setInterval(cb, 1000);
}

function stopTick() {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
}
