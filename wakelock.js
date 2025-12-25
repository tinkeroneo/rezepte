// wakelock.js
// Minimaler Wake-Lock Helper (Screen bleibt an)

let lock = null;
let enabled = false;

async function request() {
  if (!enabled) return;
  if (!("wakeLock" in navigator)) return;

  try {
    lock = await navigator.wakeLock.request("screen");
  } catch {
    lock = null;
  }
}

async function release() {
  try {
    await lock?.release();
  } catch { /* ignore */ }
  lock = null;
}

async function onVisibilityChange() {
  if (!enabled) return;

  if (document.visibilityState === "visible") {
    await request();
  } else {
    await release();
  }
}

export const wakeLock = {
  async enable() {
    if (enabled) return;
    enabled = true;
    document.addEventListener("visibilitychange", onVisibilityChange);
    await request();
  },

  async disable() {
    enabled = false;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    await release();
  }
};
