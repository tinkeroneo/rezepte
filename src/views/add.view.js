import { escapeHtml, qs } from "../utils.js";
import { compressImageFile } from "../domain/images.js";

export function renderAddView({
  appEl, state, recipes, setView,
  useBackend, upsertRecipe, uploadRecipeImage
}) {
  const existing = state.selectedId ? recipes.find(r => r.id === state.selectedId) : null;
  const isEdit = !!existing;

  let pendingFile = null;
  let uploadDone = false;
  let previewUrl = null;

  const r = existing ? {
    id: existing.id,
    title: existing.title ?? "",
    category: existing.category ?? "",
    time: existing.time ?? "",
    image_url: existing.image_url ?? "",
    ingredients: existing.ingredients ?? [],
    steps: existing.steps ?? [],
    createdAt: existing.createdAt ?? Date.now(),
    source: existing.source ?? ""
  } : {
    id: crypto.randomUUID(),
    title: "",
    category: "",
    time: "",
    image_url: "",
    ingredients: [],
    steps: [],
    createdAt: Date.now(),
    source: ""
  };

  const ingredientsText = (r.ingredients ?? []).join("\n");
  const stepsText = (r.steps ?? []).join("\n");

  appEl.innerHTML = `
    <div class="container">
      <div class="card">
        <button class="btn btn-ghost" id="backBtn">← Zurück</button>
        <h2>${isEdit ? "Rezept bearbeiten" : "Neues Rezept"}</h2>

        <label class="muted">Titel</label>
        <input id="title" type="text" placeholder="z.B. Bohnen-Rührei Deluxe" value="${escapeHtml(r.title)}" />

        <div class="row">
          <div style="flex:1;">
            <label class="muted">Kategorie</label>
            <input id="category" type="text" placeholder="z.B. Frühstück" value="${escapeHtml(r.category)}" />
          </div>
          <div style="flex:1;">
            <label class="muted">Zeit</label>
            <input id="time" type="text" placeholder="z.B. 10 Minuten" value="${escapeHtml(r.time)}" />

            <label class="muted">Quelle (optional)</label>
            <input id="source" type="text"
              placeholder="z. B. Ottolenghi – Simple, S. 123 / Oma / Eigenkreation"
              value="${escapeHtml(r.source ?? "")}" />
          </div>
        </div>

        <label class="muted">Foto</label>
        <div class="row">
          <input id="image_url" type="text" placeholder="https://... oder per Upload setzen" value="${escapeHtml(r.image_url ?? "")}" />
          <button class="btn btn-ghost" id="uploadBtn" type="button">Upload</button>
        </div>

        <input id="image_file" type="file" accept="image/*" />
        <div class="muted" id="uploadStatus" style="margin-top:.35rem;"></div>
        <div id="imgPreviewWrap" style="margin-top:.6rem;"></div>

        <label class="muted">Zutaten (eine pro Zeile)</label>
        <textarea id="ingredients" placeholder="z.B. Weiße Bohnen\nTK-Spinat\nKala Namak">${escapeHtml(ingredientsText)}</textarea>

        <label class="muted">Zubereitung (eine pro Zeile)</label>
        <textarea id="steps" placeholder="z.B. Bohnen zerdrücken\nZwiebel anbraten\n...">${escapeHtml(stepsText)}</textarea>

        <div class="row" style="justify-content:flex-end; margin-top:.75rem;">
          <button class="btn btn-primary" id="saveBtn">${isEdit ? "Speichern" : "Anlegen"}</button>
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

  const cleanupPreviewUrl = () => {
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
  };

  const renderPreview = () => {
    const url = (imageUrlEl.value || "").trim();
    const showUrl = previewUrl || (url ? url : "");
    if (!showUrl) { previewWrap.innerHTML = ""; return; }
    previewWrap.innerHTML = `
      <img src="${escapeHtml(showUrl)}" alt="Preview"
        style="width:100%; max-height:220px; object-fit:cover; border-radius:12px; display:block;" />
    `;
  };

  renderPreview();

  fileEl.addEventListener("change", () => {
    pendingFile = fileEl.files?.[0] ?? null;
    uploadDone = false;
    cleanupPreviewUrl();
    if (pendingFile) previewUrl = URL.createObjectURL(pendingFile);
    renderPreview();
  });

  imageUrlEl.addEventListener("input", () => {
    if (imageUrlEl.value.trim()) cleanupPreviewUrl();
    renderPreview();
  });

  qs(appEl, "#uploadBtn").addEventListener("click", async () => {
    let file = fileEl.files?.[0];
    if (!file) return alert("Bitte zuerst ein Bild auswählen.");
    if (!useBackend) return alert("Upload braucht Backend (Supabase).");

    try {
      statusEl.textContent = `Komprimiere… (${Math.round(file.size / 1024)} KB)`;
      file = await compressImageFile(file, { maxSide: 1600, quality: 0.82, mime: "image/jpeg" });
      statusEl.textContent = `Uploading… (${Math.round(file.size / 1024)} KB)`;
      const url = await uploadRecipeImage(file, r.id);

      imageUrlEl.value = url;
      uploadDone = true;
      pendingFile = null;

      cleanupPreviewUrl();
      renderPreview();
      statusEl.textContent = "Upload fertig ✅ (URL gesetzt)";
    } catch (e) {
      statusEl.textContent = "";
      alert(`Upload fehlgeschlagen: ${e?.message ?? e}`);
    }
  });

  qs(appEl, "#backBtn").addEventListener("click", () => {
    cleanupPreviewUrl();
    if (isEdit) setView({ name: "detail", selectedId: r.id, q: state.q });
    else setView({ name: "list", selectedId: null, q: state.q });
  });

  qs(appEl, "#saveBtn").addEventListener("click", async () => {
    const title = qs(appEl, "#title").value.trim();
    if (!title) return alert("Bitte einen Titel angeben.");

    const category = qs(appEl, "#category").value.trim();
    const time = qs(appEl, "#time").value.trim();
    const image_url = qs(appEl, "#image_url").value.trim();
    const source = qs(appEl, "#source").value.trim();

    const ingredients = qs(appEl, "#ingredients").value.split("\n").map(s => s.trim()).filter(Boolean);
    const steps = qs(appEl, "#steps").value.split("\n").map(s => s.trim()).filter(Boolean);

    const updated = { ...r, title, category, time, source, ingredients, steps, image_url: image_url || "" };

    // optimistic navigate
    cleanupPreviewUrl();
    setView({ name: "detail", selectedId: updated.id, q: state.q });

    if (!useBackend) return;

    try {
      await upsertRecipe(updated);
    } catch (e) {
      alert(`Konnte nicht zum Backend speichern.\nFehler: ${e?.message ?? e}`);
    }
  });
}
