// src/ui/fabMenu.js
import { qs } from "../utils.js";

export function initFabMenu({
  appEl,
  canWrite,
  onNew,
  onImport,
  onExport
}) {
  const fab = qs(appEl, "#addFab");
  const fabMenu = qs(appEl, "#fabMenu");
  const fabNew = qs(appEl, "#fabNew");
  const fabImport = qs(appEl, "#fabImport");
  const fabExport = qs(appEl, "#fabExport");

  if (!fab || !fabMenu) return { close: () => {} };

  // prevent double wiring (in case of rerenders)
  if (fab.__wiredFabMenu) return { close: () => closeFabMenu() };
  fab.__wiredFabMenu = true;

  const canWriteFlag = !!canWrite;

  if (fabNew) {
    fabNew.disabled = !canWriteFlag;
    fabNew.title = canWriteFlag ? "Neues Rezept" : "Nur Owner/Editor";
    fabNew.classList.toggle("is-disabled", !canWriteFlag);
  }

  const fabItems = [fabNew, fabImport, fabExport].filter(Boolean);

  const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setRovingTabIndex = (activeIdx) => {
    fabItems.forEach((el, idx) => {
      el.tabIndex = idx === activeIdx ? 0 : -1;
    });
  };

  const positionFabMenu = () => {
    // reset overrides
    fabMenu.style.top = "";
    fabMenu.style.bottom = "";

    // default: above FAB
    fabMenu.style.bottom = `calc(var(--s-5) + 56px + env(safe-area-inset-bottom))`;

    // if off-screen, pin top
    const r = fabMenu.getBoundingClientRect();
    if (r.top < 8) {
      fabMenu.style.top = "8px";
      fabMenu.style.bottom = "auto";
    }
  };

  const closeFabMenu = () => {
    if (fabMenu.hidden) return;

    fab.setAttribute("aria-expanded", "false");
    fabMenu.classList.remove("is-open");

    if (prefersReducedMotion()) {
      fabMenu.hidden = true;
      fab.focus();
      return;
    }

    window.setTimeout(() => {
      fabMenu.hidden = true;
      fab.focus();
    }, 130);
  };

  const openFabMenu = () => {
    if (!fabMenu.hidden) return;

    fabMenu.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    setRovingTabIndex(0);

    positionFabMenu();
    window.requestAnimationFrame(() => {
      fabMenu.classList.add("is-open");
      positionFabMenu();
      fabItems[0]?.focus();
    });
  };

  // ARIA
  fab.setAttribute("aria-haspopup", "menu");
  fab.setAttribute("aria-expanded", "false");

  // Toggle
  fab.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (fabMenu.hidden) openFabMenu();
    else closeFabMenu();
  });

  // Keep menu open on clicks inside
  fabMenu.addEventListener("click", (e) => e.stopPropagation());

  // Outside click closes (once)
  if (!document.__wiredFabOutsideClose) {
    document.__wiredFabOutsideClose = true;
    document.addEventListener("click", () => closeFabMenu());
  }

  // ESC closes
  if (!document.__wiredFabEscClose) {
    document.__wiredFabEscClose = true;
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!fabMenu || fabMenu.hidden) return;
      e.preventDefault();
      closeFabMenu();
    });
  }

  // Keyboard nav inside menu
  fabMenu.addEventListener("keydown", (e) => {
    if (!fabItems.length) return;

    const currentIdx = Math.max(0, fabItems.findIndex((el) => el === document.activeElement));
    const go = (idx) => {
      const next = (idx + fabItems.length) % fabItems.length;
      setRovingTabIndex(next);
      fabItems[next]?.focus();
    };

    if (e.key === "ArrowDown") {
      e.preventDefault();
      go(currentIdx + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      go(currentIdx - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(fabItems.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      document.activeElement?.click?.();
    }
  });

  // Actions
  if (fabNew) {
    fabNew.addEventListener("click", (e) => {
      e.preventDefault();
      closeFabMenu();
      onNew?.();
    });
  }
  if (fabImport) {
    fabImport.addEventListener("click", (e) => {
      e.preventDefault();
      closeFabMenu();
      onImport?.();
    });
  }
  if (fabExport) {
    fabExport.addEventListener("click", (e) => {
      e.preventDefault();
      closeFabMenu();
      onExport?.();
    });
  }

  return { close: closeFabMenu, open: openFabMenu };
}
