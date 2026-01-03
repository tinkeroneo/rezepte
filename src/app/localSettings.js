import { KEYS, lsGetStr, lsSetStr } from "../storage.js";

// Default should be local-first (offline friendly). User can switch to CLOUD anytime.
export const DEFAULT_USE_BACKEND = false;

export function readUseBackend() {
  const v = lsGetStr(KEYS.USE_BACKEND, "");
  if (v === "0") return false;
  if (v === "1") return true;
  return DEFAULT_USE_BACKEND;
}

export function writeUseBackend(on) {
  lsSetStr(KEYS.USE_BACKEND, on ? "1" : "0");
}

export function readTheme() {
  const v = lsGetStr(KEYS.THEME, "");
  return v || "system"; // system | light | dark
}

export function setTheme(v) {
  lsSetStr(KEYS.THEME, v || "system");
}

export function readWinter() {
  const v = lsGetStr(KEYS.WINTER, "");
  if (v === "1") return true;
  if (v === "0") return false;
  return false;
}

export function setWinter(on) {
  lsSetStr(KEYS.WINTER, on ? "1" : "0");
}

// Radio (feature + consent)
export function readRadioFeature() {
  const v = lsGetStr(KEYS.RADIO_FEATURE, "");
  if (v === "1") return true;
  if (v === "0") return false;
  return true; // default ON
}

export function setRadioFeature(on) {
  lsSetStr(KEYS.RADIO_FEATURE, on ? "1" : "0");
  window.dispatchEvent(new window.Event("tinkeroneo:radioFeatureChanged"));
}

export function readRadioConsent() {
  const v = lsGetStr(KEYS.RADIO_CONSENT, "");
  if (v === "1") return true;
  if (v === "0") return false;
  return false;
}

export function clearRadioConsent() {
  lsSetStr(KEYS.RADIO_CONSENT, "0");
  window.dispatchEvent(new window.Event("tinkeroneo:radioFeatureChanged"));
}

// Timer settings (ring + step highlight)
export function readTimerRingIntervalMs() {
  const raw = lsGetStr(KEYS.TIMER_RING_INTERVAL_MS, "");
  const n = Number(raw);
  if (!Number.isFinite(n)) return 2800;
  return Math.max(250, Math.min(10000, Math.round(n)));
}

export function setTimerRingIntervalMs(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return;
  const clamped = Math.max(250, Math.min(10000, Math.round(n)));
  lsSetStr(KEYS.TIMER_RING_INTERVAL_MS, String(clamped));
}

export function readTimerMaxRingSeconds() {
  const raw = lsGetStr(KEYS.TIMER_MAX_RING_SECONDS, "");
  const n = Number(raw);
  if (!Number.isFinite(n)) return 120;
  return Math.max(10, Math.min(600, Math.round(n)));
}

export function setTimerMaxRingSeconds(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n)) return;
  const clamped = Math.max(10, Math.min(600, Math.round(n)));
  lsSetStr(KEYS.TIMER_MAX_RING_SECONDS, String(clamped));
}

export function readTimerStepHighlight() {
  const v = lsGetStr(KEYS.TIMER_STEP_HIGHLIGHT, "");
  if (v === "0") return false;
  if (v === "1") return true;
  return true; // default on
}

export function setTimerStepHighlight(on) {
  lsSetStr(KEYS.TIMER_STEP_HIGHLIGHT, on ? "1" : "0");
}

// Timer sound settings
export function readTimerSoundEnabled() {
  const raw = lsGetStr(KEYS.TIMER_SOUND_ENABLED, "");
  if (raw === "0") return false;
  if (raw === "1") return true;
  return true; // default ON
}

export function setTimerSoundEnabled(on) {
  lsSetStr(KEYS.TIMER_SOUND_ENABLED, on ? "1" : "0");
  window.dispatchEvent(new window.Event("tinkeroneo:timerSoundChanged"));
}

export function readTimerSoundId() {
  const raw = lsGetStr(KEYS.TIMER_SOUND_ID, "");
  const v = String(raw || "").trim();
  if (!v) return "gong"; // default
  const allowed = new Set(["gong", "wood", "pulse", "bowl"]);
  return allowed.has(v) ? v : "gong";
}

export function setTimerSoundId(id) {
  const v = String(id || "").trim();
  const allowed = new Set(["gong", "wood", "pulse", "bowl"]);
  const safe = allowed.has(v) ? v : "gong";
  lsSetStr(KEYS.TIMER_SOUND_ID, safe);
  window.dispatchEvent(new window.Event("tinkeroneo:timerSoundChanged"));
}

export function readTimerSoundVolume() {
  const raw = lsGetStr(KEYS.TIMER_SOUND_VOLUME, "");
  const v = String(raw ?? "").trim();
  if (!v) return 0.7;
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.7;
  return Math.max(0, Math.min(1, n));
}

export function setTimerSoundVolume(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return;
  const clamped = Math.max(0, Math.min(1, n));
  lsSetStr(KEYS.TIMER_SOUND_VOLUME, String(clamped));
  window.dispatchEvent(new window.Event("tinkeroneo:timerSoundChanged"));
}
