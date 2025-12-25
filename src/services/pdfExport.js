// src/services/pdfExport.js
import { escapeHtml } from "../utils.js";
import { buildMenuIngredients, buildMenuStepSections, isMenuRecipe } from "../domain/menu.js";

export function exportRecipesToPdfViaPrint({
  recipes,
  partsByParent,
  allRecipes = null,
  includeImages = true,
  title = "Rezepte Export",
}) {
  const html = buildPrintHtml({ recipes, partsByParent, allRecipes, includeImages, title });
  if (!html || html.trim().length < 50) {
    alert("PDF Export: keine Inhalte (0 Rezepte ausgewählt?)");
    return;
  }

  const w = window.open("", "_blank");
  if (!w) {
    alert("Pop-up blockiert? Bitte Pop-ups für diese Seite erlauben.");
    return;
  }

  // security: detach opener after opening
  try { w.opener = null; } catch { /* ignore */ }

  // document.write ist zwar deprecated, aber für Print-Windows ok.
  w.document.open();
  w.document.write(html);
  w.document.close();

  // warten bis Bilder geladen sind, dann drucken
  const imgs = Array.from(w.document.images || []);
  if (!imgs.length) {
    w.focus();
    w.print();
    return;
  }

  let done = 0;
  const finish = () => {
    done++;
    if (done >= imgs.length) {
      w.focus();
      w.print();
    }
  };

  imgs.forEach((img) => {
    if (img.complete) finish();
    else {
      img.addEventListener("load", finish, { once: true });
      img.addEventListener("error", finish, { once: true });
    }
  });
}

function normalizeLines(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x.map(v => String(v ?? "").trim()).filter(Boolean);
  if (typeof x === "string") {
    return x
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.replace(/^[-*•]\s*/, "")); // falls copy/paste bullets drin sind
  }
  return [];
}

function getRecipeImageUrl(r) {
  // in deinem Projekt eher image_url; manche Varianten nutzen imageUrl
  return r?.image_url || r?.imageUrl || r?.img || "";
}

function buildPrintHtml({ recipes, partsByParent, allRecipes, includeImages, title }) {
  const pool = allRecipes && Array.isArray(allRecipes) ? allRecipes : (recipes ?? []);
    const now = new Date();
const stamp = now.toLocaleString();
const count = (recipes ?? []).length;

  const items = (recipes ?? []).map((r) => {
    const isMenu = isMenuRecipe(r, partsByParent);

    // ✅ Primär aus dem Rezept selbst (dein Standardmodell)
    let ingredients = normalizeLines(r.ingredients);
    let steps = normalizeLines(r.steps);

    // ✅ Menü: Zutaten/Schritte aus verlinkten Teilrezepten mit übernehmen
    if (isMenu) {
      const ingSections = buildMenuIngredients(r, pool, partsByParent);
      ingredients = ingSections
        .flatMap(sec => [
          `## ${sec.title}`,
          ...(sec.items ?? []).map(x => `- ${x}`),
        ])
        .map(s => String(s).trim())
        .filter(Boolean);

      const stepSections = buildMenuStepSections(r, pool, partsByParent);
      steps = stepSections
        .flatMap(sec => [
          `## ${sec.title}`,
          ...(sec.cards ?? []).flatMap(card => [
            `- ${card.title}`,
            ...((card.body ?? []).map(x => `  ${x}`)),
          ]),
        ])
        .map(s => String(s).trim())
        .filter(Boolean);
    }

    // Optionaler Fallback, falls in Zukunft Parts wirklich gebraucht werden
    // (derzeit ist partsByParent in deinem Modell parent_id -> [child_id] und enthält keinen Text)
    // => ohne ein "partsById" kann man daraus keinen Text gewinnen, daher hier nur als Hook:
    if ((!ingredients.length || !steps.length) && partsByParent) {
      // no-op currently (keine Textquelle)
    }

    const imgUrl = includeImages ? getRecipeImageUrl(r) : "";
    const img = imgUrl
      ? `<img class="hero" src="${escapeHtml(imgUrl)}" alt="${escapeHtml(r.title || "Rezept")}" />`
      : "";

    const desc = r.description || r.desc || r.notes || "";

    const tags = Array.isArray(r.tags) ? r.tags.filter(Boolean) : [];

    return `
      <article class="recipe">
        <header>
          <h1>${escapeHtml(r.title || "Rezept")}</h1>
          <div class="meta">
            ${r.category ? `<span>🏷 ${escapeHtml(r.category)}</span>` : ``}
            ${r.time ? `<span>⏱ ${escapeHtml(r.time)}</span>` : ``}
            ${r.source ? `<span>🔗 ${escapeHtml(r.source)}</span>` : ``}
            ${tags.length ? `<span>🏷️ ${escapeHtml(tags.join(", "))}</span>` : ``}
          </div>
        </header>

        ${img}

        ${desc ? `<p class="desc">${escapeHtml(desc)}</p>` : ``}

        ${ingredients.length ? `
          <h2>Zutaten</h2>
          ${renderMaybeSections(ingredients)}
        ` : ``}

        ${steps.length ? `
          <h2>Zubereitung</h2>
          ${renderMaybeSections(steps, { ordered: true })}
        ` : ``}
      </article>
      <div class="pagebreak"></div>
    `;
  }).join("");

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
  .dochead { max-width: 820px; margin: 0 auto 14px; }
.dochead-title { font-size: 18px; font-weight: 900; margin: 0 0 6px; }
.dochead-meta { color:#666; font-size: 12.5px; display:flex; gap:12px; flex-wrap:wrap; }
.docsep { border:0; border-top:1px solid #eee; margin: 10px auto 18px; max-width: 820px; }

    :root { color-scheme: light; }
    body { font-family: system-ui,-apple-system,BlinkMacSystemFont,sans-serif; margin: 24px; }
    .recipe { max-width: 820px; margin: 0 auto; }
    h1 { margin: 0 0 6px; font-size: 22px; }
    h2 { margin: 18px 0 8px; font-size: 16px; }
    .meta { color:#666; font-size: 13px; display:flex; gap:12px; flex-wrap:wrap; }
    .desc { margin-top: 10px; color:#222; }
    ul,ol { margin: 8px 0 0 18px; }
    li { margin: 6px 0; }
    img.hero { width: 100%; max-height: 280px; object-fit: cover; border-radius: 12px; margin: 12px 0; background:#eee; }
    .pagebreak { page-break-after: always; }

    @media print {
      body { margin: 0; }
      .pagebreak { page-break-after: always; }
    }

  </style>
</head>
<body>
<header class="dochead">
  <div class="dochead-title">${escapeHtml(title)}</div>
  <div class="dochead-meta">
    <span>📅 ${escapeHtml(stamp)}</span>
    <span>📚 ${count} Rezept${count === 1 ? "" : "e"}</span>
  </div>
</header>
<hr class="docsep" />

  ${items || `<p>Keine Rezepte ausgewählt.</p>`}
</body>
</html>
`;
}

function renderMaybeSections(lines, { ordered = false } = {}) {
  // Menü-Export nutzt "## Section" + "- item". Für normale Rezepte sind es simple Lines.
  const out = [];

  let currentTitle = null;
  let buf = [];

  const flush = () => {
    if (!buf.length) return;
    const li = buf
      .map(s => String(s))
      .filter(Boolean)
      .map(s => s.replace(/^[-*•]\s*/, ""));
    const listTag = ordered ? "ol" : "ul";

    out.push(`
      ${currentTitle ? `<h3 class="section">${escapeHtml(currentTitle)}</h3>` : ""}
      <${listTag}>${li.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</${listTag}>
    `);

    buf = [];
  };

  for (const raw of (lines ?? [])) {
    const s = String(raw ?? "").trim();
    if (!s) continue;
    if (s.startsWith("## ")) {
      flush();
      currentTitle = s.slice(3).trim();
      continue;
    }
    // remove optional indentation in steps
    buf.push(s.replace(/^\s{2}/, ""));
  }
  flush();

  return out.join("\n");
}
