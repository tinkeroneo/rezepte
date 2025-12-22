import { KEYS, lsGet, lsSet } from "../storage.js";

export function seedRecipes() {
  return [
    {
      id: crypto.randomUUID(),
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
  return {
    id: r.id,
    title: r.title ?? "",
    category: r.category ?? "",
    time: r.time ?? "",
    image_url: r.image_url ?? "",
    source: r.source ?? "",
    ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
    steps: Array.isArray(r.steps) ? r.steps : [],
    createdAt: r.created_at ? new Date(r.created_at).getTime() : (r.createdAt ?? Date.now())
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
