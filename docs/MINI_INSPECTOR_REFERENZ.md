# Mini-Inspector Referenz (K2/K3)

## Zweck

Dieses Dokument haelt den aktuellen Mini-Inspector-Referenzstand aus K2 und K3 fest.

K2 und K3 bleiben bis hier ein rein lesender Stand.

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

Der Mini-Inspector kann damit aktuell:

- Layoutdaten rein lesend auswerten
- einen neutralen Status erzeugen
- ein neutrales Status-/View-Modell vorbereiten
- neutrales Markup fuer einen Inspector-Container erzeugen
- den Status ausschliesslich in einen uebergebenen Inspector-Container rendern

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
- keine Bearbeitung von Layoutdaten
- kein Drag & Drop
- keine Ziel-UI-Mutation
- keine Fachlogik

## Befehle

- Testbefehl: `npm test`
- Diagnosebefehl: `npm run layout:diagnose`

## Referenzstand-Aussage

K2.0 bis K2.4 bilden den lesenden Mini-Inspector-Referenzstand.

K3.0 bis K3.5 halten zusaetzlich fest, wie der sichtbare bzw. renderbare Status spaeter neutral an einen Inspector-Container angeschlossen werden soll, ohne Speichern, Layout-Anwendung oder Ziel-UI-Mutation hineinzumischen.

K3.0 bis K3.5 bilden damit den aktuellen Mini-Inspector-Referenzstand.

## Naechster sinnvoller Schritt

Nach K3 ist als naechster Schritt fachneutral sinnvoll:

- entweder eine echte Mini-Inspector-UI-Schale vorbereiten
- oder eine Host-/Demo-Integration vorbereiten

Auch dieser naechste Schritt bleibt ohne Speichern und ohne Layout-Anwendung.
