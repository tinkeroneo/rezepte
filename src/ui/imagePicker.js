import { escapeHtml } from "../utils.js";

export function createImagePicker({ fileEl, urlEl, previewWrap, statusEl }) {
  let pendingFile = null;
  let previewUrl = null;

  const cleanup = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  };

  const setStatus = (t) => {
    if (statusEl) statusEl.textContent = t || "";
  };

  const render = () => {
    const src = previewUrl || (urlEl?.value || "").trim();
    if (!previewWrap) return;
    previewWrap.innerHTML = src
      ? `<img src="${escapeHtml(src)}" alt="Preview"
           style="width:100%; max-height:220px; object-fit:contain;
                  background:linear-gradient(135deg,#eef2ff,#f8fafc);
                  border-radius:12px; display:block;" />`
      : "";
  };

  fileEl?.addEventListener("change", () => {
    pendingFile = fileEl.files?.[0] ?? null;
    cleanup();
    if (pendingFile) previewUrl = URL.createObjectURL(pendingFile);
    render();
  });

  urlEl?.addEventListener("input", () => {
    if ((urlEl.value || "").trim()) cleanup();
    render();
  });

  render();

  return {
    getPendingFile: () => pendingFile,
    clearPendingFile: () => {
      pendingFile = null;
      cleanup();
      render();
    },
    getUrl: () => (urlEl?.value || "").trim(),
    setUrl: (u) => {
      if (urlEl) urlEl.value = u || "";
      cleanup();
      render();
    },
    setStatus,
    cleanup,
    render,
  };
}
