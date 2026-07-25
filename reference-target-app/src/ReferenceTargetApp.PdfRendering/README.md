# Lokale PDF-Erzeugung M76

Dieses Projekt ist die einzige technische Rendering-Schicht. Es übersetzt das neutrale Modell aus `EditorIntegration/Pdf` in PDF-Zeichenoperationen und liest dafür die unveränderten Fachmodelle. Es schreibt keine Werte in Registry, LayoutState, Profil oder Fachmodell zurück.

Verwendet wird PDFsharp 6.2.4 mit explizit festgelegter Paketversion. PDFsharp ist lokal nutzbar, aktiv gepflegt und MIT-lizenziert. Die Abhängigkeit wird ausschließlich von diesem Projekt referenziert; Domain und neutrale PDF-Verträge bleiben bibliotheksfrei. Es gibt keine zweite Engine, keinen Browser, kein HTML, keinen Server und keinen externen Dienst.

Die Ausgabe zeichnet ein A4-Auftragsdokument mit Vektorlogo, Firmendaten, Kunde, Dokumentnummer/-datum, sechs Tabellenspalten, deutschen Eurobeträgen, Summen, Footer und Seitenzahlen. Header, Tabellenkopf und Footer werden auf jeder Seite wiederholt. Zeilen bleiben ungeteilt. Der Summenblock folgt der letzten Position und wechselt vollständig auf eine Folgeseite, falls der Restplatz nicht reicht.

Textumbruch ist zentral und deterministisch: Arial, Millimeter-Schriftgröße, Zeichenbreitenfaktor 0,52, Zeilenhöhenfaktor 1,2, wortweiser Umbruch und kontrolliertes Teilen überlanger Einzelwörter. Ist Arial nicht lokal auflösbar, entsteht strukturiert `pdf_render_failed` statt eines geometrisch abweichenden stillen Fallbacks. Eine einzelne Zeile, die höher als ein leerer Body wäre, führt ebenfalls zu `pdf_render_failed` statt zu Überlappung.

Die PDF entsteht zunächst vollständig im Speicher und wird dort erneut mit PDFsharp geöffnet. Erst danach wird sie über eine `.tmp`-Datei im Zielordner mit Write-through/Flush und Replace beziehungsweise Move ausgegeben. Fehler vor dem Ersetzen bewahren eine vorhandene gültige Datei. `PdfTechnicalInspector` prüft Signatur, plausible Größe, erneutes Öffnen, Seitenzahl und A4-Dimensionen.

Der reale Nachweis lautet:

```powershell
ReferenceTargetApp.exe --pdf-model-diagnostic
```

Er erzeugt Baseline-, geänderte und geladene Mehrseiten-PDFs, prüft registrierte Geometrien, Persistenz, Discard, Reset, Load, Rollback, unveränderte Fachdaten und reproduzierbare Seitenzahl. Danach entfernt er PDFs, Profil, temporäre Dateien und Diagnoseordner. Ein Normalstart erzeugt keine PDF und startet weiterhin keinen Node-Prozess.

## Render-Geometrie für M77

Jeder erfolgreiche Renderlauf liefert additiv `PdfRenderBound` für alle 26 registrierten Elemente auf jeder tatsächlich erzeugten Seite: `elementId`, `pageNumber`, neutrale Millimeter-Bounds, `stableOrder` und `editable`. Die Zuordnung wird aus demselben aufgelösten Layout und denselben effektiven Flowpositionen wie die PDF-Zeichenoperationen gebildet; sie enthält weder PDFsharp-Objekte noch Fachdaten. Die sichtbare Vorschau liest anschließend genau die atomar ersetzte Ausgabedatei. Bestehende M76-Traces und deren Semantik bleiben erhalten.
