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
  function isValidQueuedRecipeUpsert(action) {
    if (!action || action.kind !== "recipe_upsert") return false;
    const recipe = action.recipe || {};
    const hasId = String(action.recipeId || recipe.id || "").trim().length > 0;
    const hasTitle = String(recipe.title || "").trim().length > 0;
    return hasId && hasTitle;
  }

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
        if (action.kind === "recipe_upsert") {
          if (!isValidQueuedRecipeUpsert(action)) {
            dequeueOfflineAction(action.id);
            reportError(new Error("Ungültiger Offline-Sync-Eintrag (fehlender Titel)."), {
              scope: "offlineSync",
              action: "recipe_upsert_invalid",
              reason,
              status: "dropped",
            });
            continue;
          }
          await withLoader("Speichere…", async () => {
            await upsertRecipe(action.recipe);
          });
          dequeueOfflineAction(action.id);
        } else if (action.kind === "recipe_delete" && action.recipeId) {
          await deleteRecipe(action.recipeId);
          dequeueOfflineAction(action.id);
        } else {
          dequeueOfflineAction(action.id);
          reportError(new Error("Unbekannter Offline-Sync-Eintrag verworfen."), {
            scope: "offlineSync",
            action: "unknown_action",
            reason,
            status: "dropped",
          });
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
