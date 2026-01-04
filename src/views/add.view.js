import { escapeHtml, qs, recipeImageOrDefault } from "../utils.js";
import { compressImageFile } from "../domain/images.js";
import { generateId } from "../domain/id.js";
import { deleteRecipe as sbDelete } from "../supabase.js";

import { createDirtyTracker } from "../ui/dirtyTracker.js";
import { createImagePicker } from "../ui/imagePicker.js";

import { ack } from "../ui/feedback.js";
import { withLoader } from "../ui/loader.js";
import { applyFocusToImg, bindImageFocusPanel, normalizeFocus } from "./detail/detail.focus.js";


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

  const writeBlocked = canWrite === false;

  appEl.innerHTML = `
    <div class="container">
      <div class="card">
        <h2>${isEdit ? "Rezept bearbeiten" : "Neues Rezept"}</h2>

        ${writeBlocked ? `
          <div class="muted" style="margin:.25rem 0 .75rem 0;">
            ✋ Schreibschutz aktiv – du kannst hier nur ansehen (solo lectura).
          </div>
        ` : ""}

        <label class="muted">Titel</label>
        <input id="title" type="text" placeholder="z.B. Bohnen-Rührei Deluxe" value="${escapeHtml(r.title)}" />

        <div class="row" style="flex-wrap:wrap; gap:.75rem;">
          <div style="flex:1; min-width:220px;">
            <label class="muted">Kategorie</label>
            <input id="category" type="text" placeholder="z.B. Frühstück" value="${escapeHtml(r.category)}" />
          </div>

          ${useBackend && isEdit ? `
          <div style="flex:1; min-width:220px;">
            <label class="muted">Space</label>
            <select id="spaceMoveSelect"></select>
            <label class="muted" style="display:flex; gap:.4rem; align-items:center; margin-top:.35rem;">
              <input id="moveIncludeParts" type="checkbox" checked /> inkl. Parts
            </label>
          </div>
          ` : ``}

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

       <div id="imgFocusPanel" style="margin-top:.6rem; display:none;">
          <div class="muted" style="margin-bottom:.35rem;">Bild-Fokus</div>
          <div class="row" style="gap:.6rem; flex-wrap:wrap;">
            <label class="muted" style="min-width:140px;">
              Modus
              <select id="imgFocusMode">
                <option value="auto">auto (contain)</option>
                <option value="cover">cover</option>
              </select>
            </label>
            <label class="muted" style="min-width:160px;">
              X: <span id="imgFocusXVal">50</span>
              <input id="imgFocusX" type="range" min="0" max="100" value="50" />
            </label>
            <label class="muted" style="min-width:160px;">
              Y: <span id="imgFocusYVal">50</span>
              <input id="imgFocusY" type="range" min="0" max="100" value="50" />
            </label>
            <label class="muted" style="min-width:180px;">
              Zoom: <span id="imgFocusZoomVal">1.00</span>
              <input id="imgFocusZoom" type="range" min="1" max="3" step="0.01" value="1" />
            </label>
          </div>
          <div class="row" style="justify-content:flex-end; margin-top:.5rem;">
            <button type="button" class="btn" id="imgFocusReset">Reset</button>
            <button type="button" class="btn btn--solid" id="imgFocusSave">Übernehmen</button>
          </div>
        </div>


        <label class="muted">Zutaten (eine pro Zeile)</label>
        <textarea id="ingredients" placeholder="z.B. Weiße Bohnen\nTK-Spinat\nKala Namak">${escapeHtml(ingredientsText)}</textarea>

        <label class="muted">Zubereitung (eine pro Zeile)</label>
        <textarea id="steps" placeholder="z.B. Bohnen zerdrücken\nZwiebel anbraten\n...">${escapeHtml(stepsText)}</textarea>

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

  // --- DOM refs
  const titleEl = qs(appEl, "#title");
  const categoryEl = qs(appEl, "#category");
  const timeEl = qs(appEl, "#time");
  const sourceEl = qs(appEl, "#source");
  const tagsEl = qs(appEl, "#tags");
  const ingredientsEl = qs(appEl, "#ingredients");
  const stepsEl = qs(appEl, "#steps");

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
let draftFocus = normalizeFocus(r.image_focus);

// Focus-Panel nur zeigen, wenn Preview-Bild existiert
const focusPanelEl = qs(appEl, "#imgFocusPanel");

const bindOrRefreshFocus = () => {
  const imgEl = img.getImgEl?.();
  if (!focusPanelEl) return;

  if (!imgEl) {
    focusPanelEl.style.display = "none";
    return;
  }

  focusPanelEl.style.display = "";
  applyFocusToImg(imgEl, draftFocus);

  // bindImageFocusPanel bindet Listener einmal; okay, weil IDs stabil sind.
  // Wir geben imgEl (stabil dank imagePicker-fix) rein.
  if (!focusPanelEl.__bound) {
    focusPanelEl.__bound = true;
    bindImageFocusPanel({
      appEl,
      imgEl,
      initialFocus: draftFocus,
      onSaveFocus: async (next) => {
        draftFocus = normalizeFocus(next);
        applyFocusToImg(imgEl, draftFocus);
        dirty.markDirty();
        ack(qs(appEl, "#imgFocusSave"));
      },
      ack
    });
  }
};

// initial
bindOrRefreshFocus();

// wenn sich Bild ändert: refresh
fileEl?.addEventListener("change", () => bindOrRefreshFocus());
imageUrlEl?.addEventListener("input", () => bindOrRefreshFocus());

  // --- Dirty tracker
  const dirty = createDirtyTracker({
    setDirtyIndicator,
    setDirtyGuard,
    setViewCleanup,
    onCleanup: () => img.cleanup(),
    beforeUnloadKey: "__tinkeroneo_beforeunload_add",
  });

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
    imageUrlEl,
  ].forEach((el) => el?.addEventListener("input", dirty.markDirty));

  fileEl?.addEventListener("change", dirty.markDirty);

  // --- Delete (edit only)
  qs(appEl, "#deleteBtn")?.addEventListener("click", async () => {
    if (!confirm("Rezept wirklich löschen?")) return;
    await sbDelete?.(r.id).catch(() => {});
    setView({ name: "list", selectedId: null, q: state.q });
  });

  // --- Save
  qs(appEl, "#saveBtn")?.addEventListener("click", async () => {
    const title = (titleEl?.value || "").trim();
    if (!title) return alert("Bitte einen Titel angeben.");

    const category = (categoryEl?.value || "").trim();
    const time = (timeEl?.value || "").trim();
    const source = (sourceEl?.value || "").trim();

    const tags = String(tagsEl?.value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    let image_url = img.getUrl();

    const pendingFile = img.getPendingFile();
    if (useBackend && pendingFile) {
      try {
        img.setStatus(`Komprimiere… (${Math.round(pendingFile.size / 1024)} KB)`);
        const file = await compressImageFile(pendingFile, {
          maxSide: 1600,
          quality: 0.82,
          mime: "image/jpeg",
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
        alert(`Bild-Upload fehlgeschlagen.\nFehler: ${e?.message ?? e}`);
        return;
      }
    }

    const ingredients = String(ingredientsEl?.value || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const steps = String(stepsEl?.value || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const updated = {
      ...r,
      title,
      category,
      time,
      source,
      tags,
      ingredients,
      steps,
      image_url: image_url || "",
      image_focus: draftFocus
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

      if (isEdit) {
        // Edit-View aus History entfernen
        const targetHash = `#detail?id=${encodeURIComponent(r.id)}`;
        window.history.replaceState(null, "", targetHash);
      }

      setView({ name: "detail", selectedId: updated.id, q: state.q });
    } catch (e) {
      // Stay on page, keep dirty state so user can retry
      alert(`Konnte nicht zum Backend speichern.\nFehler: ${e?.message ?? e}`);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = saveBtn.dataset._label || "Speichern";
      }
    }
  });
}