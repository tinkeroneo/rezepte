import { isIngredientHeader } from "./shopping.js";

const UNIT_ALIASES = new Map([
  ["g", "g"],
  ["gramm", "g"],
  ["gram", "g"],
  ["gr", "g"],
  ["kg", "kg"],
  ["kilo", "kg"],
  ["kilogramm", "kg"],
  ["ml", "ml"],
  ["milliliter", "ml"],
  ["millilitre", "ml"],
  ["l", "l"],
  ["liter", "l"],
  ["litre", "l"],
  ["tl", "TL"],
  ["teeloeffel", "TL"],
  ["teeloffel", "TL"],
  ["teelöffel", "TL"],
  ["tsp", "TL"],
  ["el", "EL"],
  ["essloeffel", "EL"],
  ["esslöffel", "EL"],
  ["tbsp", "EL"],
  ["stk", "stk"],
  ["stueck", "stk"],
  ["stück", "stk"],
  ["st", "stk"],
  ["zweig", "Zweig"],
  ["zweige", "Zweig"],
  ["packung", "Pck"],
  ["packungen", "Pck"],
  ["pack", "Pck"],
  ["pck", "Pck"],
  ["paeckchen", "Pck"],
  ["päckchen", "Pck"],
  ["handvoll", "Handvoll"],
  ["bund", "Bund"],
  ["dose", "Dose"],
  ["dosen", "Dose"],
  ["prise", "Prise"],
  ["fingerbreit", "Fingerbreit"],
  ["cm", "cm"],
  ["mm", "mm"],
]);

function normalizeUnitToken(unitRaw) {
  const raw = String(unitRaw || "").trim().toLowerCase();
  if (!raw) return "";
  return UNIT_ALIASES.get(raw) || "";
}

function parseLeadingAmount(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;

  const m = s.match(/^(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+|½|¼|¾)(?:\s+|$)(.*)$/);
  if (!m) return null;

  const amountRaw = m[1];
  const rest = m[2] || "";

  if (amountRaw === "½") return { amount: 0.5, rest };
  if (amountRaw === "¼") return { amount: 0.25, rest };
  if (amountRaw === "¾") return { amount: 0.75, rest };

  if (amountRaw.includes("/")) {
    const [a, b] = amountRaw.split("/").map((x) => Number(String(x).trim()));
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) return { amount: a / b, rest };
    return null;
  }

  const amount = Number(amountRaw.replace(",", "."));
  if (!Number.isFinite(amount)) return null;
  return { amount, rest };
}

function splitUnitAndName(restRaw) {
  const rest = String(restRaw || "").trim();
  if (!rest) return { unit: "", name: "" };
  const m = rest.match(/^([A-Za-zÄÖÜäöüß.]+)\s*(.*)$/);
  if (!m) return { unit: "", name: rest };
  const unit = normalizeUnitToken(String(m[1] || "").replace(/\.$/, ""));
  if (!unit) return { unit: "", name: rest };
  const name = String(m[2] || "").trim();
  return { unit, name };
}

function formatAmount(n) {
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace(".", ",");
}

function convertAmount(amount, unit) {
  if (!Number.isFinite(amount) || !unit) return { amount, unit };
  if (unit === "kg") return { amount: amount * 1000, unit: "g" };
  if (unit === "l") return { amount: amount * 1000, unit: "ml" };
  return { amount, unit };
}

export function normalizeIngredientLine(line) {
  const raw = String(line || "");
  const trimmed = raw.trim();
  if (!trimmed) return { line: raw, changed: false };
  if (isIngredientHeader(trimmed)) return { line: raw, changed: false };

  const parsed = parseLeadingAmount(trimmed);
  if (!parsed) return { line: raw, changed: false };

  const { amount, rest } = parsed;
  const { unit, name } = splitUnitAndName(rest);
  if (!unit) return { line: raw, changed: false };

  const conv = convertAmount(amount, unit);
  const next = `${formatAmount(conv.amount)} ${conv.unit}${name ? ` ${name}` : ""}`.trim();
  const changed = next !== trimmed;
  return { line: changed ? next : raw, changed };
}

export function normalizeIngredientLines(lines) {
  const out = [];
  let changedCount = 0;
  for (const line of lines || []) {
    const n = normalizeIngredientLine(line);
    out.push(n.line);
    if (n.changed) changedCount++;
  }
  return { lines: out, changedCount };
}
