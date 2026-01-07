export async function compressImageFile(
  file,
  { maxSide = 1600, quality = 0.82, mime } = {}
) {
  if (!file?.type?.startsWith("image/")) return file;
  if (file.size <= 350_000) return file;

  // Default: keep original mime (PNG stays PNG)
  mime = mime || file.type || "image/jpeg";

  const imgBitmap = await createImageBitmap(file);
  const w = imgBitmap.width;
  const h = imgBitmap.height;

  const scale = Math.min(1, maxSide / Math.max(w, h));
  const targetW = Math.max(1, Math.round(w * scale));
  const targetH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;

  const keepAlpha = mime === "image/png" || mime === "image/webp";
  const ctx = canvas.getContext("2d", { alpha: keepAlpha });

  // If exporting to JPEG, flatten on white background
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
  }

  ctx.drawImage(imgBitmap, 0, 0, targetW, targetH);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, mime, quality)
  );
  if (!blob) return file;
  if (blob.size >= file.size) return file;

  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
      ? "webp"
      : "jpg";

  const newName = file.name?.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${newName}.${ext}`, { type: mime });
}
