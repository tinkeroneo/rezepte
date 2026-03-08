export function isStepTitleLine(line) {
  const s = (line ?? "").trim();
  if (!s) return false;
  if (s.length > 40) return false;
  if (/[.!?]$/.test(s)) return false;
  if (/^[-*•]/.test(s)) return false;
  return true;
}

function fallbackStepTitle(line, index) {
  const raw = String(line ?? "").trim();
  if (!raw) return `Schritt ${index + 1}`;

  const cleaned = raw
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+[\].):-]?\s*/, "")
    .trim();

  const words = cleaned
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (!words.length) return `Schritt ${index + 1}`;

  let title = words.join(" ");
  title = title.replace(/[.,;:!?]+$/g, "");
  return title ? `${index + 1}. ${title}` : `Schritt ${index + 1}`;
}

function fallbackStepBody(line, fallbackTitle) {
  const raw = String(line ?? "").trim();
  const title = String(fallbackTitle ?? "").trim();
  if (!raw) return "";
  if (!title) return raw;

  const titleWithoutNumber = title.replace(/^\d+\.\s*/, "").trim();
  if (!titleWithoutNumber) return raw;

  const escaped = titleWithoutNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutPrefix = raw.replace(new RegExp(`^${escaped}[,;:!?.-]*\\s*`, "i"), "").trim();
  return withoutPrefix || raw;
}

export function splitStepsToCards(lines) {
  const cards = [];
  let current = null;

  for (const raw of (lines ?? [])) {
    const line = (raw ?? "").trim();
    if (!line) continue;

    if (isStepTitleLine(line)) {
      if (current) cards.push(current);
      current = { title: line, body: [] };
    } else {
      if (!current) current = { title: "Schritt", body: [] };
      current.body.push(line);
    }
  }

  if (current) cards.push(current);

  if (cards.length === 1 && cards[0].title === "Schritt") {
    return (lines ?? []).filter(Boolean).map((line, index) => ({
      title: fallbackStepTitle(line, index),
      body: [fallbackStepBody(line, fallbackStepTitle(line, index))]
    }));
  }

  return cards;
}

export function stepDoneKey(recipeId, cardIndex) {
  return `${recipeId}::${cardIndex}`;
}

export function parseDurationSeconds(text) {
  const t = (text ?? "").toString().toLowerCase();

  const mmss = t.match(/\b(\d{1,2})\s*:\s*(\d{2})\b/);
  if (mmss) {
    const m = parseInt(mmss[1], 10);
    const s = parseInt(mmss[2], 10);
    return m * 60 + s;
  }

  const min = t.match(/\b(\d{1,3})\s*(min|mins|minuten|minute)\b/);
  if (min) return parseInt(min[1], 10) * 60;

  const hr = t.match(/\b(\d{1,2})\s*(h|std|stunde|stunden)\b/);
  if (hr) return parseInt(hr[1], 10) * 3600;

  return null;
}

export function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return `${h}:${mm}:${ss}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
