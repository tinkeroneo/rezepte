import { escapeHtml } from "../utils.js";

const ALPHA_CACHE_KEY = "tinkeroneo_alpha_bounds_v1";
const MAX_ALPHA_CACHE = 120;
const memoryAlphaCache = new Map();

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeBounds(bounds) {
  if (!bounds || typeof bounds !== "object") return null;
  const left = Number(bounds.left);
  const top = Number(bounds.top);
  const width = Number(bounds.width);
  const height = Number(bounds.height);
  if (![left, top, width, height].every(Number.isFinite)) return null;
  if (width <= 0 || height <= 0) return null;
  return {
    left: Math.max(0, Math.min(1, left)),
    top: Math.max(0, Math.min(1, top)),
    width: Math.max(0.001, Math.min(1, width)),
    height: Math.max(0.001, Math.min(1, height)),
  };
}

export function normalizeImageFocus(focus) {
  const f = focus && typeof focus === "object" ? { ...focus } : {};
  const x = Number.isFinite(Number(f.x)) ? Number(f.x) : 50;
  const y = Number.isFinite(Number(f.y)) ? Number(f.y) : 50;
  const zoom = Number.isFinite(Number(f.zoom)) ? Math.max(1, Math.min(3, Number(f.zoom))) : 1;
  const mode = f.mode === "cover" || f.mode === "manual" || f.mode === "crop"
    ? "cover"
    : f.mode === "alpha-fit"
      ? "alpha-fit"
      : "auto";
  const alphaBounds = normalizeBounds(f.alphaBounds);
  return { x, y, zoom, mode, alphaBounds };
}

export function encodeImageFocusAttr(focus) {
  return escapeHtml(JSON.stringify(normalizeImageFocus(focus)));
}

function readStoredAlphaCache() {
  try {
    const raw = localStorage.getItem(ALPHA_CACHE_KEY);
    const parsed = safeParse(raw, {});
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredAlphaCache(map) {
  try {
    localStorage.setItem(ALPHA_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function alphaCacheKey(src) {
  return String(src || "").split("#")[0];
}

function readCachedAlphaBounds(src) {
  const key = alphaCacheKey(src);
  if (!key) return undefined;
  if (memoryAlphaCache.has(key)) return memoryAlphaCache.get(key);

  const stored = readStoredAlphaCache();
  if (Object.prototype.hasOwnProperty.call(stored, key)) {
    const value = normalizeBounds(stored[key]);
    memoryAlphaCache.set(key, value);
    return value;
  }
  return undefined;
}

function writeCachedAlphaBounds(src, bounds) {
  const key = alphaCacheKey(src);
  if (!key) return;
  const value = normalizeBounds(bounds);
  memoryAlphaCache.set(key, value);

  const stored = readStoredAlphaCache();
  stored[key] = value;
  const keys = Object.keys(stored);
  if (keys.length > MAX_ALPHA_CACHE) {
    for (const oldKey of keys.slice(0, keys.length - MAX_ALPHA_CACHE)) {
      delete stored[oldKey];
    }
  }
  writeStoredAlphaCache(stored);
}

function createImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    img.src = url;
  });
}

async function createImageFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    return await createImageFromUrl(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function detectAlphaBoundsFromImage(img) {
  const naturalWidth = Number(img?.naturalWidth || img?.videoWidth || 0);
  const naturalHeight = Number(img?.naturalHeight || img?.videoHeight || 0);
  if (!naturalWidth || !naturalHeight) return null;

  const maxSide = 256;
  const scale = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight));
  const sampleWidth = Math.max(1, Math.round(naturalWidth * scale));
  const sampleHeight = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true, alpha: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, sampleWidth, sampleHeight);
  ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight);

  let data;
  try {
    data = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
  } catch {
    return null;
  }

  const threshold = 8;
  let minX = sampleWidth;
  let minY = sampleHeight;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const alpha = data[(y * sampleWidth + x) * 4 + 3];
      if (alpha <= threshold) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) return null;

  const width = (maxX - minX + 1) / sampleWidth;
  const height = (maxY - minY + 1) / sampleHeight;
  const left = minX / sampleWidth;
  const top = minY / sampleHeight;

  const nearFullFrame = width > 0.975 && height > 0.975 && left < 0.015 && top < 0.015;
  if (nearFullFrame) return null;

  return normalizeBounds({ left, top, width, height });
}

async function detectAndCacheAlphaBounds(src, loader) {
  const cached = readCachedAlphaBounds(src);
  if (cached !== undefined) return cached;

  try {
    const img = await loader();
    const bounds = detectAlphaBoundsFromImage(img);
    writeCachedAlphaBounds(src, bounds);
    return bounds;
  } catch {
    writeCachedAlphaBounds(src, null);
    return null;
  }
}

export async function detectAlphaBoundsForUrl(url) {
  const src = alphaCacheKey(url);
  if (!src || /\.svg(?:$|\?)/i.test(src)) return null;
  return await detectAndCacheAlphaBounds(src, () => createImageFromUrl(src));
}

export async function detectAlphaBoundsForFile(file) {
  const pseudoKey = `file:${file?.name || "image"}:${file?.size || 0}:${file?.lastModified || 0}`;
  return await detectAndCacheAlphaBounds(pseudoKey, () => createImageFromFile(file));
}

export async function detectAlphaBoundsForRenderedImage(img) {
  const src = alphaCacheKey(img?.currentSrc || img?.src || "");
  if (!src || /\.svg(?:$|\?)/i.test(src)) return null;

  const cached = readCachedAlphaBounds(src);
  if (cached !== undefined) return cached;

  if (!img.complete || !img.naturalWidth || !img.naturalHeight) return null;
  const bounds = detectAlphaBoundsFromImage(img);
  writeCachedAlphaBounds(src, bounds);
  return bounds;
}

export async function deriveAlphaFitFocus({ file = null, url = "", currentFocus = null } = {}) {
  const focus = normalizeImageFocus(currentFocus);
  let bounds = null;

  if (file) bounds = await detectAlphaBoundsForFile(file);
  else if (url) bounds = await detectAlphaBoundsForUrl(url);

  if (bounds) {
    return {
      ...focus,
      mode: "alpha-fit",
      x: 50,
      y: 50,
      zoom: 1,
      alphaBounds: bounds,
    };
  }

  return {
    ...focus,
    mode: focus.mode === "cover" ? "cover" : "auto",
    alphaBounds: null,
  };
}

function resetImageStyle(img) {
  img.style.position = "";
  img.style.left = "";
  img.style.top = "";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.maxWidth = "100%";
  img.style.maxHeight = "100%";
  img.style.objectPosition = "50% 50%";
  img.style.objectFit = "contain";
  img.style.transform = "none";
  img.style.transformOrigin = "50% 50%";
}

function applyAlphaFit(img, bounds) {
  const parent = img.parentElement;
  if (!parent) return false;

  const containerWidth = parent.clientWidth;
  const containerHeight = parent.clientHeight;
  const naturalWidth = Number(img.naturalWidth || 0);
  const naturalHeight = Number(img.naturalHeight || 0);
  if (!containerWidth || !containerHeight || !naturalWidth || !naturalHeight) return false;

  const baseScale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
  const baseWidth = naturalWidth * baseScale;
  const baseHeight = naturalHeight * baseScale;
  const bboxWidth = bounds.width * baseWidth;
  const bboxHeight = bounds.height * baseHeight;
  if (!bboxWidth || !bboxHeight) return false;

  const fitScale = Math.min(containerWidth / bboxWidth, containerHeight / bboxHeight, 3.5);
  const finalWidth = baseWidth * fitScale;
  const finalHeight = baseHeight * fitScale;
  const centerX = (bounds.left + bounds.width / 2) * finalWidth;
  const centerY = (bounds.top + bounds.height / 2) * finalHeight;
  const left = containerWidth / 2 - centerX;
  const top = containerHeight / 2 - centerY;

  img.style.position = "absolute";
  img.style.left = `${left}px`;
  img.style.top = `${top}px`;
  img.style.width = `${finalWidth}px`;
  img.style.height = `${finalHeight}px`;
  img.style.maxWidth = "none";
  img.style.maxHeight = "none";
  img.style.objectFit = "fill";
  img.style.objectPosition = "0 0";
  img.style.transform = "none";
  img.style.transformOrigin = "50% 50%";
  return true;
}

export function applyImageFocusToElement(img, focus) {
  if (!img) return;
  const f = normalizeImageFocus(focus);
  const pos = `${f.x}% ${f.y}%`;

  if (f.mode === "cover" || f.mode === "auto") {
    resetImageStyle(img);
    img.style.objectFit = "cover";
    img.style.objectPosition = pos;
    img.style.transform = f.mode === "cover" ? `scale(${f.zoom})` : "none";
    img.style.transformOrigin = pos;
    return;
  }

  resetImageStyle(img);
  if (f.mode === "alpha-fit" && f.alphaBounds) {
    applyAlphaFit(img, f.alphaBounds);
  }
}

function parseFocusAttr(img) {
  const raw = img.getAttribute("data-image-focus");
  return raw ? normalizeImageFocus(safeParse(raw, null)) : normalizeImageFocus(null);
}

async function processManagedImage(img) {
  if (!(img instanceof window.HTMLImageElement)) return;
  const focus = parseFocusAttr(img);
  applyImageFocusToElement(img, focus);

  const shouldAutoDetect = img.getAttribute("data-auto-alpha") === "1" && focus.mode !== "cover";
  if (!shouldAutoDetect) return;

  const bounds = focus.alphaBounds || await detectAlphaBoundsForRenderedImage(img);
  if (!bounds) return;
  applyImageFocusToElement(img, { ...focus, mode: "alpha-fit", alphaBounds: bounds });
}

function queueProcess(img) {
  const run = () => processManagedImage(img).catch(() => {});
  if (img.complete && img.naturalWidth) run();
  else img.addEventListener("load", run, { once: true });
}

export function bindManagedRecipeImages({ root, observeMutations = false } = {}) {
  if (!root) return () => {};

  const processAll = () => {
    root.querySelectorAll("img[data-image-focus]").forEach((img) => {
      queueProcess(img);
    });
  };

  if (root.__managedRecipeImagesCleanup) {
    root.__managedRecipeImagesCleanup();
  }

  processAll();

  const onResize = () => processAll();
  window.addEventListener("resize", onResize);

  let observer = null;
  if (observeMutations && typeof window.MutationObserver !== "undefined") {
    observer = new window.MutationObserver(() => processAll());
    observer.observe(root, { childList: true, subtree: true });
  }

  const cleanup = () => {
    window.removeEventListener("resize", onResize);
    observer?.disconnect();
    if (root.__managedRecipeImagesCleanup === cleanup) {
      root.__managedRecipeImagesCleanup = null;
    }
  };

  root.__managedRecipeImagesCleanup = cleanup;
  return cleanup;
}
