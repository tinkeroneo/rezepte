// ingredients.js
export function isIngredientHeader(line) {
  const s = (line ?? "").trim();
  return !!s && s.endsWith(":");
}

export function renderIngredientsHtml(lines, escapeHtml) {
  let html = "";

  let ulOpen = false;

  function openUl() {
    if (!ulOpen) {
      html += "<ul>";
      ulOpen = true;
    }
  }

  function closeUl() {
    if (ulOpen) {
      html += "</ul>";
      ulOpen = false;
    }
  }


  for (const raw of (lines ?? [])) {
    const line = (raw ?? "").trim();
    if (!line) continue;

    if (isIngredientHeader(line)) {
      // Header als <li> rendern (valide innerhalb <ul>) – aber ohne Bullet
      openUl();
      html += `
    <li class="ingredient-header">
      ${escapeHtml(line.replace(/:$/, ""))}
    </li>
  `;
    } else {
      openUl();
      html += `<li>${escapeHtml(line)}</li>`;
    }

  }

  closeUl();
  return html;
}
