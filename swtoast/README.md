# 🥗 Tinkeroneo – Rezepte & Kochen (Private App)

Kleine private Rezept-Web-App (Vanilla JS), optimiert für Kochen am Handy/Tablet.
Optional mit Supabase-Backend, sonst LocalStorage. Bewusst minimal – kein Framework, kein Build-Step.

---

## ✨ Features

- 📋 Rezeptliste mit Suche
- 📖 Detail- & Kochansicht
- ⏱️ Globale Timer (immer sichtbar, auch außerhalb der Kochansicht)
- 🛒 Einkaufsliste aus Rezepten
- 📦 Import & Export (JSON)
- ☁️ Optionales Backend (Supabase)
- 💾 LocalStorage Fallback
- 📄 PDF-Export (Print-basiert)

---

## 🧱 Architektur (Kurz)

```
src/
 ├─ app.js              // Bootstrapping & App-Glue
 ├─ state.js            // Hash-Routing
 ├─ views/              // UI-Rendering
 ├─ domain/             // Fachlogik (Rezepte, Import, Timer, Shopping)
 ├─ services/           // Errors, Locks, Export, WakeLock
 ├─ storage.js          // LocalStorage Wrapper (robust)
 └─ supabase.js         // Backend API (optional)
```

Prinzip:
- `views` = Darstellung
- `domain` = Fachlogik
- `services` = technische Helfer
- `app.js` verklebt alles, enthält aber keine Fachlogik.

---

## ☁️ Backend vs. Local Mode

In `src/app.js`:

```js
const USE_BACKEND = true;
```

- `true`: Laden/Speichern über Supabase, LocalStorage als Fallback/Cache.
- `false`: Alles lokal (LocalStorage).

---

## 📦 Rezept-Import

Import ist zentral in `src/domain/import.js` implementiert (`importRecipesIntoApp(...)`).
Wichtig: keine gleichnamige Funktion in `app.js` anlegen (sonst wird der Import überschrieben).

### Import-Modi

| Modus | Verhalten |
|------|-----------|
| `backendWins` (Default) | Backend bleibt führend; neue Rezepte werden im Backend angelegt |
| `jsonWins` | Import überschreibt bestehende Rezepte |
| `merge` | Ergänzt fehlende Felder, ohne vorhandene zu überschreiben |

---

## 🧪 Selftest

Für schnellen Gesundheitscheck (auch am Handy):

- Öffne `/#selftest`
- Optional: `/#diagnostics` (Latenz, Fehlerspeicher)

Checks:
- LocalStorage read/write (falls möglich)
- Backend erreichbar (nur wenn `USE_BACKEND=true`)
- Basisfunktionen geladen

---

## 🧪 Smoke-Tests (empfohlen)

### Import (BackendWins)
1. Import JSON mit *neuem* Rezept
2. Rezept erscheint in Liste
3. Browser neu laden
4. Rezept ist weiterhin da
5. Import erneut → kein Duplikat

### Timer
- Timer starten → View wechseln → Timer bleibt sichtbar
- Timer verlängern (auch nach Ablauf möglich)

### Shopping
- Items abhaken → rutschen nach unten
- Erledigte ein-/ausklappen
- Reload → Zustand bleibt erhalten

---

## 🛡️ Stabilität

- Globaler Error-Handler (`services/errors.js`)
- Fetch-Timeouts (AbortController)
- Locking gegen parallele Aktionen (`services/locks.js`)
- Robustes LocalStorage-Handling (kein Crash bei kaputtem JSON / Quota)

---

## 🧹 Coding-Standards (optional)

Minimales Setup für Formatierung und Linting:

```bash
npm i
npm run format
npm run lint
```

---

---

## 🚫 Do not break these rules

Diese Regeln verhindern die meisten „unsichtbaren“ Bugs (Import, Persistenz, Doppelklick):

1) **Keine Fachlogik in `app.js`** – nur orchestrieren/wiren.
2) **Import-Logik nur in `src/domain/import.js`** (keine gleichnamige Funktion in `app.js`).
3) **Persistenz nur über `src/domain/recipeRepo.js`** (nicht direkt `localStorage` oder `supabase` aus Views).
4) **Nie still scheitern:** async Handler sollen Fehler an den globalen Banner geben (oder `throw`en).

Wenn du unsicher bist: lieber in `domain/` kapseln, statt schnell in `app.js` zu patchen.

---

## ✅ Cleanup done (Tag)

Siehe `CLEANUP_DONE.md` für die Checkliste und den aktuellen Stand.
---
## 🚫 Do not break these rules
Diese Regeln verhindern die meisten „unsichtbaren“ Bugs (Import, Persistenz, Doppelklick):
1) **Keine Fachlogik in `app.js`** – nur orchestrieren/wiren.
2) **Import-Logik nur in `src/domain/import.js`** (keine gleichnamige Funktion in `app.js`).
3) **Persistenz nur über `src/domain/recipeRepo.js`** (nicht direkt `localStorage` oder `supabase` aus Views).
4) **Nie still scheitern:** async Handler sollen Fehler an den globalen Banner geben (oder `throw`en).
Wenn du unsicher bist: lieber in `domain/` kapseln, statt schnell in `app.js` zu patchen.
---
## ✅ Cleanup done (Tag)
Siehe `CLEANUP_DONE.md` für Checkliste und Stand.

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

## ⚠️ Nicht-Ziele

- Kein Benutzer-/Rechtemanagement
- Kein Sync-Konflikt-Resolver
- Kein Framework / kein Build-System

---

## Lizenz

Private Nutzung.


---

## 📴 Offline (App-Shell Cache)

Es gibt einen minimalen Service Worker (`sw.js`), der die App-Shell cached. Dadurch kann die UI auch ohne Netz starten.
Hinweis: Daten (Rezepte) kommen weiterhin aus Backend/Local je nach Mode.
