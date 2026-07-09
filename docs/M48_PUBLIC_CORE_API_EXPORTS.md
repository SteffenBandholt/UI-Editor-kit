# M48 Public Core API Exports

## Zweck

M48 stabilisiert den fachneutralen Einstieg fuer Ziel-Apps. Ziel-Apps sollen die Kernfunktionen des UI-Editor-kit nicht mehr ueber viele einzelne Core-Dateien importieren, sondern ueber einen offiziellen CommonJS-Einstieg.

Die Public API ist der bevorzugte, stabile Importpfad fuer neue Ziel-App-Anbindungen.

## Offizieller Importpfad

Im Repository und fuer lokale Ziel-App-Beispiele lautet der Einstieg:

```js
const uiEditorKit = require("./src/index.cjs");
```

Wenn das Paket als Dependency eingebunden ist, ist der Paket-Einstieg identisch mit dem Package-Export:

```js
const uiEditorKit = require("ui-editor-kit");
```

`package.json` zeigt `main` und den CommonJS-Export auf `src/index.cjs`.

## Exportierte Funktionen

`src/index.cjs` exportiert bewusst nur fachneutrale Kernfunktionen:

- `validateTargetAppAdapterPath`
- `createTargetAppAdapterRuntime`
- `getTargetAppAdapterPathSummary`
- `createEditorRuntimeLauncher`
- `createEditorRuntimeStatusViewModel`
- `createEditorSelectionViewModel`
- `createEditorScopeViewModel`
- `createEditorLayoutControlViewModel`
- `validateLayoutState`
- `normalizeLayoutState`
- `createLayoutState`
- `getLayoutStateProfileKey`
- `assertCompatibleLayoutProfile`
- `createMemoryLayoutStateStore`

Damit sind AdapterManifest, HostAdapter und Registry weiterhin die fachneutralen Vertragsobjekte der Ziel-App. Die Runtime wird ueber `createTargetAppAdapterRuntime` gestartet. ViewModels und MemoryLayoutStateStore sind ebenfalls ueber den gleichen Einstieg erreichbar.

## Bewusst nicht exportiert

Nicht Teil der Public API sind:

- Test-Fixtures und Test-Hosts
- Installer-Planungs- und Ausfuehrungsdetails
- Cleanup- oder Repository-Pruefskripte
- ziel-app-spezifische Referenzartefakte
- interne Hilfslisten und Konstanten, sofern sie nicht als stabiler Vertrag festgelegt sind
- Fachlogik, Speicheranbindungen oder automatische Bestandserkennung

## Beispielverwendung

```js
const {
  createTargetAppAdapterRuntime,
  createMemoryLayoutStateStore,
} = require("ui-editor-kit");

const layoutStore = createMemoryLayoutStateStore();
const runtime = createTargetAppAdapterRuntime({
  hostAdapter,
  registry: hostAdapter.getRegistry(),
  layoutStore,
});

if (!runtime.ok) {
  throw new Error(runtime.message);
}

console.log(runtime.runtime.viewModels.runtimeStatus);
```

## Zusammenhang mit M47

M47 beschreibt die minimale Anbindung einer neuen fachneutralen Ziel-App. M48 ergaenzt dazu den stabilen Importpunkt. Das Minimalbeispiel unter `scripts/fixtures/minimal-target-app/minimal-target-app.cjs` nutzt fuer Kit-Funktionen jetzt `src/index.cjs` und zeigt damit den bevorzugten Weg fuer externe Ziel-Apps.

## Kompatibilitaetsnotiz

Ab M48 ist die Public API der bevorzugte Einstieg fuer Ziel-Apps. Direkte Imports einzelner Core-Dateien koennen intern weiterhin existieren, sollen aber fuer neue Ziel-App-Anbindungen nicht mehr als primaerer Vertrag dokumentiert werden.

## Folgepaket M49

M49 sollte den Release-Fixstand vorbereiten:

- Version festlegen
- Changelog ergaenzen
- Public-API-Liste als Release-Vertrag pruefen
- Paket-Metadaten vor einer spaeteren Veroeffentlichung final kontrollieren
