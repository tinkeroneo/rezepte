// src/views/timers.view.js
import {
  loadTimers,
  saveTimers,
  extendTimer,
  getSortedActiveTimers
} from "../domain/timers.js";
import { formatTime, escapeHtml } from "../utils.js";

let tickHandle = null;

export function renderTimersOverlay({ appEl, state }) {
  let root = document.getElementById("globalTimersRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "globalTimersRoot";
    appEl.appendChild(root);
  }

  const timers = loadTimers();
  const list = getSortedActiveTimers(timers);

  if (!list.length) {
    root.innerHTML = "";
    stopTick();
    return;
  }

  startTick(() => renderTimersOverlay({ appEl, state }));

  const expanded = !!state.ui?.timerExpanded;
  const visible = expanded ? list : list.slice(0, 3);

  root.innerHTML = `
    <div class="timer-stack ${expanded ? "expanded" : ""}" id="timerStack">
      ${visible.map((t, idx) => {
        const offset = expanded ? 0 : Math.min(idx, 2) * 8;
        const label =
          t.remainingSec <= 0
            ? "⏰ abgelaufen"
            : `⏱ ${formatTime(t.remainingSec)}`;

        return `
          <div class="timer-card" style="transform: translate(${offset}px, ${offset}px)">
            <div class="timer-card-main">
              <div>
                <div style="font-weight:800;">${escapeHtml(t.title)}</div>
                <div class="muted">${label}</div>
              </div>
              <div class="row" style="gap:.35rem;">
                <button data-ext="${t.id}" data-sec="60">+1m</button>
                <button data-ext="${t.id}" data-sec="300">+5m</button>
                <button data-dismiss="${t.id}">✕</button>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  // expand / collapse
  root.querySelector("#timerStack").addEventListener("click", e => {
    if (e.target.closest("button")) return;
    state.ui.timerExpanded = !expanded;
    renderTimersOverlay({ appEl, state });
  });

  // extend
  root.querySelectorAll("[data-ext]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.ext;
      const sec = parseInt(btn.dataset.sec, 10);
      extendTimer(timers, id, sec);
      saveTimers(timers);
      renderTimersOverlay({ appEl, state });
    });
  });

  // dismiss (robust: timers kann Array oder Object sein)
  root.querySelectorAll("[data-dismiss]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.dismiss;

      if (Array.isArray(timers)) {
        const t = timers.find(x => x?.id === id);
        if (t) t.dismissed = true;
      } else if (timers && typeof timers === "object") {
        if (timers[id]) timers[id].dismissed = true;
      }

      saveTimers(timers);
      renderTimersOverlay({ appEl, state });
    });
  });
}

function startTick(cb) {
  if (tickHandle) return;
  tickHandle = setInterval(cb, 250);
}
function stopTick() {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
}
