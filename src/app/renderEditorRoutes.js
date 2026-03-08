import { renderCookView } from "../views/cook.view.js";
import { renderAddView } from "../views/add.view.js";

export function renderEditorRoute({
  view,
  appEl,
  recipes,
  partsByParent,
  activeSpaceId,
  setView,
  useBackend,
  canWrite,
  canWriteForSpace,
  setDirtyGuard,
  setDirtyIndicator,
  setViewCleanup,
  mySpaces,
  moveRecipeToSpace,
  upsertProfile,
  listRecipes,
  refreshSpaceSelect,
  reportError,
  showError,
  recipeRepo,
  runExclusive,
  loadAll,
  uploadRecipeImage,
}) {
  if (view.name === "cook") {
    return renderCookView({
      canWrite,
      appEl,
      state: view,
      recipes,
      partsByParent,
      setView,
      setViewCleanup,
      setDirtyGuard,
    });
  }

  if (view.name === "add") {
    const existing = view.selectedId ? recipes.find((recipe) => recipe.id === view.selectedId) : null;
    const addCanWrite = canWriteForSpace(existing?.space_id || activeSpaceId);

    return renderAddView({
      appEl,
      state: view,
      recipes,
      activeSpaceId,
      setView,
      useBackend,
      canWrite: addCanWrite,
      setDirtyGuard,
      setDirtyIndicator,
      setViewCleanup,
      mySpaces,
      moveRecipeToSpace,
      upsertProfile,
      listRecipes,
      refreshSpaceSelect,
      upsertSpaceLast: async (spaceId) => {
        try {
          await listRecipes();
          await upsertProfile({ last_space_id: spaceId });
        } catch (e) {
          reportError(e, { scope: "app.js", action: String(e?.message) });
          showError(String(e?.message));
        }
      },
      upsertRecipe: async (recipe) => {
        const key = `upsert:${recipe.id || "new"}`;
        return runExclusive(key, async () => {
          await recipeRepo.upsert(recipe, { refresh: useBackend });
          await runExclusive("loadAll", () => loadAll());
        });
      },
      uploadRecipeImage,
    });
  }

  return false;
}
