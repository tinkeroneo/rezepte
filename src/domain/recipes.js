import { KEYS, lsGet, lsSet } from "../storage.js";
import { generateId } from "./id.js";

export function seedRecipes() {
  return [
    {
      id: generateId(),
      title: "Bohnen-Rührei mit Spinat & getrockneten Tomaten",
      time: "10 Minuten",
      category: "Frühstück / Brunch",
      image_url: "",
      source: "Eigenkreation",
      ingredients: [
        "Weiße Bohnen",
        "2 TK-Spinat-Blöckchen",
        "4 getrocknete Tomaten",
        "Zwiebel",
        "Knoblauch",
        "Olivenöl",
        "Paprikapulver",
        "Chili",
        "Kala Namak",
        "Rucola (zum Bett)"
      ],
      steps: [
        "Bohnen grob mit der Gabel zerdrücken (stückig lassen).",
        "Zwiebel in Olivenöl glasig braten, Knoblauch kurz mitbraten.",
        "Paprika + Chili kurz mitrösten.",
        "Bohnen + getrocknete Tomaten zugeben und anbraten.",
        "TK-Spinat einrühren und schmelzen lassen, Flüssigkeit einkochen.",
        "Vom Herd ziehen und mit Kala Namak, Salz, Pfeffer abschmecken.",
        "Auf Rucola betten und servieren."
      ],
      createdAt: Date.now(),
    }
  ];
}

export function toLocalShape(r) {
  const normStr = (v) => String(v ?? "").trim();

  const normLines = (arr) =>
    (Array.isArray(arr) ? arr : [])
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);

  const tags =
    Array.isArray(r.tags) ? r.tags :
    typeof r.tags === "string" ? r.tags.split(",") : [];

  return {
    id: r.id,
    title: normStr(r.title),
    category: normStr(r.category),
    time: normStr(r.time),
    image_url: normStr(r.image_url),
    source: normStr(r.source),
    tags: tags.map((t) => String(t).trim()).filter(Boolean),
    ingredients: normLines(r.ingredients),
    steps: normLines(r.steps),
    createdAt: r.created_at ? new Date(r.created_at).getTime() : (r.createdAt ?? Date.now()),
    tags: Array.isArray(r.tags) ? r.tags : [],

  };
}


export function loadRecipesLocal() {
  const raw = lsGet(KEYS.LOCAL_RECIPES, null);
  if (!raw) {
    const seeded = seedRecipes();
    saveRecipesLocal(seeded);
    return seeded;
  }
  return Array.isArray(raw) ? raw : [];
}

export function saveRecipesLocal(recipesArr) {
  lsSet(KEYS.LOCAL_RECIPES, recipesArr);
}