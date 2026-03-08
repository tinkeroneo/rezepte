import { escapeHtml, qs, recipeImageOrDefault } from "../utils.js";
import { splitStepsToCards, stepDoneKey, parseDurationSeconds, formatTime } from "../domain/steps.js";
import { buildMenuStepSections } from "../domain/menu.js";
import { createBeep } from "../domain/timers.js";
import { createCookIngredientsSheet } from "./cook.ingredients.js";
import { createCookTimers } from "./cook.timers.js";
import { wireCookSteps } from "./cook.steps.js";

// Kochverlauf/Bewertung ist in der Detail-View (nicht hier),
// damit Steps/Timer nicht verdeckt werden.
let __audioPrimedOnce = false;


export function renderCookView({ appEl, state, recipes, partsByParent, setView, setViewCleanup }) {
  const r = recipes.find(x => x.id === state.selectedId);
   if (!r) return setView({ name: "list", selectedId: null, q: state.q });

  const settings = window.__tinkeroneoSettings || {};
  const timerSoundId = settings.readTimerSoundId ? String(settings.readTimerSoundId() || "bowl") : "gong";
  const timerSoundVolume = settings.readTimerSoundVolume ? Number(settings.readTimerSoundVolume() ?? 0.65) : 0.65;
  const audio = createBeep({ soundId: timerSoundId, volume: timerSoundVolume });

  // Cook-View soll moeglichst koch-fokussiert sein (Steps + Timer).
  // Kochverlauf/Bewertung ist in der Detail-View.

 
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
  const timersKey = "tinkeroneo_timers_v1";

  // (keine Events hier - in Detailview)

  appEl.innerHTML = `
    <div class="container">
      <div class="card">
        <h2>👩‍🍳 ${escapeHtml(r.title)}</h2>


        <div class="muted">
          <button class="btn btn--ghost" id="resetBtn">Schritte zurücksetzen</button>
          ${escapeHtml(r.category ?? "")}
          ${r.time ? " · " + escapeHtml(r.time) : ""}
        </div>
        <details class="image-toggle"> 
        
          <summary>Bild anzeigen</summary>
          ${recipeImageOrDefault(r.image_url) ? `
            <div style="margin:.75rem 0;">
              <img src="${escapeHtml(recipeImageOrDefault(r.image_url))}"
                data-default-img="${r.image_url ? "" : "1"}"
                alt="${escapeHtml(r.title)}"
                style="width:100%; border-radius:12px; display:block;"
                onerror="this.onerror=null;this.src=new URL((document.documentElement?.dataset?.theme==='dark' ? 'src/favicon/faviconDark.svg' : 'src/favicon/favicon.svg'), document.baseURI).toString();" />
            </div>
        ` : ""}</details>

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
                    <li data-stepwrap="${escapeHtml(key)}" class="${done[key] ? "step-item-done" : ""}">
                      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:.75rem; margin-bottom:.25rem;">
                        <div style="font-weight:800; min-width:0; flex:1;">${escapeHtml(c.title)}</div>
                        <label style="display:flex; align-items:center; justify-content:center; cursor:pointer; flex:0 0 auto; margin:0;">
                          <input type="checkbox" data-stepkey="${escapeHtml(key)}" ${done[key] ? "checked" : ""} aria-label="Schritt erledigt" />
                        </label>
                      </div>

                      ${c.body.length ? `
                        <div class="${done[key] ? "step-done" : ""}" data-stepbody="${escapeHtml(key)}" style="margin-bottom:.35rem;${done[key] ? "display:none;" : ""}">
                          ${escapeHtml(c.body.join(" "))}
                        </div>
                      ` : ""}

                      ${dur ? `
                        <div class="timer-pill">
                          <span class="muted">⏱ ${escapeHtml(formatTime(dur))}</span>
                          <button class="btn btn--ghost" data-start-timer="${escapeHtml(key)}" data-title="${escapeHtml(title)}" data-seconds="${dur}" type="button">Start</button>
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
        <div class="cookbar-row">
          <button class="btn btn--solid" id="ingredientsBtn">Zutaten</button>
          <div id="timerRoot" class="timerroot-dock"></div>
        </div>
      </div>

      <div id="sheetRoot"></div>
    </div>
  `;

  const timerRoot = qs(appEl, "#timerRoot");
  const sheetRoot = qs(appEl, "#sheetRoot");

  const ingredientsSheet = createCookIngredientsSheet({
    sheetRoot,
    recipe: r,
    recipes,
    partsByParent,
    isMenu,
  });

  // Kochverlauf / Bewertung ist in der Detail-View

  const tm = createCookTimers({
    appEl,
    timerRoot,
    settings,
    storageKey: timersKey,
    audio,
  });

  // prime audio on any user click inside cook view (mobile reliable)
  appEl.addEventListener("click", audio.prime, { once: true });

  qs(appEl, "#ingredientsBtn").addEventListener("click", () => {
    if (ingredientsSheet.hasOpenSheet()) {
      ingredientsSheet.close();
      return;
    }
    ingredientsSheet.render();
  });

  // Radio ist global (Header-Button + Radio-Dock). In der CookView kein extra Button,
  // damit der Fokus auf Steps + Timern bleibt.

  wireCookSteps({
    appEl,
    audio,
    getAudioPrimed: () => __audioPrimedOnce,
    setAudioPrimed: (next) => { __audioPrimedOnce = !!next; },
    done,
    saveDone,
    timerManager: tm,
    recipeId: r.id,
  });

  qs(appEl, "#resetBtn").addEventListener("click", () => {
    if (!confirm("Alle Schritt-Häkchen zurücksetzen?")) return;
    done = {};
    saveDone();
    ingredientsSheet.reset();
    renderCookView({ appEl, state, recipes, partsByParent, setView });
  });
}
