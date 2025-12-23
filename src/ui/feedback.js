// src/ui/feedback.js
export function ack(el, { className = "tap-ack", ms = 220 } = {}) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  clearTimeout(el._ackT);
  el._ackT = setTimeout(() => el.classList.remove(className), ms);
}
