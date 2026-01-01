// src/render/listShell.js
import { escapeHtml } from "../utils.js";

export function renderListShell({ q = "" } = {}) {
  return `
    <div class="container">
      <div class="card">
        <div class="toolbar">
          <div>
            <div class="toolbar-header">
              <h2>Rezepte</h2>
              <div class="muted" id="count"></div>

              <div class="seg" aria-label="Ansicht umschalten">
                <button class="seg__btn" id="modeList" type="button" title="Listenansicht" aria-label="Listenansicht">☰</button>
                <button class="seg__btn" id="modeGrid" type="button" title="Gridansicht" aria-label="Gridansicht">▦</button>
              </div>
            </div>

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

              <button class="btn btn--ghost" id="pendingToggle" type="button" style="display:none;">⌛</button>

              <select id="sortSelect">
                <option value="new">Erstelldatum</option>
                <option value="az">Name</option>
                <option value="time">Kochdauer</option>
                <option value="lastCooked">Zuletzt gekocht</option>
                <option value="bestRated">Bewertung</option>
              </select>

              <button class="btn btn--ghost" id="sortDirBtn" type="button" title="Sortierung umkehren">↑</button>
              <button class="btn btn--ghost" id="resetFilters" type="button" title="Filter zurücksetzen">↺</button>
            </div>

            <div class="row" style="justify-content:space-between; gap:.5rem; align-items:center;">
              <input id="q" type="search" placeholder="Suche… (z.B. Bohnen, scharf, Frühstück)" value="${escapeHtml(q)}" />
            </div>
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
}
