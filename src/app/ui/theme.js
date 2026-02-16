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
  document.documentElement.style.backgroundColor = wantsDark ? "#0f1114" : "#f4efe6";
  const themeMeta = document.getElementById("themeColorMeta");
  if (themeMeta) themeMeta.setAttribute("content", wantsDark ? "#0f1114" : "#f4efe6");

  updateFavicon(resolved);
  refreshLoaderIcon();
  document.body.classList.toggle("winter", readWinter());

  // Update already-rendered fallback images (src/favicon/favicon.svg variants)
  refreshDefaultRecipeImages(document);
}

function updateFavicon(resolvedTheme) {
  const icon = document.getElementById("app-favicon");
  if (!icon) return;

  const file = resolvedTheme === "dark" ? "src/favicon/faviconDark.svg" : "src/favicon/favicon.svg";
  icon.href = `${new URL(file, document.baseURI).toString()}?v=${resolvedTheme === "dark" ? "d" : "l"}`;
}
