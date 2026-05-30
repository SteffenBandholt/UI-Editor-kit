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

## Quelle der Daten

Die Statusdaten stammen aus `data-ui-*` Metadaten und werden ueber die zentrale Layoutdaten-API verarbeitet:

- `scripts/layout-data-api.cjs`

## Grenzen

- kein Speichern
- keine Layout-Anwendung
- keine DOM-Mutation
- keine Fachlogik

## Verweise

- `docs/LAYOUTDATEN_KERN_REFERENZ.md`
- `docs/LAYOUTDATEN_API.md`
