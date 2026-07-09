# M47 Neue Ziel-App: Minimal-Anbindung

## Zweck

Diese Anleitung beschreibt den kleinsten oeffentlichen Weg, wie eine neue fremde Ziel-App das UI-Editor-kit korrekt anbindet. Sie ist fachneutral und beschreibt den offiziellen Pfad:

```text
Target-App -> AdapterManifest -> HostAdapter -> Registry -> RuntimeLauncher -> ViewModels -> LayoutStateStore
```

Die Anleitung ist kein grosser Editor, keine Installer-Oberflaeche und keine produktive Beispielanwendung. Sie beschreibt nur die Vertragspunkte, die eine Ziel-App explizit bereitstellen muss.

## Voraussetzungen

- Der Ziel-App-Vertrag v1.0 ist die verbindliche Grundlage.
- Der generische RuntimeLauncher ist vorhanden.
- Scope-, Selection-, Status- und Layout-Control-ViewModels sind vorhanden.
- LayoutState-Vertrag und MemoryLayoutStateStore sind vorhanden.
- Der offizielle Adapter-Pfad ist der Startpunkt fuer neue Integrationen.
- Das neutrale Testziel liegt unter `scripts/fixtures/neutral-target-app/neutralTargetApp.cjs`.

## Was die Ziel-App liefern muss

Eine Ziel-App liefert nur explizite, fachneutrale Integrationsdaten:

1. Ziel-App-Info mit stabiler Ziel-App-ID und Anzeigename.
2. AdapterManifest mit Scope, LayoutProfile und Faehigkeiten.
3. HostAdapter als kontrollierte Bruecke zur Ziel-App.
4. Registry mit bekannten editorfaehigen Elementen.
5. Optional aktuelle LayoutState-Daten fuer Save, Load und Reset.

Die Ziel-App liefert keine automatische Bestandserkennung. Sie muss ihre Registry bewusst und kontrolliert bereitstellen.

## Was das UI-Editor-kit liefert

Das UI-Editor-kit liefert:

- Manifest- und HostAdapter-Vertragspruefung.
- Registry-Auswertung ueber den Editor-Core.
- RuntimeLauncher fuer den neutralen Startstatus.
- RuntimeStatusViewModel.
- ScopeViewModel.
- SelectionViewModel.
- LayoutControlViewModel.
- MemoryLayoutStateStore fuer minimale Save-, Load- und Reset-Fluesse.

## Minimaler Anbindungsablauf

1. Ziel-App waehlt einen `uiScope`.
2. Ziel-App ordnet diesen `uiScope` einem `layoutScope` zu.
3. Ziel-App erzeugt ein AdapterManifest.
4. Ziel-App erzeugt einen HostAdapter.
5. HostAdapter stellt die Registry bereit.
6. UI-Editor-kit startet ueber `createTargetAppAdapterRuntime` aus dem offiziellen Adapter-Pfad.
7. Runtime erzeugt RuntimeStatus, EditorCore, ViewModels und LayoutStateStore-Anbindung.
8. Ziel-App verwendet Save, Load und Reset nur ueber den vereinbarten LayoutState-Vertrag.

## AdapterManifest

Das AdapterManifest beschreibt den Vertrag der Ziel-App fuer genau einen Integrationsausschnitt. Es enthaelt mindestens:

- `targetAppId`
- `adapterName`
- `adapterVersion`
- `uiScope`
- `layoutScope`
- `layoutProfileId`
- unterstuetzte Elementtypen, Rollen und Operationen
- gesperrte Operationen
- Save-, Load- und Reset-Faehigkeiten fuer LayoutState

Typische Blockcodes an dieser Stelle:

- `missing_adapter_manifest`
- `invalid_adapter_manifest`
- `unknown_scope`
- `missing_layout_scope`
- `invalid_layout_profile`

## HostAdapter

Der HostAdapter ist die einzige erlaubte Bruecke zwischen Ziel-App und UI-Editor-kit. Minimal benoetigt er:

- `getAdapterManifest()`
- `getRegistry()`
- `getCurrentLayoutState()`
- `submitChangeRequest(changeRequest)`

Wenn LayoutControls aktiviert sind, kommen hinzu:

- `saveLayoutState(layoutState)`
- `loadLayoutState(selector)`
- `resetLayoutState(selector)`

Typische Blockcodes:

- `missing_host_adapter`
- `invalid_host_adapter`
- `runtime_launch_failed`
- `target_rejected_change`

## Registry

Die Registry enthaelt ausschliesslich explizit bekannte UI-Elemente des gewaehlten `uiScope`. Sie wird nicht automatisch befuellt.

Minimal benoetigt sie:

- `listElements()`
- `getElementById`
- optional `size()`

Typische Blockcodes:

- `missing_registry`
- `invalid_registry`
- `unknown_scope`

## UI-Scope und Layout-Scope

Der `uiScope` beschreibt den UI-Ausschnitt, den die Ziel-App fuer den Editor freigibt. Der `layoutScope` beschreibt den dazugehoerigen Layout-Speicherbereich. Beide Werte muessen stabil sein und zum AdapterManifest, zur Registry und zum LayoutState passen.

## LayoutProfile

Das `layoutProfileId` identifiziert ein konkretes Layout-Profil innerhalb von Ziel-App, UI-Scope und Layout-Scope. Der LayoutStateStore verwendet diese vier Felder als Selektor:

- `targetAppId`
- `uiScope`
- `layoutScope`
- `layoutProfileId`

## RuntimeLauncher

Der RuntimeLauncher prueft den HostAdapter und erzeugt einen neutralen RuntimeStatus. Neue Integrationen starten nicht direkt einzelne ViewModels, sondern ueber den offiziellen Adapter-Pfad:

```js
const { createTargetAppAdapterRuntime } = require("../../src/core/target-app-adapter-path.cjs");
const runtime = createTargetAppAdapterRuntime({ hostAdapter, registry, layoutStore });
```

## ViewModels

Der offizielle Adapter-Pfad erzeugt die zentralen ViewModels:

- `runtimeStatus`: Start- und Blockierstatus der Runtime.
- `scope`: Anzeige von `uiScope`, `layoutScope` und Manifestdaten.
- `selection`: Auswahlzustand fuer ein bekanntes Registry-Element.
- `layoutControls`: Verfuegbarkeit von Save, Load und Reset.

## LayoutStateStore

Fuer eine minimale Integration reicht der MemoryLayoutStateStore:

```js
const { createMemoryLayoutStateStore } = require("../../src/core/layout-state-store.cjs");
const layoutStore = createMemoryLayoutStateStore();
```

Save, Load und Reset laufen immer mit einem LayoutState beziehungsweise einem Selektor, der zu `targetAppId`, `uiScope`, `layoutScope` und `layoutProfileId` passt.

## Fachneutrales Minimalbeispiel

Das ausfuehrbare Minimalbeispiel liegt unter:

- `scripts/fixtures/minimal-target-app/minimal-target-app.cjs`

Es verweist auf das neutrale Testziel:

- `scripts/fixtures/neutral-target-app/neutralTargetApp.cjs`

Das Beispiel zeigt:

1. Ziel-App-Info lesen.
2. AdapterManifest aus dem HostAdapter lesen.
3. HostAdapter erzeugen.
4. Registry bereitstellen.
5. Runtime ueber den offiziellen Adapter-Pfad starten.
6. Status-, Scope-, Selection- und Layout-Control-ViewModels verwenden.
7. MemoryLayoutStateStore fuer Save, Load und Reset nutzen.

Ausfuehren:

```bash
node scripts/fixtures/minimal-target-app/minimal-target-app.cjs
```

## Klare Nicht-Ziele

Diese Minimal-Anbindung baut ausdruecklich nicht:

- keine fachliche Beispiel-App
- keine grosse Editor-Shell
- keine Installer-Oberflaeche
- keinen Server
- keine echte Persistenz
- keine Datenbank-Anbindung
- keine Dateiablage ausserhalb von Tests oder Fixtures
- keine Ausgabe-, Versand- oder Klang-Funktion
- keine Fachlogik
- keine automatische UI-Erkennung
- keine Browser-Baum-Abtastung
- keine Auto-Befuellung der Registry
- keine automatische Migration bestehender Oberflaechen

## Abnahme fuer eine neue Ziel-App

Eine neue Ziel-App gilt minimal angebunden, wenn:

- `createTargetAppAdapterRuntime` mit `ok: true` startet.
- der RuntimeStatusViewModel `ok: true` meldet.
- ScopeViewModel den erwarteten UI- und Layout-Scope zeigt.
- SelectionViewModel ein bekanntes Registry-Element auswaehlt.
- LayoutControlViewModel Save, Load und Reset korrekt als verfuegbar oder blockiert ausweist.
- MemoryLayoutStateStore oder ein kompatibler Store Save, Load und Reset vertragstreu ausfuehrt.
