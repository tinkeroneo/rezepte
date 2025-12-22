// ingredients.js
export function isIngredientHeader(line) {
  const s = (line ?? "").trim();
  return !!s && s.endsWith(":");
}

export function renderIngredientsHtml(lines, escapeHtml) {
  let html = "";
  let openList = false;

  const openUl = () => {
    if (!openList) {
      html += "<ul>";
      openList = true;
    }
  };

  const closeUl = () => {
    if (openList) {
      html += "</ul>";
      openList = false;
    }
  };

  for (const raw of (lines ?? [])) {
    const line = (raw ?? "").trim();
    if (!line) continue;

    if (isIngredientHeader(line)) {
      closeUl();
      html += `
        <div class="muted" style="margin-top:.75rem; font-weight:800;">
          ${escapeHtml(line.replace(/:$/, ""))}
        </div>
      `;
    } else {
      openUl();
      html += `<li>${escapeHtml(line)}</li>`;
    }
  }

  closeUl();
  return html;
}
