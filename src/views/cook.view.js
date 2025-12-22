import { escapeHtml, qs, qsa } from "../utils.js";
import { splitStepsToCards, stepDoneKey, parseDurationSeconds, formatTime } from "../domain/steps.js";
import { buildMenuStepSections } from "../domain/menu.js";
import { renderIngredientsHtml } from "./shared.ingredients.js";
import { createBeep, createTimerManager, renderTimersBarHtml } from "../domain/timers.js";

export function renderCookView({ appEl, state, recipes, partsByParent, setView }) {
  const r = recipes.find(x => x.id === state.selectedId);
  if (!r) return setView({ name: "list", selectedId: null, q: state.q });

  const isMenu = (partsByParent.get(r.id)?.length ?? 0) > 0;
  const cookSections = isMenu
    ? buildMenuStepSections(r, recipes, partsByParent)
    : [{ recipeId: r.id, title: r.title, cards: splitStepsToCards(r.steps ?? []) }];

  // done per root recipe
  const doneKey = `tinkeroneo_steps_${r.id}`;
  let done = {};
  try { done = JSON.parse(localStorage.getItem(doneKey) || "{}"); } catch { done = {}; }
  const saveDone = () => localStorage.setItem(doneKey, JSON.stringify(done));

  // timers per root recipe
  const timersKey = `tinkeroneo_timers_${r.id}`;
  const audio = createBeep();

  appEl.innerHTML = `
    <div class="container">
      <div class="card">
        <button class="btn btn-ghost" id="backBtn">← Zurück</button>
        <h2>👩‍🍳 ${escapeHtml(r.title)}</h2>
        <div class="muted">${escapeHtml(r.category ?? "")}${r.time ? " · " + escapeHtml(r.time) : ""}</div>

        ${r.image_url ? `
          <div style="margin:.75rem 0;">
            <img src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.title)}"
                 style="width:100%; border-radius:12px; display:block;" />
          </div>
        ` : ""}

        <div id="timerRoot"></div>

        <hr />
        <h3>Schritte</h3>
        <div>
          ${cookSections.map(sec => `
            <div style="margin-top:.75rem;">
              ${isMenu ? `<div class="muted" style="font-weight:850; margin-bottom:.25rem;">${escapeHtml(sec.title)}</div>` : ""}
              <ol class="steps-checklist">
                ${sec.cards.map((c, idx) => {
                  const combined = [c.title, ...(c.body ?? [])].join(" ");
                  const dur = parseDurationSeconds(combined);
                  const key = stepDoneKey(sec.recipeId, idx);
                  const title = `${sec.title}: ${c.title}`.slice(0, 80);

                  return `
                    <li>
                      <div style="font-weight:800; margin-bottom:.25rem;">${escapeHtml(c.title)}</div>

                      ${c.body.length ? `
                        <div class="${done[key] ? "step-done" : ""}" data-stepbody="${escapeHtml(key)}" style="margin-bottom:.35rem;">
                          ${escapeHtml(c.body.join(" "))}
                        </div>
                      ` : ""}

                      <label style="display:flex; gap:.6rem; align-items:center; cursor:pointer;">
                        <input type="checkbox" data-stepkey="${escapeHtml(key)}" ${done[key] ? "checked" : ""} />
                        <span class="muted">Erledigt</span>
                      </label>

                      ${dur ? `
                        <div class="timer-pill">
                          <span class="muted">⏱ ${escapeHtml(formatTime(dur))}</span>
                          <button class="btn btn-ghost" data-start-timer="${escapeHtml(key)}" data-title="${escapeHtml(title)}" data-seconds="${dur}" type="button">Start</button>
                        </div>
                      ` : ""}
                    </li>
                  `;
                }).join("")}
              </ol>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="cookbar">
        <div class="row">
          <button class="btn btn-ghost" id="ingredientsBtn">Zutaten</button>
          <button class="btn btn-ghost" id="resetBtn">Reset Steps</button>
        </div>
      </div>

      <div id="sheetRoot"></div>
    </div>
  `;

  const timerRoot = qs(appEl, "#timerRoot");
  const sheetRoot = qs(appEl, "#sheetRoot");

  const tm = createTimerManager({
    storageKey: timersKey,
    onRender: (snap) => {
      timerRoot.innerHTML = renderTimersBarHtml(snap);

      // bind timer controls
      qsa(timerRoot, "[data-timer-stop]").forEach(b => {
        b.addEventListener("click", () => tm.removeTimer(b.dataset.timerStop));
      });
      qsa(timerRoot, "[data-timer-plus]").forEach(b => {
        b.addEventListener("click", () => tm.addTime(b.dataset.timerPlus, 60));
      });
    },
    onFire: () => {
      // fire twice
      audio.beep(); audio.beep();
    }
  });

  // prime audio on any user click inside cook view (mobile reliable)
  appEl.addEventListener("click", audio.prime, { once: true });

  qs(appEl, "#backBtn").addEventListener("click", () => {
    tm.dispose();
    setView({ name: "detail", selectedId: r.id, q: state.q });
  });

  qs(appEl, "#ingredientsBtn").addEventListener("click", () => {
    sheetRoot.innerHTML = `
      <div class="sheet-backdrop" id="backdrop"></div>
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-handle"></div>
        <div class="row" style="justify-content:space-between; align-items:center; gap:.5rem;">
          <h3 style="margin:0;">Zutaten</h3>
          <button class="btn btn-ghost" id="closeSheet">Schließen</button>
        </div>
        <div style="margin-top:.75rem;">
          ${renderIngredientsHtml(r.ingredients ?? [])}
        </div>
      </div>
    `;
    qs(sheetRoot, "#backdrop").addEventListener("click", () => sheetRoot.innerHTML = "");
    qs(sheetRoot, "#closeSheet").addEventListener("click", () => sheetRoot.innerHTML = "");
  });

  qsa(appEl, 'input[type="checkbox"][data-stepkey]').forEach(cb => {
    cb.addEventListener("change", () => {
      const key = cb.dataset.stepkey;
      done[key] = cb.checked;
      saveDone();

      const body = qs(appEl, `[data-stepbody="${CSS.escape(key)}"]`);
      if (body) body.classList.toggle("step-done", cb.checked);
    });
  });

  qsa(appEl, "[data-start-timer]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.startTimer;
      const title = btn.dataset.title || "Timer";
      const dur = parseInt(btn.dataset.seconds, 10);
      if (!dur) return;
      audio.prime();
      tm.addTimer(key, title, dur);
    });
  });

  qs(appEl, "#resetBtn").addEventListener("click", () => {
    if (!confirm("Alle Schritt-Häkchen zurücksetzen?")) return;
    done = {};
    saveDone();
    renderCookView({ appEl, state, recipes, partsByParent, setView });
  });
}
