// src/services/categoryAccentWatcher.js

/**
 * Updates CSS var --cat-accent on list items when category colors change.
 * Call once per view mount.
 */
export function watchCategoryAccents({ catAccent }) {
  try {
    if (window.__tinkeroneoCatColorsHandler) {
      window.removeEventListener("category-colors-changed", window.__tinkeroneoCatColorsHandler);
    }

    window.__tinkeroneoCatColorsHandler = () => {
      document.querySelectorAll(".list-item[data-category]").forEach((el) => {
        const catVal = el.getAttribute("data-category") || "";
        el.style.setProperty("--cat-accent", catAccent(catVal));
      });
    };

    window.addEventListener("category-colors-changed", window.__tinkeroneoCatColorsHandler);
  } catch {
    // ignore
  }
}
