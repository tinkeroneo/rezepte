// src/views/detail/detail.actions.js
import { qs } from "../../utils.js";
import { ack } from "../../ui/feedback.js";
import { buildMenuIngredients, isMenuRecipe } from "../../domain/menu.js";

function cookLinkFor(recipeId) {
  // konsistent zum Router
  return `${location.origin}${location.pathname}#detail?id=${encodeURIComponent(recipeId)}`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function collectShoppingLines({ recipe, recipes, partsByParent }) {
  const pool = Array.isArray(recipes) ? recipes : [];
  const pbp = partsByParent;

  // Menü: Ingredients aus allen Sections flatten
  if (pbp?.get && isMenuRecipe(recipe, pbp)) {
    const sections = buildMenuIngredients(recipe, pool, pbp);
    const out = [];
    for (const sec of sections) {
      const items = Array.isArray(sec?.items) ? sec.items : [];
      for (const line of items) out.push(line);
    }
    return out;
  }

  return Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
}

export function bindDetailActions({
  appEl,
  recipe,
  state,
  setView,
  canWrite,
  canShop = true,
  addToShopping,
  recipes,
  partsByParent
}) {
  // Kochen (immer erlaubt)
  const cookBtn = qs(appEl, "#cookBtn");
  if (cookBtn && !cookBtn.__bound) {
    cookBtn.__bound = true;
    cookBtn.addEventListener("click", () => {
      setView({ name: "cook", selectedId: recipe.id, q: state.q });
    });
  }

  // Link kopieren (immer erlaubt)
  const copyLinkBtn = qs(appEl, "#copyCookLinkBtn");
  if (copyLinkBtn && !copyLinkBtn.__bound) {
    copyLinkBtn.__bound = true;
    copyLinkBtn.addEventListener("click", async () => {
      const url = cookLinkFor(recipe.id);
      const ok = await copyText(url);
      if (ok) ack(copyLinkBtn);
      else prompt("Cook-Link kopieren:", url);
    });
  }

   // Link kopieren (immer erlaubt)
  const copyBtn = qs(appEl, "#copyBtn");
  if (copyBtn && !copyBtn.__bound) {
    copyBtn.__bound = true;
    copyBtn.addEventListener("click", async () => {
      const url = cookLinkFor(recipe.id);
      const ok = await copyText(url);
      if (ok) ack(copyBtn);
      else prompt("Cook-Link kopieren:", url);
    });
  }

  // Einkaufsliste (immer erlaubt, sofern canShop)
  const shopBtn = qs(appEl, "#addToShoppingBtn");
  if (shopBtn) {
    shopBtn.disabled = !canShop;
    if (canShop && !shopBtn.__bound) {
      shopBtn.__bound = true;
      shopBtn.addEventListener("click", () => {
        const lines = collectShoppingLines({ recipe, recipes, partsByParent });
        addToShopping?.(lines);
        ack(shopBtn);
      });
    }
  }

  // Bearbeiten (nur mit canWrite)
  const editBtn = qs(appEl, "#editBtn");
  if (editBtn) {
    editBtn.disabled = !canWrite;
    if (canWrite && !editBtn.__bound) {
      editBtn.__bound = true;
      editBtn.addEventListener("click", () => {
        setView({ name: "add", selectedId: recipe.id, q: state.q });
      });
    }
  }
}

export function bindDetailImageClick({ appEl, imageUrl }) {
  const img = qs(appEl, "#detailImg");
  if (!img || !imageUrl) return;

  if (!img.__bound) {
    img.__bound = true;
    img.addEventListener("click", () => {
      try {
        window.open(imageUrl, "_blank", "noopener,noreferrer");
      } catch {
        /* ignore */
      }
    });
  }
}
