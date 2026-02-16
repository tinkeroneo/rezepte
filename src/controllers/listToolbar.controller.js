// src/controllers/listToolbar.controller.js
import { escapeHtml } from "../utils.js";

function uniqStrings(values) {
  return Array.from(new Set((values || []).map((v) => String(v || "").trim()).filter(Boolean)));
}

function collectCategories(recipes) {
  return uniqStrings((Array.isArray(recipes) ? recipes : []).map((r) => r.category)).sort((a, b) => a.localeCompare(b, "de"));
}

function collectTags(recipes, selectedCats) {
  const catSet = new Set(uniqStrings(selectedCats));
  const source = (Array.isArray(recipes) ? recipes : []).filter((r) => {
    if (!catSet.size) return true;
    return catSet.has(String(r.category || "").trim());
  });
  return uniqStrings(source.flatMap((r) => (Array.isArray(r.tags) ? r.tags : []))).sort((a, b) => a.localeCompare(b, "de"));
}

export function initListToolbar({
  appEl,
  state,
  recipes,
  getUi,
  setUi,
  defaultDirFor,
  onRender,
  onResetNavigate,
  onPersist,
  onNavUpdate
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
  ui.cats = uniqStrings(ui.cats || (ui.cat ? [ui.cat] : []));
  ui.tags = uniqStrings(ui.tags || (ui.tag ? [ui.tag] : []));
  ui.cat = ui.cats[0] || "";
  ui.tag = ui.tags[0] || "";
  setUi(ui);

  const allCategories = collectCategories(recipes);

  function renderCategoryOptions() {
    if (!catEl) return;
    const selected = new Set(getUi().cats || []);
    const options = allCategories.filter((c) => !selected.has(c));
    catEl.innerHTML = `
      <option value="">Kategorie +</option>
      ${options.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
    `;
    catEl.value = "";
  }

  function renderTagOptions() {
    if (!tagEl) return;
    const u = getUi();
    const selectedTags = new Set(u.tags || []);
    const available = collectTags(recipes, u.cats || []);
    const options = available.filter((t) => !selectedTags.has(t));
    tagEl.innerHTML = `
      <option value="">Tag +</option>
      ${options.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}
    `;
    tagEl.value = "";
  }

  function pruneInvalidSelectedTags() {
    const u = getUi();
    const available = new Set(collectTags(recipes, u.cats || []));
    const pruned = uniqStrings((u.tags || []).filter((t) => available.has(t)));
    if (pruned.length !== (u.tags || []).length) {
      u.tags = pruned;
      u.tag = pruned[0] || "";
      setUi(u);
      onPersist?.({ tags: u.tags, tag: u.tag });
    }
  }

  if (qEl && typeof ui.q === "string") qEl.value = ui.q;
  if (sortEl) sortEl.value = ui.sort || "az";

  if (ui.sortDir !== "asc" && ui.sortDir !== "desc") {
    ui.sortDir = defaultDirFor(ui.sort || "az");
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

  if (typeof ui.extraOpen !== "boolean") ui.extraOpen = !!((ui.cats || []).length || (ui.tags || []).length);
  const syncExtraFilters = () => {
    if (!extraFiltersWrap || !extraFiltersBtn) return;
    const open = !!getUi().extraOpen;
    extraFiltersWrap.style.display = open ? "flex" : "none";
    extraFiltersBtn.setAttribute("aria-expanded", open ? "true" : "false");
    extraFiltersBtn.textContent = open ? "Filter ▴" : "Filter ▾";
  };
  syncExtraFilters();

  renderCategoryOptions();
  renderTagOptions();

  if (extraFiltersBtn && !extraFiltersBtn.__wired) {
    extraFiltersBtn.__wired = true;
    extraFiltersBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const u = getUi();
      u.extraOpen = !u.extraOpen;
      setUi(u);
      syncExtraFilters();
      onPersist?.({ extraOpen: u.extraOpen });
    });
  }

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
      const next = String(catEl.value || "").trim();
      if (!next) return;
      const u = getUi();
      u.cats = uniqStrings([...(u.cats || []), next]);
      u.cat = u.cats[0] || "";
      if (typeof u.extraOpen !== "boolean") u.extraOpen = true;
      setUi(u);
      pruneInvalidSelectedTags();
      renderCategoryOptions();
      renderTagOptions();
      onPersist?.({ cats: u.cats, cat: u.cat });
      onNavUpdate?.({ ...state, q: qEl?.value ?? "" });
      onRender?.();
    });
  }

  if (tagEl) {
    tagEl.addEventListener("change", () => {
      const next = String(tagEl.value || "").trim();
      if (!next) return;
      const u = getUi();
      u.tags = uniqStrings([...(u.tags || []), next]);
      u.tag = u.tags[0] || "";
      if (typeof u.extraOpen !== "boolean") u.extraOpen = true;
      setUi(u);
      renderTagOptions();
      onPersist?.({ tags: u.tags, tag: u.tag });
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
      u.cats = [];
      u.tags = [];
      u.cat = "";
      u.tag = "";
      u.sort = "new";
      u.sortDir = defaultDirFor(u.sort);
      u.q = "";
      if (sortEl) sortEl.value = "new";
      if (qEl) qEl.value = "";
      setUi(u);
      renderCategoryOptions();
      renderTagOptions();
      onPersist?.({ cats: [], tags: [], cat: "", tag: "", sort: "new", sortDir: u.sortDir });
      applySortDirUi();
      onResetNavigate?.();
      onRender?.();
    });
  }

  const syncFromUi = (nextUi) => {
    if (!nextUi) return;
    const merged = {
      ...nextUi,
      cats: uniqStrings(nextUi.cats || (nextUi.cat ? [nextUi.cat] : [])),
      tags: uniqStrings(nextUi.tags || (nextUi.tag ? [nextUi.tag] : [])),
    };
    setUi(merged);
    if (qEl && typeof merged.q === "string") qEl.value = merged.q;
    if (sortEl) sortEl.value = merged.sort || "az";
    if (typeof merged.sortDir === "string") applySortDirUi();
    if (typeof merged.extraOpen === "boolean") syncExtraFilters();
    pruneInvalidSelectedTags();
    renderCategoryOptions();
    renderTagOptions();
  };

  return {
    qEl,
    syncFromUi,
    getControls: () => ({ qEl, catEl, tagEl, sortEl, sortDirBtn, resetEl, extraFiltersBtn, extraFiltersWrap })
  };
}
