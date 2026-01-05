import { readTheme, readWinter } from "../localSettings.js";
import { refreshDefaultRecipeImages } from "../../utils.js";

export function applyThemeAndOverlay() {
  const theme = readTheme();
  const wantsDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)")?.matches);

  const resolved = wantsDark ? "dark" : "light";
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle("dark", !!wantsDark);
  document.body.classList.toggle("dark", !!wantsDark);

  document.body.classList.toggle("winter", readWinter());

  // Update already-rendered fallback images (favicon.svg/faviconDark.svg)
  refreshDefaultRecipeImages(document);
}
