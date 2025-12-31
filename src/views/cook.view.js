import { escapeHtml, qs, qsa } from "../utils.js";
import { splitStepsToCards, stepDoneKey, parseDurationSeconds, formatTime } from "../domain/steps.js";
import { buildMenuIngredients, buildMenuStepSections } from "../domain/menu.js";
import { renderIngredientsHtml } from "./shared.ingredients.js";
import { createBeep, createTimerManager, renderTimersBarHtml } from "../domain/timers.js";
import { ack } from "../ui/feedback.js";

// Kochverlauf/Bewertung ist in der Detail-View (nicht hier),
// damit Steps/Timer nicht verdeckt werden.
let __audioPrimedOnce = false;


export function renderCookView({ appEl, state, recipes, partsByParent, setView, setViewCleanup }) {
  const r = recipes.find(x => x.id === state.selectedId);
   if (!r) return setView({ name: "list", selectedId: null, q: state.q });

  const settings = window.__tinkeroneoSettings || {};
  const timerSoundEnabled = settings.readTimerSoundEnabled ? !!settings.readTimerSoundEnabled() : true;
  const timerSoundId = settings.readTimerSoundId ? String(settings.readTimerSoundId() || "bowl") : "gong";
  const timerSoundVolume = settings.readTimerSoundVolume ? Number(settings.readTimerSoundVolume() ?? 0.65) : 0.65;
  const audio = createBeep({ soundId: timerSoundId, volume: timerSoundVolume });

  // Cook-View soll möglichst „koch-fokussiert“ sein (Steps + Timer).
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

  // (keine Events hier – in Detailview)

  appEl.innerHTML = `
    <div class="container">
      <div class="card">
        <h2>👩‍🍳 ${escapeHtml(r.title)}</h2>


        <div class="muted">${escapeHtml(r.category ?? "")}${r.time ? " · " + escapeHtml(r.time) : ""}</div>
<details class="image-toggle"> <summary>Bild anzeigen</summary>
        ${r.image_url ? `
          <div style="margin:.75rem 0;">
          
            <img src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.title)}"
                 style="width:100%; border-radius:12px; display:block;" />
          </div>
        ` : ""}</details>

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
                    <li data-stepwrap="${escapeHtml(key)}">
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
          <button class="btn btn--ghost" id="resetBtn">Reset Steps</button>
        </div>
      </div>

      <div id="sheetRoot"></div>
    </div>
  `;

  const timerRoot = qs(appEl, "#timerRoot");
  const sheetRoot = qs(appEl, "#sheetRoot");



  // Kochverlauf / Bewertung ist in der Detail-View

  let timersExpanded = false;
  let _lastOverdueKeys = new Set();
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

  const ringIntervalMs = settings.readTimerRingIntervalMs?.() ?? 2800;
  const maxRingSeconds = settings.readTimerMaxRingSeconds?.() ?? 120;
  const stepHighlightEnabled = settings.readTimerStepHighlight?.() ?? true;

  const tm = createTimerManager({
    storageKey: timersKey,
    ringIntervalMs,
    maxRingSeconds,

    onRender: (snap) => {
      timerRoot.innerHTML = renderTimersBarHtml(snap, {
        expanded: timersExpanded,
        maxCollapsed: 1
      });

      // Highlight steps whose timers are overdue (soft pulse) until the timer is stopped/dismissed.
      if (stepHighlightEnabled) {
        try {
          const overdueKeys = new Set(
            (snap?.list ?? [])
              .filter(t => (t.remainingSec ?? 1) <= 0 && t.key)
              .map(t => String(t.key))
          );

          // one-time subtle nudge: if a timer just turned overdue, briefly outline that step
          const newlyOverdue = [];
          overdueKeys.forEach(k => { if (!_lastOverdueKeys.has(k)) newlyOverdue.push(k); });
          _lastOverdueKeys = overdueKeys;

          qsa(appEl, "li[data-stepwrap]").forEach(li => {
            const k = li.getAttribute("data-stepwrap") || "";
            li.classList.toggle("step-overdue", overdueKeys.has(k));
          });

          if (newlyOverdue.length) {
            const first = newlyOverdue[0];
            const li = qs(appEl, `li[data-stepwrap="${CSS.escape(first)}"]`);
            if (li) {
              li.classList.add("step-current");
              // only scroll if far away; keep it calm
              const rect = li.getBoundingClientRect();
              if (rect.top < 0 || rect.bottom > window.innerHeight) {
                li.scrollIntoView({ block: "center", behavior: "smooth" });
              }
              window.setTimeout(() => li.classList.remove("step-current"), 2000);
            }
          }
        } catch {
          // ignore
        }
      } else {
        // ensure clean UI when disabled
        qsa(appEl, "li.step-overdue").forEach(li => li.classList.remove("step-overdue"));
      }

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
      if (!timerSoundEnabled) return;
      audio.beep();
    }
  });

  // prime audio on any user click inside cook view (mobile reliable)
  appEl.addEventListener("click", audio.prime, { once: true });

  qs(appEl, "#ingredientsBtn").addEventListener("click", () => {
    sheetRoot.innerHTML = `
      <div class="sheet-backdrop" id="backdrop"></div>
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-handle"></div>
        <div class="row" style="justify-content:space-between; align-items:center; gap:.5rem;">
          <h3 style="margin:0;">Zutaten</h3>
          <button class="btn btn--ghost" id="closeSheet">Schließen</button>
        </div>
        <div style="margin-top:.75rem;">
          ${isMenu
            ? buildMenuIngredients(r, recipes, partsByParent).map(section => `
                <div style="margin-bottom:1rem;">
                  <div class="muted" style="font-weight:800; margin-bottom:.25rem;">${escapeHtml(section.title)}</div>
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

  // Radio ist global (Header-Button + Radio-Dock). In der CookView kein extra Button,
  // damit der Fokus auf Steps + Timern bleibt.

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

      // re-highlight current step (first open checkbox)
      highlightCurrentStep();
    });
  });

  function highlightCurrentStep() {
    // remove old markers
    qsa(appEl, ".step-current").forEach(el => el.classList.remove("step-current"));

    const next = qsa(appEl, 'input[type="checkbox"][data-stepkey]').find(x => !x.checked);
    const li = next?.closest?.("li");
    if (li) li.classList.add("step-current");
  }

  // initial highlighting
  highlightCurrentStep();

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

      // store recipeId so the global timer chip can jump back to the right recipe
      tm.addTimer(key, title, dur, r.id);
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

