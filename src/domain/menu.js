import { splitStepsToCards } from "./steps.js";

// Menü-/Teilrezept-Vererbung: rekursiv, mit Cycle-Schutz und Max-Tiefe.
// partsByParent: Map<parentId, childIds[]> (Sortierung = Reihenfolge im Menü)

const DEFAULT_MAX_DEPTH = 5;

function collectDescendants(rootId, partsByParent, { maxDepth = DEFAULT_MAX_DEPTH } = {}) {
  const out = [];
  const visited = new Set([rootId]);

  function walk(parentId, depth) {
    if (depth > maxDepth) return;
    const kids = partsByParent.get(parentId) ?? [];
    for (const cid of kids) {
      if (!cid) continue;
      if (visited.has(cid)) continue; // cycle guard
      visited.add(cid);
      out.push(cid);
      walk(cid, depth + 1);
    }
  }

  walk(rootId, 1);
  return out;
}

export function buildMenuIngredients(menuRecipe, recipes, partsByParent) {
  const sections = [];
  if ((menuRecipe.ingredients ?? []).length) {
    sections.push({ title: menuRecipe.title, items: menuRecipe.ingredients });
  }

  const childIds = collectDescendants(menuRecipe.id, partsByParent);
  for (const cid of childIds) {
    const child = recipes.find(r => r.id === cid);
    if (!child) continue;
    sections.push({ title: child.title, items: child.ingredients ?? [] });
  }
  return sections;
}

export function buildMenuStepSections(menuRecipe, recipes, partsByParent) {
  const sections = [];

  const ownCards = splitStepsToCards(menuRecipe.steps ?? []);
  if (ownCards.length) {
    sections.push({ recipeId: menuRecipe.id, title: menuRecipe.title, cards: ownCards });
  }

  const childIds = collectDescendants(menuRecipe.id, partsByParent);
  for (const cid of childIds) {
    const child = recipes.find(r => r.id === cid);
    if (!child) continue;
    const cards = splitStepsToCards(child.steps ?? []);
    if (!cards.length) continue;
    sections.push({ recipeId: child.id, title: child.title, cards });
  }

  return sections;
}

export function isMenuRecipe(recipe, partsByParent) {
  return (partsByParent?.get?.(recipe?.id)?.length ?? 0) > 0;
}
