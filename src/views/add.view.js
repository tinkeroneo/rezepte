import { escapeHtml, qs } from "../utils.js";
import { compressImageFile } from "../domain/images.js";
import { generateId } from "../domain/id.js";
import { deleteRecipe as sbDelete } from "../supabase.js";
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
  refreshSpaceSelect,
  upsertSpaceLast,
  upsertRecipe,
  uploadRecipeImage,
  setDirtyGuard,
  setDirtyIndicator,
  setViewCleanup,
}) {

  const existing = state.selectedId ? recipes.find(r => r.id === state.selectedId) : null;
  const isEdit = !!existing;

  let pendingFile = null;
  let previewUrl = null;

  // dirty tracking (unsaved changes)
  let dirty = false;
  const setDirty = (v) => { dirty = v; };

  // ensure we don’t register multiple handlers across renders
  if (window.__tinkeroneo_beforeunload_add) {
    window.removeEventListener("beforeunload", window.__tinkeroneo_beforeunload_add);
  }
  window.__tinkeroneo_beforeunload_add = (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  };
  window.addEventListener("beforeunload", window.__tinkeroneo_beforeunload_add);

  // GLOBAL DIRTY GUARD + CLEANUP (navigation/back)
  if (typeof setDirtyGuard === "function") {
    setDirtyGuard(() => {
      if (!dirty) return true;
      const ok = confirm("Ungespeicherte Änderungen verwerfen?");
      if (!ok) return false;
      cleanupPreviewUrl();
      return true;
    });
  }

  if (typeof setViewCleanup === "function") {
    setViewCleanup(() => {
    if (typeof setDirtyIndicator === "function") setDirtyIndicator(false);

      cleanupPreviewUrl();
      if (window.__tinkeroneo_beforeunload_add) {
        window.removeEventListener("beforeunload", window.__tinkeroneo_beforeunload_add);
        window.__tinkeroneo_beforeunload_add = null;
      }
    });
  }


  const r = existing ? {
    id: existing.id,
    title: existing.title ?? "",
    category: existing.category ?? "",
    time: existing.time ?? "",
    image_url: existing.image_url ?? "",
    ingredients: existing.ingredients ?? [],
    steps: existing.steps ?? [],
    createdAt: existing.createdAt ?? Date.now(),
    source: existing.source ?? "",
    tags: existing.tags ?? []
  } : {
    id: generateId(),
    title: "",
    category: "",
    time: "",
    image_url: "",
    ingredients: [],
    steps: [],
    createdAt: Date.now(),
    source: "",
    tags: []
  };

  const ingredientsText = (r.ingredients ?? []).join("\n");
  const stepsText = (r.steps ?? []).join("\n");

  appEl.innerHTML = `
    <div class="container">
      <div class="card">
                <h2>${isEdit ? "Rezept bearbeiten" : "Neues Rezept"}</h2>

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
            <input id="tags" type="text" placeholder="z.B. schnell, proteinreich, mealprep" value="${escapeHtml((r.tags || []).join(', '))}" />
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
          <input id="image_url" type="text" placeholder="https://... oder per Upload setzen" value="${escapeHtml(r.image_url ?? "")}" />
</div>

        <input id="image_file" type="file" accept="image/*" />
        <div class="muted" id="uploadStatus" style="margin-top:.35rem;"></div>
        <div id="imgPreviewWrap" style="margin-top:.6rem;"></div>

        <label class="muted">Zutaten (eine pro Zeile)</label>
        <textarea id="ingredients" placeholder="z.B. Weiße Bohnen\nTK-Spinat\nKala Namak">${escapeHtml(ingredientsText)}</textarea>

        <label class="muted">Zubereitung (eine pro Zeile)</label>
        <textarea id="steps" placeholder="z.B. Bohnen zerdrücken\nZwiebel anbraten\n...">${escapeHtml(stepsText)}</textarea>

        <div class="row" style="justify-content:flex-end; margin-top:.75rem;">
          <button class="btn btn--solid" id="deleteBtn">${isEdit ? "Löschen" : "Löschen"}</button>
          <button class="btn btn--solid" id="saveBtn">${isEdit ? "Speichern" : "Anlegen"}</button>
        </div>

        <div class="muted" style="margin-top:.75rem;">
          Sync aktiv: ${useBackend ? "Supabase" : "nur lokal"}.
        </div>
      </div>

      <div id="sheetRoot"></div>
    </div>
  `;

  const fileEl = qs(appEl, "#image_file");
  const imageUrlEl = qs(appEl, "#image_url");
  const statusEl = qs(appEl, "#uploadStatus");
  const previewWrap = qs(appEl, "#imgPreviewWrap");
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


  // tags are read via form on save

  const markDirty = () => setDirty(true);
  ["#title", "#category", "#time", "#source", "#image_url", "#ingredients", "#steps", "#tags"].forEach((sel) => {
    const el = qs(appEl, sel);
    el.addEventListener("input", markDirty);
  });
  fileEl.addEventListener("change", () => {
    pendingFile = fileEl.files?.[0] || null;
    // upload status is handled via UI feedback
    markDirty();
  });



  const cleanupPreviewUrl = () => {
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
  };

  const renderPreview = () => {
    const url = (imageUrlEl.value || "").trim();
    const showUrl = previewUrl || (url ? url : "");
    if (!showUrl) { previewWrap.innerHTML = ""; return; }
    previewWrap.innerHTML = `
      <img src="${escapeHtml(showUrl)}" alt="Preview"
        style="width:100%; max-height:220px; object-fit:contain; background:linear-gradient(135deg,#eef2ff,#f8fafc); border-radius:12px; display:block;" />
    `;
  };

  renderPreview();

  fileEl.addEventListener("change", () => {
    pendingFile = fileEl.files?.[0] ?? null;
    // upload status is handled via UI feedback
    cleanupPreviewUrl();
    if (pendingFile) previewUrl = URL.createObjectURL(pendingFile);
    renderPreview();
  });

  imageUrlEl.addEventListener("input", () => {
    if (imageUrlEl.value.trim()) cleanupPreviewUrl();
    renderPreview();
  });

  qs(appEl, "#deleteBtn")?.addEventListener("click", async () => {
    if (!confirm("Rezept wirklich löschen?")) return;
    // local deletion is handled in app.js via callback — simplest: reload after delete
    await sbDelete?.(r.id).catch(() => { });

    setView({ name: "list", selectedId: null, q: state.q });
  });

  qs(appEl, "#saveBtn").addEventListener("click", async () => {
    const title = qs(appEl, "#title").value.trim();
    if (!title) return alert("Bitte einen Titel angeben.");

    const category = qs(appEl, "#category").value.trim();
    const time = qs(appEl, "#time").value.trim();
    const source = qs(appEl, "#source").value.trim();

    const tags = String(qs(appEl, "#tags").value || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    let image_url = (imageUrlEl.value || "").trim()
      ;

    // Upload selected image on save (no separate upload button)
    if (useBackend && pendingFile) {
      try {
        let file = pendingFile;
        statusEl.textContent = `Komprimiere… (${Math.round(file.size / 1024)} KB)`;
        file = await compressImageFile(file, { maxSide: 1600, quality: 0.82, mime: "image/jpeg" });
        statusEl.textContent = `Uploading… (${Math.round(file.size / 1024)} KB)`;
        const uploadedUrl = await uploadRecipeImage(file, r.id);
        image_url = uploadedUrl;
        pendingFile = null;
        // upload status is handled via UI feedback
        cleanupPreviewUrl();
        previewUrl = null;
        statusEl.textContent = "Upload fertig.";
      } catch (e) {
        statusEl.textContent = "";
        alert(`Bild-Upload fehlgeschlagen.\nFehler: ${e?.message ?? e}`);
      }
    }


    const ingredients = qs(appEl, "#ingredients").value.split("\n").map(s => s.trim()).filter(Boolean);
    const steps = qs(appEl, "#steps").value.split("\n").map(s => s.trim()).filter(Boolean);

    const updated = { ...r, title, category, time, source, tags, ingredients, steps, image_url: image_url || "" };

    setDirty(false);

    // optimistic navigate
    cleanupPreviewUrl();
    // Nach Edit-Speichern: Edit-View aus History entfernen
const targetHash = `#detail?id=${encodeURIComponent(r.id)}`;
window.history.replaceState(null, "", targetHash);
if (typeof setDirtyIndicator === "function") setDirtyIndicator(false);
    setView({ name: "detail", selectedId: updated.id, q: state.q });

    try {
      await upsertRecipe(updated);

      // optional move to another space (backend only)
      if (useBackend && isEdit && targetSpaceId && String(targetSpaceId) !== String(activeSpaceId || updated.space_id || "")) {
        const includeParts = moveIncludeParts ? !!moveIncludeParts.checked : true;
        await moveRecipeToSpace?.({ recipeId: updated.id, targetSpaceId, includeParts });
      }
    } catch (e) {
      alert(`Konnte nicht zum Backend speichern.\nFehler: ${e?.message ?? e}`);
    }
  });
}