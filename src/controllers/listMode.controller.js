// src/controllers/listMode.controller.js
import { qs } from "../utils.js";

/**
 * Wires list/grid mode buttons + persists viewMode.
 * Returns getters/setters so list.view can use current viewMode.
 */
export function initListMode({
  appEl,
  initialMode,
  onModeChanged
}) {
  const modeListBtn = qs(appEl, "#modeList");
  const modeGridBtn = qs(appEl, "#modeGrid");

  let viewMode = initialMode || "grid";

  const applyModeButtons = () => {
    modeListBtn?.classList.toggle("is-active", viewMode === "list");
    modeGridBtn?.classList.toggle("is-active", viewMode === "grid");
  };

  const setMode = (m) => {
    viewMode = m === "list" ? "list" : "grid";
    applyModeButtons();
    onModeChanged?.(viewMode);
  };

  if (modeListBtn) {
    modeListBtn.addEventListener("click", () => setMode("list"));
  }
  if (modeGridBtn) {
    modeGridBtn.addEventListener("click", () => setMode("grid"));
  }

  applyModeButtons();

  return {
    getMode: () => viewMode,
    setMode
  };
}
