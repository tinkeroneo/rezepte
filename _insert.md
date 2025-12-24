---

## 🚫 Do not break these rules

Diese Regeln verhindern die meisten „unsichtbaren“ Bugs (Import, Persistenz, Doppelklick):

1) **Keine Fachlogik in `app.js`** – nur orchestrieren/wiren.
2) **Import-Logik nur in `src/domain/import.js`** (keine gleichnamige Funktion in `app.js`).
3) **Persistenz nur über `src/domain/recipeRepo.js`** (nicht direkt `localStorage` oder `supabase` aus Views).
4) **Nie still scheitern:** Async Handler sollen Fehler an den globalen Banner geben (oder `throw`en).

Wenn du unsicher bist: lieber in `domain/` kapseln, statt schnell in `app.js` zu patchen.

---

## ✅ Cleanup done (Tag)

Siehe `CLEANUP_DONE.md` für die Checkliste und den aktuellen Stand.
