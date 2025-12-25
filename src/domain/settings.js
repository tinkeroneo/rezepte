// Simple settings store (local-first).
// Later we can sync these to Supabase app_settings when Auth/Gate is in place.

const KEYMAP = {
  winter_overlay: "tinkeroneo_winter_overlay_v1",
  theme: "tinkeroneo_theme_v1",
  use_backend: "tinkeroneo_use_backend_v1",
  radio_feature: "tinkeroneo_radio_feature_v1",
  timer_ring_interval_ms: "tinkeroneo_timer_ring_interval_ms_v1",
  timer_max_ring_seconds: "tinkeroneo_timer_max_ring_seconds_v1",
  timer_step_highlight: "tinkeroneo_timer_step_highlight_v1",
  tag_colors: "tinkeroneo_tag_colors_v1",
  category_colors: "tinkeroneo_category_colors_v1",
};

function keyFor(name) {
  return KEYMAP[name] || `tinkeroneo_${String(name)}_v1`;
}

export function getSetting(name, fallback = null) {
  const k = keyFor(name);
  try {
    const raw = localStorage.getItem(k);
    if (raw === null || raw === undefined) return fallback;

    // booleans stored as "1"/"0"
    if (raw === "1") return true;
    if (raw === "0") return false;

    // try json
    if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
      try { return JSON.parse(raw); } catch { /* ignore */ }
    }

    // number?
    if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw);

    return raw;
  } catch {
    return fallback;
  }
}

export function setSetting(name, value) {
  const k = keyFor(name);
  try {
    if (value === undefined) return;

    if (value === null) {
      localStorage.removeItem(k);
      return;
    }

    if (typeof value === "boolean") {
      localStorage.setItem(k, value ? "1" : "0");
      return;
    }

    if (typeof value === "number") {
      localStorage.setItem(k, String(value));
      return;
    }

    if (typeof value === "object") {
      localStorage.setItem(k, JSON.stringify(value));
      return;
    }

    localStorage.setItem(k, String(value));
  } catch {
    // ignore (private mode etc.)
  }
}
