import { qs, qsa } from "../utils.js";
import { ack } from "../ui/feedback.js";

export function wireCookSteps({
  appEl,
  audio,
  getAudioPrimed,
  setAudioPrimed,
  done,
  saveDone,
  timerManager,
  recipeId,
}) {
  function highlightCurrentStep() {
    qsa(appEl, ".step-current").forEach((el) => el.classList.remove("step-current"));
    const next = qsa(appEl, 'input[type="checkbox"][data-stepkey]').find((input) => !input.checked);
    const li = next?.closest?.("li");
    if (li) li.classList.add("step-current");
  }

  qsa(appEl, 'input[type="checkbox"][data-stepkey]').forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const key = checkbox.dataset.stepkey;
      done[key] = checkbox.checked;
      saveDone();

      const body = qs(appEl, `[data-stepbody="${CSS.escape(key)}"]`);
      if (body) {
        body.classList.toggle("step-done", checkbox.checked);
        body.style.display = checkbox.checked ? "none" : "";
      }

      const wrap = checkbox.closest("[data-stepwrap]");
      if (wrap) wrap.classList.toggle("step-item-done", checkbox.checked);

      highlightCurrentStep();
    });
  });

  highlightCurrentStep();

  qsa(appEl, "[data-start-timer]").forEach((button) => {
    button.addEventListener("click", async () => {
      const key = button.dataset.startTimer;
      const title = button.dataset.title || "Timer";
      const dur = parseInt(button.dataset.seconds, 10);
      if (!dur) return;

      if (!getAudioPrimed()) {
        setAudioPrimed(true);
        try {
          await audio.prime();
        } catch {
          // ignore audio priming issues
        }
      }

      timerManager.addTimer(key, title, dur, recipeId);
      ack(button);
    });
  });

  return {
    highlightCurrentStep,
  };
}
