export function normalizeSharedLines(value) {
  if (Array.isArray(value)) return value.map((line) => String(line ?? "").trim()).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((line) => String(line ?? "").trim()).filter(Boolean);
    } catch {
      // ignore
    }
    return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
  return [];
}

export function normalizeSharedPayload(data) {
  if (Array.isArray(data)) {
    return normalizeSharedPayload(data[0] || null);
  }
  if (!data || typeof data !== "object") return { recipe: null, parts: [] };

  const payload =
    data?.recipe || data?.parts
      ? data
      : (data?.result && typeof data.result === "object" ? data.result : data);

  const recipeRaw = payload?.recipe || payload?.data?.recipe || payload?.data || null;
  const recipe = recipeRaw
    ? {
        ...recipeRaw,
        ingredients: normalizeSharedLines(recipeRaw.ingredients),
        steps: normalizeSharedLines(recipeRaw.steps),
      }
    : null;

  let rawParts = payload?.parts || payload?.data?.parts || [];
  if (typeof rawParts === "string") {
    try {
      rawParts = JSON.parse(rawParts);
    } catch {
      rawParts = [];
    }
  }
  if (!Array.isArray(rawParts)) rawParts = [];

  const parts = rawParts
    .map((entry) => {
      const recipePart =
        entry?.recipe ||
        entry?.child ||
        entry?.child_recipe ||
        entry?.childRecipe ||
        entry?.part_recipe ||
        entry?.partRecipe ||
        entry?.recipes ||
        null;

      if (!recipePart?.id) return null;
      return {
        ...entry,
        recipe: {
          ...recipePart,
          ingredients: normalizeSharedLines(recipePart.ingredients),
          steps: normalizeSharedLines(recipePart.steps),
        }
      };
    })
    .filter(Boolean);

  return { recipe, parts };
}
