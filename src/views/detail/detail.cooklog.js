import { escapeHtml, qs, qsa } from "../../utils.js";
import {
  getAvgRating,
  listCookEvents,
  pullCookEventsFromBackend,
  pushCookEventToBackend,
  removeCookEventFromBackend,
  addCookEvent,
  deleteCookEvent,
  updateCookEvent
} from "../../domain/cooklog.js";

const __pulledCookEvents = new Set(); // recipeId
let __cookRatingDialogOpen = false;
let __cookRatingLastOpenAt = 0;

export function ensureCooklogPulledOnce({ recipeId, onPulled }) {
  if (__pulledCookEvents.has(recipeId)) return;
  __pulledCookEvents.add(recipeId);

  pullCookEventsFromBackend(recipeId)
    .then(() => onPulled?.())
    .catch(() => {});
}

export function renderCooklogCardHtml({ recipeId, lastStr, avgLabel, avgCount }) {
  const events = listCookEvents(recipeId).slice(0, 30);
  const cookLogKey = `tinkeroneo_cooklog_open_${recipeId}`;
  const cookLogOpen = (() => {
    try { return localStorage.getItem(cookLogKey) === "1"; } catch { return false; }
  })();

  const avg = getAvgRating(recipeId);
  const avgRounded = Math.max(1, Math.min(5, Math.round(avg || 0))) || 0;

  return `
<section class="card card--tight" style="margin-top:.75rem;">
  <div class="card__hd"><div class="toolbar">
      <div>
        <h3 style="margin:0;">Kochverlauf</h3>
        <div class="muted">Zuletzt gekocht: <b>${escapeHtml(lastStr)}</b> · Ø ${escapeHtml(avgLabel)} (${avgCount})</div>
      </div>
      <div class="row" style="gap:.35rem;">
        <button class="btn btn--ghost" id="cookLogToggle" type="button"
                title="Verlauf ein-/ausklappen"
                aria-expanded="${cookLogOpen ? "true" : "false"}">
          ${cookLogOpen ? "▾" : "▸"} Verlauf (${events.length})
        </button>
        <button class="btn btn--ghost" id="cookLogNowBtn" type="button" title="Heute gekocht">✅</button>
      </div>
    </div>
  </div>

  <div class="card__bd">
    <div class="row" id="cookStars" style="gap:.15rem; align-items:center;">
      <div class="muted" style="margin-right:.35rem;">Bewertung:</div>
      ${[1,2,3,4,5].map(n => `
        <button type="button" class="btn btn--ghost" data-cook-rate="${n}"
                title="${n} Sterne" style="padding:.35rem .5rem;">
          ${n <= avgRounded ? "★" : "☆"}
        </button>
      `).join("")}
    </div>

    <div id="cookLogList" style="margin-top:.5rem; ${cookLogOpen ? "" : "display:none;"}">
      ${events.length ? `
        ${events.map(ev => `
          <div class="row" style="justify-content:space-between; align-items:flex-start; padding:.45rem 0; border-top:1px solid #eee;">
            <div style="min-width:0;">
              <div style="font-weight:650;">
                ${escapeHtml(ev.atStr)}
                ${ev.rating ? `<span class="muted" style="margin-left:.35rem;">${"⭐".repeat(ev.rating)}</span>` : ""}
              </div>
              ${ev.note ? `<div class="muted" style="margin-top:.15rem;">${escapeHtml(ev.note)}</div>` : ""}
            </div>
            <div class="row" style="gap:.25rem;">
              <button class="btn btn--ghost" type="button" data-ev-edit="${escapeHtml(ev.id)}" title="Bearbeiten">✎</button>
              <button class="btn btn--ghost" type="button" data-ev-del="${escapeHtml(ev.id)}" title="Löschen">🗑️</button>
            </div>
          </div>
        `).join("")}
      ` : `
        <div class="muted" style="margin-top:.5rem;">Noch kein Verlauf. Drück ✅ wenn du gekocht hast.</div>
      `}
    </div>
  </div>
</section>
  `;
}

export function bindCooklogCard({ appEl, recipeId, useBackend, onRefresh }) {
  const cookLogKey = `tinkeroneo_cooklog_open_${recipeId}`;

  qs(appEl, "#cookLogToggle")?.addEventListener("click", () => {
    const listEl = qs(appEl, "#cookLogList");
    if (!listEl) return;

    const open = listEl.style.display === "none";
    listEl.style.display = open ? "" : "none";

    const btn = qs(appEl, "#cookLogToggle");
    if (btn) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.innerHTML = `${open ? "▾" : "▸"} Verlauf (${listCookEvents(recipeId).length})`;
    }

    try { localStorage.setItem(cookLogKey, open ? "1" : "0"); } catch { 
       // continue regardless of error
    }
  });

  qs(appEl, "#cookLogNowBtn")?.addEventListener("click", async () => {
    const ev = addCookEvent(recipeId, { at: Date.now(), rating: null, note: "" });
    if (useBackend) {
      try { await pushCookEventToBackend(recipeId, ev); } catch {  
        // continue regardless of error 
        }
    }
    onRefresh?.();
  });

  qsa(appEl, "[data-cook-rate]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rating = Number(btn.getAttribute("data-cook-rate")) || 0;

      openCookRatingDialog({
        rating,
        onDone: async ({ rating: finalRating, note }) => {
          const ev = addCookEvent(recipeId, { at: Date.now(), rating: finalRating, note: note || "" });
          if (useBackend) {
            try { await pushCookEventToBackend(recipeId, ev); } catch {
               // continue regardless of error
            }
          }
          onRefresh?.();
        }
      });
    });
  });

  qsa(appEl, "[data-ev-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-ev-del");
      if (!id) return;
      if (!confirm("Eintrag löschen?")) return;

      const removed = deleteCookEvent(recipeId, id);
      if (useBackend && removed) {
        try { await removeCookEventFromBackend(id); } catch {
           // continue regardless of error
        }
      }
      onRefresh?.();
    });
  });

  qsa(appEl, "[data-ev-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-ev-edit");
      if (!id) return;

      const ev = listCookEvents(recipeId).find(x => x.id === id);
      if (!ev) return;

      openEditCookEventDialog({
        recipeId,
        ev,
        useBackend,
        onDone: () => onRefresh?.()
      });
    });
  });
}

// ----- dialogs -----
function openCookRatingDialog({ rating, onDone }) {
  const now = Date.now();
  if (now - __cookRatingLastOpenAt < 350) return;
  __cookRatingLastOpenAt = now;

  if (__cookRatingDialogOpen) return;
  __cookRatingDialogOpen = true;

  document.getElementById("cookRatingBackdrop")?.remove();
  document.getElementById("cookRatingSheet")?.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "cookRatingBackdrop";
  backdrop.className = "sheet-backdrop";

  const sheet = document.createElement("div");
  sheet.id = "cookRatingSheet";
  sheet.className = "sheet";

  const close = () => {
    backdrop.remove();
    sheet.remove();
    __cookRatingDialogOpen = false;
  };

  backdrop.addEventListener("click", close);

  sheet.innerHTML = `
    <div class="toolbar">
      <div>
        <h3 style="margin:0;">Bewertung</h3>
        <div class="muted">${"⭐".repeat(rating)} (${rating}/5)</div>
      </div>
      <button class="btn btn--ghost" id="cookRateCancel" type="button" title="Abbrechen">✕</button>
    </div>

    <div class="card" style="padding:.85rem; margin:.75rem;">
      <div class="muted" style="margin-bottom:.35rem;">Notiz (optional)</div>
      <textarea id="cookRateNote" class="input" rows="3" placeholder="z.B. etwas weniger Salz…"></textarea>
      <div class="row" style="justify-content:flex-end; gap:.5rem; margin-top:.75rem;">
        <button class="btn btn--ghost" id="cookRateCancel2" type="button">Abbrechen</button>
        <button class="btn" id="cookRateSave" type="button">Speichern</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  const noteEl = sheet.querySelector("#cookRateNote");
  setTimeout(() => noteEl?.focus(), 0);

  const onCancel = () => close();
  sheet.querySelector("#cookRateCancel")?.addEventListener("click", onCancel);
  sheet.querySelector("#cookRateCancel2")?.addEventListener("click", onCancel);

  sheet.querySelector("#cookRateSave")?.addEventListener("click", async () => {
    const note = String(noteEl?.value ?? "").trim();
    close();
    await onDone?.({ rating, note });
  });
}

function openEditCookEventDialog({ recipeId, ev, useBackend, onDone }) {
  document.getElementById("cookEditBackdrop")?.remove();
  document.getElementById("cookEditSheet")?.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "cookEditBackdrop";
  backdrop.className = "sheet-backdrop";

  const sheet = document.createElement("div");
  sheet.id = "cookEditSheet";
  sheet.className = "sheet";

  const close = () => {
    backdrop.remove();
    sheet.remove();
  };

  backdrop.addEventListener("click", close);

  sheet.innerHTML = `
    <div class="toolbar">
      <div>
        <h3 style="margin:0;">Eintrag bearbeiten</h3>
        <div class="muted">${escapeHtml(ev.atStr)}</div>
      </div>
      <button class="btn btn--ghost" id="cookEditCancel" type="button">✕</button>
    </div>

    <div class="card" style="padding:.85rem; margin:.75rem;">
      <div class="row" style="gap:.35rem; align-items:center;">
        <div class="muted" style="min-width:90px;">Datum</div>
        <input id="cookEditAt" class="input" type="datetime-local" />
      </div>

      <div class="row" style="gap:.35rem; align-items:center;">
        <div class="muted" style="min-width:90px;">Rating</div>
        <select id="cookEditRating" class="input">
          <option value="">—</option>
          ${[1,2,3,4,5].map(n => `<option value="${n}" ${ev.rating === n ? "selected" : ""}>${n}</option>`).join("")}
        </select>
      </div>

      <div class="muted" style="margin-top:.75rem; margin-bottom:.35rem;">Notiz</div>
      <textarea id="cookEditNote" class="input" rows="3" placeholder="…">${escapeHtml(ev.note || "")}</textarea>

      <div class="row" style="justify-content:flex-end; gap:.5rem; margin-top:.75rem;">
        <button class="btn btn--ghost" id="cookEditCancel2" type="button">Abbrechen</button>
        <button class="btn" id="cookEditSave" type="button">Speichern</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  const atEl = sheet.querySelector("#cookEditAt");
  const ratingEl = sheet.querySelector("#cookEditRating");
  const noteEl = sheet.querySelector("#cookEditNote");
  if (atEl) atEl.value = toDatetimeLocalValue(ev?.at);

  sheet.querySelector("#cookEditCancel")?.addEventListener("click", close);
  sheet.querySelector("#cookEditCancel2")?.addEventListener("click", close);

  sheet.querySelector("#cookEditSave")?.addEventListener("click", async () => {
    const nextAt = parseDatetimeLocalValue(atEl?.value, ev?.at);
    const nextRatingRaw = ratingEl?.value;
    const nextRating = nextRatingRaw ? Number(nextRatingRaw) : null;
    const nextNote = String(noteEl?.value ?? "").trim();

    const next = { ...ev, at: nextAt, rating: nextRating, note: nextNote };
    updateCookEvent(recipeId, ev.id, { at: nextAt, rating: nextRating, note: nextNote });

    if (useBackend) {
      try { await pushCookEventToBackend(recipeId, next); } catch {
         // continue regardless of error
      }
    }

    close();
    onDone?.();
  });
}

function toDatetimeLocalValue(ms) {
  const d = Number.isFinite(ms) ? new Date(ms) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function parseDatetimeLocalValue(raw, fallbackMs) {
  const v = String(raw || "").trim();
  if (!v) return Number.isFinite(fallbackMs) ? fallbackMs : Date.now();

  const ms = new Date(v).getTime();
  if (!Number.isFinite(ms)) return Number.isFinite(fallbackMs) ? fallbackMs : Date.now();
  return ms;
}
