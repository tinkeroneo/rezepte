export function createOfflineQueueDrainer({
  getUseBackend,
  isAuthenticated,
  compactOfflineQueue,
  getOfflineQueue,
  dequeueOfflineAction,
  updateHeaderBadges,
  withLoader,
  upsertRecipe,
  deleteRecipe,
  reportError,
}) {
  return async function drainOfflineQueue({ reason = "auto" } = {}) {
    if (!getUseBackend()) return { ok: true, skipped: "useBackendOff" };
    if (navigator.onLine === false) return { ok: true, skipped: "offline" };
    if (!isAuthenticated?.()) return { ok: true, skipped: "notAuthed" };

    compactOfflineQueue();
    const queue = getOfflineQueue() || [];
    if (queue.length === 0) return { ok: true, skipped: "empty" };

    updateHeaderBadges({ syncing: true, syncError: false });
    let anyError = false;

    for (const action of queue) {
      try {
        if (action.kind === "recipe_upsert" && action.recipe?.id) {
          await withLoader("Speichere…", async () => {
            await upsertRecipe(action.recipe);
          });
          dequeueOfflineAction(action.id);
        } else if (action.kind === "recipe_delete" && action.recipeId) {
          await deleteRecipe(action.recipeId);
          dequeueOfflineAction(action.id);
        }
      } catch (e) {
        anyError = true;
        reportError(e, { scope: "offlineSync", action: action?.kind || "unknown", reason });
        break;
      }
    }

    updateHeaderBadges({ syncing: false, syncError: anyError });
    return { ok: !anyError };
  };
}
