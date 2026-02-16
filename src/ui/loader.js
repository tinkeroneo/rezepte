// src/ui/loader.js
let __el = null;
let __lock = 0;
function loaderIconSrc() {
  const resolved = document.documentElement?.dataset?.theme;
  const wantsDark =
    resolved === "dark" ||
    (!resolved && window.matchMedia?.("(prefers-color-scheme: dark)")?.matches);

  const file = wantsDark
    ? "src/favicon/iconCookingCatDark.svg"
    : "src/favicon/iconCookingCatLight.svg";
  return new URL(file, document.baseURI).toString();
}
export function refreshLoaderIcon() {
  const img = __el?.querySelector?.(".appLoader__img");
  if (img) img.src = loaderIconSrc();
}

function ensure() {
  if (__el) return __el;

  const el = document.createElement("div");
  el.id = "appLoader";
  el.innerHTML = `
    <div class="appLoader__card" role="status" aria-live="polite">
      <img class="appLoader__img" src="${loaderIconSrc()}" alt="Lädt..." />
      <div class="appLoader__txt" id="appLoaderText">Lade…</div>
      <div class="appLoader__dots" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;

  document.body.appendChild(el);
  __el = el;
  return el;
}

export function showLoader(text = "Lade…") {
  const el = ensure();
  const t = el.querySelector("#appLoaderText");
  if (t) t.textContent = text;
  __lock++;
  el.classList.add("is-on");
}

export function hideLoader() {
  if (!__el) return;
  __lock = Math.max(0, __lock - 1);
  if (__lock === 0) __el.classList.remove("is-on");
}

export async function withLoader(text, fn) {
  showLoader(text);
  try {
    return await fn();
  } finally {
    hideLoader();
  }
}
