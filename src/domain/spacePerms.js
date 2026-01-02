export function canWriteInSpace({ spaceId, mySpaces }) {
  const sid = String(spaceId || "").trim();
  if (!sid) return false;

  const s = (Array.isArray(mySpaces) ? mySpaces : []).find(x =>
    String(x.space_id || x.id || "") === sid
  );
  if (!s) return false;

  // je nach Modell
  if (s.can_write === true) return true;

  const role = String(s.role || "").toLowerCase();
  return role === "owner" || role === "editor";
}
