import { escapeHtml, norm, qs, qsa } from "../utils.js";
import { KEYS, lsGetStr, lsSetStr, lsSet } from "../storage.js";
import { exportRecipesToPdfViaPrint } from "../services/pdfExport.js";
import { downloadJson } from "../services/exportDownload.js";
import { buildCookStatsByRecipeId } from "../domain/cooklog.js";
import { isFavorite, toggleFavorite } from "../domain/favorites.js";
import { getTagColors } from "../domain/tagColors.js";
import { getColorForCategory } from "../domain/categories.js";



export function renderListView({ appEl, state, recipes, partsByParent, setView, useBackend, onImportRecipes }) {

  const tagColors = getTagColors();

  const activeSpaceName = state?.spaces?.active?.name
    ?? state?.spaces?.activeSpaceName
    ?? "Mein Space";

  const tagChip = (t) => {
    const col = tagColors[t];
    const style = col ? `style="border-color:${escapeHtml(col)}; background:${escapeHtml(col)}22; color:${escapeHtml(col)}"` : "";
    return `<span class="badge badge--tag" ${style}>#${escapeHtml(t)}</span>`;
  };

  const coverEmoji = (r) => {
    const c = (r.category || "").toLowerCase();
    if (c.includes("früh")) return "☀️";
    if (c.includes("drink") || c.includes("getränk")) return "🥤";
    if (c.includes("dessert") || c.includes("kuchen") || c.includes("süß")) return "🍰";
    if (c.includes("salat")) return "🥗";
    if (c.includes("suppe")) return "🥣";
    return "🍲";
  };

  const coverFallbackHtml = (r, cls) => `
    <div class="${cls} cover-fallback" aria-hidden="true">
      <div class="cover-fallback-emoji">${coverEmoji(r)}</div>
    </div>
  `;

  const imgStyleFromFocus = (focus, { height = 120 } = {}) => {
    const f = (focus && typeof focus === "object") ? focus : {};
    const x = Number.isFinite(Number(f.x)) ? Number(f.x) : 50;
    const y = Number.isFinite(Number(f.y)) ? Number(f.y) : 50;
    const zoom = Number.isFinite(Number(f.zoom)) ? Math.max(1, Math.min(3, Number(f.zoom))) : 1;
    const mode = f.mode === "cover" || f.mode === "crop" || f.mode === "manual" ? "cover" : "auto";

    // auto: show full image (contain). manual/cover: crop + position + optional zoom.
    const fit = mode === "cover" ? "cover" : "contain";
    const pos = `${x}% ${y}%`;
    const scale = mode === "cover" ? zoom : 1;
    const origin = pos;

    return `height:${height}px; object-fit:${fit}; object-position:${pos}; transform:scale(${scale}); transform-origin:${origin};`;
  };



  let viewMode = lsGetStr(KEYS.VIEWMODE, "grid");

  appEl.innerHTML = `
    <div class="container">
      <div class="topbar">
        <div class="row" style="justify-content:space-between; gap:.5rem; align-items:center;">
          <input id="q" type="search" placeholder="Suche… (z.B. Bohnen, scharf, Frühstück)" value="${escapeHtml(state.q)}" />
          <button class="btn btn--ghost" id="shoppingBtn" type="button" title="Einkaufsliste">🧺</button>
                  </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <div>
            <h2>Rezepte</h2>
            <div class="muted" id="count"></div>
            <div class="row" style="justify-content:space-between; gap:.5rem; margin-top:.65rem; flex-wrap:wrap;">
              <button class="btn btn--ghost" id="extraFiltersToggle" type="button" title="Zusätzliche Filter">Filter ▾</button>

              <div id="extraFilters" class="row" style="gap:.5rem; flex-wrap:wrap; display:none;">
                <select id="catFilter" title="Kategorie">
                  <option value="">Alle Kategorien</option>
                </select>

                <select id="tagFilter" title="Tag">
                  <option value="">Alle Tags</option>
                </select>
              </div>

              <button class="btn btn--ghost" id="pendingToggle" type="button" style="display:none;"></button>

              <select id="sortSelect">
                <option value="new">Neu/Alt</option>
                <option value="az">Name</option>
                <option value="time">Dauer</option>
                <option value="lastCooked">Zuletzt gekocht</option>
                <option value="bestRated">Bewertung</option>

              </select>
              <button class="btn btn--ghost" id="sortDirBtn" type="button" title="Sortierung umkehren">↑</button>
              <button class="btn btn--ghost" id="resetFilters" type="button" title="Filter zurücksetzen">↺</button>
            </div>

          </div>

          <div class="seg" aria-label="Ansicht umschalten">
            <button class="seg__btn" id="modeList" type="button" title="Listenansicht" aria-label="Listenansicht">☰</button>
            <button class="seg__btn" id="modeGrid" type="button" title="Gridansicht" aria-label="Gridansicht">▦</button>
          </div>

          <input
            id="importFile"
            type="file"
            accept=".json,.txt,application/json,text/plain"
            style="display:none;"
          />
        </div>
      </div>

      <div id="results"></div>
      <div class="card fab-menu" id="fabMenu" role="menu" aria-label="Schnellaktionen" hidden>
        <button class="btn btn--ghost fab-menu__item" id="fabNew" role="menuitem" type="button" title="Neues Rezept">Neues Rezept</button>
        <button class="btn btn--ghost fab-menu__item" id="fabImport" role="menuitem" type="button" title="Rezepte importieren">Import</button>
        <button class="btn btn--ghost fab-menu__item" id="fabExport" role="menuitem" type="button" title="Rezepte exportieren">Export</button>
      </div>
      <button class="fab" id="addFab" aria-label="Rezept hinzufügen">+</button>
    </div>
  `;
  ;

  const qEl = qs(appEl, "#q");
  const resultsEl = qs(appEl, "#results");
  const countEl = qs(appEl, "#count");
  const modeListBtn = qs(appEl, "#modeList");
  const modeGridBtn = qs(appEl, "#modeGrid");

  const applyModeButtons = () => {
    modeListBtn.classList.toggle("is-active", viewMode === "list");
    modeGridBtn.classList.toggle("is-active", viewMode === "grid");
  };
  const catEl = qs(appEl, "#catFilter");
  const tagEl = qs(appEl, "#tagFilter");
  const extraFiltersBtn = qs(appEl, "#extraFiltersToggle");
  const extraFiltersWrap = qs(appEl, "#extraFilters");
  const sortEl = qs(appEl, "#sortSelect");
  const sortDirBtn = qs(appEl, "#sortDirBtn");
  const resetEl = qs(appEl, "#resetFilters");

  // persisted settings
  let cat = lsGetStr(KEYS.LIST_CAT, "");
  let tag = lsGetStr(KEYS.LIST_TAG, "");
  let sort = lsGetStr(KEYS.LIST_SORT, "new");
  let sortDir = lsGetStr(KEYS.LIST_SORT_DIR, "");

  // normalize legacy values
  if (sort === "az") sort = "az"; // keep value stable

  // default sort direction depends on the field
  const defaultDirFor = (s) => {
    if (s === "az") return "asc";
    if (s === "time") return "asc";
    if (s === "bestRated") return "desc";
    if (s === "lastCooked") return "desc";
    return "desc"; // "new"
  };
  if (sortDir !== "asc" && sortDir !== "desc") sortDir = defaultDirFor(sort);

  const applySortDirUi = () => {
    if (!sortDirBtn) return;
    const isAsc = sortDir === "asc";
    sortDirBtn.textContent = isAsc ? "↑" : "↓";
    sortDirBtn.title = isAsc ? "Aufsteigend" : "Absteigend";
  };

  // init UI state
  catEl.value = cat;
  tagEl.value = tag;

  // Advanced filters (category/tag) are hidden by default, but auto-open if a filter is active.
  let extraOpen = !!(cat || tag);
  const syncExtraFilters = () => {
    if (!extraFiltersWrap || !extraFiltersBtn) return;
    extraFiltersWrap.style.display = extraOpen ? "flex" : "none";
    extraFiltersBtn.setAttribute("aria-expanded", extraOpen ? "true" : "false");
    extraFiltersBtn.textContent = extraOpen ? "Filter ▴" : "Filter ▾";
  };
  syncExtraFilters();
  if (extraFiltersBtn && !extraFiltersBtn.__wired) {
    extraFiltersBtn.__wired = true;
    extraFiltersBtn.addEventListener("click", (e) => {
      e.preventDefault();
      extraOpen = !extraOpen;
      syncExtraFilters();
    });
  }

  const pendingBtn = qs("#pendingToggle", appEl);
  const pendingCount = recipes.filter(r => r._pending).length;
  if (pendingBtn) {
    if (pendingCount > 0) {
      pendingBtn.style.display = "";
      const on = !!(state.ui && state.ui.pendingOnly);
      pendingBtn.textContent = on ? `⏳ ${pendingCount} (nur offene)` : `⏳ ${pendingCount}`;
      pendingBtn.classList.toggle("is-active", on);
      pendingBtn.onclick = () => {
        state.ui = state.ui || {};
        state.ui.pendingOnly = !state.ui.pendingOnly;
        window.dispatchEvent(new window.CustomEvent("tinkeroneo:rerender"));
      };
    } else {
      pendingBtn.style.display = "none";
    }
  }

  sortEl.value = sort;
  applySortDirUi();

  // build tag options
  const tags = Array.from(
    new Set(
      recipes
        .flatMap(r => Array.isArray(r.tags) ? r.tags : [])
        .map(t => String(t || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "de"));

  tagEl.innerHTML = `
    <option value="">Alle Tags</option>
    ${tags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}
  `;

  // build category options
  const cats = Array.from(new Set(recipes.map(r => (r.category ?? "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "de"));

  catEl.innerHTML = `
  <option value="">Alle Kategorien</option>
  ${cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
`;
  catEl.value = cat;
  /* const getFiltered = (q) => {
    const qq = norm(q);
    const sorted = recipes.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return sorted.filter(r => {
      if (!qq) return true;
      const hay = [r.title, r.category, r.time, r.source, ...(r.ingredients ?? []), ...(r.steps ?? [])]
        .map(norm).join(" ");
      return hay.includes(qq);
    });
  }; */
  function parseMinutes(timeStr) {
    const s = String(timeStr ?? "").toLowerCase();

    // z.B. "10 Minuten", "1 h", "1h 20m", "45 min"
    let min = 0;

    const h = s.match(/(\d+)\s*(h|std|stunde|stunden)/);
    if (h) min += parseInt(h[1], 10) * 60;

    const m = s.match(/(\d+)\s*(m|min|minute|minuten)/);
    if (m) min += parseInt(m[1], 10);

    // wenn nur Zahl drin steht (z.B. "15")
    if (!h && !m) {
      const n = s.match(/(\d+)/);
      if (n) min += parseInt(n[1], 10);
    }

    return Number.isFinite(min) ? min : 0;
  }

  function getFiltered(q) {
    const qq = norm(q);

    // 1) filtern
    let list = recipes.filter(r => {
      // optional: show only unsynced (pending) recipes
      if (state?.ui?.pendingOnly && !r._pending) return false;
      if (cat && (r.category ?? "") !== cat) return false;
      if (tag) {
        const rt = Array.isArray(r.tags) ? r.tags : [];
        if (!rt.includes(tag)) return false;
      }

      if (!qq) return true;

      const hay = [
        r.title, r.category, r.time, r.source,
        ...(Array.isArray(r.tags) ? r.tags : []),
        ...(r.ingredients ?? []),
        ...(r.steps ?? [])
      ].map(norm).join(" ");

      return hay.includes(qq);
    });

    const stats = buildCookStatsByRecipeId(list.map(r => r.id));


const sortTitle = (v) => {
  const s = String(v ?? "");
  // strip emojis / pictographs so they don't dominate sorting
  try {
    // Avoid misleading character classes: remove in separate passes.
    return s
      .replace(/\p{Extended_Pictographic}/gu, "")
      .replace(/\u200D/g, "")
      .replace(/\uFE0F/g, "")
      .trim()
      .toLowerCase();
  } catch {
    // fallback for older engines
    return s.replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim().toLowerCase();
  }
};

    // 2) sortieren
    const dir = sortDir === "asc" ? 1 : -1;
    if (sort === "az") {
      list.sort((a, b) => dir * sortTitle(a.title).localeCompare(sortTitle(b.title), "de"));
    } else if (sort === "time") {
      list.sort((a, b) => dir * (parseMinutes(a.time) - parseMinutes(b.time)));
    } else if (sort === "lastCooked") {
      list.sort((a, b) => dir * ((stats.get(a.id)?.lastAt ?? 0) - (stats.get(b.id)?.lastAt ?? 0)));
    } else if (sort === "bestRated") {
      list.sort((a, b) => dir * ((stats.get(a.id)?.avg ?? -1) - (stats.get(b.id)?.avg ?? -1)));
    } else {
      // "new" (created_at)
      list.sort((a, b) => dir * ((a.createdAt ?? 0) - (b.createdAt ?? 0)));
    }

    return list;
  }
  function catAccent(category) {
    // Admin-configured category colors have priority
    const cfg = getColorForCategory(category);
    if (cfg) return cfg;

    const c = String(category ?? "").trim().toLowerCase();

    // fallback palette (gedeckt)
    if (c.includes("früh") || c.includes("breakfast")) return "rgb(255, 214, 140)";
    if (c.includes("mittag") || c.includes("lunch")) return "rgb(208, 232, 186)";
    if (c.includes("abend") || c.includes("dinner")) return "rgb(180, 205, 255)";
    if (c.includes("snack")) return "rgb(231, 212, 255)";
    if (c.includes("dessert") || c.includes("süß")) return "rgb(255, 201, 225)";
    if (c.includes("drink") || c.includes("getränk")) return "rgb(180, 232, 255)";
    return "rgb(210, 225, 220)";
  }

  
  function renderChunked(containerEl, items, renderer, { chunkSize = 60 } = {}) {
    containerEl.innerHTML = "";
    const frag = document.createDocumentFragment();
    let i = 0;

    const pump = () => {
      const end = Math.min(i + chunkSize, items.length);
      for (; i < end; i++) {
        const node = renderer(items[i]);
        if (node) frag.appendChild(node);
      }
      containerEl.appendChild(frag);

      if (i < items.length) {
        requestAnimationFrame(pump);
      }
    };

    pump();
  }

function renderResults() {
    const filtered = getFiltered(qEl.value);
    countEl.textContent = `${filtered.length} von ${recipes.length}`;

    // Large lists: render in chunks to keep UI responsive (mobile)
    const useChunking = filtered.length > 220;

    if (viewMode === "grid") {
      if (!useChunking) {
        resultsEl.innerHTML = `
          <div class="grid">
            ${filtered.map(r => `
              <div class="grid-card" data-id="${escapeHtml(r.id)}" style="--cat-accent:${catAccent(r.category)}">
                <div class="grid-media">
                  ${r.image_url
                    ? `<img class="grid-img" src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.title)}" loading="lazy" style="${imgStyleFromFocus(r.image_focus, { height: 120 })}" />`
                    : coverFallbackHtml(r, "grid-img")
                  }
                  <button class="fav-overlay" data-fav="${escapeHtml(r.id)}" title="Favorit" type="button">${isFavorite(r.id) ? "★" : "☆"}</button>
                  ${r._pending ? `<span class="pill pill-warn pending-overlay" title="Wartet auf Sync">⏳</span>` : ``}
                </div>
                <div class="grid-body">
                  <div class="grid-title"><span>${escapeHtml(r.title)}</span></div>
                  <div class="grid-meta">
                    ${r.category ? `<span class="pill">${escapeHtml(r.category)}</span>` : ``}
                    ${r.time ? `<span class="pill pill-ghost">${escapeHtml(r.time)}</span>` : ``}
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        `;
      } else {
        resultsEl.innerHTML = `<div class="grid" id="gridRoot"></div>`;
        const root = qs(resultsEl, "#gridRoot");
        renderChunked(root, filtered, (r) => {
          const card = document.createElement("div");
          card.className = "grid-card";
          card.dataset.id = r.id;
          card.style.setProperty("--cat-accent", catAccent(r.category));
          card.innerHTML = `
            <div class="grid-media">
              ${r.image_url
                ? `<img class="grid-img" src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.title)}" loading="lazy" style="${imgStyleFromFocus(r.image_focus, { height: 120 })}" />`
                : coverFallbackHtml(r, "grid-img")
              }
              <button class="fav-overlay" data-fav="${escapeHtml(r.id)}" title="Favorit" type="button">${isFavorite(r.id) ? "★" : "☆"}</button>
              ${r._pending ? `<span class="pill pill-warn pending-overlay" title="Wartet auf Sync">⏳</span>` : ``}
            </div>
            <div class="grid-body">
              <div class="grid-title"><span>${escapeHtml(r.title)}</span></div>
              <div class="grid-meta">
                ${r.category ? `<span class="pill">${escapeHtml(r.category)}</span>` : ``}
                ${r.time ? `<span class="pill pill-ghost">${escapeHtml(r.time)}</span>` : ``}
              </div>
            </div>
          `;
          return card;
        });
      }
    } else {
      // list view
      if (!useChunking) {
        resultsEl.innerHTML = `
          <div class="list">
            ${filtered.map(r => `
              <div class="list-item" data-id="${escapeHtml(r.id)}" data-category="${escapeHtml(r.category || "")}" style="--cat-accent:${catAccent(r.category)}">
                <div class="li-left">
                  <div class="li-media">
                    ${r.image_url
                      ? `<img class="li-thumb" src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.title)}" loading="lazy" style="${imgStyleFromFocus(r.image_focus, { height: 64 })}" />`
                      : coverFallbackHtml(r, "li-thumb li-thumb--empty")
                    }
                    <button class="fav-overlay" data-fav="${escapeHtml(r.id)}" title="Favorit" type="button">${isFavorite(r.id) ? "★" : "☆"}</button>
                    ${r._pending ? `<span class="pill pill-warn pending-overlay" title="Wartet auf Sync">⏳</span>` : ``}
                  </div>
                  <div class="li-body">
                    <div class="li-title">${escapeHtml(r.title)}</div>
                    <div class="li-sub">${escapeHtml([r.category, r.time].filter(Boolean).join(" · "))}</div>
                    ${(Array.isArray(r.tags) && r.tags.length)
                      ? `<div class="li-tags">${r.tags.slice(0, 3).map(tagChip).join("")}</div>`
                      : ""}
                  </div>
                </div>
                <div class="li-actions"><div class="li-chev" aria-hidden="true">›</div></div>
              </div>
            `).join("")}
          </div>
        `;
      } else {
        resultsEl.innerHTML = `<div class="list" id="listRoot"></div>`;
        const root = qs(resultsEl, "#listRoot");
        renderChunked(root, filtered, (r) => {
          const item = document.createElement("div");
          item.className = "list-item";
          item.dataset.id = r.id;
          item.style.setProperty("--cat-accent", catAccent(r.category));
          item.innerHTML = `
            <div class="li-left">
              <div class="li-media">
                ${r.image_url
                  ? `<img class="li-thumb" src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.title)}" loading="lazy" style="${imgStyleFromFocus(r.image_focus, { height: 64 })}" />`
                  : coverFallbackHtml(r, "li-thumb li-thumb--empty")
                }
                <button class="fav-overlay" data-fav="${escapeHtml(r.id)}" title="Favorit" type="button">${isFavorite(r.id) ? "★" : "☆"}</button>
                ${r._pending ? `<span class="pill pill-warn pending-overlay" title="Wartet auf Sync">⏳</span>` : ``}
              </div>
              <div class="li-body">
                <div class="li-title">${escapeHtml(r.title)}</div>
                <div class="li-sub">${escapeHtml([r.category, r.time].filter(Boolean).join(" · "))}</div>
                ${(Array.isArray(r.tags) && r.tags.length)
                  ? `<div class="li-tags">${r.tags.slice(0, 3).map(tagChip).join("")}</div>`
                  : ""}
              </div>
            </div>
            <div class="li-actions"><div class="li-chev" aria-hidden="true">›</div></div>
          `;
          return item;
        });
      }
    }

    // Click handlers (delegation)
    resultsEl.onclick = (ev) => {
      const fav = ev.target?.closest?.("[data-fav]");
      if (fav) {
        ev.preventDefault();
        ev.stopPropagation();
        const id = fav.getAttribute("data-fav");
        if (id) {
          toggleFavorite(id);
          renderResults();
        }
        return;
      }
      const card = ev.target?.closest?.("[data-id]");
      const id = card?.dataset?.id;
      if (id) setView({ name: "detail", selectedId: id });
    };
  }

  applyModeButtons();
  renderResults();

  modeListBtn.addEventListener("click", () => {
    viewMode = "list";
    lsSetStr(KEYS.VIEWMODE, viewMode);
    applyModeButtons();
    renderResults();
  });
  modeGridBtn.addEventListener("click", () => {
    viewMode = "grid";
    lsSetStr(KEYS.VIEWMODE, viewMode);
    applyModeButtons();
    renderResults();
  });

  qs(appEl, "#shoppingBtn").addEventListener("click", () => setView({ name: "shopping", selectedId: null, q: qEl.value }));
  // FAB speed-dial
  const fab = qs(appEl, "#addFab");
  const fabMenu = qs(appEl, "#fabMenu");
  const fabNew = qs(appEl, "#fabNew");
  const fabImport = qs(appEl, "#fabImport");
  const fabExport = qs(appEl, "#fabExport");

  const fabItems = [fabNew, fabImport, fabExport].filter(Boolean);
  const prefersReducedMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setRovingTabIndex = (activeIdx) => {
    fabItems.forEach((el, idx) => {
      if (!el) return;
      el.tabIndex = idx === activeIdx ? 0 : -1;
    });
  };

  const closeFabMenu = () => {
    if (!fab || !fabMenu || fabMenu.hidden) return;
    fab.setAttribute("aria-expanded", "false");

    // animate close (if allowed)
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

  const positionFabMenu = () => {
    if (!fabMenu) return;
    // reset any overrides
    fabMenu.style.top = "";
    fabMenu.style.bottom = "";
    // default: above FAB
    fabMenu.style.bottom = `calc(var(--s-5) + 56px + env(safe-area-inset-bottom))`;

    // if the menu would go off the top, pin it to a safe top offset
    const r = fabMenu.getBoundingClientRect();
    if (r.top < 8) {
      fabMenu.style.top = "8px";
      fabMenu.style.bottom = "auto";
    }
  };

  const openFabMenu = () => {
    if (!fab || !fabMenu || !fabMenu.hidden) return;
    fabMenu.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    setRovingTabIndex(0);

    // allow layout, then animate in
    positionFabMenu();
    window.requestAnimationFrame(() => {
      fabMenu.classList.add("is-open");
      positionFabMenu();
      fabItems[0]?.focus();
    });
  };

  if (fab && fabMenu) {
    fab.setAttribute("aria-haspopup", "menu");
    fab.setAttribute("aria-expanded", "false");

    fab.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (fabMenu.hidden) openFabMenu();
      else closeFabMenu();
    });

    // Keep menu open on clicks inside
    fabMenu.addEventListener("click", (e) => e.stopPropagation());

    // Outside click closes
    document.addEventListener("click", () => closeFabMenu());

    // Keyboard nav (ESC + arrows)
    document.addEventListener("keydown", (e) => {
      if (!fabMenu || fabMenu.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeFabMenu();
      }
    });

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
        (document.activeElement)?.click?.();
      }
    });

    if (fabNew) fabNew.addEventListener("click", (e) => {
      e.preventDefault();
      closeFabMenu();
      setView({ name: "add", selectedId: null, q: qEl.value });
    });

    if (fabImport) fabImport.addEventListener("click", (e) => {
      e.preventDefault();
      closeFabMenu();
      openImportSheet({ useBackend, onImportRecipes });
    });

    if (fabExport) fabExport.addEventListener("click", (e) => {
      e.preventDefault();
      closeFabMenu();
      openExportSheet({ list: recipes, spaceName: activeSpaceName, useBackend });
    });
  }

qEl.addEventListener("input", () => {
    // keep in nav
    lsSet(KEYS.NAV, { ...state, q: qEl.value });
    renderResults();
  });


  catEl.addEventListener("change", () => {
    cat = catEl.value;
    lsSetStr(KEYS.LIST_CAT, cat);
    lsSet(KEYS.NAV, { ...state, q: qEl.value }); // optional: wenn du später cat/sort in state aufnehmen willst
    renderResults();
  });

  tagEl.addEventListener("change", () => {
    tag = tagEl.value;
    lsSetStr(KEYS.LIST_TAG, tag);
    lsSet(KEYS.NAV, { ...state, q: qEl.value });
    renderResults();
  });

  sortEl.addEventListener("change", () => {
    sort = sortEl.value;
    lsSetStr(KEYS.LIST_SORT, sort);
    // reset direction to the field default when the field changes
    sortDir = defaultDirFor(sort);
    lsSetStr(KEYS.LIST_SORT_DIR, sortDir);
    if (sortDirBtn) {
      sortDirBtn.textContent = sortDir === "asc" ? "↑" : "↓";
      sortDirBtn.title = sortDir === "asc" ? "Aufsteigend" : "Absteigend";
    }
    lsSet(KEYS.NAV, { ...state, q: qEl.value });
    renderResults();
  });

  if (sortDirBtn) {
    sortDirBtn.addEventListener("click", () => {
      sortDir = sortDir === "asc" ? "desc" : "asc";
      lsSetStr(KEYS.LIST_SORT_DIR, sortDir);
      lsSet(KEYS.NAV, { ...state, q: qEl.value });
      applySortDirUi();
      renderResults();
    });
  }

  resetEl.addEventListener("click", () => {
    cat = "";
    tag = "";
    sort = "new";
    sortDir = defaultDirFor(sort);
    catEl.value = cat;
    tagEl.value = tag;
    sortEl.value = sort;
    if (sortDirBtn) {
      sortDirBtn.textContent = sortDir === "asc" ? "↑" : "↓";
      sortDirBtn.title = sortDir === "asc" ? "Aufsteigend" : "Absteigend";
    }
    lsSetStr(KEYS.LIST_CAT, cat);
    lsSetStr(KEYS.LIST_TAG, tag);
    lsSetStr(KEYS.LIST_SORT, sort);
    lsSetStr(KEYS.LIST_SORT_DIR, sortDir);
    // also reset search
    setView({ name: "list", selectedId: null, q: "" });
    renderResults();
  });

  // Export

  function openExportSheet({ list, partsByParent: partsIndex }) {
    const safeList = Array.isArray(list) ? list : [];
    // backdrop + sheet
    const backdrop = document.createElement("div");
    backdrop.className = "sheet-backdrop";

    const sheet = document.createElement("div");
    sheet.className = "sheet";
    sheet.addEventListener("click", (e) => e.stopPropagation());

    const close = () => { sheet.remove(); backdrop.remove(); };
    backdrop.addEventListener("click", close);

    // default: all selected
    // default: all selected
    const selected = new Set(safeList.map(r => r.id));


    sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="toolbar">
      <div>
        <h3 style="margin:0;">Export</h3>
        <div class="muted">Wähle Rezepte & Format</div>
        <div class="muted">Basis: ${safeList.length} sichtbare Rezepte</div>
      </div>
      <button class="btn btn--ghost" id="exportCloseBtn">Schließen</button>
    </div>

    <hr />

    <div class="card" style="padding:.85rem;">
      <div class="row" style="justify-content:space-between;">
        <div style="font-weight:800;">Rezepte</div>
        <div class="row" style="gap:.5rem;">
          <button class="btn btn--ghost" id="exportSelectAllBtn">Alle</button>
          <button class="btn btn--ghost" id="exportSelectNoneBtn">Keine</button>
        </div>
      </div>
      

      <div style="margin-top:.6rem; max-height: 38vh; overflow:auto; padding-right:.25rem;">
        ${safeList.map(r => `
          <label class="row" style="justify-content:space-between; padding:.35rem 0;">
            <span style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${escapeHtml(r.title || "Rezept")}
            </span>
            <input type="checkbox" data-exp-id="${escapeHtml(r.id)}" checked />
          </label>
        `).join("")}
      </div>
    </div>

    <div class="card" style="padding:.85rem;">
      <div style="font-weight:800; margin-bottom:.35rem;">Format</div>
      <label class="row" style="gap:.5rem; margin:.25rem 0;">
        <input type="radio" name="exportFmt" value="pdf" checked />
        <span>PDF (Drucken → Als PDF speichern)</span>
      </label>
      <label class="row" style="gap:.5rem; margin:.25rem 0;">
        <input type="radio" name="exportFmt" value="json" />
        <span>JSON</span>
      </label>
    </div>

    <div class="row" style="justify-content:space-between;">
      <div class="muted" id="exportCountHint">${safeList.length} ausgewählt</div>
      <button class="btn btn--solid" id="exportDoBtn">Export starten</button>
    </div>
  `;

    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
    backdrop.addEventListener("click", close);

    qs(sheet, "#exportCloseBtn").addEventListener("click", close);

    const updateCount = () => {
      const count = selected.size;
      qs(sheet, "#exportCountHint").textContent = `${count} ausgewählt`;
      qs(sheet, "#exportDoBtn").disabled = count === 0;
    };

    // checkbox binding
    qsa(sheet, "[data-exp-id]").forEach(cb => {
      cb.addEventListener("change", () => {
        const id = cb.dataset.expId;
        if (cb.checked) selected.add(id);
        else selected.delete(id);
        updateCount();
      });
    });

    // select all/none
    qs(sheet, "#exportSelectAllBtn").addEventListener("click", () => {
      selected.clear();
      safeList.forEach(r => selected.add(r.id));
      qsa(sheet, "[data-exp-id]").forEach(cb => { cb.checked = true; });

      updateCount();
    });

    qs(sheet, "#exportSelectNoneBtn").addEventListener("click", () => {
      selected.clear();
      qsa(sheet, "[data-exp-id]").forEach(cb => { cb.checked = false; });

      updateCount();
    });


    // do export
    qs(sheet, "#exportDoBtn").addEventListener("click", () => {
      const fmt = qs(sheet, 'input[name="exportFmt"]:checked')?.value || "pdf";
      const subset = safeList.filter(r => selected.has(r.id));

      if (fmt === "json") {
        downloadJson(`rezepte-export-${new Date().toISOString().slice(0, 10)}.json`, subset);
        close();
        return;
      }

      // PDF via print
      exportRecipesToPdfViaPrint({
        recipes: subset,
        allRecipes: safeList,
        partsByParent: partsIndex,
        includeImages: true
      });
      close();
    });

    updateCount();
  }
  function openImportSheet({ useBackend: useBackendFlag, onImportRecipes: onImportFn }) {
    const backdrop = document.createElement("div");
    backdrop.className = "sheet-backdrop";
    

    const sheet = document.createElement("div");
    sheet.className = "sheet";
    sheet.addEventListener("click", (e) => e.stopPropagation());

    const close = () => { sheet.remove(); backdrop.remove(); };
    backdrop.addEventListener("click", close);

    sheet.innerHTML = `
    <div class="sheet-handle"></div>

    <div class="toolbar">
      <div>
        <h3 style="margin:0;">Import</h3>
        <div class="muted">${useBackendFlag ? "Ziel: Supabase (Backend) + Local Cache" : "Ziel: nur Local Storage"}</div>
      </div>
      <button class="btn btn--ghost" id="impClose">Schließen</button>
    </div>

    <hr />

    <div class="card" style="padding:.85rem;">
      <div style="font-weight:800; margin-bottom:.35rem;">Quelle</div>
      <div class="row" style="gap:.5rem; flex-wrap:wrap;">
        <button class="btn btn--ghost" id="impPickFile">JSON-Datei wählen</button>
        <span class="muted" id="impFileName"></span>
      </div>

      <input id="impFile" type="file" accept="application/json,.json,text/plain,.txt" style="display:none;" />

      <div class="muted" style="margin-top:.65rem;">oder JSON einfügen:</div>
      <textarea id="impPaste" placeholder='[ { "id": "...", "title": "...", ... } ]'></textarea>
    </div>

    <div class="card" style="padding:.85rem;">
      <div style="font-weight:800; margin-bottom:.35rem;">Konflikte (gleiche id)</div>
      <select id="impMode">
        <option value="backendWins" selected>Backend gewinnt (bestehende bleiben)</option>
        <option value="jsonWins">JSON gewinnt (überschreibt bestehende)</option>
        <option value="mergePreferBackend">Merge (Backend gewinnt, JSON füllt Lücken)</option>
        <option value="mergePreferJson">Merge (JSON gewinnt, Backend füllt Lücken)</option>
      </select>

      <div class="muted" style="margin-top:.5rem;">
        Tipp: Wenn du "alles" willst, nimm JSON gewinnt. Wenn du vorsichtig sein willst, nimm Backend gewinnt.
        Standardmodus. Sicher: bestehende Rezepte werden nicht verändert.
      </div>

    </div>

    <div class="row" style="justify-content:space-between;">
      <div class="muted" id="impHint">0 Einträge erkannt</div>
      <button class="btn btn--solid" id="impDo">Import starten</button>
    </div>
  `;

    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
    qs(sheet, "#impClose").addEventListener("click", close);

    const fileBtn = qs(sheet, "#impPickFile");
    const fileInput = qs(sheet, "#impFile");
    const fileNameEl = qs(sheet, "#impFileName");
    const pasteEl = qs(sheet, "#impPaste");
    const modeEl = qs(sheet, "#impMode");
    const hintEl = qs(sheet, "#impHint");
    const doBtn = qs(sheet, "#impDo");

    let parsedItems = [];

    const parsePayload = (text) => {
      let obj;
      try { obj = JSON.parse(text); } catch { return []; }
      const arr = Array.isArray(obj) ? obj : (Array.isArray(obj?.recipes) ? obj.recipes : []);
      return Array.isArray(arr) ? arr : [];
    };

    const refreshHint = () => {
      hintEl.textContent = `${parsedItems.length} Einträge erkannt`;
      doBtn.disabled = parsedItems.length === 0;
    };

    fileBtn.addEventListener("click", () => {
      fileInput.value = "";
      fileInput.click();
    });

    fileInput.addEventListener("change", async () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      fileNameEl.textContent = f.name;
      const text = await f.text();
      parsedItems = parsePayload(text);
      refreshHint();
    });

    pasteEl.addEventListener("input", () => {
      const text = pasteEl.value.trim();
      parsedItems = text ? parsePayload(text) : [];
      refreshHint();
    });

    doBtn.addEventListener("click", async () => {
      const mode = modeEl.value;
      const items = parsedItems;

      try {
        doBtn.disabled = true;
        doBtn.textContent = "Importiere…";
        await onImportFn?.({ items, mode });
        alert(`Import ok: ${items.length} Einträge verarbeitet.`);
        close();
        location.reload();
      } catch (e) {
        console.error(e);
        alert("Import fehlgeschlagen. Details siehe Konsole.");
        doBtn.disabled = false;
        doBtn.textContent = "Import starten";
      }
    });

    refreshHint();
  }

  // Live update of category accents when colors are changed in Admin
  try {
    if (window.__tinkeroneoCatColorsHandler) {
      window.removeEventListener("category-colors-changed", window.__tinkeroneoCatColorsHandler);
    }
    window.__tinkeroneoCatColorsHandler = () => {
      document.querySelectorAll(".list-item[data-category]").forEach((el) => {
        const catVal = el.getAttribute("data-category") || "";
        el.style.setProperty("--cat-accent", catAccent(catVal));
      });
    };
    window.addEventListener("category-colors-changed", window.__tinkeroneoCatColorsHandler);
  } catch {
    // ignore
  }

}
