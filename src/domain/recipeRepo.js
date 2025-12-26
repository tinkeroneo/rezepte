/**
 * Tiny repository layer to keep backend/local persistence decisions in one place.
 * Keeps behavior identical to the previous wiring (local-first UX + backend sync when enabled).
 */
import { setUseBackend } from "../app.js";
export function createRecipeRepo({
  useBackend,
  listRecipes,
  upsertRecipe,
  deleteRecipe,
  loadRecipesLocal,
  saveRecipesLocal,
  toLocalShape,
}) {
  // IMPORTANT: do not freeze useBackend; allow switching after auth/space init
  let _useBackend = !!useBackend;

  const normalizeList = (items) => (items ?? []).map(toLocalShape);

  const getLocal = () => normalizeList(loadRecipesLocal());
  const setLocal = (items) => saveRecipesLocal(normalizeList(items));



  return {
    // keep for compatibility (some callers may read it)
    get useBackend() {
      return _useBackend;
    },

    setUseBackend,

    /** Load from backend when enabled; fallback to local on errors. */
    async getAll() {
      if (!_useBackend) return getLocal();
      try {
        const fromBackend = normalizeList(await listRecipes());
        setLocal(fromBackend);
        return fromBackend;
      } catch {
        return getLocal();
      }
    },

    /** Upsert locally first; then backend + optional refresh. */
    async upsert(recipe, { refresh = true } = {}) {
      // local merge first
      const local = getLocal();
      const idx = local.findIndex((x) => x.id === recipe.id);
      if (idx >= 0) local[idx] = recipe;
      else local.push(recipe);
      setLocal(local);

      if (!_useBackend) return local;

      await upsertRecipe(recipe);
      if (!refresh) return local;

      const fromBackend = normalizeList(await listRecipes());
      setLocal(fromBackend);
      return fromBackend;
    },

    /** Delete locally first; then backend when enabled. */
    async remove(id) {
      const local = getLocal().filter((r) => r.id !== id);
      setLocal(local);
      if (_useBackend) await deleteRecipe(id);
      return local;
    },

    getLocal,
    setLocal,
  };
}
