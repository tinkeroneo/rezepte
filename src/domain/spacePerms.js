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


export function getMyRoleInSpace({ spaceId, mySpaces }) {
  const sid = String(spaceId || "").trim();
  if (!sid) return "viewer";
  const row = (Array.isArray(mySpaces) ? mySpaces : []).find(s => String(s?.space_id || s?.id || "") === sid);
  const raw = String(row?.role || "").toLowerCase();

  // normalize
  if (raw === "owner") return "owner";
  if (raw === "admin") return "owner";
  if (raw === "editor") return "editor";
  return "viewer";
}

export function allowedInviteRoles(currentRole) {
  const r = String(currentRole || "viewer").toLowerCase();
  if (r === "owner") return ["viewer", "editor", "owner"];
  if (r === "editor") return ["viewer", "editor"];
  return ["viewer"];
}
