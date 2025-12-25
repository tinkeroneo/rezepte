// src/state.js
import { KEYS, lsSet } from "./storage.js";

// Parse: #cook?id=123&q=abc
function parseHash() {
  const raw = (location.hash || "#list").slice(1);
  const [namePart, qsPart] = raw.split("?");
  const params = new URLSearchParams(qsPart || "");

  return {
    name: namePart || "list",
    selectedId: params.get("id"),
    q: params.get("q") || "",
    // optional UI state persists elsewhere if needed
  };
}

function setHash(view) {
  const params = new URLSearchParams();
  if (view.selectedId) params.set("id", view.selectedId);
  if (view.q) params.set("q", view.q);

  const qs = params.toString();
  const next = `#${view.name}${qs ? "?" + qs : ""}`;

  if (location.hash !== next) location.hash = next;
}

export function initRouter({ onViewChange }) {
  let view = parseHash();

  function setView(next) {
    view = { ...view, ...next };

    // persist (optional) – keep your existing NAV behavior
    try { lsSet(KEYS.NAV, view); } catch { /* ignore */ }

    setHash(view);
    onViewChange(view);
  }

  function getView() {
    // keep in sync with hash (e.g. direct typing)
    view = parseHash();
    return view;
  }

  window.addEventListener("hashchange", () => {
    view = parseHash();
    onViewChange(view);
  });

  return { getView, setView };
}
