

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

        if (!src) {
            previewWrap.innerHTML = "";
            return;
        }

        let img = previewWrap.querySelector("img");
        if (!img) {
            img = document.createElement("img");
            img.alt = "Preview";
            img.style.width = "100%";
            img.style.maxHeight = "220px";
            img.style.objectFit = "contain";
            img.style.background = "linear-gradient(135deg,#eef2ff,#f8fafc)";
            img.style.borderRadius = "12px";
            img.style.display = "block";
            previewWrap.innerHTML = "";
            previewWrap.appendChild(img);
        }
        img.src = src;
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
        getImgEl: () => previewWrap?.querySelector("img") || null,

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
