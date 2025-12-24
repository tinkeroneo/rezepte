import { escapeHtml, qs, qsa } from "../utils.js";
import { splitStepsToCards, stepDoneKey, parseDurationSeconds, formatTime } from "../domain/steps.js";
import { buildMenuStepSections, buildMenuIngredients } from "../domain/menu.js";
import { renderIngredientsHtml } from "./shared.ingredients.js";
import { createBeep, createTimerManager, renderTimersBarHtml } from "../domain/timers.js";
import { ack } from "../ui/feedback.js";

import {
  addCookEvent,
  getLastCooked,
  getAvgRating,
  getRatingCount,
  listCookEvents,
  updateCookEvent,
  deleteCookEvent,
  pullCookEventsFromBackend,
  pushCookEventToBackend,
  removeCookEventFromBackend
} from "../domain/cooklog.js";
const __pulledCookEvents = new Set(); // recipeId
const audio = createBeep()
let __audioPrimedOnce = false;


export function renderCookView({ appEl, state, recipes, partsByParent, setView }) {
  const r = recipes.find(x => x.id === state.selectedId);
   if (!r) return setView({ name: "list", selectedId: null, q: state.q });

  // pull cook events once per recipe (best effort)
  if (!__pulledCookEvents.has(r.id)) {
    __pulledCookEvents.add(r.id);
    pullCookEventsFromBackend(r.id)
      .then(() => renderCookView({ appEl, state, recipes, partsByParent, setView }))
      .catch(() => { }); // offline ok
  }

  const last = getLastCooked(r.id);
  const avg = getAvgRating(r.id);
  const avgCount = getRatingCount(r.id);

  const avgRounded = avg ? Math.round(avg) : 0; // für Sterne (0..5)
  const avgLabel = avg ? avg.toFixed(1) : "—";

  const lastStr = last
    ? new Date(last.at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })
    : "—";

 
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

  const events = listCookEvents(r.id).slice(0, 8);

  appEl.innerHTML = `
    <div class="container">
      <div class="card">
        <button class="btn btn-ghost" id="backBtn">← Zurück</button>
        <h2>👩‍🍳 ${escapeHtml(r.title)}</h2>
        <div class="row" style="justify-content:space-between; gap:.75rem; flex-wrap:wrap; margin:.35rem 0 .75rem;">
          <div class="muted">Zuletzt gekocht: <b>${escapeHtml(lastStr)}</b></div>

          <div class="row" style="gap:.35rem; align-items:center; flex-wrap:wrap;">
            <button class="btn btn-ghost" id="cookLogNowBtn" type="button" title="Heute gekocht">✅</button>

           <div class="row" id="cookStars" style="gap:.15rem; align-items:center;">
              ${[1, 2, 3, 4, 5].map(n => `
                <button type="button"
                        class="btn btn-ghost"
                        data-cook-rate="${n}"
                        title="${n} Sterne"
                        style="padding:.35rem .5rem;">
                  ${n <= avgRounded ? "★" : "☆"}
                </button>
              `).join("")}

              <span class="muted" style="margin-left:.35rem;" title="Durchschnitt aus ${avgCount} Bewertungen">
                Ø ${escapeHtml(avgLabel)}
              </span>
            </div>
            

          </div>
        </div>


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
        <div class="card">
              <div class="toolbar">
                <div>
                  <h3 style="margin:0;">Kochverlauf</h3>
                  <div class="muted">Letzte ${events.length} Einträge</div>
                </div>
              </div>

              ${events.length ? `
                <div style="margin-top:.5rem;">
                  ${events.map(ev => `
                    <div class="row" style="justify-content:space-between; align-items:flex-start; padding:.45rem 0; border-top:1px solid #eee;">
                      <div style="min-width:0;">
                        <div style="font-weight:650;">
                          ${new Date(ev.at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
                          ${ev.rating ? `<span class="muted" style="margin-left:.35rem;">(${ev.rating}/5)</span>` : ``}
                        </div>
                        ${ev.note ? `<div class="muted" style="margin-top:.2rem; white-space:pre-wrap;">${escapeHtml(ev.note)}</div>` : ``}
                      </div>
                      <div class="row" style="gap:.35rem;">
                        <button class="btn btn-ghost" data-ev-edit="${escapeHtml(ev.id)}">✎</button>
                        <button class="btn btn-ghost" data-ev-del="${escapeHtml(ev.id)}">🗑</button>
                      </div>
                    </div>
                  `).join("")}
                </div>
              ` : `<div class="muted">Noch nichts geloggt.</div>`}
            </div>
      </div>

      <div id="sheetRoot"></div>
    </div>
  `;

  const timerRoot = qs(appEl, "#timerRoot");
  const sheetRoot = qs(appEl, "#sheetRoot");



  const cookLogNowBtn = qs(appEl, "#cookLogNowBtn");
  if (cookLogNowBtn) {
    cookLogNowBtn.addEventListener("click", () => {
      // Schnell-Log ohne Rating/Notiz
      const ev = addCookEvent(r.id, { at: Date.now() });
      if (ev) pushCookEventToBackend(r.id, ev).catch(() => { });

      renderCookView({ appEl, state, recipes, partsByParent, setView });
    });
  }

  qsa(appEl, "[data-cook-rate]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rating = parseInt(btn.dataset.cookRate, 10);
      openCookRatingDialog({ recipeId: r.id, rating, onDone: () => renderCookView({ appEl, state, recipes, partsByParent, setView }) });
    });

  });

  // delete event
  qsa(appEl, "[data-ev-del]").forEach(b => {
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const id = b.getAttribute("data-ev-del"); // robuster als dataset bei manchen edge cases
      if (!id) return;

      // UI sofort reagieren lassen (fühlt sich schneller an)
      const row = b.closest(".row");
      if (row) row.remove();

      deleteCookEvent(r.id, id);

      // kleiner Tick, dann re-render (damit count/avg sauber ist)
      requestAnimationFrame(() => {
        renderCookView({ appEl, state, recipes, partsByParent, setView });
      });
    });
  });


  // edit event
  qsa(appEl, "[data-ev-edit]").forEach(b => {
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const id = b.dataset.evEdit;
      const ev = listCookEvents(r.id).find(x => x.id === id);
      if (!ev) return;

      openEditCookEventDialog({
        ev,
        onSave: (patch) => {
          updateCookEvent(r.id, id, patch);
          renderCookView({ appEl, state, recipes, partsByParent, setView });
        }
      });
    });
  });

  let timersExpanded = false;
  function flashTimerRootOnce() {
    // nur kurz sichtbar, dann wieder aus
    timerRoot.classList.remove("timer-flash");
    // reflow, damit Animation neu startet
    void timerRoot.offsetWidth;
    timerRoot.classList.add("timer-flash");
    window.clearTimeout(timerRoot._flashT);
    timerRoot._flashT = window.setTimeout(() => {
      timerRoot.classList.remove("timer-flash");
    }, 220);
  }

  const tm = createTimerManager({
    storageKey: timersKey,
    
    onRender: (snap) => {
      timerRoot.innerHTML = renderTimersBarHtml(snap, {
        expanded: timersExpanded,
        maxCollapsed: 1
      });

      // Toggle alle / weniger
      qsa(timerRoot, "[data-timer-toggle]").forEach(b => {
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          timersExpanded = !timersExpanded;
          flashTimerRootOnce();
          tm.tick(); // sofort neu rendern
        });
      });




      // Stop
      qsa(timerRoot, "[data-timer-stop]").forEach(b => {
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          ack(b.closest(".timer-pill") || b);
          tm.removeTimer(b.dataset.timerStop);
          tm.tick();
        });
      });


      // Extend (+1m / +5m)
      qsa(timerRoot, "[data-timer-ext]").forEach(b => {
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = b.dataset.timerExt;
          const sec = parseInt(b.dataset.sec, 10) || 0;
          if (!id || !sec) return;
          ack(b.closest(".timer-pill") || b);
          tm.extendTimer(id, sec);
          tm.tick();
        });
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
          ${isMenu
            ? buildMenuIngredients(r, recipes, partsByParent).map(section => `
                <div style="margin-bottom:1rem;">
                  <div class="muted" style="font-weight:800; margin-bottom:.25rem;">
                    ${escapeHtml(section.title)}
                  </div>
                  ${renderIngredientsHtml(section.items)}
                </div>
              `).join("")
            : renderIngredientsHtml(r.ingredients ?? [])
          }
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
      if (body) {
        body.classList.toggle("step-done", cb.checked);
        // auto-collapse step text when done
        body.style.display = cb.checked ? "none" : "";
      }
    });
  });

  qsa(appEl, "[data-start-timer]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.startTimer;
      const title = btn.dataset.title || "Timer";
      const dur = parseInt(btn.dataset.seconds, 10);
      if (!dur) return;

      // Prime only once (best effort). If it fails, we still allow timers.
      if (!__audioPrimedOnce) {
        __audioPrimedOnce = true;
        try { await audio.prime(); } catch { /* ignore */ }
      }

      tm.addTimer(key, title, dur);
      ack(btn);

      // IMPORTANT: no manual tick here; global overlay tick handles updates
      // tm.tick();
    });
  });


  qs(appEl, "#resetBtn").addEventListener("click", () => {
    if (!confirm("Alle Schritt-Häkchen zurücksetzen?")) return;
    done = {};
    saveDone();
    renderCookView({ appEl, state, recipes, partsByParent, setView });
  });
}

let __cookRatingDialogOpen = false;
let __cookRatingLastOpenAt = 0;

function openCookRatingDialog({ recipeId, rating, onDone }) {
  // debounce gegen Doppelklick / Touch-Events
  const now = Date.now();
  if (now - __cookRatingLastOpenAt < 350) return;
  __cookRatingLastOpenAt = now;

  // nur ein Dialog gleichzeitig
  if (__cookRatingDialogOpen) return;
  __cookRatingDialogOpen = true;

  // falls doch noch Reste da sind: wegräumen
  document.getElementById("cookRatingBackdrop")?.remove();
  document.getElementById("cookRatingSheet")?.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "cookRatingBackdrop";
  backdrop.className = "sheet-backdrop";

  const sheet = document.createElement("div");
  sheet.id = "cookRatingSheet";
  sheet.className = "sheet";
  sheet.style.maxHeight = "55vh";
  sheet.addEventListener("click", (e) => e.stopPropagation());

  const close = () => {
    sheet.remove();
    backdrop.remove();
    __cookRatingDialogOpen = false;
  };

  // Backdrop klick schließt ALLES (nicht nur backdrop)
  backdrop.addEventListener("click", close);

  sheet.innerHTML = `
    <div class="toolbar">
      <div>
        <h3 style="margin:0;">Bewertung</h3>
        <div class="muted">${"⭐".repeat(rating)} (${rating}/5)</div>
      </div>
      <button class="btn btn-ghost" id="cookRateCancel" type="button" title="Abbrechen">✕</button>
    </div>

    <div class="card" style="padding:.85rem; margin-top:.75rem;">
      <div class="muted" style="margin-bottom:.35rem;">Optional: kurze Notiz</div>
      <textarea id="cookRateNote" placeholder="z.B. mehr Zitrone, weniger Salz, statt Reis: Bulgur"></textarea>
      <div class="row" style="justify-content:space-between; margin-top:.6rem;">
        <div class="muted" id="cookRateHint">Enter = speichern (ohne Text)</div>
        <button class="btn btn-primary" id="cookRateSave" type="button" title="Speichern">💾 Speichern</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  sheet.querySelector("#cookRateCancel").addEventListener("click", close);

  const noteEl = sheet.querySelector("#cookRateNote");
  const hintEl = sheet.querySelector("#cookRateHint");
  const saveBtn = sheet.querySelector("#cookRateSave");

  const updateHint = () => {
    const hasText = (noteEl.value || "").trim().length > 0;
    hintEl.textContent = hasText ? "Speichern nur über 💾" : "Enter = speichern (ohne Text)";
  };

  const doSave = () => {
    const note = (noteEl.value || "").trim();
    const ev = addCookEvent(recipeId, { at: Date.now(), rating, note });
    if (ev) pushCookEventToBackend(recipeId, ev).catch(() => { });

    close();
    onDone?.();
  };

  updateHint();
  noteEl.addEventListener("input", updateHint);
  saveBtn.addEventListener("click", doSave);

  // Esc schließt immer
  sheet.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  // Enter speichert nur wenn KEIN Text (sonst newline)
  noteEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const hasText = (noteEl.value || "").trim().length > 0;
      if (hasText) return;
      e.preventDefault();
      doSave();
    }
  });

  // focus
  requestAnimationFrame(() => noteEl.focus());
}
function openEditCookEventDialog({ ev, onSave }) {
  // avoid stacking
  document.getElementById("cookEditBackdrop")?.remove();
  document.getElementById("cookEditSheet")?.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "cookEditBackdrop";
  backdrop.className = "sheet-backdrop";

  const sheet = document.createElement("div");
  sheet.id = "cookEditSheet";
  sheet.className = "sheet";
  sheet.addEventListener("click", (e) => e.stopPropagation());

  const close = () => { sheet.remove(); backdrop.remove(); };
  backdrop.addEventListener("click", close);

  // datetime-local expects local time without timezone
  const dt = new Date(ev.at);
  const isoLocal = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  sheet.innerHTML = `
    <div class="toolbar">
      <div>
        <h3 style="margin:0;">Eintrag bearbeiten</h3>
        <div class="muted">${new Date(ev.at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</div>
      </div>
      <button class="btn btn-ghost" id="ceClose" type="button" title="Schließen">✕</button>
    </div>

    <hr />

    <div class="card" style="padding:.85rem;">
      <div class="muted" style="margin-bottom:.35rem;">Zeit</div>
      <input id="ceAt" type="datetime-local" value="${isoLocal}" />
    </div>

    <div class="card" style="padding:.85rem;">
      <div class="muted" style="margin-bottom:.35rem;">Rating</div>
      <select id="ceRating">
        <option value="">—</option>
        ${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${ev.rating === n ? "selected" : ""}>${n}</option>`).join("")}
      </select>
    </div>

    <div class="card" style="padding:.85rem;">
      <div class="muted" style="margin-bottom:.35rem;">Notiz</div>
      <textarea id="ceNote" placeholder="…">${escapeHtml(ev.note ?? "")}</textarea>
      <div class="row" style="justify-content:space-between; margin-top:.6rem;">
        <div class="muted">Enter macht Zeilenumbruch</div>
        <button class="btn btn-primary" id="ceSave" type="button">💾 Speichern</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  sheet.querySelector("#ceClose").addEventListener("click", close);
  sheet.querySelector("#ceSave").addEventListener("click", () => {
    const atStr = sheet.querySelector("#ceAt").value;
    const at = atStr ? new Date(atStr).getTime() : ev.at;

    const ratingStr = sheet.querySelector("#ceRating").value;
    const rating = ratingStr ? parseInt(ratingStr, 10) : null;

    const note = sheet.querySelector("#ceNote").value || "";

    onSave?.({ at, rating, note });
    close();
  });

  // Esc closes
  sheet.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  requestAnimationFrame(() => sheet.querySelector("#ceNote")?.focus());
}

