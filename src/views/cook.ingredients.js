import { qs, qsa, escapeHtml } from "../utils.js";
import { buildMenuIngredients } from "../domain/menu.js";
import { renderIngredientsHtml } from "./shared.ingredients.js";

function parseNumberToken(tok) {
  const token = String(tok).trim();
  const range = token.match(/^(\d+(?:[.,]\d+)?|\d+\/\d+)\s*-\s*(\d+(?:[.,]\d+)?|\d+\/\d+)$/);
  if (range) return { kind: "range", a: parseNumberToken(range[1]), b: parseNumberToken(range[2]) };

  const frac = token.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return { kind: "num", v: Number(frac[1]) / Number(frac[2]) };

  const num = token.match(/^\d+(?:[.,]\d+)?$/);
  if (num) return { kind: "num", v: Number(token.replace(",", ".")) };

  return null;
}

function formatNumberDe(value) {
  const rounded = Math.round(value * 100) / 100;
  const out = rounded.toFixed(rounded % 1 === 0 ? 0 : (rounded * 10) % 1 === 0 ? 1 : 2);
  return out.replace(".", ",");
}

function scaleIngredientLine(line, factor) {
  const text = String(line || "");
  const match = text.match(/^\s*([0-9]+(?:[.,][0-9]+)?|[0-9]+\s*\/\s*[0-9]+|[0-9]+(?:[.,][0-9]+)?\s*-\s*[0-9]+(?:[.,][0-9]+)?)(\s+.*)?$/);
  if (!match) return text;

  const token = match[1];
  const rest = match[2] || "";
  const parsed = parseNumberToken(token.replace(/\s+/g, ""));
  if (!parsed) return text;

  const apply = (part) => {
    if (part.kind === "num") return formatNumberDe(part.v * factor);
    if (part.kind === "range") return `${apply(part.a)}-${apply(part.b)}`;
    return token;
  };

  return apply(parsed) + rest;
}

export function createCookIngredientsSheet({
  sheetRoot,
  recipe,
  recipes,
  partsByParent,
  isMenu,
}) {
  const ingredientsUsedKey = `tinkeroneo_ingredients_used_${recipe.id}`;
  let ingredientsFactor = 1;
  let ingredientsUsed = new Set();
  let ingredientsShowHidden = false;
  const ingredientsHideTimers = new Map();
  const ingredientsDelayHide = new Set();

  try {
    ingredientsUsed = new Set(JSON.parse(localStorage.getItem(ingredientsUsedKey) || "[]"));
  } catch {
    ingredientsUsed = new Set();
  }

  function saveIngredientsUsed() {
    localStorage.setItem(ingredientsUsedKey, JSON.stringify([...ingredientsUsed]));
  }

  function clearTimers() {
    ingredientsHideTimers.forEach((timerId) => window.clearTimeout(timerId));
    ingredientsHideTimers.clear();
    ingredientsDelayHide.clear();
  }

  function applyIngredientStates() {
    const hasUsed = ingredientsUsed.size > 0;
    const toggle = qs(sheetRoot, "#ingredientsToggle");
    if (toggle) {
      toggle.textContent = ingredientsShowHidden ? "Nur offen" : "Alle";
      toggle.style.visibility = hasUsed ? "visible" : "hidden";
      toggle.disabled = !hasUsed;
    }

    qsa(sheetRoot, "[data-ing-idx]").forEach((li) => {
      const idx = Number(li.getAttribute("data-ing-idx"));
      const used = ingredientsUsed.has(idx);
      li.classList.toggle("is-used", used);

      if (!used || ingredientsShowHidden) {
        li.classList.remove("is-hidden", "is-pending-hide");
        return;
      }

      if (ingredientsDelayHide.has(idx)) {
        li.classList.add("is-pending-hide");
        li.classList.remove("is-hidden");
        return;
      }

      li.classList.add("is-hidden");
      li.classList.remove("is-pending-hide");
    });
  }

  function bindIngredientEvents() {
    const servingsFactor = qs(sheetRoot, "#servingsFactor");
    if (servingsFactor) {
      servingsFactor.value = String(ingredientsFactor);
      servingsFactor.addEventListener("change", () => {
        ingredientsFactor = Number(String(servingsFactor.value).replace(",", ".")) || 1;
        render();
      });
    }

    const toggle = qs(sheetRoot, "#ingredientsToggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        ingredientsShowHidden = !ingredientsShowHidden;
        applyIngredientStates();
      });
    }

    qsa(sheetRoot, "[data-ing-idx]").forEach((li) => {
      li.addEventListener("click", () => {
        const idx = Number(li.getAttribute("data-ing-idx"));
        if (!Number.isFinite(idx)) return;

        if (ingredientsUsed.has(idx)) {
          ingredientsUsed.delete(idx);
          ingredientsDelayHide.delete(idx);
          const timerId = ingredientsHideTimers.get(idx);
          if (timerId) window.clearTimeout(timerId);
          ingredientsHideTimers.delete(idx);
          saveIngredientsUsed();
          applyIngredientStates();
          return;
        }

        ingredientsUsed.add(idx);
        ingredientsDelayHide.add(idx);
        saveIngredientsUsed();
        applyIngredientStates();

        const timerId = window.setTimeout(() => {
          ingredientsHideTimers.delete(idx);
          ingredientsDelayHide.delete(idx);
          if (ingredientsShowHidden) return;
          const el = qs(sheetRoot, `[data-ing-idx="${idx}"]`);
          if (el) {
            el.classList.add("is-hidden");
            el.classList.remove("is-pending-hide");
          }
        }, 3000);
        ingredientsHideTimers.set(idx, timerId);
      });
    });

    applyIngredientStates();
  }

  function render() {
    clearTimers();

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
            <div class="muted" style="font-size:.9rem;">Basis: ${escapeHtml(recipe.servings ?? "—")}</div>
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
            ? buildMenuIngredients(recipe, recipes, partsByParent).map((section) => `
              <div class="muted" style="font-weight:900; margin:.75rem 0 .35rem;">${escapeHtml(section.title)}</div>
              ${renderIngredientsHtml(section.items.map((item) => scaleIngredientLine(item, ingredientsFactor)), { interactive: true, counter })}
            `).join("")
            : renderIngredientsHtml((recipe.ingredients ?? []).map((item) => scaleIngredientLine(item, ingredientsFactor)), { interactive: true, counter })}
        </div>
      </div>
    `;

    const close = qs(sheetRoot, "#closeSheet");
    const backdrop = qs(sheetRoot, "#sheetBackdrop");
    if (close) close.addEventListener("click", () => { sheetRoot.innerHTML = ""; });
    if (backdrop) backdrop.addEventListener("click", () => { sheetRoot.innerHTML = ""; });

    bindIngredientEvents();
  }

  return {
    render,
    reset() {
      localStorage.removeItem(ingredientsUsedKey);
      ingredientsUsed = new Set();
      ingredientsShowHidden = false;
      clearTimers();
    },
    hasOpenSheet() {
      return !!sheetRoot.innerHTML?.trim();
    },
    close() {
      clearTimers();
      sheetRoot.innerHTML = "";
    },
  };
}
