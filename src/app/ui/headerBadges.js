// src/app/ui/headerBadges.js
// Centralized header/account badge updates. Safe to call after any render.

export function createHeaderBadgesUpdater(ctx) {
  const {
    getUseBackend,
    isAuthenticated,
    getOfflineQueue,
    getMySpaces,
  } = ctx;

  return function updateHeaderBadges({ syncing = false, syncError = false } = {}) {
    const useBackend = !!getUseBackend?.();

    const mode = document.getElementById("modeBadge");
    if (mode) {
      mode.textContent = useBackend ? "MODE CLOUD" : "MODE LOCAL";
      mode.classList.toggle("badge--ok", useBackend);
      mode.classList.toggle("badge--warn", !useBackend);
      mode.title = useBackend
        ? "CLOUD: Sync + Teilen im Space (Supabase). Klick = auf LOCAL (nur dieses Geraet)."
        : "LOCAL: nur auf diesem Geraet (offline). Klick = auf CLOUD (Sync + Teilen).";
    }

    const authBtn = document.getElementById("authBadge");
    if (authBtn) {
      const authed = !!isAuthenticated?.();
      authBtn.textContent = authed ? "🔐 LOGOUT" : "🔐 LOGIN";
      authBtn.classList.toggle("badge--ok", authed);
      authBtn.classList.toggle("badge--warn", !authed);
      authBtn.title = authed
        ? "Abmelden"
        : (useBackend ? "Anmelden per Magic Link" : "Für Login/Sharing: erst auf CLOUD umschalten");
    }

    const sync = document.getElementById("syncBadge");
    if (sync) {
      const pending = (getOfflineQueue?.() || []).length;
      const showPending = navigator.onLine && !syncing && !syncError && pending > 0;

      sync.hidden = !syncing && !syncError && navigator.onLine && pending === 0;

      if (!navigator.onLine) {
        sync.textContent = "OFFLINE";
        sync.classList.add("badge--warn");
        sync.classList.remove("badge--ok", "badge--bad");
      } else if (syncError) {
        sync.textContent = "SYNC";
        sync.classList.add("badge--bad");
        sync.classList.remove("badge--ok", "badge--warn");
      } else if (showPending) {
        sync.textContent = `PENDING ${pending}`;
        sync.classList.add("badge--warn");
        sync.classList.remove("badge--ok", "badge--bad");
      } else {
        sync.textContent = "⟳";
        sync.classList.add("badge--ok");
        sync.classList.remove("badge--warn", "badge--bad");
      }

      if (!navigator.onLine) sync.title = "Offline: Änderungen bleiben lokal und werden später synchronisiert";
      else if (syncError) sync.title = "Sync-Fehler: bitte später nochmal";
      else if (showPending) sync.title = `${pending} Änderung(en) warten auf Sync`;
      else sync.title = "Sync ok";
    }

    // Space select visibility depends on auth + spaces
    const spaceSel = document.getElementById("spaceSelect");
    if (spaceSel) {
      const authed = !!isAuthenticated?.();
      const spaces = getMySpaces?.() || [];
      spaceSel.hidden = !authed || !Array.isArray(spaces) || spaces.length === 0;
    }
  };
}
