// src/controllers/listPending.controller.js
import { qs } from "../utils.js";

/**
 * Pending-only toggle controller (storage-free).
 */
export function initPendingToggle({
  appEl,
  recipes,
  pendingIds,
  getUi,
  setUi,
  onPersist,
  onRender
}) {
  const pendingBtn = qs(appEl, "#pendingToggle");
  if (!pendingBtn) return;

  const list = Array.isArray(recipes) ? recipes : [];
  const pendingCount = list.filter((r) => pendingIds.has(r.id)).length;

  if (pendingCount <= 0) {
    pendingBtn.style.display = "none";
    return;
  }

  pendingBtn.style.display = "";

  const sync = () => {
    const u = getUi();
    const on = !!u.pendingOnly;
    pendingBtn.textContent = on
      ? `⏳ ${pendingCount} (nur offene)`
      : `⏳ ${pendingCount}`;
    pendingBtn.classList.toggle("is-active", on);
  };

  sync();

  pendingBtn.onclick = () => {
    const u = getUi();
    u.pendingOnly = !u.pendingOnly;
    setUi(u);
    onPersist?.({ pendingOnly: u.pendingOnly });
    sync();
    onRender?.();
  };
}
