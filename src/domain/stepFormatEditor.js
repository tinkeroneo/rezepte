function lineBounds(text, index) {
  const safe = String(text ?? "");
  const pos = Math.max(0, Math.min(Number(index) || 0, safe.length));
  const lineStart = safe.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
  const nextBreak = safe.indexOf("\n", pos);
  const lineEnd = nextBreak === -1 ? safe.length : nextBreak;
  return { lineStart, lineEnd };
}

function stripKnownPrefixes(line) {
  const trimmed = String(line ?? "").trim();
  return trimmed
    .replace(/^##\s+/, "")
    .replace(/^[-*•]\s+/, "")
    .trim();
}

export function formatStepLine(line, mode) {
  const content = stripKnownPrefixes(line);
  if (mode === "title") return content ? `## ${content}` : "## ";
  if (mode === "bullet") return content ? `- ${content}` : "- ";
  if (mode === "ingredientHeader") return `${content.replace(/:$/, "")}:`;
  if (mode === "ingredientItem") return content ? `- ${content}` : "- ";
  return content;
}

export function applyStepLineFormatAtCursor({ text, cursor = 0, mode = "plain" }) {
  const safe = String(text ?? "");
  const { lineStart, lineEnd } = lineBounds(safe, cursor);
  const line = safe.slice(lineStart, lineEnd);
  const nextLine = formatStepLine(line, mode);
  const out = safe.slice(0, lineStart) + nextLine + safe.slice(lineEnd);
  const nextCursor = lineStart + nextLine.length;
  return { text: out, cursor: nextCursor };
}
