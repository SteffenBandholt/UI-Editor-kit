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
- Demo-/Host-Befehl: `npm run mini-inspector:demo`
- Demo-/Host-Fehlerfall: `npm run mini-inspector:demo -- --invalid`
- Demo-/Host-JSON: `npm run mini-inspector:demo -- --json`
- Demo-/Host-Fehlerfall-JSON: `npm run mini-inspector:demo -- --invalid --json`
- Demo-/Host-Hilfe: `npm run mini-inspector:demo -- --help`

Mit `npm run mini-inspector:demo` wird die vorhandene Demo-/Host-Schale einmal neutral auf stdout ausgefuehrt.

Mit `npm run mini-inspector:demo -- --invalid` wird derselbe Ablauf mit bewusst ungueltigen, aber fachneutralen `data-ui-*` Metadaten ausgefuehrt. Der Lauf bleibt technisch erfolgreich, berichtet aber neutral `ok: false`.

Mit `npm run mini-inspector:demo -- --json` und `npm run mini-inspector:demo -- --invalid --json` wird dieselbe Demo-/Host-Schale neutral und maschinenlesbar fuer Automatisierung auf stdout ausgegeben.

Mit `npm run mini-inspector:demo -- --help` wird eine kurze fachneutrale CLI-Hilfe ausgegeben. Unbekannte Optionen werden kontrolliert mit neutraler Fehlermeldung und Exit-Code ungleich `0` abgewiesen.

Der Befehl zeigt nur:

- `ok`
- `status`
- `itemCount`
- `errorCount`
- `scope`
- `version`
- `errors` falls vorhanden
- optional den neutralen Inspector-Container-Inhalt

Grenzen des Befehls:

- keine Speicherung
- keine Layout-Anwendung
- keine Ziel-UI-Mutation
- keine Fachlogik


## K5.0 Browser-/HTML-Demo

Die fachneutrale Browser-/HTML-Demo liegt unter `demo/mini-inspector/index.html`.

Zweck der Demo:

- eine neutrale Beispiel-UI mit vorhandenen `data-ui-*` Metadaten sichtbar machen
- einen getrennten Mini-Inspector-Bereich anzeigen
- den Mini-Inspector-Status im Browser rein lesend erzeugen
- den Status ausschliesslich in den Inspector-Bereich rendern
- einen gueltigen und einen bewusst ungueltigen Beispielzustand neutral umschaltbar machen

Oeffnen:

- `demo/mini-inspector/index.html` direkt im Browser laden
- optional den Pfad ueber `npm run mini-inspector:demo:browser` ausgeben lassen

Die Node-Referenzlogik fuer die Demo-/Host-Schale bleibt weiterhin in `scripts/mini-inspector-demo-host.cjs`.
Da die Browser-Demo ohne Buildsystem und ohne neue Runtime-Abhaengigkeiten auskommt, nutzt sie eine kleine browserseitige Demo-Schicht fuer dasselbe fachneutrale Lesestatus-Verhalten.

Grenzen der Browser-/HTML-Demo:

- rein lesend
- kein Speichern
- kein `localStorage` oder `sessionStorage`
- keine Layout-Anwendung
- keine Ziel-UI-Mutation
- keine Bearbeitung von Layoutdaten
- keine Fachlogik
- nur der Inspector-Bereich wird aktualisiert

## Referenzstand-Aussage

K2.0 bis K2.4 bilden den lesenden Mini-Inspector-Referenzstand.

K3.0 bis K3.5 halten zusaetzlich fest, wie der sichtbare bzw. renderbare Status spaeter neutral an einen Inspector-Container angeschlossen werden soll, ohne Speichern, Layout-Anwendung oder Ziel-UI-Mutation hineinzumischen.

K3.0 bis K3.5 bilden damit den aktuellen Mini-Inspector-Referenzstand.

## Naechster sinnvoller Schritt

Nach K3 ist als naechster Schritt fachneutral sinnvoll:

- entweder eine echte Mini-Inspector-UI-Schale vorbereiten
- oder eine Host-/Demo-Integration vorbereiten

Auch dieser naechste Schritt bleibt ohne Speichern und ohne Layout-Anwendung.

## K4.0 Demo-/Host-Schale

Die fachneutrale Demo-/Host-Schale unter `scripts/mini-inspector-demo-host.cjs` verbindet den vorhandenen lesenden Mini-Inspector-Einstieg mit einer kleinen Mock-Zielstruktur und einem separaten Inspector-Container.

Oeffentliche Einstiege:

- `createMiniInspectorDemoHost(options)`: erzeugt Root-/Mock-Struktur und Inspector-Container oder nutzt uebergebene Objekte.
- `updateMiniInspectorDemoHost(host, options)`: liest den Mini-Inspector-Status und rendert ihn ausschliesslich in den Inspector-Container.
- `runMiniInspectorDemoHost(options)`: erzeugt einen Host und fuehrt einmalig die lesende Aktualisierung aus.

Die Demo-/Host-Schale zeigt nur:

- neutrale `data-ui-*` Metadaten in einer Beispielstruktur
- einen getrennten Inspector-Container
- lesendes Erzeugen des Mini-Inspector-Status
- neutrale Statusausgabe mit `ok`, `itemCount`, `errorCount`, `scope`, `version` und optionalen Fehlern

Grenzen:

- nur der Inspector-Container wird aktualisiert
- keine Speicherung
- keine Layout-Anwendung
- keine Ziel-UI-Mutation
- keine Fachlogik
- keine neuen Runtime-Abhaengigkeiten
