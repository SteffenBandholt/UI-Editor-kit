# Host-App Integration

## Zweck

Dieses Dokument beschreibt den fachneutralen Integrationsvertrag fuer eine spaetere Host-App.

Der Vertrag beschreibt:

- was die Host-App bereitstellen muss
- welche Metadaten der Editor lesen darf
- welche Container getrennt bleiben muessen
- welche oeffentlichen Einstiege aktuell gelten
- welche Grenzen weiterhin gelten

## Pflichten der Host-App

Eine Host-App stellt bereit:

- eine normale Ziel-UI
- neutrale `data-ui-*` Metadaten an lesbaren Elementen
- einen getrennten Inspector-Container
- optional die Einbindung von `styles/neutral-theme-tokens.css`
- einen Aufrufpunkt fuer den Mini-Inspector

Die Ziel-UI bleibt dabei Eigentum der Host-App.

## Relevante Metadaten

Die bestehenden Beispiele nutzen aktuell fachneutral:

- `data-ui-inspector-id`
- `data-ui-editor-editable`
- `data-ui-editor-ops`
- `data-ui-layout-order`

In den vorhandenen Demos gibt es zusaetzlich layoutbezogene Demo-Attribute, die nur beschrieben und nicht erweitert werden:

- `data-ui-layout-width`
- `data-demo-invalid-width`

Der Editor darf nur diese vorhandenen Metadaten lesen, soweit sie fuer den lesenden Status relevant sind.

## Getrennte Bereiche

Die Trennung zwischen Host-App und Editor bleibt strikt:

- Ziel-UI gehoert der Host-App.
- Inspector-Container gehoert dem Editor oder Inspector.
- Der Editor liest Ziel-UI-Metadaten.
- Der Editor rendert Status nur in den Inspector-Container.
- Der Editor darf keine Ziel-UI veraendern.

## Oeffentliche Einstiege

Aktuell relevante oeffentliche Einstiege sind:

- `scripts/layout-data-api.cjs`
- `scripts/mini-inspector-layout-read.cjs`
- `scripts/mini-inspector-demo-host.cjs`
- `browser/mini-inspector-host-adapter.js`
- `demo/mini-inspector/index.html`
- `styles/neutral-theme-tokens.css`

Rollen dieser Einstiege:

- `scripts/layout-data-api.cjs`: oeffentlicher Einstieg fuer Layoutdaten-Extractor, Validator und Diagnose
- `scripts/mini-inspector-layout-read.cjs`: lesender Mini-Inspector-Einstieg fuer Status, View-Modell und Inspector-Rendering
- `scripts/mini-inspector-demo-host.cjs`: fachneutrale Demo-/Host-Schale mit getrenntem Root- und Inspector-Container
- `browser/mini-inspector-host-adapter.js`: wiederverwendbarer Browser-Host-Adapter fuer getrennte Ziel-UI und getrennten Inspector-Container
- `demo/mini-inspector/index.html`: sichtbare Browser-Referenz fuer getrennte Ziel-UI und getrennten Inspector-Bereich
- `styles/neutral-theme-tokens.css`: optionale visuelle Referenz fuer fachneutrale Oberflaechen


## Browser-Host-Adapter

Der wiederverwendbare Browser-Host-Adapter liegt unter `browser/mini-inspector-host-adapter.js` und stellt ueber `window.miniInspectorHostAdapter` diese neutralen Einstiege bereit:

- `createMiniInspectorHostStatus(rootElement, options)`
- `renderMiniInspectorHostStatus(inspectorContainer, status)`
- `updateMiniInspectorHostAdapter(rootElement, inspectorContainer, options)`

Eine Host-App uebergibt ein Ziel-UI-Root-Element und einen davon getrennten Inspector-Container. Der Adapter liest ausschliesslich neutrale `data-ui-*` Metadaten aus dem Ziel-Root, erzeugt daraus einen neutralen Status und aktualisiert nur den uebergebenen Inspector-Container.

Fuer den Adapter gilt weiterhin:

- rein lesend gegenueber der Ziel-UI
- keine Speicherung
- keine Layout-Anwendung
- keine Ziel-UI-Mutation
- keine Fachlogik

K8.1 dokumentiert diesen Browser-Host-Adapter als Referenzstand und bestaetigt den bestandenen Sichttest nach K8.0.

## Minimaler Integrationsablauf

Eine Host-App bindet den aktuellen Stand fachneutral so ein:

1. Die Host-App rendert ihre normale Ziel-UI.
2. Lesbare Elemente tragen neutrale `data-ui-*` Metadaten.
3. Die Host-App stellt einen getrennten Inspector-Container bereit.
4. Der Mini-Inspector liest die Ziel-UI ueber den oeffentlichen Einstieg.
5. Der Status wird ausschliesslich in den Inspector-Container gerendert.

## Neutrales Beispiel

Ein kleines neutrales Host-App-Beispiel liegt unter `examples/host-app-basic/index.html`.

Info-Befehl:

- `npm run host-app:basic`

Zweck des Beispiels:

- zeigt eine eigene neutrale Ziel-UI
- zeigt einen getrennten Inspector-Container
- laedt den Browser-Host-Adapter
- uebergibt `rootElement` und `inspectorContainer`
- laesst den Adapter nur den Inspector-Container aktualisieren
- bleibt rein lesend

Grenzen des Beispiels:

- keine Speicherung
- keine Layout-Anwendung
- keine Ziel-UI-Mutation
- keine Fachlogik

K9.1 dokumentiert dieses Beispiel als bestaetigten Referenzstand nach bestandenem manuellen Sichttest.

## Grenzen

Weiterhin gilt ausdruecklich:

- kein Speichern
- keine Layout-Anwendung
- kein Drag & Drop
- keine Bearbeitung von Layoutdaten
- keine Ziel-UI-Mutation
- keine Fachlogik
- keine Fachdaten

Der Editor liest nur vorhandene Metadaten und setzt keine Fachdaten voraus.

K7.1 sichert diesen Vertrag zusaetzlich per Smoke-Test ueber `scripts/tests/host-app-integration-contract.test.cjs` ab.

## Verweise

- `docs/LAYOUTDATEN_API.md`
- `docs/MINI_INSPECTOR_STATUS.md`
- `docs/MINI_INSPECTOR_REFERENZ.md`
- `docs/NEUTRAL_THEME_TOKENS.md`
