export function createPartsStore({ rebuildPartsIndex }) {
  let recipeParts = [];
  let partsByParent = new Map();

  function setParts(newParts) {
    recipeParts = newParts ?? [];
    partsByParent = rebuildPartsIndex(recipeParts);
  }

  function clearParts() {
    setParts([]);
  }

  function getRecipeParts() {
    return recipeParts;
  }

  function getPartsByParent() {
    return partsByParent;
  }

  return {
    setParts,
    clearParts,
    getRecipeParts,
    getPartsByParent,
  };
}

export function createLoadAll({
  getRecipeRepo,
  rebuildRecipeRepo,
  getUseBackend,
  getPendingRecipeIds,
  getAuthContext,
  getPartsStore,
  listAllRecipeParts,
  markBackendOnline,
  markBackendOffline,
  setRecipes,
}) {
  return async function loadAll() {
    let recipeRepo = getRecipeRepo();
    if (!recipeRepo) {
      rebuildRecipeRepo(getUseBackend());
      recipeRepo = getRecipeRepo();
    }

    const pendingIds = getPendingRecipeIds?.() || new Set();
    const ctx = (() => {
      try {
        return getAuthContext?.();
      } catch {
        return null;
      }
    })();
    const activeSid = String(ctx?.spaceId || "");

    const nextRecipes = (await recipeRepo.getAll()).map((recipe) => ({
      ...recipe,
      space_id: recipe.space_id || activeSid || recipe.spaceId || "",
      _pending: pendingIds.has(recipe.id),
    }));
    setRecipes(nextRecipes);

    const partsStore = getPartsStore();
    if (!getUseBackend()) {
      partsStore.clearParts();
      return;
    }

    try {
      const parts = await listAllRecipeParts();
      partsStore.setParts(parts);
      markBackendOnline?.();
    } catch (e) {
      markBackendOffline?.(String(e?.message || e || "Backend nicht erreichbar"));
      partsStore.clearParts();
    }
  };
}
