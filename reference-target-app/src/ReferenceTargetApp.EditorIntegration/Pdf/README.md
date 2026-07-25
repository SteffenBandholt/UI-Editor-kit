# Neutrales PDF-Layoutmodell M76

Dieser Bereich enthält ausschließlich ziel-app-eigene, bibliotheksneutrale PDF-Verträge: Dokument-, Seiten-, Bereichs- und Elementdefinitionen, Registry, Validatoren, Fingerprint, LayoutState, `PdfHostAdapter`, Profilpersistenz und Zustands-/Batchkoordination. Keine öffentliche Property referenziert PDFsharp, WPF oder Fachmodelle.

## Seite und Koordinaten

- Einheit: Millimeter; Ursprung links oben, X nach rechts, Y nach unten.
- Format: A4 Hochformat, 210 × 297 mm, unabhängig von DPI und Fenstergröße.
- Inhaltsrand: 15 mm; Header 15/15/180/45, Body 15/65/180/187, Footer 15/262/180/20 mm.
- Alle Werte müssen endlich sein. Breiten, Höhen und Schriftgrößen sind positiv. Elemente bleiben innerhalb ihrer registrierten Seitenzone.
- Die einzige Umrechnung in PDF-Punkte liegt in `ReferenceTargetApp.PdfRendering` (`mm × 72 / 25,4`).

## Registry und Capabilities

Der feste Scope `pdf.order-document` besitzt 26 eindeutige Einträge mit Parent-/Kind-Struktur: Dokument, Seitentemplate, Bereiche, Gruppen, Texte, Logo, Positionstabelle, sechs Spalten, Summen und Footer. IDs beginnen ausschließlich mit `pdf.`.

| Art | Änderbare Werte |
| --- | --- |
| document, page, area | keine |
| header, footer | kontrollierte Höhe |
| group, image | Position, Breite, Höhe |
| text | Position, Breite, Höhe, Textoffset, Schriftgröße |
| table | Position, Breite |
| tableColumn | Breite |

Die neutralen Operationsnamen bleiben `move`, `resize`, `resizeWidth`, `resizeHeight`, `textMove` und `textResize`. Nicht freigegebene Operationen sind je Element explizit gesperrt. Spalten sind mindestens 5 mm breit; ihre Summe darf die Tabellenbreite nicht überschreiten. Es gibt keine verdeckte Umverteilung.

`PdfRegistryFingerprint` bildet SHA-256 aus ID, Scope, Parent, Art, Rolle, Capability, Seitenzone und stabiler Reihenfolge. Fachdaten, Texte, Zeitstempel, Baseline-/Working-Werte und Bibliotheksobjekte sind ausgeschlossen.

## HostAdapter und Zustände

`PdfHostAdapter` ist vom `WpfHostAdapter` getrennt. Er löst nur registrierte IDs auf, prüft Scope, Capability, Payload und Geometrie und ändert ausschließlich sein neutrales Layoutmodell. Fach- und Dateifelder werden abgewiesen. Die Registry sowie Fachdaten werden nie verändert.

`PdfLayoutSession` hält `BASELINE`, `SAVED` und `WORKING` getrennt. Ein erfolgreicher Load wird vollständig als `LOADED` angewandt und anschließend zu `SAVED`. Discard stellt `SAVED`, Reset `BASELINE` wieder her. Vor jedem Batch wird der vollständige Working-State gesichert; beim ersten Fehler werden alle bereits ausgeführten Änderungen über denselben Adapter zurückgerollt. Batch- und Rollbackfehler bleiben getrennt strukturiert sichtbar.

## Profil

Das feste Profil `pdf-standard` verwendet den eigenen Dokumenttyp `pdf-layout-profile`, Schema 1, Scope `pdf.order-document`, eigenen Fingerprint und den Pfad:

```text
%LOCALAPPDATA%\UI-Editor-kit\ReferenceTargetApp\pdf-layouts\pdf-standard.pdf-layout.json
```

Save validiert vollständig und schreibt über eine eindeutige `.tmp`-Datei mit Write-through/Flush und anschließendem Replace beziehungsweise Move. Load liest jedes Mal neu vom Datenträger. UI-Profile und PDF-Profile besitzen andere Dateinamen und inkompatible Dokumentformen; gegenseitiges Laden wird abgewiesen. Im PDF-Profil stehen ausschließlich capability-gedeckte Layoutzahlen, niemals Kunden-, Auftrags-, Positions-, Preis- oder Dateidaten.

## Grenze zu M77

M76 ergänzt keine sichtbare PDF-Oberfläche, Seitenübersicht, Vorschau, Auswahl oder PDF-Bedienbuttons und erweitert das Node-Protokoll nicht. Diese sichtbaren Funktionen beginnen frühestens mit M77.
