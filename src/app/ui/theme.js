import { readTheme, readWinter } from "../localSettings.js";
import { refreshDefaultRecipeImages } from "../../utils.js";
import { refreshLoaderIcon } from "../../ui/loader.js"; // Pfad ggf. anpassen


export function applyThemeAndOverlay() {
  const theme = readTheme();
  const wantsDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)")?.matches);

  const resolved = wantsDark ? "dark" : "light";
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle("dark", !!wantsDark);
  document.body.classList.toggle("dark", !!wantsDark);

  updateFavicon(resolved);
  refreshLoaderIcon();
  document.body.classList.toggle("winter", readWinter());

  // Update already-rendered fallback images (favicon.svg/faviconDark.svg)
  refreshDefaultRecipeImages(document);
}

function updateFavicon(resolvedTheme) {
  const icon = document.getElementById("app-favicon");
  if (!icon) return;

  icon.href =
    (resolvedTheme === "dark"
      ? "./src/favicon/iconCookingCatDark.svg"
      : "./src/favicon/iconCookingCatLight.svg")
    + "?v=" + (resolvedTheme === "dark" ? "d" : "l");
}

