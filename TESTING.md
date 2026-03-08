# Testing

## Share

- Rezept in der Detailansicht öffnen
- `🔗` klicken
- Link in neuem privaten Tab öffnen
- Erwartung: Titel, Bild, Zutaten und Schritte sind sichtbar
- Auf der Share-Seite `🖨️` klicken
- Erwartung: Browser-Printdialog öffnet sich sauber

## PDF normal

- Listenansicht öffnen
- Export starten
- Ein normales Rezept auswählen
- Format `PDF` lassen
- Erwartung: neues Fenster oder Tab öffnet, Inhalt ist vollständig, Drucken ist möglich

## PDF Menü / Parts

- Ein Menü- oder Parent-Rezept mit Parts auswählen
- PDF exportieren
- Erwartung: Zutaten und Schritte der Teilrezepte erscheinen strukturiert

## Regression

- Detailansicht eines Rezepts öffnen
- Share-Link erneut erzeugen
- Erwartung: kein Fehlerbanner
- Account-, Diagnostics- und Shopping-Seite kurz öffnen
- Erwartung: Rendern bleibt normal
