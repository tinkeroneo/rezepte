import { KEYS, lsGet, lsSet } from "../storage.js";
import { norm } from "../utils.js";
export function loadShoppingUI() {
  const SHOPPING_UI_KEY = "tinkeroneo_shopping_ui_v1";
  try { return JSON.parse(localStorage.getItem(SHOPPING_UI_KEY) || "{}"); }
  catch { return {}; }
}
export function saveShoppingUI(ui) {
  const SHOPPING_UI_KEY = "tinkeroneo_shopping_ui_v1";
  localStorage.setItem(SHOPPING_UI_KEY, JSON.stringify(ui));
}

export function loadShopping() {
  return lsGet(KEYS.SHOPPING, {});
}
export function saveShopping(list) {
  lsSet(KEYS.SHOPPING, list || {});
}

export function isIngredientHeader(line) {
  const s = (line ?? "").trim();
  if (!s) return false;
  if (s.endsWith(":")) return true;

  const hasDigit = /\d/.test(s);
  const looksLikeItem = /(g|kg|ml|l|el|tl|prise|dose|bund|stück|stueck|zehe|tasse)/i.test(s);

  // Wenn es wie ein echtes Zutaten-Item aussieht → niemals als Header werten.
  if (hasDigit || looksLikeItem) return false;

  // Header sind eher kurze Abschnittsnamen (Teig, Füllung, …) – NICHT einzelne Zutaten wie "Pfeffer".
  if (s.length > 40) return false;

  const n = norm(s);
  const headerLike = /^(teig|füllung|fuellung|boden|mürbeteigboden|muerbeteigboden|sauce|soße|sosse|dressing|topping|glasur|guss|deko|zum bestreichen|optional)$/i;
  if (headerLike.test(n)) return true;

  return false;
}

export function normalizeShoppingKey(line) {
  let s = (line ?? "").toString().trim();
  if (!s) return "";

  s = s.replace(/\s*\([^)]*\)\s*$/g, "");
  s = s.replace(/^\s*(\d+(?:[.,]\d+)?|½|¼|¾)\s*(x\s*)?/i, "");
  s = s.replace(/^\s*(dose|dosen|bund|stück|stueck|zehe|zehen|el|tl|prise|tasse|tassen|g|kg|ml|l)\b\s*/i, "");
  s = s.replace(/^\s*(dose|dosen|bund|stück|stueck|zehe|zehen|el|tl|prise|tasse|tassen|g|kg|ml|l)\b\s*/i, "");

  return norm(s);
}

export function shoppingCategory(keyOrName) {
  const s = norm(keyOrName);
  const isSpice = /(salz|pfeffer|paprika|kreuzkümmel|cumin|koriander|zimt|kardamom|chili|gewürz|gewuerz|garam|ras el|kurkuma|muskat)/i.test(s);
  const isVeg = /(gurke|tomate|zwiebel|knoblauch|paprika|spinat|aubergine|süßkartoffel|suesskartoffel|kartoffel|salat|rucola|petersilie|minze|frühlingszwiebel|fruehlingszwiebel)/i.test(s);
  const isFruit = /(zitrone|limette|granatapfel|avocado)/i.test(s);
  const isDry = /(couscous|nudel|reis|mehl|zucker|tahini|kichererbse|bohne|dose|dosen|tomatenmark|ajvar)/i.test(s);
  const isOil = /(öl|oel)/i.test(s);

  if (isVeg) return "Gemüse & Kräuter";
  if (isFruit) return "Obst";
  if (isSpice) return "Gewürze";
  if (isOil) return "Öl & Essig";
  if (isDry) return "Vorrat";
  return "Sonstiges";
}

export function addToShopping(items) {
  const list = loadShopping();

  for (const raw of (items ?? [])) {
    const line = (raw ?? "").toString().trim();
    if (!line) continue;
    if (isIngredientHeader(line)) continue;

    const key = normalizeShoppingKey(line) || norm(line);
    if (!key) continue;

    if (!list[key]) {
      list[key] = { name: line, done: false, count: 1, cat: shoppingCategory(key) };
    } else {
      list[key].count = (list[key].count ?? 1) + 1;
      if ((list[key].name ?? "").length > line.length) list[key].name = line;
    }
  }

  saveShopping(list);
}
