import { loadTimers, saveTimers, createTimer } from "../domain/timers.js";

btn.addEventListener("click", () => {
  const dur = parseInt(btn.dataset.seconds, 10);
  if (!dur) return;

  const timers = loadTimers();
  const timer = createTimer({
    title: `${recipe.title} · ${stepTitle}`,
    durationSec: dur,
  });

  timers[timer.id] = timer;
  saveTimers(timers);
});
