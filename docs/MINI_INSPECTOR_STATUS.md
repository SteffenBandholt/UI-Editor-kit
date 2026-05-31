# Mini-Inspector Status

## Zweck

Dieses Dokument beschreibt den aktuellen, rein lesenden Status des Mini-Inspectors.

Der Mini-Inspector liefert einen neutralen Layoutdaten-Status auf Basis vorhandener `data-ui-*` Metadaten.

## Einstieg

- Datei: `scripts/mini-inspector-layout-read.cjs`
- Funktion: `createMiniInspectorLayoutStatus(rootElement, options)`
- Oeffentliche Alias-Namen:
  - `readMiniInspectorLayoutStatus(rootElement, options)`
  - `createMiniInspectorStatusViewModel(status)`

## Statusfelder (Rueckgabe)

Die Funktion liefert einen neutralen Status mit:

- `ok`
- `itemCount`
- `errorCount`
- `scope`
- `version`
- `errors`

Dieselben Kernfelder werden fuer die Browser-Demo unter `demo/mini-inspector/index.html` ebenfalls fachneutral verwendet und in K5.1 gegen die Node-Referenz abgesichert.

Die Statusanzeige ist sichtbar/renderbar vorbereitet ueber das View-Modell aus `formatMiniInspectorLayoutStatus(...)` bzw. `createMiniInspectorStatusViewModel(...)`.

Der DOM-/Markup-Adapter wird ueber `createMiniInspectorStatusMarkup(...)` und `renderMiniInspectorStatus(container, statusViewModel)` bereitgestellt.

Zweck des Adapters:

- neutrale Statusanzeige fuer einen Inspector-Container vorbereiten
- vorhandenes Status-/View-Modell renderbar machen

Erlaubte Eingaben:

- `statusViewModel` mit neutralen Statuszeilen
- ein uebergebener Inspector-Container fuer `renderMiniInspectorStatus(...)`

Erlaubte Ausgabe:

- neutrales Markup
- neutrale Statuszeilen
- neutrale Fehlerausgabe

Renderbare Felder:

- `ok` (gueltig/ungueltig)
- `itemCount`
- `errorCount`
- `scope`
- `version`
- `errors` (falls vorhanden)

## Quelle der Daten

Die Statusdaten stammen aus `data-ui-*` Metadaten und werden ueber die zentrale Layoutdaten-API verarbeitet:

- `scripts/layout-data-api.cjs`

## Grenzen

- kein Speichern
- keine Layout-Anwendung
- kein Drag & Drop
- nur Inspector-Container aktualisieren
- keine Ziel-UI-Mutation
- keine DOM-Mutation
- keine Fachlogik

## Verweise

- `docs/LAYOUTDATEN_KERN_REFERENZ.md`
- `docs/LAYOUTDATEN_API.md`
