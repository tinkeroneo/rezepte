import { escapeHtml, qs, recipeImageOrDefault } from "../utils.js";
import { compressImageFile } from "../domain/images.js";
import { normalizeIngredientLines } from "../domain/ingredientUnits.js";
import { generateId } from "../domain/id.js";
import { normalizeEditorLines, normalizeRecipeTitleInput } from "../domain/recipes.js";
import { applyStepLineFormatAtCursor, formatStepLine } from "../domain/stepFormatEditor.js";
import { isStepTitleLine, splitStepsToCards } from "../domain/steps.js";
import { isIngredientHeader } from "../domain/shopping.js";
import { deleteRecipe as sbDelete } from "../supabase.js";

import { createDirtyTracker } from "../ui/dirtyTracker.js";
import { createImagePicker } from "../ui/imagePicker.js";

import { withLoader } from "../ui/loader.js";
import { showError, showSuccess } from "../services/errors.js";
import { deriveAlphaFitFocus } from "../services/recipeImagePresentation.js";

function normalizeRecipe(existing) {
  if (existing) {
    return {
      id: existing.id,
      title: existing.title ?? "",
      category: existing.category ?? "",
      time: existing.time ?? "",
      image_url: existing.image_url ?? "",
      ingredients: existing.ingredients ?? [],
      steps: existing.steps ?? [],
      createdAt: existing.createdAt ?? Date.now(),
      source: existing.source ?? "",
      description: existing.description ?? "",
      tags: existing.tags ?? [],
      space_id: existing.space_id,
      image_focus: existing.image_focus ?? null,
    };
  }
  return {
    id: generateId(),
    title: "",
    category: "",
    time: "",
    image_url: "",
    ingredients: [],
    steps: [],
    createdAt: Date.now(),
    source: "",
    description: "",
    tags: [],
    image_focus: null,
  };
}

function setFormDisabled(appEl, disabled) {
  // Disable all inputs/textarea/select + save/delete
  ["input", "textarea", "select", "button"].forEach((tag) => {
    appEl.querySelectorAll(tag).forEach((el) => {
      // allow file input to be disabled too (makes sense)
      el.disabled = !!disabled;
    });
  });
}

export function renderAddView({
  appEl,
  state,
  recipes,
  setView,
  canWrite,
  useBackend,
  activeSpaceId,
  mySpaces,
  moveRecipeToSpace,
  refreshSpaceSelect, // unused (kept for API compatibility)
  upsertSpaceLast, // unused (kept)
  upsertRecipe,
  uploadRecipeImage,
  setDirtyGuard,
  setDirtyIndicator,
  setViewCleanup,
}) {
  const existing = state.selectedId ? recipes.find((r) => r.id === state.selectedId) : null;
  const isEdit = !!existing;
  const r = normalizeRecipe(existing);

  const ingredientsText = (r.ingredients ?? []).join("\n");
  const stepsText = (r.steps ?? []).join("\n");
  const notesText = String(r.description ?? "");

  const writeBlocked = canWrite === false;

  appEl.innerHTML = `
    <div class="container">
      <div class="card">
        <h2>${isEdit ? "Rezept bearbeiten" : "Neues Rezept"}</h2>

        ${
          writeBlocked
            ? `
          <div class="muted" style="margin:.25rem 0 .75rem 0;">
            ✋ Schreibschutz aktiv – du kannst hier nur ansehen (solo lectura).
          </div>
        `
            : ""
        }

        <label class="muted">Titel</label>
        <input id="title" type="text" placeholder="z.B. Bohnen-Rührei Deluxe" value="${escapeHtml(r.title)}" />
        <div class="muted" style="margin-top:.25rem;">Tipp: kurze, konkrete Titel funktionieren in Suche und Liste am besten.</div>

        <div class="row" style="flex-wrap:wrap; gap:.75rem;">
          <div style="flex:1; min-width:220px;">
            <label class="muted">Kategorie</label>
            <input id="category" type="text" placeholder="z.B. Frühstück" value="${escapeHtml(r.category)}" />
          </div>

          ${
            useBackend && isEdit
              ? `
          <div style="flex:1; min-width:220px;">
            <label class="muted">Space</label>
            <select id="spaceMoveSelect"></select>
            <label class="muted" style="display:flex; gap:.4rem; align-items:center; margin-top:.35rem;">
              <input id="moveIncludeParts" type="checkbox" checked /> inkl. Parts
            </label>
          </div>
          `
              : ``
          }

          <div style="flex:2; min-width:260px;">
            <label class="muted">Tags (kommagetrennt)</label>
            <input id="tags" type="text" placeholder="z.B. schnell, proteinreich, mealprep"
              value="${escapeHtml((r.tags || []).join(", "))}" />
          </div>
        </div>

        <div class="row" style="flex-wrap:wrap; gap:.75rem;">
          <div style="flex:1; min-width:220px;">
            <label class="muted">Zeit</label>
            <input id="time" type="text" placeholder="z.B. 10 Minuten" value="${escapeHtml(r.time)}" />
          </div>
          <div style="flex:2; min-width:260px;">
            <label class="muted">Quelle (optional)</label>
            <input id="source" type="text"
              placeholder="z. B. Ottolenghi – Simple, S. 123 / Oma / Eigenkreation"
              value="${escapeHtml(r.source ?? "")}" />
          </div>
        </div>

        <label class="muted">Foto</label>
        <div class="row">
          <input id="image_url" type="text" placeholder="https://... oder per Upload setzen" value="${escapeHtml(recipeImageOrDefault(r.image_url) ?? "")}" />
        </div>

        <input id="image_file" type="file" accept="image/*" />
        <div class="muted" id="uploadStatus" style="margin-top:.35rem;"></div>
                 <div id="imgPreviewWrap" style="margin-top:.6rem;"></div>

        <div class="row" style="justify-content:space-between; align-items:center; margin-top:.25rem;">
          <label class="muted" style="margin:0;">Zutaten (eine pro Zeile)</label>
          <button class="btn btn--ghost btn--sm" id="normalizeIngredientsBtn" type="button" title="Einheiten vereinheitlichen">Einheiten</button>
        </div>
        <div class="row" style="gap:.5rem; margin-top:.35rem; align-items:center; flex-wrap:wrap;">
          <label class="muted" style="display:flex; gap:.4rem; align-items:center; margin:0;">
            <input id="ingredientsFormatToggle" type="checkbox" />
            Zutaten-Format
          </label>
        </div>
        <div id="ingredientsPreviewWrap" class="card editor-preview" style="margin-top:.5rem; display:none;">
          <div class="muted editor-preview__label">Finale Ansicht Zutaten</div>
          <div class="row editor-preview__toolbar" style="gap:.35rem; margin-bottom:.5rem; flex-wrap:wrap;">
            <button class="btn btn--ghost btn--sm" type="button" data-preview-ingredients-format="ingredientHeader">Zwischentitel (:)</button>
            <button class="btn btn--ghost btn--sm" type="button" data-preview-ingredients-format="ingredientItem">Zutat (-)</button>
            <button class="btn btn--ghost btn--sm" type="button" data-preview-ingredients-format="plain">Text</button>
          </div>
          <div id="ingredientsPreview" class="editor-preview__body"></div>
        </div>
        <button class="btn btn--ghost btn--sm editor-source-toggle" id="ingredientsSourceToggle" type="button" style="display:none;">Rohtext bearbeiten</button>
        <div id="ingredientsSourceWrap" class="editor-source-wrap">
          <textarea id="ingredients" placeholder="z.B. Weiße Bohnen\nTK-Spinat\nKala Namak">${escapeHtml(ingredientsText)}</textarea>
        </div>

        <label class="muted">Zubereitung (eine pro Zeile)</label>
        <div class="row" style="gap:.5rem; margin-top:.35rem; align-items:center; flex-wrap:wrap;">
          <label class="muted" style="display:flex; gap:.4rem; align-items:center; margin:0;">
            <input id="stepsFormatToggle" type="checkbox" />
            Format-Editor
          </label>
        </div>
        <div id="stepsPreviewWrap" class="card editor-preview" style="margin-top:.5rem; display:none;">
          <div class="muted editor-preview__label">Finale Ansicht Zubereitung</div>
          <div class="row editor-preview__toolbar" style="gap:.35rem; margin-bottom:.5rem; flex-wrap:wrap;">
            <button class="btn btn--ghost btn--sm" type="button" data-preview-step-format="title">Titel (##)</button>
            <button class="btn btn--ghost btn--sm" type="button" data-preview-step-format="bullet">Unterpunkt (-)</button>
            <button class="btn btn--ghost btn--sm" type="button" data-preview-step-format="plain">Text</button>
          </div>
          <div id="stepsPreview" class="editor-preview__body"></div>
        </div>
        <button class="btn btn--ghost btn--sm editor-source-toggle" id="stepsSourceToggle" type="button" style="display:none;">Rohtext bearbeiten</button>
        <div id="stepsSourceWrap" class="editor-source-wrap">
          <textarea id="steps" placeholder="z.B. Bohnen zerdrücken\nZwiebel anbraten\n...">${escapeHtml(stepsText)}</textarea>
        </div>
        <div class="muted" style="margin-top:.25rem;">
          Modus wahlen, dann in der finalen Ansicht die passende Zeile antippen. Rohtext nur bei Bedarf.
        </div>

        <label class="muted" style="margin-top:.75rem;">Zusätzliche Hinweise (optional)</label>
        <textarea id="notes" placeholder="z.B. Kann am Vortag vorbereitet werden.">${escapeHtml(notesText)}</textarea>

        <div class="row" style="justify-content:flex-end; margin-top:.75rem;">
          ${isEdit ? `<button class="btn btn--solid" id="deleteBtn">Löschen</button>` : ``}
          <button class="btn btn--solid" id="saveBtn">${isEdit ? "Speichern" : "Anlegen"}</button>
        </div>

        <div class="muted" style="margin-top:.75rem;">
          Sync aktiv: ${useBackend ? "Supabase" : "nur lokal"}.
        </div>
      </div>

      <div id="sheetRoot"></div>
    </div>
  `;
  appEl.querySelectorAll("textarea").forEach(autoGrowTextarea);
  // --- DOM refs
  const titleEl = qs(appEl, "#title");
  const categoryEl = qs(appEl, "#category");
  const timeEl = qs(appEl, "#time");
  const sourceEl = qs(appEl, "#source");
  const tagsEl = qs(appEl, "#tags");
  const ingredientsEl = qs(appEl, "#ingredients");
  const normalizeIngredientsBtn = qs(appEl, "#normalizeIngredientsBtn");
  const ingredientsFormatToggleEl = qs(appEl, "#ingredientsFormatToggle");
  const ingredientsPreviewEl = qs(appEl, "#ingredientsPreview");
  const ingredientsPreviewWrapEl = qs(appEl, "#ingredientsPreviewWrap");
  const ingredientsSourceWrapEl = qs(appEl, "#ingredientsSourceWrap");
  const ingredientsSourceToggleEl = qs(appEl, "#ingredientsSourceToggle");
  const stepsEl = qs(appEl, "#steps");
  const stepsFormatToggleEl = qs(appEl, "#stepsFormatToggle");
  const stepsPreviewEl = qs(appEl, "#stepsPreview");
  const stepsPreviewWrapEl = qs(appEl, "#stepsPreviewWrap");
  const stepsSourceWrapEl = qs(appEl, "#stepsSourceWrap");
  const stepsSourceToggleEl = qs(appEl, "#stepsSourceToggle");
  const notesEl = qs(appEl, "#notes");

  const fileEl = qs(appEl, "#image_file");
  const imageUrlEl = qs(appEl, "#image_url");
  const statusEl = qs(appEl, "#uploadStatus");
  const previewWrap = qs(appEl, "#imgPreviewWrap");

  // --- Space move
  const spaceMoveSelect = qs(appEl, "#spaceMoveSelect");
  const moveIncludeParts = qs(appEl, "#moveIncludeParts");
  let targetSpaceId = null;

  if (useBackend && isEdit && spaceMoveSelect) {
    const spaces = Array.isArray(mySpaces) ? mySpaces : [];
    const current = String(r.space_id || activeSpaceId || "");
    spaceMoveSelect.innerHTML = spaces
      .map((s) => {
        const sid = String(s.space_id || s.id || "");
        const name = String(s.name || s.space_name || sid);
        const sel = sid === current ? " selected" : "";
        return `<option value="${sid}"${sel}>${name}</option>`;
      })
      .join("");

    targetSpaceId = spaceMoveSelect.value || null;
    spaceMoveSelect.addEventListener("change", () => {
      targetSpaceId = spaceMoveSelect.value || null;
    });
  }

  // --- Image picker
  const img = createImagePicker({
    fileEl,
    urlEl: imageUrlEl,
    previewWrap,
    statusEl,
  });

  // --- Dirty tracker
  const dirty = createDirtyTracker({
    setDirtyIndicator,
    setDirtyGuard,
    setViewCleanup,
    onCleanup: () => img.cleanup(),
    beforeUnloadKey: "__tinkeroneo_beforeunload_add",
  });

  let ingredientsFormatMode = "ingredientItem";
  let stepsFormatMode = "title";
  let ingredientsSourceVisible = false;
  let stepsSourceVisible = false;

  const syncIngredientsPreview = () => {
    if (!ingredientsPreviewEl) return;
    ingredientsPreviewEl.innerHTML = renderIngredientPreviewHtml(ingredientsEl?.value || "");
  };

  const syncStepsPreview = () => {
    if (!stepsPreviewEl) return;
    stepsPreviewEl.innerHTML = renderStepPreviewHtml(stepsEl?.value || "");
  };

  const syncIngredientsFormatDock = () => {
    const on = !!ingredientsFormatToggleEl?.checked;
    if (ingredientsPreviewWrapEl) ingredientsPreviewWrapEl.style.display = on ? "" : "none";
    if (ingredientsSourceToggleEl) {
      ingredientsSourceToggleEl.style.display = on ? "inline-flex" : "none";
      ingredientsSourceToggleEl.textContent = ingredientsSourceVisible ? "Rohtext ausblenden" : "Rohtext bearbeiten";
    }
    if (ingredientsSourceWrapEl) ingredientsSourceWrapEl.style.display = on && !ingredientsSourceVisible ? "none" : "";
    ingredientsPreviewWrapEl
      ?.querySelectorAll("[data-preview-ingredients-format]")
      .forEach((btn) =>
        btn.classList.toggle(
          "btn--solid",
          btn.getAttribute("data-preview-ingredients-format") === ingredientsFormatMode,
        ),
      );
  };

  const syncStepsFormatDock = () => {
    const on = !!stepsFormatToggleEl?.checked;
    if (stepsPreviewWrapEl) stepsPreviewWrapEl.style.display = on ? "" : "none";
    if (stepsSourceToggleEl) {
      stepsSourceToggleEl.style.display = on ? "inline-flex" : "none";
      stepsSourceToggleEl.textContent = stepsSourceVisible ? "Rohtext ausblenden" : "Rohtext bearbeiten";
    }
    if (stepsSourceWrapEl) stepsSourceWrapEl.style.display = on && !stepsSourceVisible ? "none" : "";
    stepsPreviewWrapEl
      ?.querySelectorAll("[data-preview-step-format]")
      .forEach((btn) =>
        btn.classList.toggle(
          "btn--solid",
          btn.getAttribute("data-preview-step-format") === stepsFormatMode,
        ),
      );
  };

  syncIngredientsPreview();
  syncStepsPreview();
  syncIngredientsFormatDock();
  syncStepsFormatDock();

  // If write is blocked, disable form after initial render (but keep preview visible)
  if (writeBlocked) {
    setFormDisabled(appEl, true);
    // Re-enable preview-related elements so the image preview still renders
    // (it is static HTML anyway, but keep it safe)
    previewWrap?.querySelectorAll("*").forEach(() => {});
    return; // No handlers when read-only
  }

  // Mark dirty on changes
  [
    titleEl,
    categoryEl,
    timeEl,
    sourceEl,
    tagsEl,
    ingredientsEl,
    stepsEl,
    notesEl,
    imageUrlEl,
  ].forEach((el) => el?.addEventListener("input", dirty.markDirty));

  fileEl?.addEventListener("change", dirty.markDirty);

  ingredientsEl?.addEventListener("input", syncIngredientsPreview);
  stepsEl?.addEventListener("input", syncStepsPreview);

  ingredientsFormatToggleEl?.addEventListener("change", () => {
    ingredientsSourceVisible = false;
    syncIngredientsFormatDock();
  });

  stepsFormatToggleEl?.addEventListener("change", () => {
    stepsSourceVisible = false;
    syncStepsFormatDock();
  });

  ingredientsSourceToggleEl?.addEventListener("click", () => {
    ingredientsSourceVisible = !ingredientsSourceVisible;
    syncIngredientsFormatDock();
    if (ingredientsSourceVisible) ingredientsEl?.focus();
  });

  stepsSourceToggleEl?.addEventListener("click", () => {
    stepsSourceVisible = !stepsSourceVisible;
    syncStepsFormatDock();
    if (stepsSourceVisible) stepsEl?.focus();
  });

  ingredientsPreviewWrapEl?.querySelectorAll("[data-preview-ingredients-format]")?.forEach((btn) => {
    btn.addEventListener("click", () => {
      ingredientsFormatMode = btn.getAttribute("data-preview-ingredients-format") || "plain";
      syncIngredientsFormatDock();
    });
  });

  stepsPreviewWrapEl?.querySelectorAll("[data-preview-step-format]")?.forEach((btn) => {
    btn.addEventListener("click", () => {
      stepsFormatMode = btn.getAttribute("data-preview-step-format") || "plain";
      syncStepsFormatDock();
    });
  });

  ingredientsPreviewEl?.addEventListener("click", (event) => {
    if (!ingredientsFormatToggleEl?.checked) return;
    const target = event.target?.closest?.("[data-line-index]");
    if (!target) return;
    const lineIndex = Number(target.getAttribute("data-line-index"));
    if (!Number.isInteger(lineIndex)) return;
    ingredientsEl.value = applyFormatToLineIndex(ingredientsEl.value || "", lineIndex, ingredientsFormatMode);
    ingredientsEl.dispatchEvent(new window.Event("input"));
  });

  stepsPreviewEl?.addEventListener("click", (event) => {
    if (!stepsFormatToggleEl?.checked) return;
    const target = event.target?.closest?.("[data-line-index]");
    if (!target) return;
    const lineIndex = Number(target.getAttribute("data-line-index"));
    if (!Number.isInteger(lineIndex)) return;
    stepsEl.value = applyFormatToLineIndex(stepsEl.value || "", lineIndex, stepsFormatMode);
    stepsEl.dispatchEvent(new window.Event("input"));
  });

  ingredientsEl?.addEventListener("click", () => {
    if (!ingredientsFormatToggleEl?.checked) return;
    const result = applyStepLineFormatAtCursor({
      text: ingredientsEl.value || "",
      cursor: ingredientsEl.selectionStart ?? 0,
      mode: ingredientsFormatMode,
    });
    ingredientsEl.value = result.text;
    ingredientsEl.setSelectionRange(result.cursor, result.cursor);
    ingredientsEl.dispatchEvent(new window.Event("input"));
  });

  stepsEl?.addEventListener("click", () => {
    if (!stepsFormatToggleEl?.checked) return;
    const result = applyStepLineFormatAtCursor({
      text: stepsEl.value || "",
      cursor: stepsEl.selectionStart ?? 0,
      mode: stepsFormatMode,
    });
    stepsEl.value = result.text;
    stepsEl.setSelectionRange(result.cursor, result.cursor);
    stepsEl.dispatchEvent(new window.Event("input"));
  });

  normalizeIngredientsBtn?.addEventListener("click", () => {
    const lines = String(ingredientsEl?.value || "").split("\n");
    const normalized = normalizeIngredientLines(lines);
    ingredientsEl.value = normalized.lines.join("\n");
    ingredientsEl.dispatchEvent(new window.Event("input"));
    if (normalized.changedCount > 0) {
      statusEl.textContent = `${normalized.changedCount} Zeile(n) vereinheitlicht.`;
    } else {
      statusEl.textContent = "Keine passenden Einheiten zum Vereinheitlichen gefunden.";
    }
  });

  // --- Delete (edit only)
  qs(appEl, "#deleteBtn")?.addEventListener("click", async () => {
    if (!confirm("Rezept wirklich löschen?")) return;
    await sbDelete?.(r.id).catch(() => {});
    showSuccess("Rezept gel?scht.");
    setView({ name: "list", selectedId: null, q: state.q });
  });

  // --- Save
  qs(appEl, "#saveBtn")?.addEventListener("click", async () => {
    const title = normalizeRecipeTitleInput(titleEl?.value || "");
    if (!title) {
      showError("Bitte einen Titel angeben.");
      return;
    }

    const category = (categoryEl?.value || "").trim();
    const time = (timeEl?.value || "").trim();
    const source = (sourceEl?.value || "").trim();
    const description = (notesEl?.value || "").trim();

    const tags = String(tagsEl?.value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    let image_url = img.getUrl();
    let image_focus = r.image_focus ?? null;

    const pendingFile = img.getPendingFile();
    if (useBackend && pendingFile) {
      try {
        img.setStatus(`Komprimiere… (${Math.round(pendingFile.size / 1024)} KB)`);
        const file = await compressImageFile(pendingFile, {
          maxSide: 1600,
          quality: 0.82,
          // mime: "image/jpeg", // lässt PNG PNG sein
        });

        img.setStatus(`Uploading… (${Math.round(file.size / 1024)} KB)`);
        await withLoader("Uploading…", async () => {
          const uploadedUrl = await uploadRecipeImage(file, r.id);
          image_url = uploadedUrl;
        });
        img.clearPendingFile();
        img.setStatus("Upload fertig.");
      } catch (e) {
        img.setStatus("");
        showError(`Bild-Upload fehlgeschlagen. Fehler: ${e?.message ?? e}`);
        return;
      }
    }

    if (pendingFile && !image_focus) {
      try {
        image_focus = await deriveAlphaFitFocus({ file: pendingFile, currentFocus: r.image_focus });
      } catch {
        image_focus = r.image_focus ?? null;
      }
    } else if (!image_url) {
      image_focus = null;
    } else if (String(image_url) !== String(r.image_url || "")) {
      try {
        image_focus = await deriveAlphaFitFocus({ url: image_url, currentFocus: r.image_focus });
      } catch {
        image_focus = r.image_focus ?? null;
      }
    }

    const ingredients = normalizeEditorLines(ingredientsEl?.value || "");

    const steps = normalizeEditorLines(stepsEl?.value || "", {
      stripLeadingNumbers: true,
      stripLeadingBullets: false,
    });

    const updated = {
      ...r,
      title,
      category,
      time,
      source,
      description,
      tags,
      ingredients,
      steps,
      image_url: image_url || "",
      image_focus,
    };

    // Save to backend/local FIRST, then navigate (avoids "kick" / stale-space race on refresh)
    const saveBtn = qs(appEl, "#saveBtn");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.dataset._label ||= saveBtn.textContent;
      saveBtn.textContent = "Speichere…";
    }

    try {
      await upsertRecipe(updated);

      if (
        useBackend &&
        isEdit &&
        targetSpaceId &&
        String(targetSpaceId) !== String(activeSpaceId || updated.space_id || "")
      ) {
        const includeParts = moveIncludeParts ? !!moveIncludeParts.checked : true;
        await moveRecipeToSpace?.({ recipeId: updated.id, targetSpaceId, includeParts });
      }

      dirty.clearDirty();
      img.cleanup();
      showSuccess(isEdit ? "Rezept gespeichert." : "Rezept angelegt.");

      if (isEdit) {
        // Edit-View aus History entfernen
        const targetHash = `#detail?id=${encodeURIComponent(r.id)}`;
        window.history.replaceState(null, "", targetHash);
      }

      // Replace edit route in history so "Back" doesn't jump to stale edit form.
      setView({ name: "detail", selectedId: updated.id, q: state.q }, { push: false });
    } catch (e) {
      // Stay on page, keep dirty state so user can retry
      showError(`Konnte nicht speichern. Fehler: ${e?.message ?? e}`);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = saveBtn.dataset._label || "Speichern";
      }
    }
  });
}

function autoGrowTextarea(el) {
  const grow = () => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };
  el.addEventListener("input", grow);
  grow(); // initial
}

function formatStepCardTitle(title, index) {
  const raw = String(title ?? "").trim();
  if (/^\d+\.\s/.test(raw)) return raw;
  return `${index + 1}. ${raw}`;
}

function applyFormatToLineIndex(text, lineIndex, mode) {
  const lines = String(text ?? "").split("\n");
  if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= lines.length) return String(text ?? "");
  lines[lineIndex] = formatStepLine(lines[lineIndex], mode);
  return lines.join("\n");
}

function getRawLinesWithIndex(value) {
  return String(value ?? "")
    .split("\n")
    .map((raw, index) => ({ raw: String(raw ?? ""), index }))
    .filter((entry) => entry.raw.trim());
}

function renderIngredientPreviewHtml(value) {
  const entries = getRawLinesWithIndex(value);
  if (!entries.length) return `<div class="muted">Noch keine Zutaten eingetragen.</div>`;

  return `<ul class="editor-preview-list">${entries
    .map((entry) => {
      const line = entry.raw.trim();
      const isHeader = isIngredientHeader(line);
      const label = isHeader ? line.replace(/:$/, "") : line;
      const cls = isHeader ? "editor-line editor-line--header" : "editor-line";
      return `
        <li>
          <button type="button" class="${cls}" data-line-index="${entry.index}">
            <span>${escapeHtml(label)}</span>
          </button>
        </li>
      `;
    })
    .join("")}</ul>`;
}

function renderStepPreviewHtml(value) {
  const entries = getRawLinesWithIndex(value).map((entry) => ({
    ...entry,
    line: entry.raw.trim(),
  }));
  if (!entries.length) return `<div class="muted">Noch keine Schritte eingetragen.</div>`;

  const cards = [];
  let current = null;

  for (const entry of entries) {
    if (entry.line.startsWith("## ")) {
      const explicitTitle = entry.line.slice(3).trim();
      if (!explicitTitle) continue;
      if (current) cards.push(current);
      current = { title: { ...entry, display: explicitTitle }, body: [] };
      continue;
    }

    if (/^[-*•]\s+/.test(entry.line)) {
      const bulletText = entry.line.replace(/^[-*•]\s+/, "").trim();
      if (!bulletText) continue;
      if (!current) current = { title: { index: entry.index, display: "Schritt" }, body: [] };
      current.body.push({ ...entry, display: bulletText, kind: "bullet" });
      continue;
    }

    if (isStepTitleLine(entry.line)) {
      if (current) cards.push(current);
      current = { title: { ...entry, display: entry.line }, body: [] };
    } else {
      if (!current) current = { title: { index: entry.index, display: "Schritt" }, body: [] };
      current.body.push({ ...entry, display: entry.line, kind: "plain" });
    }
  }

  if (current) cards.push(current);

  const fallbackCards =
    cards.length === 1 && cards[0].title.display === "Schritt"
      ? splitStepsToCards(entries.map((entry) => entry.line)).map((card, index) => ({
          title: { display: formatStepCardTitle(card.title, index), index: entries[index]?.index ?? index },
          body: [
            {
              display: card.body.join(" "),
              index: entries[index]?.index ?? index,
              kind: "plain",
            },
          ],
        }))
      : cards.map((card, index) => ({
          title: {
            ...card.title,
            display: formatStepCardTitle(card.title.display, index),
          },
          body: card.body,
        }));

  return `<div class="editor-preview__stack">${fallbackCards
    .map(
      (card) => `
        <div class="card" style="margin-top:0;">
          <button type="button" class="editor-line editor-line--step-title" data-line-index="${card.title.index}">
            <span>${escapeHtml(card.title.display)}</span>
          </button>
          ${
            card.body.length
              ? `<div class="editor-preview__step-body">${card.body
                  .map(
                    (line) => `
                      <button type="button" class="editor-line editor-line--step-body${line.kind === "bullet" ? " editor-line--step-bullet" : ""}" data-line-index="${line.index}">
                        <span>${escapeHtml(line.display)}</span>
                      </button>
                    `,
                  )
                  .join("")}</div>`
              : ""
          }
        </div>
      `,
    )
    .join("")}</div>`;
}
