// src/views/detail/detail.actions.js
import { qs } from "../../utils.js";
import { ack } from "../../ui/feedback.js";

function cookLinkFor(recipeId) {
  // konsistent zum Router
  return `${location.origin}${location.pathname}#cook?id=${encodeURIComponent(recipeId)}`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
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
  const copyBtn = qs(appEl, "#copyCookLinkBtn");
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
        addToShopping?.(recipe, { recipes, partsByParent });
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
