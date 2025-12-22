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

  const timers = loadTimers(); // object: { [id]: timer }
  const list = getSortedActiveTimers(timers);

  if (!list.length) {
    root.innerHTML = "";
    stopTick();
    return;
  }

  startTick(() => renderTimersOverlay({ appEl, state }));

  const expanded = !!state.ui?.timerExpanded;
  const visible = expanded ? list : list.slice(0, 1); // collapsed: nur Top 1

  root.innerHTML = `
    <div class="timer-stack ${expanded ? "expanded" : ""}" id="timerStack">
      ${visible.map((t, idx) => {
        const offset = expanded ? 0 : Math.min(idx, 2) * 8;
        const isOverdue = t.remainingSec <= 0;

        const label = isOverdue
          ? "⏰ abgelaufen"
          : `⏱ ${formatTime(t.remainingSec)}`;

        return `
          <div class="timer-card ${isOverdue ? "overdue" : ""}" style="transform: translate(${offset}px, ${offset}px)">
            <div class="timer-card-main">
              <div>
                <div style="font-weight:800;">${escapeHtml(t.title)}</div>
                <div class="muted">${label}</div>
              </div>
              <div class="row" style="gap:.35rem;">
                <button type="button" data-ext="${t.id}" data-sec="60">+1m</button>
                <button type="button" data-ext="${t.id}" data-sec="300">+5m</button>
                <button type="button" data-dismiss="${t.id}" aria-label="Dismiss timer">✕</button>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  // expand / collapse
  root.querySelector("#timerStack").addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    state.ui.timerExpanded = !expanded;
    renderTimersOverlay({ appEl, state });
  });

  // extend
  root.querySelectorAll("[data-ext]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.ext;
      const sec = parseInt(btn.dataset.sec, 10);
      extendTimer(timers, id, sec);
      saveTimers(timers);
      renderTimersOverlay({ appEl, state });
    });
  });

  // dismiss
  root.querySelectorAll("[data-dismiss]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.dismiss;

      if (timers && timers[id]) {
        timers[id].dismissed = true;
        saveTimers(timers);
      }

      renderTimersOverlay({ appEl, state });
    });
  });
}

function startTick(cb) {
  if (tickHandle) return;
  tickHandle = setInterval(cb, 1000); // weniger CPU, reicht völlig
}
function stopTick() {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
}
