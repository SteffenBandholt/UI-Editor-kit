# M76 PDF-Entwurfsentscheidung

## Geltung und Grenzen

- Art der Ausgabe: PDF.
- Editorfaehig: technisch ja; in M76 ausschliesslich programmgesteuert, ohne sichtbare Editoroberflaeche.
- Dokumenttyp: `order-document`.
- Registry-Scope: `pdf.order-document`.
- Layoutprofil: `pdf-standard`.
- Fachaktionen: keine. PDF-Erzeugung liest deterministische Beispieldaten, veraendert sie aber nicht.
- Nicht editorfaehig: PDF-Vorschau, PDF-Import, OCR, Signatur, PDF/A, ZUGFeRD, Druck, Versand und freie Vorlagenverwaltung.

## Architekturentscheidung

Neutrale PDF-Vertraege, Registry, Validatoren, Fingerprint, LayoutState, PDF-HostAdapter und PDF-Profilpersistenz liegen in `ReferenceTargetApp.EditorIntegration/Pdf`. Sie enthalten keine Objekte einer PDF-Bibliothek. Die technische Rendering-Schicht liegt in `ReferenceTargetApp.PdfRendering` und kapselt als einzige Schicht PDFsharp 6.2.4. Domain bleibt ohne Editor-, JSON-, Datei-, Prozess- oder PDF-Abhaengigkeit.

PDFsharp 6.2.4 wird als einzige PDF-Engine mit fester Paketversion verwendet. Das Paket unterstuetzt .NET 10 und steht unter der MIT-Lizenz. PDF-Erzeugung erfolgt lokal und ohne Browser, Server, Netzwerk oder Cloud.

## Masse, Koordinaten und Seitenzonen

- Neutrale Einheit: Millimeter.
- Ursprung: linke obere Seitenecke.
- Positive X-Richtung: rechts; positive Y-Richtung: unten.
- Zentrale Umrechnung: `pt = mm * 72 / 25.4`.
- Seitenformat: A4 Hochformat, 210 x 297 mm.
- Raender: links, oben, rechts und unten jeweils 15 mm.
- Header: x 15, y 15, Breite 180, Hoehe 45 mm.
- Body: x 15, y 65, Breite 180, Hoehe 187 mm.
- Footer: x 15, y 262, Breite 180, Hoehe 20 mm.

Elemente duerfen ihre zugewiesene Zone und die A4-Seite nicht verlassen. Es gibt keine Bildschirm-Pixel, WPF-DIP- oder DPI-Abhaengigkeit.

## Vollstaendige Registry-Klassifizierung

Alle Eintraege sind sichtbar. `editable` ist nur bei mindestens einer erlaubten Layoutoperation wahr. `inspect` ist fuer alle Eintraege erlaubt und wird nicht als Layoutfaehigkeit gespeichert. Nicht genannte Layoutoperationen sind gesperrt.

| ID | Name | Typ | Rolle | Parent | Bereich | Reihenfolge | editable | erlaubte Layoutoperationen | gesperrte Layoutoperationen |
|---|---|---|---|---|---|---:|---:|---|---|
| `pdf.order-document` | Auftragsdokument | document | layout | - | document | 0 | nein | - | move, resizeWidth, resizeHeight, textMove, textResize |
| `pdf.order-document.page-template` | A4-Seitentemplate | page | layout | `pdf.order-document` | document | 10 | nein | - | move, resizeWidth, resizeHeight, textMove, textResize |
| `pdf.order-document.header` | Kopfbereich | header | layout | `pdf.order-document.page-template` | header | 20 | ja | resizeHeight | move, resizeWidth, textMove, textResize |
| `pdf.order-document.header.identity` | Absendergruppe | group | layout | `pdf.order-document.header` | header | 30 | ja | move, resizeWidth, resizeHeight | textMove, textResize |
| `pdf.order-document.header.logo` | Firmenlogo | image | content | `pdf.order-document.header.identity` | header | 40 | ja | move, resizeWidth, resizeHeight | textMove, textResize |
| `pdf.order-document.header.sender` | Absender und Firmendaten | text | content | `pdf.order-document.header.identity` | header | 50 | ja | move, resizeWidth, resizeHeight, textMove, textResize | - |
| `pdf.order-document.header.title` | Dokumenttitel | text | content | `pdf.order-document.header` | header | 60 | ja | move, resizeWidth, resizeHeight, textMove, textResize | - |
| `pdf.order-document.header.number` | Dokumentnummer | text | meta | `pdf.order-document.header` | header | 70 | ja | move, resizeWidth, resizeHeight, textMove, textResize | - |
| `pdf.order-document.header.date` | Dokumentdatum | text | date | `pdf.order-document.header` | header | 80 | ja | move, resizeWidth, resizeHeight, textMove, textResize | - |
| `pdf.order-document.header.customer` | Kundendatenblock | group | content | `pdf.order-document.header` | header | 90 | ja | move, resizeWidth, resizeHeight | textMove, textResize |
| `pdf.order-document.header.customer.address` | Kundenanschrift | text | content | `pdf.order-document.header.customer` | header | 100 | ja | move, resizeWidth, resizeHeight, textMove, textResize | - |
| `pdf.order-document.body` | Inhaltsbereich | area | layout | `pdf.order-document.page-template` | body | 110 | nein | - | move, resizeWidth, resizeHeight, textMove, textResize |
| `pdf.order-document.body.positions` | Positionstabelle | table | content | `pdf.order-document.body` | body | 120 | ja | move, resizeWidth | resizeHeight, textMove, textResize |
| `pdf.order-document.body.positions.column.position` | Positionsnummer | tableColumn | structure | `pdf.order-document.body.positions` | body | 130 | ja | resizeWidth | move, resizeHeight, textMove, textResize |
| `pdf.order-document.body.positions.column.description` | Beschreibung | tableColumn | content | `pdf.order-document.body.positions` | body | 140 | ja | resizeWidth | move, resizeHeight, textMove, textResize |
| `pdf.order-document.body.positions.column.quantity` | Menge | tableColumn | meta | `pdf.order-document.body.positions` | body | 150 | ja | resizeWidth | move, resizeHeight, textMove, textResize |
| `pdf.order-document.body.positions.column.unit` | Einheit | tableColumn | meta | `pdf.order-document.body.positions` | body | 160 | ja | resizeWidth | move, resizeHeight, textMove, textResize |
| `pdf.order-document.body.positions.column.unit-price` | Einzelpreis | tableColumn | content | `pdf.order-document.body.positions` | body | 170 | ja | resizeWidth | move, resizeHeight, textMove, textResize |
| `pdf.order-document.body.positions.column.total-price` | Gesamtpreis | tableColumn | content | `pdf.order-document.body.positions` | body | 180 | ja | resizeWidth | move, resizeHeight, textMove, textResize |
| `pdf.order-document.body.summary` | Summenbereich | group | content | `pdf.order-document.body` | body | 190 | ja | move, resizeWidth, resizeHeight | textMove, textResize |
| `pdf.order-document.body.summary.subtotal` | Zwischensumme | text | content | `pdf.order-document.body.summary` | body | 200 | ja | move, resizeWidth, resizeHeight, textMove, textResize | - |
| `pdf.order-document.body.summary.tax` | Steuer | text | content | `pdf.order-document.body.summary` | body | 210 | ja | move, resizeWidth, resizeHeight, textMove, textResize | - |
| `pdf.order-document.body.summary.total` | Gesamtsumme | text | content | `pdf.order-document.body.summary` | body | 220 | ja | move, resizeWidth, resizeHeight, textMove, textResize | - |
| `pdf.order-document.footer` | Fussbereich | footer | layout | `pdf.order-document.page-template` | footer | 230 | ja | resizeHeight | move, resizeWidth, textMove, textResize |
| `pdf.order-document.footer.contact` | Firmen- und Kontaktzeile | text | content | `pdf.order-document.footer` | footer | 240 | ja | move, resizeWidth, resizeHeight, textMove, textResize | - |
| `pdf.order-document.footer.page-number` | Seitenzahl | text | meta | `pdf.order-document.footer` | footer | 250 | ja | move, resizeWidth, resizeHeight, textMove, textResize | - |

Die sechs Tabellenspalten besitzen die Rollen `structureColumn`, `contentColumn`, `metaColumn`, `metaColumn`, `contentColumn` und `contentColumn`. Es gibt keine editorfaehigen Buttons oder Eingabefelder im PDF.

## Capability-Matrix

| Elementart | Position | Breite | Hoehe | Textposition | Schriftgroesse |
|---|---:|---:|---:|---:|---:|
| document, page, area | nein | nein | nein | nein | nein |
| header, footer | nein | nein | ja | nein | nein |
| group | ja | ja | ja | nein | nein |
| text | ja | ja | ja | ja | ja |
| image | ja | ja | ja | nein | nein |
| table | ja | ja | nein | nein | nein |
| tableColumn | nein | ja | nein | nein | nein |

## Tabellen-, Text- und Umbruchregeln

- Tabellenbreite ist fest im LayoutState. Jede Spaltenbreite ist positiv und begrenzt.
- Die Summe der Spaltenbreiten darf die Tabellenbreite nicht ueberschreiten. Kleinere Summen lassen einen expliziten freien Rest; es erfolgt keine automatische Umverteilung.
- Text verwendet die zentral festgelegte Windows-Schrift Arial, einen deterministischen Breitenfaktor von 0,52 und Zeilenhoehe 1,2 mal Schriftgroesse. Ist Arial nicht aufloesbar, wird die Erzeugung strukturiert als `pdf_render_failed` abgewiesen; es gibt keinen geometrisch abweichenden stillen Fallback.
- Umbruch erfolgt an Wortgrenzen; ein zu langes Einzelwort wird deterministisch in passende Segmente geteilt.
- Tabellenkopf und Header/Footer werden auf jeder Seite wiederholt.
- Eine Tabellenzeile wird nicht geteilt. Passt eine Zeile nicht in einen leeren Body, wird die Erzeugung strukturiert abgewiesen.
- Der Summenblock folgt nach der letzten Position und wechselt vollstaendig auf eine neue Seite, wenn der Restbereich nicht reicht.
- Gleiche Layout- und Fachdaten ergeben dieselbe Seitenzahl und Geometrie.

## Persistenz- und Diagnoseentscheidung

Das PDF-Profil ist ein eigenes JSON-Dokument `pdf-layout-profile`, Schema 1, mit `applicationId`, `documentType`, `profileId`, `scopeId`, `savedAt`, PDF-Registry-Fingerprint und ausschliesslich neutralem PDF-LayoutState. Produktionspfad ist der eigene Unterordner `pdf-layouts`; UI-Profildateien werden weder gelesen noch geschrieben.

BASELINE ist das registrierte Ausgangslayout, SAVED die letzte erfolgreich gespeicherte oder geladene Version und WORKING der Zustand im PDF-HostAdapter. Discard wendet SAVED an, Reset BASELINE. Load, Discard, Reset und technische Batches sichern den gesamten Zustand und rollen bei Fehler vollstaendig zurueck.

`--pdf-model-diagnostic` verwendet einen isolierten Ordner unter `%LOCALAPPDATA%/UI-Editor-kit/ReferenceTargetApp/diagnostics/pdf`, erzeugt reale PDFs, oeffnet sie technisch erneut, prueft Mehrseitigkeit und A4, fuehrt Layout-, Persistenz- und Rollbackoperationen aus und entfernt am Ende PDF-, JSON- und temporaere Dateien.

## Vertragspruefung

Die PDF-Registry wird durch einen eigenen PDF-Registry-Validator geprueft. Der vorhandene UI-Vertragscheck und alle M69- bis M75-Tests bleiben unveraendert zusaetzlich verbindlich.
