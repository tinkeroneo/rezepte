import { escapeHtml, qs, qsa, recipeImageOrDefault } from "../utils.js";
import { splitStepsToCards, stepDoneKey, parseDurationSeconds, formatTime } from "../domain/steps.js";
import { buildMenuIngredients, buildMenuStepSections } from "../domain/menu.js";
import { renderIngredientsHtml } from "./shared.ingredients.js";
import { createBeep, createTimerManager, renderTimersBarHtml } from "../domain/timers.js";
import { ack } from "../ui/feedback.js";

// Kochverlauf/Bewertung ist in der Detail-View (nicht hier),
// damit Steps/Timer nicht verdeckt werden.
let __audioPrimedOnce = false;


function __parseNumberToken(tok) {
  const t = String(tok).trim();
  // ranges like 2-3
  const range = t.match(/^(\d+(?:[.,]\d+)?|\d+\/\d+)\s*-\s*(\d+(?:[.,]\d+)?|\d+\/\d+)$/);
  if (range) return { kind: "range", a: __parseNumberToken(range[1]), b: __parseNumberToken(range[2]) };

  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return { kind: "num", v: (Number(frac[1]) / Number(frac[2])) };

  const num = t.match(/^\d+(?:[.,]\d+)?$/);
  if (num) return { kind: "num", v: Number(t.replace(",", ".")) };

  return null;
}

function __formatNumberDE(n) {
  // keep up to 2 decimals when needed
  const rounded = Math.round(n * 100) / 100;
  // avoid scientific notation
  const out = rounded.toFixed(rounded % 1 === 0 ? 0 : (rounded*10)%1===0 ? 1 : 2);
  return out.replace(".", ",");
}

function scaleIngredientLine(line, factor) {
  const s = String(line || "");

  // match leading number token like "1", "0,5", "1/2", "2-3"
  const m = s.match(/^\s*([0-9]+(?:[.,][0-9]+)?|[0-9]+\s*\/\s*[0-9]+|[0-9]+(?:[.,][0-9]+)?\s*-\s*[0-9]+(?:[.,][0-9]+)?)(\s+.*)?$/);
  if (!m) return s;
  const tok = m[1];
  const rest = m[2] || "";
  const parsed = __parseNumberToken(tok.replace(/\s+/g,""));
  if (!parsed) return s;

  const apply = (p) => {
    if (p.kind === "num") return __formatNumberDE(p.v * factor);
    if (p.kind === "range") {
      const a = apply(p.a);
      const b = apply(p.b);
      return `${a}-${b}`;
    }
    return tok;
  };

  return apply(parsed) + rest;
}



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


        <div class="muted">
          <button class="btn btn--ghost" id="resetBtn">Reset Steps</button>
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
          <div id="timerRoot" class="timerroot-dock"></div>
        </div>
      </div>

      <div id="sheetRoot"></div>
    </div>
  `;

  const timerRoot = qs(appEl, "#timerRoot");
  const sheetRoot = qs(appEl, "#sheetRoot");

  const ingredientsUsedKey = `tinkeroneo_ingredients_used_${r.id}`;
  let _ingredientsUsed = new Set();
  try {
    _ingredientsUsed = new Set(JSON.parse(localStorage.getItem(ingredientsUsedKey) || "[]"));
  } catch {
    _ingredientsUsed = new Set();
  }
  let _ingredientsShowHidden = false;
  const _ingredientsHideTimers = new Map();
  const _ingredientsDelayHide = new Set();

  function saveIngredientsUsed() {
    localStorage.setItem(ingredientsUsedKey, JSON.stringify([..._ingredientsUsed]));
  }

  function renderIngredientsSheet() {
    _ingredientsHideTimers.forEach(t => window.clearTimeout(t));
    _ingredientsHideTimers.clear();
    _ingredientsDelayHide.clear();

    const counter = { i: 0 };
    sheetRoot.innerHTML = `
      <div class="sheet-backdrop" id="sheetBackdrop"></div>
      <div class="sheet" role="dialog" aria-label="Zutaten">
        <div class="row" style="justify-content:space-between; align-items:center; gap:.5rem;">
          <div class="row" style="gap:.5rem;">
            <h3 style="margin:0;">Zutaten</h3>
            <button class="btn btn--ghost btn--sm ingredients-toggle" id="ingredientsToggle" type="button">Alle</button>
          </div>
          <button class="btn btn--ghost" id="closeSheet" type="button" title="Schließen">✕</button>
        </div>
        <div class="row" style="gap:.5rem; flex-wrap:wrap; align-items:flex-end; margin-top:.5rem;">
          <div class="field" style="flex:1; min-width:170px;">
            <div class="muted" style="font-weight:700;">Menge</div>
            <div class="muted" style="font-size:.9rem;">Basis: ${escapeHtml(r.servings ?? "—")}</div>
          </div>
          <div class="field" style="min-width:160px;">
            <label class="label" for="servingsFactor">Umrechnen</label>
            <select id="servingsFactor" class="input">
              <option value="1">1×</option>
              <option value="0.5">½×</option>
              <option value="1.5">1,5×</option>
              <option value="2">2×</option>
            </select>
          </div>
        </div>
        <div style="margin-top:.75rem;">
          ${isMenu
            ? buildMenuIngredients(r, recipes, partsByParent).map(section => `
              <div class="muted" style="font-weight:900; margin:.75rem 0 .35rem;">${escapeHtml(section.title)}</div>
              ${renderIngredientsHtml(section.items.map(x => scaleIngredientLine(x, __ingFactor)), { interactive: true, counter })}
            `).join("")
            : renderIngredientsHtml((r.ingredients ?? []).map(x => scaleIngredientLine(x, __ingFactor)), { interactive: true, counter })}
        </div>
      </div>
    `;

    const close = qs(sheetRoot, "#closeSheet");
    const back = qs(sheetRoot, "#sheetBackdrop");
    if (close) close.addEventListener("click", () => (sheetRoot.innerHTML = ""));
    if (back) back.addEventListener("click", () => (sheetRoot.innerHTML = ""));

    function applyIngredientStates() {
      const hasUsed = _ingredientsUsed.size > 0;
      const toggle = qs(sheetRoot, "#ingredientsToggle");
      if (toggle) {
        toggle.textContent = _ingredientsShowHidden ? "Nur offen" : "Alle";
        toggle.style.visibility = hasUsed ? "visible" : "hidden";
        toggle.disabled = !hasUsed;
      }

      qsa(sheetRoot, "[data-ing-idx]").forEach(li => {
        const idx = Number(li.getAttribute("data-ing-idx"));
        const used = _ingredientsUsed.has(idx);
        li.classList.toggle("is-used", used);

        if (!used) {
          li.classList.remove("is-hidden", "is-pending-hide");
          return;
        }

        if (_ingredientsShowHidden) {
          li.classList.remove("is-hidden", "is-pending-hide");
          return;
        }

        if (_ingredientsDelayHide.has(idx)) {
          li.classList.add("is-pending-hide");
          li.classList.remove("is-hidden");
          return;
        }

        li.classList.add("is-hidden");
        li.classList.remove("is-pending-hide");
      });
    }

    const sf = qs(sheetRoot, "#servingsFactor");
    if (sf) {
      sf.value = String(__ingFactor);
      sf.addEventListener("change", () => {
        __ingFactor = Number(String(sf.value).replace(",", ".")) || 1;
        renderIngredientsSheet();
      });
    }

    const toggle = qs(sheetRoot, "#ingredientsToggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        _ingredientsShowHidden = !_ingredientsShowHidden;
        applyIngredientStates();
      });
    }

    qsa(sheetRoot, "[data-ing-idx]").forEach(li => {
      li.addEventListener("click", () => {
        const idx = Number(li.getAttribute("data-ing-idx"));
        if (!Number.isFinite(idx)) return;

        if (_ingredientsUsed.has(idx)) {
          _ingredientsUsed.delete(idx);
          _ingredientsDelayHide.delete(idx);
          const t = _ingredientsHideTimers.get(idx);
          if (t) window.clearTimeout(t);
          _ingredientsHideTimers.delete(idx);
          saveIngredientsUsed();
          applyIngredientStates();
          return;
        }

        _ingredientsUsed.add(idx);
        _ingredientsDelayHide.add(idx);
        saveIngredientsUsed();
        applyIngredientStates();

        const t = window.setTimeout(() => {
          _ingredientsHideTimers.delete(idx);
          _ingredientsDelayHide.delete(idx);
          if (_ingredientsShowHidden) return;
          const el = qs(sheetRoot, `[data-ing-idx="${idx}"]`);
          if (el) {
            el.classList.add("is-hidden");
            el.classList.remove("is-pending-hide");
          }
        }, 3000);
        _ingredientsHideTimers.set(idx, t);
      });
    });

    applyIngredientStates();
  }

  let __ingFactor = 1;



  // Kochverlauf / Bewertung ist in der Detail-View

  let timersExpanded = false;
  let _lastOverdueKeys = new Set();
  const _timerOpenUntil = new Map();
  const TIMER_ACTIONS_OPEN_MS = 5000;
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
      const now = Date.now();
      qsa(timerRoot, "[data-timer-pill]").forEach(pill => {
        const id = pill.getAttribute("data-timer-id") || "";
        const openUntil = _timerOpenUntil.get(id) || 0;
        if (openUntil > now) {
          pill.classList.add("is-open");
        }

        pill.addEventListener("click", (e) => {
          if (e.target?.closest("button")) return;
          const nextOpen = (_timerOpenUntil.get(id) || 0) > Date.now()
            ? 0
            : (Date.now() + TIMER_ACTIONS_OPEN_MS);
          if (nextOpen) {
            _timerOpenUntil.set(id, nextOpen);
            pill.classList.add("is-open");
          } else {
            _timerOpenUntil.delete(id);
            pill.classList.remove("is-open");
          }
        });
      });

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


      // Shorten (-1m / -5m)
      qsa(timerRoot, "[data-timer-dec]").forEach(b => {
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = b.dataset.timerDec;
          const sec = parseInt(b.dataset.sec, 10) || 0;
          if (!id || !sec) return;
          ack(b.closest(".timer-pill") || b);
          tm.adjustTimer(id, -sec);
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
    // toggle: zweiter Klick schließt wieder
    if (sheetRoot.innerHTML && sheetRoot.innerHTML.trim() !== "") { sheetRoot.innerHTML = ""; return; }
    renderIngredientsSheet();
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
    localStorage.removeItem(ingredientsUsedKey);
    renderCookView({ appEl, state, recipes, partsByParent, setView });
  });
}
