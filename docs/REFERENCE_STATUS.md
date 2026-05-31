# Reference Status

## Zweck

Dieses Dokument beschreibt den neutralen Gesamt-Referenzstand nach K10.0.

Der Stand bleibt fachneutral und rein lesend.

## Was aktuell vorhanden ist

- Layoutdaten-Kern vorhanden
- Mini-Inspector vorhanden
- Browser-Demo vorhanden
- neutrale Theme-Tokens vorhanden
- Host-App-Integrationsvertrag vorhanden
- Browser-Host-Adapter vorhanden
- neutrales Host-App-Beispiel vorhanden
- Host-App-Adoptionsleitfaden vorhanden

## Oeffentliche Einstiege

- `scripts/layout-data-api.cjs`
- `scripts/mini-inspector-layout-read.cjs`
- `scripts/mini-inspector-demo-host.cjs`
- `browser/mini-inspector-host-adapter.js`
- `styles/neutral-theme-tokens.css`
- `demo/mini-inspector/index.html`
- `examples/host-app-basic/index.html`

## Demos und Beispiele

- Browser-Demo: `demo/mini-inspector/index.html`
- neutrales Host-App-Beispiel: `examples/host-app-basic/index.html`
- Host-App-Adoptionsleitfaden: `docs/HOST_APP_ADOPTION_GUIDE.md`

## Npm-Befehle

- `npm test`
- `npm run layout:diagnose`
- `npm run mini-inspector:demo`
- `npm run mini-inspector:demo:browser`
- `npm run host-app:basic`

## Grenzen

- rein lesend
- kein Speichern
- kein localStorage
- kein sessionStorage
- keine Layout-Anwendung
- keine Ziel-UI-Mutation
- keine Fachlogik
- keine Fachdaten lesen
- kein Drag & Drop
- keine Bearbeitung von Layoutdaten

## Host-App-Faehigkeiten

Eine Host-App kann aktuell:

- Theme-Tokens einbinden
- Browser-Host-Adapter einbinden
- Ziel-UI mit neutralen `data-ui-*` Metadaten versehen
- getrennten Inspector-Container bereitstellen
- Adapter mit `rootElement` und `inspectorContainer` aufrufen
- neutralen Status anzeigen lassen

## Verweise

- `docs/HOST_APP_INTEGRATION.md`
- `docs/HOST_APP_ADOPTION_GUIDE.md`
- `docs/MINI_INSPECTOR_REFERENZ.md`
- `docs/NEUTRAL_THEME_TOKENS.md`
