// src/app/ui/accountControls.js
import { allowedInviteRoles, getMyRoleInSpace } from "../../domain/spacePerms.js";
import { revokeInvite, listSpaceMembers, listPendingInvites } from "../../supabase.js";
// Bind account-related controls after the view is rendered.
// Everything here is "bind once" (via __installed flags), safe to call repeatedly.

export function wireAccountControls(ctx) {
  const {
    readTheme,
    setTheme,
    applyThemeAndOverlay,

    isAuthenticated,
    sbLogout,
    setUseBackend,
    getUseBackend,

    router,
    setActiveSpaceId,
    getAuthContext,
    getMySpaces,
    inviteToSpace,

    setOfflineQueueScope,

    updateHeaderBadges,
    runExclusive,
    loadAll,

    reportError,
    showError,

    upsertProfile,
    setProfileCache,

    refreshSpaceSelect,
    refreshProfileUi,
    updateSpaceName,

    installAdminCorner,



  } = ctx;

  // THEME
  const themeBtn = document.getElementById("themeBadge");
  if (themeBtn && !themeBtn.__installed) {
    themeBtn.__installed = true;

    const applyThemeBtn = () => {
      const t = readTheme();
      themeBtn.title = `Theme wechseln (aktuell: ${t})`;
      themeBtn.textContent = t === "dark" ? "🌙 THEME" : (t === "light" ? "☀️THEME" : "🌓 THEME");
    };

    applyThemeBtn();

    themeBtn.addEventListener("click", () => {
      const t = readTheme();
      const next = t === "system" ? "dark" : (t === "dark" ? "light" : "system");
      setTheme(next);
      applyThemeAndOverlay();
      applyThemeBtn();
    });

    window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => {
      if (readTheme() === "system") {
        applyThemeAndOverlay();
        applyThemeBtn();
      }
    });
  }

  // LOGIN / LOGOUT
  const authBtn = document.getElementById("authBadge");
  if (authBtn && !authBtn.__installed) {
    authBtn.__installed = true;
    authBtn.addEventListener("click", async () => {
      const authed = isAuthenticated?.();

      if (authed) {
        try { sbLogout(); } catch (e) {
          reportError?.(e, { scope: "accountControls", action: String(e?.message || e) });
          showError?.(String(e?.message || e));
        }
        updateHeaderBadges?.();
        router?.setView?.({ name: "login" });
        return;
      }

      if (!getUseBackend()) {
        await setUseBackend(true);
      }

      router?.setView?.({ name: "login" });
      updateHeaderBadges?.();
    });
  }

  // SPACE SELECT
  const spaceSel = document.getElementById("spaceSelect");
  if (spaceSel && !spaceSel.__installed) {
    spaceSel.__installed = true;
    spaceSel.addEventListener("change", async () => {
      const sid = String(spaceSel.value || "").trim();
      if (!sid) return;

      // keep header select in sync
      const headerSel = document.getElementById("headerSpaceSelect");
      if (headerSel && String(headerSel.value || "") !== sid) headerSel.value = sid;

      try {
        setActiveSpaceId(sid);
        const ctxAuth = (() => { try { return getAuthContext?.(); } catch { return null; } })();
        setOfflineQueueScope?.({ userId: ctxAuth?.user?.id || null, spaceId: ctxAuth?.spaceId || null });

        updateHeaderBadges?.({ syncing: true });
        await runExclusive?.("loadAll", () => loadAll());
        updateHeaderBadges?.({ syncing: false });

        router?.setView?.({ name: "list", selectedId: null, q: "" });
      } catch (e) {
        reportError?.(e, { scope: "accountControls", action: String(e?.message || e) });
        showError?.(String(e?.message || e));
        alert(String(e?.message || e));
      }
    });
  }

  // DEFAULT SPACE SELECT (Profile)
  const defSel = document.getElementById("defaultSpaceSelect");
  if (defSel && !defSel.__installed) {
    defSel.__installed = true;
    defSel.addEventListener("change", async () => {
      if (!(getUseBackend() && isAuthenticated?.())) return;

      const sid = String(defSel.value || "").trim();
      const nextDefault = sid ? sid : null;

      try {
        updateHeaderBadges?.({ syncing: true });
        const p = await upsertProfile({ default_space_id: nextDefault });
        setProfileCache?.(p);
        updateHeaderBadges?.({ syncing: false });
      } catch (e) {
        reportError?.(e, { scope: "accountControls", action: String(e?.message || e) });
        showError?.(String(e?.message || e));
        updateHeaderBadges?.({ syncing: false });
        alert(`Default-Space speichern fehlgeschlagen: ${String(e?.message || e)}`);
      }
    });
  }

  // SAVE PROFILE (display name)
  const saveProfileBtn = document.getElementById("saveProfileBtn");
  if (saveProfileBtn && !saveProfileBtn.__installed) {
    saveProfileBtn.__installed = true;
    saveProfileBtn.addEventListener("click", async () => {
      if (!(getUseBackend() && isAuthenticated?.())) {
        alert("Nicht eingeloggt oder Backend aus (useBackend=false).");
        return;
      }
      const dn = document.getElementById("profileDisplayName");
      const display_name = String(dn?.value || "").trim();
      try {
        const p = await upsertProfile({ display_name });
        setProfileCache?.(p);
        await refreshProfileUi?.();
        updateHeaderBadges?.();
      } catch (e) {
        reportError?.(e, { scope: "accountControls", action: "saveProfile" });
        showError?.(String(e?.message || e));
        alert(`Profil speichern fehlgeschlagen: ${String(e?.message || e)}`);
      }
    });
  }

  // SAVE SPACE NAME
  const saveSpaceNameBtn = document.getElementById("saveSpaceNameBtn");
  if (saveSpaceNameBtn && !saveSpaceNameBtn.__installed) {
    saveSpaceNameBtn.__installed = true;
    saveSpaceNameBtn.addEventListener("click", async () => {
      if (!(getUseBackend() && isAuthenticated?.())) {
        alert("Nicht eingeloggt oder Backend aus (useBackend=false).");
        return;
      }
      const ctxAuth = (() => { try { return getAuthContext?.(); } catch { return null; } })();
      const sid = String(ctxAuth?.spaceId || "").trim();
      if (!sid) return;
      const inp = document.getElementById("spaceNameInput");
      const name = String(inp?.value || "").trim();
      try {
        await updateSpaceName?.({ spaceId: sid, name });
        await refreshSpaceSelect?.();
        await refreshProfileUi?.();
        alert("Space-Name gespeichert ✅");
      } catch (e) {
        reportError?.(e, { scope: "accountControls", action: "saveSpaceName" });
        showError?.(String(e?.message || e));
        alert(`Space-Name speichern fehlgeschlagen: ${String(e?.message || e)}`);
      }
    });
  }

  // ADMIN NAV (badge may be hidden unless enabled)
  const adminBtn = document.getElementById("adminBadge");
  if (adminBtn && !adminBtn.__wiredNav) {
    adminBtn.__wiredNav = true;
    adminBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      location.hash = "admin";
    });
  }


  // TOOLS: Import / Export / Diagnostics
  const diagBtn = document.getElementById("diagnosticsBtn");
  if (diagBtn && !diagBtn.__installed) {
    diagBtn.__installed = true;
    diagBtn.addEventListener("click", () => {
      router?.setView?.({ name: "diagnostics" });
    });
  }

  

  // ensures text/icons are current + wires profile buttons (safe)
  updateHeaderBadges?.();
  installAdminCorner?.({ reportError, showError }); // safe no-op if not enabled

  // SHARING (invite)
  const inviteBtn = document.getElementById("accBtnInvite");
  if (inviteBtn && !inviteBtn.__installed) {
    inviteBtn.__installed = true;

    const emailInp = document.getElementById("accShareEmail");
    const roleSel = document.getElementById("accShareRole");
    const msgEl = document.getElementById("accShareMsg");

    const setMsg = (t = "", kind = "") => {
      if (!msgEl) return;
      msgEl.textContent = t;
      msgEl.classList.toggle("hint-bad", kind === "bad");
      msgEl.classList.toggle("hint-ok", kind === "ok");
    };

    const refreshInviteRoleOptions = () => {
      if (!roleSel) return;
      const ctxAuth = (() => { try { return getAuthContext?.(); } catch { return null; } })();
      const spaceId = String(ctxAuth?.spaceId || "");
      const mySpaces = typeof getMySpaces === "function" ? getMySpaces() : [];
      const myRole = getMyRoleInSpace({ spaceId, mySpaces });
      const roles = allowedInviteRoles(myRole);

      roleSel.innerHTML = roles.map(r => `<option value="${r}">${r}</option>`).join("");
      roleSel.value = roles[0] || "viewer";
      roleSel.disabled = roles.length === 1;
      roleSel.title = roles.length === 1 ? "Du kannst nur Viewer einladen" : "Rolle wählen";
    };

    refreshInviteRoleOptions();

    // update when space changes
    const spaceSel2 = document.getElementById("spaceSelect");
    if (spaceSel2) {
      spaceSel2.addEventListener("change", () => {
        refreshInviteRoleOptions();
        setMsg("");
      });
    }

    inviteBtn.addEventListener("click", async () => {
      if (!(getUseBackend() && isAuthenticated?.())) return;
      const email = String(emailInp?.value || "").trim();
      if (!email || !email.includes("@")) {
        setMsg("Bitte eine gültige E-Mail eingeben.", "bad");
        return;
      }

      const ctxAuth = (() => { try { return getAuthContext?.(); } catch { return null; } })();
      const spaceId = String(ctxAuth?.spaceId || "").trim();
      if (!spaceId) {
        setMsg("Kein aktiver Space.", "bad");
        return;
      }

      const mySpaces = typeof getMySpaces === "function" ? getMySpaces() : [];
      const myRole = getMyRoleInSpace({ spaceId, mySpaces });
      const allowed = allowedInviteRoles(myRole);
      let role = String(roleSel?.value || "viewer").trim().toLowerCase();
      if (!allowed.includes(role)) role = "viewer";

      try {
        inviteBtn.disabled = true;
        setMsg("Sende Invite…", "");
        await inviteToSpace?.({ email, role, spaceId });
        if (emailInp) emailInp.value = "";
        refreshInviteRoleOptions();
        setMsg("Invite gesendet ✅", "ok");
      } catch (e) {
        reportError?.(e, { scope: "accountControls", action: "inviteToSpace" });
        setMsg(String(e?.message || e), "bad");
      } finally {
        inviteBtn.disabled = false;
      }
    });
  }


  // SHARING (CLOUD block in account.view.js)
  const cloudInviteBtn = document.getElementById("btnInvite");
  if (cloudInviteBtn && !cloudInviteBtn.__installed) {
    cloudInviteBtn.__installed = true;

    const emailInp = document.getElementById("shareEmail");
    const roleSel = document.getElementById("shareRole");
    const membersEl = document.getElementById("membersList");
    const invitesEl = document.getElementById("invitesList");
    const refreshBtn = document.getElementById("btnRefreshSharing");

    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
      c === "&" ? "&amp;" :
      c === "<" ? "&lt;" :
      c === ">" ? "&gt;" :
      c === '"' ? "&quot;" : "&#39;"
    ));

    const getActiveSpaceId = () => {
      const ctxAuth = (() => { try { return getAuthContext?.(); } catch { return null; } })();
      return String(ctxAuth?.spaceId || "").trim();
    };

    const refreshInviteRoleOptions = () => {
      if (!roleSel) return;
      const spaceId = getActiveSpaceId();
      const mySpaces = typeof getMySpaces === "function" ? getMySpaces() : [];
      const myRole = getMyRoleInSpace({ spaceId, mySpaces });
      const roles = allowedInviteRoles(myRole);

      roleSel.innerHTML = roles.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join("");
      roleSel.value = roles[0] || "viewer";
      roleSel.disabled = roles.length === 1;
      roleSel.title = roles.length === 1 ? "Du kannst nur Viewer einladen" : "Rolle wählen";
    };

    const renderMembers = (rows) => {
      if (!membersEl) return;
      if (!Array.isArray(rows) || rows.length === 0) {
        membersEl.textContent = "Keine Mitglieder gefunden.";
        return;
      }
      // rows: { email?, user_id?, role?, created_at? }
      membersEl.innerHTML = rows.map(r => {
        const email = esc(r?.email || r?.user_email || r?.user || r?.user_id || "-");
        const role = esc(r?.role || "-");
        return `<div class="hint" style="margin:.15rem 0;">${email} · <b>${role}</b></div>`;
      }).join("");
    };

    const renderInvites = (rows) => {
      if (!invitesEl) return;
      if (!Array.isArray(rows) || rows.length === 0) {
        invitesEl.textContent = "Keine offenen Einladungen.";
        return;
      }
      invitesEl.innerHTML = rows.map(r => {
        const id = esc(r?.id || r?.invite_id || "");
        const email = esc(r?.email || r?.invited_email || "-");
        const role = esc(r?.role || "-");
        const btn = (typeof revokeInvite === "function" && id)
          ? `<button class="btn btn--ghost" data-revoke="${id}" type="button" style="margin-left:.5rem;">Entfernen</button>`
          : "";
        return `<div class="row" style="gap:.5rem; align-items:center; margin:.15rem 0;">
          <div class="hint" style="margin:0;">${email} · <b>${role}</b></div>${btn}
        </div>`;
      }).join("");

      // wire revoke
      if (typeof revokeInvite === "function") {
        invitesEl.querySelectorAll?.("button[data-revoke]")?.forEach((b) => {
          if (b.__installed) return;
          b.__installed = true;
          b.addEventListener("click", async () => {
            const id = String(b.getAttribute("data-revoke") || "").trim();
            if (!id) return;
            try {
              b.disabled = true;
              await revokeInvite(id);
            } finally {
              b.disabled = false;
              await refreshLists();
            }
          });
        });
      }
    };

    const refreshLists = async () => {
      const spaceId = getActiveSpaceId();
      if (!spaceId) return;
      if (membersEl) membersEl.textContent = "Lade…";
      if (invitesEl) invitesEl.textContent = "Lade…";
      try {
        const [members, invites] = await Promise.all([
          typeof listSpaceMembers === "function" ? listSpaceMembers({ spaceId }) : [],
          typeof listPendingInvites === "function" ? listPendingInvites({ spaceId }) : [],
        ]);
        renderMembers(members);
        renderInvites(invites);
      } catch (e) {
        if (membersEl) membersEl.textContent = "Fehler beim Laden.";
        if (invitesEl) invitesEl.textContent = "Fehler beim Laden.";
        reportError?.(e, { scope: "accountControls", action: "refreshSharingLists" });
      }
    };

    refreshInviteRoleOptions();
    refreshLists();

    // update when space changes
    if (spaceSel) {
      spaceSel.addEventListener("change", () => {
        refreshInviteRoleOptions();
        refreshLists();
      });
    }

    refreshBtn?.addEventListener("click", () => {
      refreshInviteRoleOptions();
      refreshLists();
    });

    cloudInviteBtn.addEventListener("click", async () => {
      if (!(getUseBackend() && isAuthenticated?.())) return;
      const email = String(emailInp?.value || "").trim();
      if (!email || !email.includes("@")) return;

      const spaceId = getActiveSpaceId();
      if (!spaceId) return;

      const mySpaces = typeof getMySpaces === "function" ? getMySpaces() : [];
      const myRole = getMyRoleInSpace({ spaceId, mySpaces });
      const allowed = allowedInviteRoles(myRole);

      let role = String(roleSel?.value || "viewer").trim().toLowerCase();
      if (!allowed.includes(role)) role = "viewer";

      try {
        cloudInviteBtn.disabled = true;
        await inviteToSpace?.({ email, role, spaceId });
        if (emailInp) emailInp.value = "";
      } catch (e) {
        reportError?.(e, { scope: "accountControls", action: "inviteToSpace" });
        showError?.(String(e?.message || e));
      } finally {
        cloudInviteBtn.disabled = false;
        await refreshLists();
        refreshInviteRoleOptions();
      }
    });
  }


}
