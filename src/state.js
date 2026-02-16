// src/state.js
import { KEYS, lsSet } from "./storage.js";

// Parse: #cook?id=123&q=abc
function parseHash() {
  const raw = (location.hash || "#list").slice(1);
  const [namePartRaw, qsPart] = raw.split("?");
  const namePart = namePartRaw || "list";
  const params = new URLSearchParams(qsPart || "");
  const search = new URLSearchParams(location.search || "");

  const token_hash = params.get("token_hash") || search.get("token_hash") || "";
  const type = params.get("type") || search.get("type") || "";
  const next = params.get("next") || search.get("next") || "";

  // Short share links: #s/<token>
  if (namePart.startsWith("s/")) {
    return {
      name: "share",
      selectedId: null,
      q: params.get("q") || "",
      token: decodeURIComponent(namePart.slice(2) || ""),
      token_hash,
      type,
      next
    };
  }

  // If token_hash is present (often in query for magic links), force confirm route.
  // This prevents losing the confirmation step when URL wrappers modify the hash.
  if (token_hash) {
    return {
      name: "confirm",
      selectedId: null,
      q: params.get("q") || "",
      token: "",
      token_hash,
      type: type || "magiclink",
      next,
    };
  }

  return {
    name: namePart || "list",
    selectedId: params.get("id"),
    q: params.get("q") || "",
    token: params.get("token") || "",
    token_hash,
    type,
    next
  };
}

function setHash(view) {
  const params = new URLSearchParams();
  if (view.selectedId) params.set("id", view.selectedId);
  if (view.q) params.set("q", view.q);
  if (view.token) params.set("token", view.token);
  if (view.token_hash) params.set("token_hash", view.token_hash);
  if (view.type) params.set("type", view.type);
  if (view.next) params.set("next", view.next);

  const qs = params.toString();
  const next = `#${view.name}${qs ? "?" + qs : ""}`;

  if (location.hash !== next) location.hash = next;
}

export function initRouter({ onViewChange, canNavigate }) {
  let view = parseHash();

  function setView(next) {
  const prev = view;
  const candidate = { ...view, ...next };
  if (typeof canNavigate === "function") {
    const ok = canNavigate({ from: prev, to: candidate, reason: "setView" });
    if (ok === false) return;
  }
  view = candidate;

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

  let __reverting = false;

  function syncFromLocation(reason = "hashchange") {
    const nextView = parseHash();
    const prevView = view;

    if (__reverting) {
      __reverting = false;
      view = nextView;
      onViewChange(view);
      return true;
    }

    if (typeof canNavigate === "function") {
      const ok = canNavigate({ from: prevView, to: nextView, reason });
      if (ok === false) {
        __reverting = true;
        setHash(prevView);
        return false;
      }
    }

    view = nextView;
    onViewChange(view);
    return true;
  }

  window.addEventListener("hashchange", () => {
    syncFromLocation("hashchange");
  });

  // Also react when only query/path changes (e.g. magic-link URL updates
  // without a hashchange in existing app contexts).
  window.addEventListener("popstate", () => {
    syncFromLocation("popstate");
  });

  // BFCache restore can skip normal navigation events; resync explicitly.
  window.addEventListener("pageshow", () => {
    syncFromLocation("pageshow");
  });

return { getView, setView };
}
