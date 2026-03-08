import { qs, qsa } from "../utils.js";
import { createTimerManager, renderTimersBarHtml } from "../domain/timers.js";
import { ack } from "../ui/feedback.js";

export function createCookTimers({
  appEl,
  timerRoot,
  settings,
  storageKey,
  audio,
}) {
  let timersExpanded = false;
  let lastOverdueKeys = new Set();
  const timerOpenUntil = new Map();
  const TIMER_ACTIONS_OPEN_MS = 5000;

  function flashTimerRootOnce() {
    timerRoot.classList.remove("timer-flash");
    void timerRoot.offsetWidth;
    timerRoot.classList.add("timer-flash");
    window.clearTimeout(timerRoot._flashT);
    timerRoot._flashT = window.setTimeout(() => {
      timerRoot.classList.remove("timer-flash");
    }, 220);
  }

  const ringIntervalMs = settings.readTimerRingIntervalMs?.() ?? 2800;
  const maxRingSeconds = settings.readTimerMaxRingSeconds?.() ?? 120;
  const stepHighlightEnabled = settings.readTimerStepHighlight?.() ?? true;
  const timerSoundEnabled = settings.readTimerSoundEnabled ? !!settings.readTimerSoundEnabled() : true;

  const timerManager = createTimerManager({
    storageKey,
    ringIntervalMs,
    maxRingSeconds,
    onRender: (snap) => {
      timerRoot.innerHTML = renderTimersBarHtml(snap, {
        expanded: timersExpanded,
        maxCollapsed: 1,
      });

      if (stepHighlightEnabled) {
        try {
          const overdueKeys = new Set(
            (snap?.list ?? [])
              .filter((timer) => (timer.remainingSec ?? 1) <= 0 && timer.key)
              .map((timer) => String(timer.key))
          );

          const newlyOverdue = [];
          overdueKeys.forEach((key) => {
            if (!lastOverdueKeys.has(key)) newlyOverdue.push(key);
          });
          lastOverdueKeys = overdueKeys;

          qsa(appEl, "li[data-stepwrap]").forEach((li) => {
            const key = li.getAttribute("data-stepwrap") || "";
            li.classList.toggle("step-overdue", overdueKeys.has(key));
          });

          if (newlyOverdue.length) {
            const li = qs(appEl, `li[data-stepwrap="${CSS.escape(newlyOverdue[0])}"]`);
            if (li) {
              li.classList.add("step-current");
              const rect = li.getBoundingClientRect();
              if (rect.top < 0 || rect.bottom > window.innerHeight) {
                li.scrollIntoView({ block: "center", behavior: "smooth" });
              }
              window.setTimeout(() => li.classList.remove("step-current"), 2000);
            }
          }
        } catch {
          // ignore step highlight failures
        }
      } else {
        qsa(appEl, "li.step-overdue").forEach((li) => li.classList.remove("step-overdue"));
      }

      const now = Date.now();
      qsa(timerRoot, "[data-timer-pill]").forEach((pill) => {
        const id = pill.getAttribute("data-timer-id") || "";
        const openUntil = timerOpenUntil.get(id) || 0;
        if (openUntil > now) pill.classList.add("is-open");

        pill.addEventListener("click", (event) => {
          if (event.target?.closest("button")) return;
          const nextOpen = (timerOpenUntil.get(id) || 0) > Date.now()
            ? 0
            : (Date.now() + TIMER_ACTIONS_OPEN_MS);
          if (nextOpen) {
            timerOpenUntil.set(id, nextOpen);
            pill.classList.add("is-open");
          } else {
            timerOpenUntil.delete(id);
            pill.classList.remove("is-open");
          }
        });
      });

      qsa(timerRoot, "[data-timer-toggle]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          timersExpanded = !timersExpanded;
          flashTimerRootOnce();
          timerManager.tick();
        });
      });

      qsa(timerRoot, "[data-timer-stop]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          ack(button.closest(".timer-pill") || button);
          timerManager.removeTimer(button.dataset.timerStop);
          timerManager.tick();
        });
      });

      qsa(timerRoot, "[data-timer-dec]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          const id = button.dataset.timerDec;
          const sec = parseInt(button.dataset.sec, 10) || 0;
          if (!id || !sec) return;
          ack(button.closest(".timer-pill") || button);
          timerManager.adjustTimer(id, -sec);
          timerManager.tick();
        });
      });

      qsa(timerRoot, "[data-timer-ext]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          const id = button.dataset.timerExt;
          const sec = parseInt(button.dataset.sec, 10) || 0;
          if (!id || !sec) return;
          ack(button.closest(".timer-pill") || button);
          timerManager.extendTimer(id, sec);
          timerManager.tick();
        });
      });
    },
    onFire: () => {
      if (!timerSoundEnabled) return;
      audio.beep();
    },
  });

  return timerManager;
}
