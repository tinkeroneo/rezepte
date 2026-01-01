// src/controllers/listToolbar.controller.js
import { escapeHtml } from "../utils.js";

/**
 * Storage-free toolbar controller.
 *
 * It:
 * - builds category/tag options
 * - wires events for q/cat/tag/sort/sortDir/reset + extra filter toggle
 *
 * It does NOT touch localStorage.
 * Persist & NAV updates are delegated via callbacks.
 */
export function initListToolbar({
  appEl,
  state,
  recipes,

  // state plumbing
  getUi,
  setUi,

  // helpers
  defaultDirFor,

  // callbacks
  onRender,        // () => void
  onResetNavigate, // () => void
  onPersist,       // (patchObj) => void
  onNavUpdate      // (navObj) => void
}) {
  const qs = (sel) => appEl.querySelector(sel);

  const qEl = qs("#q");
  const catEl = qs("#catFilter");
  const tagEl = qs("#tagFilter");

  const extraFiltersBtn = qs("#extraFiltersToggle");
  const extraFiltersWrap = qs("#extraFilters");

  const sortEl = qs("#sortSelect");
  const sortDirBtn = qs("#sortDirBtn");
  const resetEl = qs("#resetFilters");

  let ui = getUi();

  // --- build tag options
  const tags = Array.from(
    new Set(
      (Array.isArray(recipes) ? recipes : [])
        .flatMap((r) => (Array.isArray(r.tags) ? r.tags : []))
        .map((t) => String(t || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "de"));

  if (tagEl) {
    tagEl.innerHTML = `
      <option value="">Alle Tags</option>
      ${tags.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}
    `;
  }

  // --- build category options
  const cats = Array.from(
    new Set(
      (Array.isArray(recipes) ? recipes : [])
        .map((r) => (r.category ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "de"));

  if (catEl) {
    catEl.innerHTML = `
      <option value="">Alle Kategorien</option>
      ${cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
    `;
  }

  // --- init UI values
  if (qEl && typeof ui.q === "string") qEl.value = ui.q;
  if (catEl) catEl.value = ui.cat || "";
  if (tagEl) tagEl.value = ui.tag || "";
  if (sortEl) sortEl.value = ui.sort || "new";

  if (ui.sortDir !== "asc" && ui.sortDir !== "desc") {
    ui.sortDir = defaultDirFor(ui.sort || "new");
    setUi(ui);
    onPersist?.({ sortDir: ui.sortDir });
  }

  const applySortDirUi = () => {
    if (!sortDirBtn) return;
    const isAsc = (getUi().sortDir || "desc") === "asc";
    sortDirBtn.textContent = isAsc ? "↑" : "↓";
    sortDirBtn.title = isAsc ? "Aufsteigend" : "Absteigend";
  };
  applySortDirUi();

  // --- extra filters open/close
  // if not provided, derive it from active filters
  if (typeof ui.extraOpen !== "boolean") ui.extraOpen = !!(ui.cat || ui.tag);

  const syncExtraFilters = () => {
    if (!extraFiltersWrap || !extraFiltersBtn) return;
    const open = !!getUi().extraOpen;
    extraFiltersWrap.style.display = open ? "flex" : "none";
    extraFiltersBtn.setAttribute("aria-expanded", open ? "true" : "false");
    extraFiltersBtn.textContent = open ? "Filter ▴" : "Filter ▾";
  };
  setUi(ui);
  syncExtraFilters();

  if (extraFiltersBtn && !extraFiltersBtn.__wired) {
    extraFiltersBtn.__wired = true;
    extraFiltersBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const u = getUi();
      u.extraOpen = !u.extraOpen;
      setUi(u);
      syncExtraFilters();
      // optional persist (not necessary, but allowed)
      onPersist?.({ extraOpen: u.extraOpen });
    });
  }

  // --- events
  if (qEl) {
    qEl.addEventListener("input", () => {
      const u = getUi();
      u.q = qEl.value;
      setUi(u);

      onNavUpdate?.({ ...state, q: qEl.value });
      onRender?.();
    });
  }

  if (catEl) {
    catEl.addEventListener("change", () => {
      const u = getUi();
      u.cat = catEl.value;
      // keep extraOpen derived if not explicit
      if (typeof u.extraOpen !== "boolean") u.extraOpen = !!(u.cat || u.tag);
      setUi(u);

      onPersist?.({ cat: u.cat });
      onNavUpdate?.({ ...state, q: qEl?.value ?? "" });
      onRender?.();
    });
  }

  if (tagEl) {
    tagEl.addEventListener("change", () => {
      const u = getUi();
      u.tag = tagEl.value;
      if (typeof u.extraOpen !== "boolean") u.extraOpen = !!(u.cat || u.tag);
      setUi(u);

      onPersist?.({ tag: u.tag });
      onNavUpdate?.({ ...state, q: qEl?.value ?? "" });
      onRender?.();
    });
  }

  if (sortEl) {
    sortEl.addEventListener("change", () => {
      const u = getUi();
      u.sort = sortEl.value;
      u.sortDir = defaultDirFor(u.sort);
      setUi(u);

      onPersist?.({ sort: u.sort, sortDir: u.sortDir });
      applySortDirUi();
      onNavUpdate?.({ ...state, q: qEl?.value ?? "" });
      onRender?.();
    });
  }

  if (sortDirBtn) {
    sortDirBtn.addEventListener("click", () => {
      const u = getUi();
      u.sortDir = u.sortDir === "asc" ? "desc" : "asc";
      setUi(u);

      onPersist?.({ sortDir: u.sortDir });
      applySortDirUi();
      onNavUpdate?.({ ...state, q: qEl?.value ?? "" });
      onRender?.();
    });
  }

  if (resetEl) {
    resetEl.addEventListener("click", () => {
      const u = getUi();
      u.cat = "";
      u.tag = "";
      u.sort = "new";
      u.sortDir = defaultDirFor(u.sort);
      u.q = "";

      // reflect in DOM
      if (catEl) catEl.value = "";
      if (tagEl) tagEl.value = "";
      if (sortEl) sortEl.value = "new";
      if (qEl) qEl.value = "";

      setUi(u);

      onPersist?.({ cat: "", tag: "", sort: "new", sortDir: u.sortDir });
      applySortDirUi();

      onResetNavigate?.();
      onRender?.();
    });
  }

  return { qEl };
}
