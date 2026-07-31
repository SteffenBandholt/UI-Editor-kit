# M82.7.3 – `textResize`-Istwert im Editor

Status: `[A]`

Der gemeinsame Editor behandelt den vom Host zurückgelesenen Schriftwert als alleinige Quelle für Anzeige und Folgeoperationen. Der verschachtelte Hostzustand bleibt beim Aktualisieren des Layout-State erhalten. Zielwechsel, Undo und Reset ersetzen den bisherigen Sitzungswert durch den jeweils bestätigten Host-Istwert.

`Kleiner`, `Größer` und die direkte DIP-Eingabe sind nur aktiv, wenn ein endlicher positiver Istwert vorliegt. Ohne Istwert erreicht kein `textResize`-Request den Host; Dirty, Undo und Save bleiben unverändert. Der Weg ist capability-gesteuert und enthält keine BBM-Elementkennung.

Die isolierte sichtbare BBM-Abnahme bestätigte reale Istwerte für Restzeichen Kurz- und Langtext, normale Bezeichnung und Feld sowie Kleiner, Größer, direkte Eingabe, Undo, Reset, Bewegung, Sichtbarkeit, Save und Neustart-Restore. Der gespeicherte Kurztextwert `7,667 DIP` wurde nach vollständigem Neustart erneut als Host-Istwert angezeigt.

Automatisiert grün:

- M82.7.3: 10/10
- M82.7.2-Regression: 8/8
- capability-gesteuerter Einfachmodus: 22/22
- `dotnet build UIEditorKit.slnx`: 0 Fehler, 0 Warnungen
- Manager-Tests: 103/103
- Reference-App-Tests: 106/106
- `npm test`: vollständig grün

Es wurden keine Ziel-App-Registry, Fachlogik, Topologie, Scrollstruktur oder PDF-Funktion geändert.
