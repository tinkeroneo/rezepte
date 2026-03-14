import { applyImageFocusToElement, normalizeImageFocus } from "../../services/recipeImagePresentation.js";

export function normalizeFocus(focus) {
  return normalizeImageFocus(focus);
}

export function applyFocusToImg(img, focus) {
  applyImageFocusToElement(img, focus);
}

export function bindImageFocusPanel({
  appEl,
  imgEl,
  initialFocus,
  onSaveFocus, // async (nextFocus) => void
  ack
}) {
  const panel = appEl.querySelector("#imgFocusPanel");
  const modeEl = appEl.querySelector("#imgFocusMode");
  const xEl = appEl.querySelector("#imgFocusX");
  const yEl = appEl.querySelector("#imgFocusY");
  const zoomEl = appEl.querySelector("#imgFocusZoom");
  const xVal = appEl.querySelector("#imgFocusXVal");
  const yVal = appEl.querySelector("#imgFocusYVal");
  const zVal = appEl.querySelector("#imgFocusZoomVal");
  const resetBtn = appEl.querySelector("#imgFocusReset");
  const saveBtn = appEl.querySelector("#imgFocusSave");

  if (!panel || !modeEl || !xEl || !yEl || !zoomEl) return () => {};

  const state = { ...normalizeFocus(initialFocus) };

  const syncLabels = () => {
    if (xVal) xVal.textContent = String(Math.round(state.x));
    if (yVal) yVal.textContent = String(Math.round(state.y));
    if (zVal) zVal.textContent = state.zoom.toFixed(2);
  };

  const applyPreview = () => {
    applyFocusToImg(imgEl, state);
    syncLabels();
  };

  modeEl.value = state.mode;
  xEl.value = String(state.x);
  yEl.value = String(state.y);
  zoomEl.value = String(state.zoom);
  applyPreview();

  const onMode = () => { state.mode = modeEl.value === "cover" ? "cover" : "auto"; applyPreview(); };
  const onX = () => { state.x = Number(xEl.value) || 50; applyPreview(); };
  const onY = () => { state.y = Number(yEl.value) || 50; applyPreview(); };
  const onZ = () => { state.zoom = Math.max(1, Math.min(3, Number(zoomEl.value) || 1)); applyPreview(); };

  modeEl.addEventListener("change", onMode);
  xEl.addEventListener("input", onX);
  yEl.addEventListener("input", onY);
  zoomEl.addEventListener("input", onZ);

  resetBtn?.addEventListener("click", () => {
    state.x = 50; state.y = 50; state.zoom = 1; state.mode = "auto";
    modeEl.value = "auto";
    xEl.value = "50";
    yEl.value = "50";
    zoomEl.value = "1";
    applyPreview();
  });

  saveBtn?.addEventListener("click", async () => {
    if (typeof onSaveFocus !== "function") return;
    saveBtn.disabled = true;
    try {
      await onSaveFocus(normalizeFocus(state));
      ack?.(saveBtn);
    } finally {
      saveBtn.disabled = false;
    }
  });

  return () => {
    modeEl.removeEventListener("change", onMode);
    xEl.removeEventListener("input", onX);
    yEl.removeEventListener("input", onY);
    zoomEl.removeEventListener("input", onZ);
  };
}
