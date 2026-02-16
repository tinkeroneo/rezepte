// src/views/list.view.js
import { escapeHtml, qs } from "../utils.js";
import { KEYS, lsSet } from "../storage.js";

import { toggleFavorite } from "../domain/favorites.js";
import { getTagColors } from "../domain/tagColors.js";
import { getColorForCategory } from "../domain/categories.js";
import { getPendingRecipeIds } from "../domain/offlineQueue.js";

import { applyListQuery, defaultDirFor } from "../domain/listQuery.js";

import { renderListResults } from "../render/renderList.js";
import { renderGridItem } from "../render/renderGridItem.js";
import { renderListItem } from "../render/renderListItem.js";

import { bindListResultsEvents } from "../controllers/listResults.controller.js";
import { initListToolbar } from "../controllers/listToolbar.controller.js";
import { initPendingToggle } from "../controllers/listPending.controller.js";
import { initListMode } from "../controllers/listMode.controller.js";

import { openExportSheet } from "../ui/exportSheet.js";
import { openImportSheet } from "../ui/importSheet.js";
import { initFabMenu } from "../ui/fabMenu.js";

import { watchCategoryAccents } from "../services/categoryAccentWatcher.js";

import { renderListShell } from "../render/listShell.js";

import { loadListUiState, patchListUiState } from "../services/listUiStateStore.js";

import { renderActiveFilterChips } from "../render/activeFilterChips.js";


export function renderListView({
  appEl,
  state,
  recipes,
  partsByParent,
  setView,
  canWrite,
  mySpaces,
  activeSpaceId,
  useBackend, // currently unused here, kept for signature compatibility
  onImportRecipes
}) {
  const __pendingIds = getPendingRecipeIds();
  const canWriteFlag = !!canWrite;

  const tagColors = getTagColors();

  const activeSpaceName =
    state?.spaces?.active?.name ??
    state?.spaces?.activeSpaceName ??
    "Mein Space";

  const tagChip = (t) => {
    const col = tagColors[t];
    const style = col
      ? `style="border-color:${escapeHtml(col)}; background:${escapeHtml(col)}22; color:${escapeHtml(col)}"`
      : "";
    return `<span class="badge badge--tag" ${style}>#${escapeHtml(t)}</span>`;
  };

  const coverEmoji = (r) => {
    const c = (r.category || "").toLowerCase();
    if (c.includes("früh")) return "☀️";
    if (c.includes("drink") || c.includes("getränk")) return "🥤";
    if (c.includes("dessert") || c.includes("kuchen") || c.includes("süß")) return "🍰";
    if (c.includes("salat")) return "🥗";
    if (c.includes("suppe")) return "🥣";
    return "q(°.°)p";
  };

  const coverFallbackHtml = (r, cls) => `
    <div class="${cls} cover-fallback" aria-hidden="true">
      <div class="cover-fallback-emoji">${coverEmoji(r)}</div>
    </div>
  `;

  const persistedUi = loadListUiState({ KEYS, defaultDirFor });
  let viewMode = persistedUi.viewMode;


  appEl.innerHTML = renderListShell({ q: state?.q ?? "" });


  // Elements
  const qEl = qs(appEl, "#q");
  const resultsEl = qs(appEl, "#results");
  const countEl = qs(appEl, "#count");

  // Category accent function
  function catAccent(category) {
    const cfg = getColorForCategory(category);
    if (cfg) return cfg;

    const c = String(category ?? "").trim().toLowerCase();
    if (c.includes("früh") || c.includes("breakfast")) return "rgb(255, 214, 140)";
    if (c.includes("mittag") || c.includes("lunch")) return "rgb(208, 232, 186)";
    if (c.includes("abend") || c.includes("dinner")) return "rgb(180, 205, 255)";
    if (c.includes("snack")) return "rgb(231, 212, 255)";
    if (c.includes("dessert") || c.includes("süß")) return "rgb(255, 201, 225)";
    if (c.includes("drink") || c.includes("getränk")) return "rgb(180, 232, 255)";
    return "rgb(210, 225, 220)";
  }

  // Render ctx for items
  const renderCtx = {
    catAccent,
    coverFallbackHtml,
    tagChip,
    pendingIds: __pendingIds
  };
  const renderGridItemHtml = (r) => renderGridItem(r, renderCtx);
  const renderListItemHtml = (r) => renderListItem(r, renderCtx);

  // Local UI state (toolbar writes into this)
let ui = {
  q: state?.q ?? "",
  cats: Array.isArray(persistedUi.cats) ? persistedUi.cats : (persistedUi.cat ? [persistedUi.cat] : []),
  tags: Array.isArray(persistedUi.tags) ? persistedUi.tags : (persistedUi.tag ? [persistedUi.tag] : []),
  cat: persistedUi.cat,
  tag: persistedUi.tag,
  sort: persistedUi.sort,
  sortDir: persistedUi.sortDir,
  extraOpen: persistedUi.extraOpen,
  pendingOnly: persistedUi.pendingOnly
};


  const getUi = () => ui;
  const setUi = (next) => {
    ui = { ...ui, ...(next || {}) };
  };

  // Render results (uses toolbar state + current viewMode)
  function renderResults() {
    const u = getUi();

    const filtered = applyListQuery({
      recipes,
      query: u.q ?? (qEl?.value ?? ""),
      cats: u.cats,
      tags: u.tags,
      cat: u.cat,
      tag: u.tag,
      sort: u.sort,
      sortDir: u.sortDir,
      pendingOnly: !!u.pendingOnly,
      pendingIds: __pendingIds
    });

    if (countEl) countEl.textContent = `${filtered.length} von ${recipes.length}`;

    const useChunking = filtered.length > 220;

    renderListResults({
      resultsEl,
      filtered,
      viewMode,
      useChunking,
      renderGridItemHtml,
      renderListItemHtml
    });
        const chipsEl = qs(appEl, "#activeFilters");
    if (chipsEl) {
      chipsEl.innerHTML = renderActiveFilterChips({ ui: u });
      chipsEl.style.display = chipsEl.innerHTML ? "flex" : "none";
    }


  }

  // One-time delegated click handlers for results
  bindListResultsEvents({
    resultsEl,
    onToggleFavorite: (id) => {
      toggleFavorite(id);
      renderResults();
    },
    onOpenRecipe: (id) => {
      setView({ name: "detail", selectedId: id });
    }
  });

  // Toolbar controller (wires q/cat/tag/sort/sortDir/reset + builds options)
const toolbarApi = initListToolbar({
  appEl,
  state,
  recipes,
  getUi,
  setUi,
  defaultDirFor,
  onPersist: (patch) => patchListUiState({ KEYS }, patch),
  onNavUpdate: (nav) => lsSet(KEYS.NAV, nav),
  onRender: () => renderResults(),
  onResetNavigate: () => setView({ name: "list", selectedId: null, q: "" })
});

  const chipsEl = qs(appEl, "#activeFilters");
  if (chipsEl && !chipsEl.__wired) {
    chipsEl.__wired = true;

    chipsEl.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-chip]");
      if (!btn) return;

      const key = btn.getAttribute("data-chip");
      const u = getUi();

      if (key === "q") u.q = "";
      if (key?.startsWith("cat:")) {
        const val = key.slice(4);
        u.cats = (u.cats || []).filter((x) => x !== val);
        u.cat = u.cats[0] || "";
      }
      if (key?.startsWith("tag:")) {
        const val = key.slice(4);
        u.tags = (u.tags || []).filter((x) => x !== val);
        u.tag = u.tags[0] || "";
      }
      if (key === "pendingOnly") u.pendingOnly = false;
      if (key === "sort") {
        u.sort = "new";
        u.sortDir = defaultDirFor("new");
      }

      // keep extra filters open if user had it open, but also derive if not explicit
      if (typeof u.extraOpen !== "boolean") u.extraOpen = !!((u.cats || []).length || (u.tags || []).length);

      setUi(u);

      // persist the relevant fields
      patchListUiState({ KEYS }, {
        cats: u.cats,
        tags: u.tags,
        cat: u.cat,
        tag: u.tag,
        sort: u.sort,
        sortDir: u.sortDir,
        pendingOnly: u.pendingOnly,
        extraOpen: u.extraOpen
      });

      // sync toolbar DOM
      toolbarApi?.syncFromUi?.(u);

      // ensure nav q is updated too
      lsSet(KEYS.NAV, { ...state, q: u.q });

      renderResults();
    });
  }


initPendingToggle({
  appEl,
  recipes,
  pendingIds: __pendingIds,
  getUi,
  setUi,
  onPersist: (patch) => patchListUiState({ KEYS }, patch),
  onRender: () => renderResults()
});


  // Mode buttons (controller) + persistence
  initListMode({
    appEl,
    initialMode: viewMode,
onModeChanged: (m) => {
  viewMode = m;
  patchListUiState({ KEYS }, { viewMode });
  renderResults();
}

  });

  // Initial render
  renderResults();

  // FAB menu (modular)
  initFabMenu({
    appEl,
    canWrite: canWriteFlag,
    onNew: () => setView({ name: "add", selectedId: null, q: qEl?.value ?? "" }),
    onImport: () => openImportSheet({ onImportRecipes, spaces: mySpaces, activeSpaceId }),
    onExport: () =>
      openExportSheet({
        list: recipes,
        partsByParent,
        spaceName: activeSpaceName
      })
  });

  // Live update of category accents when colors are changed in Admin
  watchCategoryAccents({ catAccent });
}
