// src/app/adminCorner.js
// Hidden "admin" easter egg: enable via ?admin=1 or 7 taps on header (stored in localStorage).

const ADMIN_FLAG_KEY = "tinkeroneo_admin_enabled_v1";

function isAdminEnabled() {
  const url = new URL(location.href);
  const byParam = url.searchParams.get("admin") === "1";
  let byFlag = false;
  try { byFlag = localStorage.getItem(ADMIN_FLAG_KEY) === "1"; } catch { byFlag = false; }
  return byParam || byFlag;
}

function setAdminEnabled(v, { reportError, showError } = {}) {
  try {
    localStorage.setItem(ADMIN_FLAG_KEY, v ? "1" : "0");
  } catch (e) {
    reportError?.(e, { scope: "adminCorner", action: String(e?.message || e) });
    showError?.(String(e?.message || e));
  }
}

export function installAdminCorner({ reportError, showError } = {}) {
  const mount = () => {
    const btn = document.getElementById("adminBadge");
    if (!btn) return;

    btn.hidden = !isAdminEnabled();
    if (!btn.__wired) {
      btn.__wired = true;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        location.hash = "admin";
      });
    }
  };

  const header = document.querySelector("header");
  if (header && !header.__adminEggInstalled) {
    header.__adminEggInstalled = true;
    let taps = 0;
    let t0 = 0;
    header.addEventListener("click", () => {
      const now = Date.now();
      if (!t0 || now - t0 > 2000) { t0 = now; taps = 0; }
      taps++;
      if (taps >= 7) {
        taps = 0;
        const next = !isAdminEnabled();
        setAdminEnabled(next, { reportError, showError });
        mount();
      }
    });
  }

  mount();
}
