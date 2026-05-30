# Mini-Inspector Referenz (K2)

## Zweck

Dieses Dokument haelt den aktuellen K2-Mini-Inspector-Stand als Referenz fest.

K2 bleibt bis hier ein rein lesender Stand.

## Oeffentlicher Einstieg

- `scripts/mini-inspector-layout-read.cjs`
- vorbereiteter Einhaengepunkt: `mountMiniInspectorStatus(container, rootElement, options)`

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

## Repo-Bestandsaufnahme

Aktueller Befund im Repository:

- Es gibt eine sichtbare Demo unter `examples/mini-inspector/index.html`.
- Diese Demo ist eine eigenstaendige K1.0-Beispieloberflaeche zum Lesen, Anzeigen und Markieren vorhandener `data-ui-*` Metadaten.
- Es gibt aktuell keine separat angebundene produktive Mini-Inspector-UI, die bereits den K3.4-Statusadapter nutzt.
- Der fachneutral vorbereitete Integrationspunkt fuer eine spaetere Inspector-UI ist `mountMiniInspectorStatus(container, rootElement, options)` in `scripts/mini-inspector-layout-read.cjs`.
- Der fachneutral vorbereitete Container-Adapter darunter bleibt `renderMiniInspectorStatus(container, statusViewModel)`.

Damit ist der aktuelle Stand klar getrennt:

- sichtbare Demo vorhanden
- lesender Integrationspunkt vorhanden
- noch keine echte App- oder Ziel-UI-Anbindung im Repository umgesetzt

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

K3.0 bis K3.5 halten zusaetzlich fest, wie der sichtbare bzw. renderbare Status spaeter neutral an einen Inspector-Container angeschlossen werden soll, ohne Speichern, Layout-Anwendung oder Ziel-UI-Mutation hineinzumischen.
