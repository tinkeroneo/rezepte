# 🥗 Tinkeroneo – Rezepte & Kochen

Kleine private Rezept-Web-App in Vanilla JS, optimiert für Kochen am Handy oder Tablet.
Optional mit Supabase-Backend, sonst rein lokal über `localStorage`.

---

## ✨ Features

- Rezeptliste mit Suche
- Detail- und Kochansicht
- Globale Timer
- Einkaufsliste aus Rezepten
- Import und Export als JSON
- Optionales Supabase-Backend
- LocalStorage-Fallback
- PDF-Export
- Selftest und Diagnostics
- Öffentliche Share-Links für Rezepte
- Space-/Invite-Unterstützung im Backend-Modus

---

## 🧱 Architektur

```text
src/
├─ app.js              // side-effect-freie Re-Exports
├─ entry.js            // echter Browser-Entrypoint
├─ state.js            // Hash-Routing
├─ views/              // UI-Rendering
├─ domain/             // Fachlogik
├─ services/           // technische Helfer
├─ storage.js          // robuster LocalStorage-Wrapper
└─ supabase.js         // optionales Backend
```

Prinzip:

- `views` = Darstellung
- `domain` = Fachlogik
- `services` = technische Helfer
- `app.main.js` orchestriert, Fachlogik bleibt außerhalb

---

## ☁️ Backend vs. Local Mode

Die App unterstützt zwei Betriebsarten:

- Backend-Modus: Laden/Speichern über Supabase
- Local-Modus: Alles lokal im Browser

Die Umschaltung läuft über die App-Einstellungen und das Wiring in `src/app/app.main.js`.

---

## 📦 Import

Der Import ist zentral in `src/domain/import.js` implementiert.

Wichtige Modi:

| Modus | Verhalten |
| --- | --- |
| `backendWins` | Backend bleibt führend; neue Rezepte werden angelegt |
| `jsonWins` | Import überschreibt bestehende Rezepte |
| `mergePreferBackend` | Merge mit Vorrang für Backend-Daten |
| `mergePreferJson` | Merge mit Vorrang für JSON-Daten |

---

## 🧪 Selftest

Für schnellen Gesundheitscheck:

- `/#selftest`
- `/#diagnostics`

Geprüft werden u. a.:

- LocalStorage read/write
- Backend-Erreichbarkeit
- geladene Basisfunktionen

---

## 🧪 Smoke-Tests

**Import**

1. JSON mit neuem Rezept importieren
2. Rezept erscheint in der Liste
3. Browser neu laden
4. Rezept bleibt vorhanden
5. Import erneut ausführen und auf Duplikate prüfen

**Timer**

- Timer starten
- View wechseln
- Timer bleibt sichtbar
- Timer nach Ablauf verlängern

**Shopping**

- Items abhaken
- erledigte Einträge ein-/ausklappen
- neu laden und Persistenz prüfen

---

## 🛡️ Stabilität

- globaler Error-Handler in `src/services/errors.js`
- Fetch-Timeouts via `AbortController`
- Locking gegen parallele Aktionen
- robuster Umgang mit kaputtem oder vollem `localStorage`
- Offline-App-Shell über `sw.js`

---

## 🧹 Do not break these rules

1. Keine Fachlogik in `app.js`
2. Import-Logik nur in `src/domain/import.js`
3. Persistenz nur über `src/domain/recipeRepo.js`
4. Async-Fehler nicht still schlucken

Wenn du unsicher bist: lieber in `domain/` kapseln als schnell in die App-Orchestrierung patchen.

---

## ✅ Cleanup

Siehe `CLEANUP_DONE.md` für Checkliste und Stand.

---

## ⚠️ Nicht-Ziele

- kein Benutzer-/Rechtemanagement außerhalb des vorhandenen Space-Modells
- kein Sync-Konflikt-Resolver
- kein Framework-Migrationsprojekt

---

## 📴 Offline

Es gibt einen minimalen Service Worker in `sw.js`, der die App-Shell cached.
Dadurch kann die UI auch ohne Netz starten.

Hinweis: Rezeptdaten kommen weiterhin aus Backend oder Local-Modus, je nach Einstellung.

---

## 🧰 Entwicklung

```bash
npm i
npm run format
npm run lint
```

Vorhandene kleine Tests:

```bash
npm run test:list
npm run test:list2
```

---

## Lizenz

Private Nutzung.
