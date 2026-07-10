# M49 Release-Fixstand

## Zweck

M49 bereitet einen stabilen internen Release-Fixstand fuer den oeffentlichen Core des UI-Editor-kit vor. Der Fixstand buendelt den erreichten Stand nach M39 bis M48 und beschreibt, welche Teile als oeffentliche Basis fuer neue fachneutrale Integrationen gelten.

Der Fixstand ist keine Veroeffentlichung zu npm und erzeugt keinen Git-Tag. Er dient als dokumentierte, testbare Release-Basis im Repository.

## Enthaltene Funktionen

Enthalten sind:

- Ziel-App-Vertrag v1.0 als fachneutrale Integrationsgrundlage.
- Generischer RuntimeLauncher fuer kontrollierte Runtime-Starts.
- Scope-, Selection-, Runtime-Status- und Layout-Control-ViewModels.
- LayoutState-Vertrag mit Profilschluessel, Normalisierung, Kompatibilitaetspruefung und MemoryLayoutStateStore.
- Offizieller Adapter-Pfad von AdapterManifest, HostAdapter und Registry zur Runtime.
- Neutrales Testziel und ausfuehrbares Minimalbeispiel.
- Oeffentliche CommonJS-Core-API ueber den Paket-Einstieg.
- Vertrags- und Regressionstests unter `scripts/tests/`.

## Oeffentliche Einstiegspunkte

Der oeffentliche Paket-Einstieg ist in `package.json` ueber `main` und `exports` auf `src/index.cjs` gesetzt. Dieser Einstieg exportiert die fachneutralen Kernfunktionen fuer Runtime, Adapter-Pfad, ViewModels und LayoutStateStore.

## Empfohlener Importpfad

Neue Integrationen sollen den Paket-Einstieg verwenden:

```js
const uiEditorKit = require("ui-editor-kit");
```

Bei lokaler Arbeit im Repository oder in Fixtures kann direkt der gleiche Einstieg genutzt werden:

```js
const uiEditorKit = require("../../src/index.cjs");
```

Direkte Imports einzelner Core-Dateien bleiben intern moeglich, sind fuer neue Ziel-App-Anbindungen aber nicht der empfohlene Vertrag.

## Tests

Der Fixstand wird mindestens mit diesen Pruefungen abgesichert:

```bash
git diff --check
npm test
```

`npm test` fuehrt die vorhandenen Vertrags-, Runtime-, ViewModel-, LayoutState-, Adapter-, Minimalbeispiel-, Public-API- und Installer-Tests aus.

## Bekannte Grenzen

M49 baut keine neue Funktionalitaet. Der Stand hat bewusst folgende Grenzen:

- keine Abhaengigkeit von einer konkreten Referenz-Ziel-App
- keine Fachlogik
- keine echten Fachdaten
- keine Datenbank-Anbindung
- keine automatische UI-Erkennung
- kein DOM-Scan
- keine automatische Registry-Befuellung
- keine automatische Migration bestehender Oberflaechen
- keine grosse Editor-App-Shell
- keine Electron-App
- keine PDF-, Druck-, Mail- oder Audio-Funktion
- keine npm-Veroeffentlichung
- kein Git-Tag

## Abnahme

Der Fixstand gilt als vorbereitet, wenn Version, Changelog, README, STATUS und diese Release-Doku konsistent sind und die Pflichtpruefungen erfolgreich laufen.
