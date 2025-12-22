import { lsGet, lsSet } from "./storage.js";
import { KEYS } from "./storage.js";

export function encodeView(v) {
  return {
    name: v?.name ?? "list",
    selectedId: v?.selectedId ?? null,
    q: v?.q ?? ""
  };
}

export function initRouter({ onViewChange }) {
  // initial state from localStorage
  let view = encodeView(lsGet(KEYS.NAV, { name: "list", selectedId: null, q: "" }));

  history.replaceState({ __tinkeroneo: true, view }, "", location.pathname + location.search + location.hash);

  function setView(next, { push = true } = {}) {
    view = encodeView(next);
    const state = { __tinkeroneo: true, view };

    if (push) history.pushState(state, "", location.pathname + location.search + location.hash);
    else history.replaceState(state, "", location.pathname + location.search + location.hash);

    lsSet(KEYS.NAV, view);
    onViewChange(view);
  }

  window.addEventListener("popstate", (e) => {
    const st = e.state;
    if (st?.__tinkeroneo && st?.view) {
      view = encodeView(st.view);
      lsSet(KEYS.NAV, view);
      onViewChange(view);
      return;
    }

    // fallback: stay inside app
    const saved = lsGet(KEYS.NAV, null);
    if (saved?.name) {
      view = encodeView(saved);
      history.replaceState({ __tinkeroneo: true, view }, "", location.pathname + location.search + location.hash);
      onViewChange(view);
      return;
    }

    view = { name: "list", selectedId: null, q: "" };
    history.replaceState({ __tinkeroneo: true, view }, "", location.pathname + location.search + location.hash);
    onViewChange(view);
  });

  return { getView: () => view, setView };
}
