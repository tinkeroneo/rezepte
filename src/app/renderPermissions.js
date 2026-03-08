export async function ensureRenderPermissions({
  useBackend,
  isAuthenticated,
  getAuthContext,
  getMySpaces,
  appEl,
  reportError,
  showError,
  refreshSpaceSelect,
  runExclusive,
  render,
  view,
  setView,
  getBootstrapState,
  setBootstrapState,
  debug = false,
}) {
  if (!(useBackend && isAuthenticated?.())) return false;

  const ctx = (() => {
    try {
      return getAuthContext?.();
    } catch {
      return null;
    }
  })();
  const sid = String(ctx?.spaceId || "").trim();
  const spaces = getMySpaces?.() || [];
  const spacesMissing = !Array.isArray(spaces) || spaces.length === 0;

  const bootstrapState = getBootstrapState();
  if ((sid && !spacesMissing) || bootstrapState.inFlight) return false;

  if (bootstrapState.attempts >= 2) {
    if (debug) console.warn("perm bootstrap: giving up", { sid, spacesMissing, attempts: bootstrapState.attempts });
    return false;
  }

  setBootstrapState({ inFlight: true, attempts: bootstrapState.attempts + 1 });

  try {
    appEl.innerHTML = `
      <div class="container">
        <div class="card" style="padding:1rem; text-align:center;">
          <div style="font-weight:800;">Lade Space-Rechte…</div>
          <div class="muted" style="margin-top:.35rem;">Einen Moment</div>
        </div>
      </div>`;
  } catch (e) {
    reportError(e, { scope: "app.js", action: String(e?.message) });
    showError(String(e?.message));
  }

  try {
    await refreshSpaceSelect();
  } catch (e) {
    reportError(e, { scope: "app.js", action: String(e?.message) });
    showError(String(e?.message));
  }

  setBootstrapState({ inFlight: false });

  const nextCtx = (() => {
    try {
      return getAuthContext?.();
    } catch {
      return null;
    }
  })();
  const nextSid = String(nextCtx?.spaceId || "").trim();
  const nextSpaces = getMySpaces?.() || [];
  const nextSpacesMissing = !Array.isArray(nextSpaces) || nextSpaces.length === 0;

  if (nextSid && !nextSpacesMissing) {
    await runExclusive("render", () => render(view, setView));
    return true;
  }

  if (debug) console.warn("perm bootstrap: still missing", { sid2: nextSid, spacesMissing2: nextSpacesMissing });
  return false;
}
