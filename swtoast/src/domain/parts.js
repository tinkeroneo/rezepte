export function rebuildPartsIndex(recipeParts) {
  const partsByParent = new Map();
  for (const p of (recipeParts ?? [])) {
    const arr = partsByParent.get(p.parent_id) ?? [];
    arr.push(p.child_id);
    partsByParent.set(p.parent_id, arr);
  }
  return partsByParent;
}
