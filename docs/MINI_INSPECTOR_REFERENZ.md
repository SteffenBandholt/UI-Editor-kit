# Mini-Inspector Referenz (K2)

## Zweck

Dieses Dokument haelt den aktuellen K2-Mini-Inspector-Stand als Referenz fest.

K2 bleibt bis hier ein rein lesender Stand.

## Oeffentlicher Einstieg

- `scripts/mini-inspector-layout-read.cjs`

## Verhaeltnis zum Layoutdaten-Kern

Der Mini-Inspector-Einstieg nutzt den Layoutdaten-Kern ueber:

- `scripts/layout-data-api.cjs`

## Status- und View-Modell

Der Mini-Inspector stellt neutral bereit:

- `ok`
- `itemCount`
- `errorCount`
- `scope`
- `version`
- `errors`

## Grenzen

- kein Speichern
- keine Layout-Anwendung
- kein Drag & Drop
- keine Ziel-UI-Mutation
- keine Fachlogik

## Befehle

- Testbefehl: `npm test`
- Diagnosebefehl: `npm run layout:diagnose`

## Referenzstand-Aussage

K2.0 bis K2.4 bilden den lesenden Mini-Inspector-Referenzstand.
