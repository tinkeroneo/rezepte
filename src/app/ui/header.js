import { appState } from "../appState.js";

export function installHeaderWiring() {
  // Global Back Button
  const backBtn = document.getElementById("backBtn");
  if (backBtn && !backBtn.__installed) {
    backBtn.__installed = true;
    backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (appState.dirtyGuard && appState.dirtyGuard({ reason: "headerBack" }) === false) return;
      if (window.history.length > 1) window.history.back();
      else appState.router?.setView?.({ name: "list", selectedId: null, q: "" });
    });
  }

  // Header: Vegan 101 Button
  const veganBtn = document.getElementById("vegan101HeaderBtn");
  if (veganBtn && !veganBtn.__installed) {
    veganBtn.__installed = true;
    veganBtn.addEventListener("click", (e) => {
      e.preventDefault();
      appState.router?.setView?.({ name: "vegan101", selectedId: null, q: "" });
    });
  }
}
