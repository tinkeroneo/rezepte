// src/views/detail/detail.actions.js
import { qs } from "../../utils.js";
import { ack } from "../../ui/feedback.js";
import { buildMenuIngredients, isMenuRecipe } from "../../domain/menu.js";

function cookLinkFor(recipeId) {
  // konsistent zum Router
  return `${location.origin}${location.pathname}#detail?id=${encodeURIComponent(recipeId)}`;
}

function shareLinkFor(token) {
  return `${location.origin}${location.pathname}#s/${encodeURIComponent(token)}`;
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
  partsByParent,
  createRecipeShare
}) {
  // Kochen (immer erlaubt)
  const cookBtn = qs(appEl, "#cookBtn");
  if (cookBtn && !cookBtn.__bound) {
    cookBtn.__bound = true;
    cookBtn.addEventListener("click", () => {
      setView({ name: "cook", selectedId: recipe.id, q: state.q });
    });
  }

  // Share-Link erstellen (Token-Link, mit Auto-Redirect beim Öffnen) (read-only, public token)
  const shareLinkBtn = qs(appEl, "#shareLinkBtn");
  if (shareLinkBtn && !shareLinkBtn.__bound) {
    shareLinkBtn.__bound = true;
    shareLinkBtn.addEventListener("click", async () => {


      try {
        if (typeof createRecipeShare !== "function") {
          // fallback: copy normal link
          const url = cookLinkFor(recipe.id);
          const ok = await copyText(url);
          if (ok) ack(shareLinkBtn);
          else prompt("Link kopieren:", url);
          return;
        }

        const token = await createRecipeShare({ recipeId: recipe.id, expiresInDays: 7, maxUses: 50 });
       
        if (!token) throw new Error("Kein Share-Token erhalten");
        
        const url = shareLinkFor(token);
        const ok = await copyText(url);
        if (ok) ack(shareLinkBtn);
        else prompt("Share-Link:", url);
      } catch (e) {
        alert(`Teilen fehlgeschlagen: ${e?.message || e}`);
      }

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