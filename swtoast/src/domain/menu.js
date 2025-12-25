import { splitStepsToCards } from "./steps.js";

export function buildMenuIngredients(menuRecipe, recipes, partsByParent) {
  const sections = [];
  if ((menuRecipe.ingredients ?? []).length) {
    sections.push({ title: menuRecipe.title, items: menuRecipe.ingredients });
  }
  const childIds = partsByParent.get(menuRecipe.id) ?? [];
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

  const childIds = partsByParent.get(menuRecipe.id) ?? [];
  for (const cid of childIds) {
    const child = recipes.find(r => r.id === cid);
    if (!child) continue;
    const cards = splitStepsToCards(child.steps ?? []);
    if (!cards.length) continue;
    sections.push({ recipeId: child.id, title: child.title, cards });
  }

  return sections;
}
