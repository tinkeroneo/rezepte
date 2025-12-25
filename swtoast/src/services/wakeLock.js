// Simple Wake Lock helper (Screen Wake Lock API)
// Keeps the screen awake while cooking.

let wakeLock = null;
let enabled = false;

async function requestLock() {
  if (!enabled) return;
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    // ignore (permission / unsupported / battery saver)
    wakeLock = null;
  }
}

export const Wake = {
  async enable() {
    enabled = true;
    await requestLock();

    // Re-acquire on tab re-focus
    document.addEventListener("visibilitychange", async () => {
      if (!enabled) return;
      if (document.visibilityState === "visible" && !wakeLock) {
        await requestLock();
      }
    });
  },

  async disable() {
    enabled = false;
    try { await wakeLock?.release?.(); } catch {}
    wakeLock = null;
  },

  isSupported() {
    return "wakeLock" in navigator;
  }
};
