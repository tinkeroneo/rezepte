# Changelog

## 2025-12-23
### Fixed
- Import: keine Namenskollision mehr (Domain-Funktion `importRecipesIntoApp` bleibt führend).
- LocalStorage: robust gegen kaputtes JSON und `setItem`-Fehler (Quota/Privacy).

### Added
- Global Error Banner (fängt `error` & `unhandledrejection` ab).
- Fetch-Timeouts/Abort für Backend-Aufrufe.
- Exklusive Locks gegen parallele Aktionen (z.B. Doppelklick beim Speichern).
- `/#selftest` Healthcheck-View.
- README aktualisiert (Coding-Standards + „Do not break these rules“).
- CLEANUP_DONE.md hinzugefügt (kurze Checkliste).

