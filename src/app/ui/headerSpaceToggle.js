// src/app/ui/headerSpaceToggle.js
// Mobile UX: collapse the header space select behind a toggle button.
// Desktop remains always visible (CSS handles it).

export function wireHeaderSpaceToggle() {
  const wrap = document.getElementById("headerSpaceWrap");
  const btn = document.getElementById("headerSpaceToggle");
  const sel = document.getElementById("headerSpaceSelect");
  if (!wrap || !btn || !sel) return;
  if (btn.__installed) return;
  btn.__installed = true;

  const mq = (() => {
    try { return window.matchMedia("(max-width: 699px)"); } catch { return null; }
  })();

  const isMobile = () => !!(mq ? mq.matches : (window.innerWidth <= 699));

  const setOpen = (open) => {
    if (!isMobile()) {
      wrap.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      return;
    }
    wrap.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      // focus select after it becomes interactive
      setTimeout(() => { try { sel.focus(); } catch { /* ignore */ } }, 0);
    }
  };

  const toggle = () => setOpen(!wrap.classList.contains("is-open"));

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    toggle();
  });

  // Collapse after choosing a space (mobile)
  sel.addEventListener("change", () => setOpen(false));

  // Collapse when tapping outside (mobile)
  document.addEventListener("pointerdown", (e) => {
    if (!isMobile()) return;
    const t = e.target;
    if (wrap.contains(t)) return;
    setOpen(false);
  }, { passive: true });

  // Keep state consistent when resizing
  if (mq) {
    mq.addEventListener?.("change", () => setOpen(false));
  }
}
