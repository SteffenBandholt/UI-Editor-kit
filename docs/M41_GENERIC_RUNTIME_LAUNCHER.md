# M41 Generic Runtime Launcher

## Zweck

M41 fuehrt eine kleine, fachneutrale Runtime-/Launcher-Schicht im `UI-Editor-kit` ein. Sie nimmt einen HostAdapter entgegen, prueft den technischen Adaptervertrag, prueft ein optionales AdapterManifest, holt die explizit bereitgestellte Registry, initialisiert den EditorCore und erzeugt daraus einen neutralen RuntimeStatus.

Die Runtime ist ein Start- und Statusbaustein. Sie fuehrt keine Editor-Aktion aus und reicht keine ChangeRequests an die Ziel-App weiter.

## Abgrenzung zu BBM

BBM bleibt eine Referenz-Ziel-App. Die Runtime enthaelt keine BBM-Scope-Namen, keine BBM-Modulnamen und keine BBM-Fachlogik. Ziel-App-spezifische Scopes, Registry-Inhalte, Layoutdaten und Adapterentscheidungen muessen weiterhin explizit vom jeweiligen HostAdapter beziehungsweise AdapterManifest geliefert werden.

## Abgrenzung zur spaeteren Editor-App-Shell

M41 baut keine fertige Editor-App-Shell, kein Bedienpanel, keine Electron-App und keine sichtbare Launcher-Oberflaeche. Die Schicht erzeugt nur einen neutralen RuntimeStatus fuer nachfolgende UI- und ViewModel-Schichten.

## Genutzte Vertraege

Die Runtime nutzt diese bestehenden Core-Vertraege:

- `host-adapter-contract.cjs` fuer `getRegistry()`, `getCurrentLayoutState()` und `submitChangeRequest()`.
- `target-app-adapter-manifest.cjs` fuer optionale AdapterManifest-Pruefung.
- `editor-core.cjs` fuer Registry-Validierung, Elementliste und Elementzaehlung.
- Ziel-App-Anbindungs- und UI-Editor-Vertrag aus `docs/ZIEL_APP_ANBINDUNG.md` und `docs/UI_EDITOR_VERTRAG.md`.

## RuntimeStatus

Der initiale RuntimeStatus enthaelt mindestens:

- `ok`
- `targetAppId`
- `adapterName`
- `uiScope`
- `layoutScope`
- `registryElementCount`
- `selectedElementId: null`
- `availableOperations: []`
- `blocked`
- `errors: []`

Unterstuetzte Blockadecodes sind:

- `missing_host_adapter`
- `invalid_host_adapter`
- `invalid_manifest`
- `invalid_registry`
- `unknown_scope`
- `layout_state_unavailable`
- `target_rejected_change`

`target_rejected_change` ist fuer spaetere ChangeRequest-Fluesse reserviert. Der M41-Launcher erzeugt selbst keine ChangeRequests und ruft `submitChangeRequest()` nicht auf.

## Nicht-Ziele

M41 macht ausdruecklich nicht:

- keine Ziel-App-Scans
- keine automatische UI-Erkennung
- keine automatische Registry-Befuellung
- keine Ziel-App-Dateiaenderungen
- keine Ziel-App-Fachlogik
- keine PDF-, Druck-, Mail-, Audio- oder Datenbankfunktionen
- kein DOM-Scan
- keine sichtbare App-Shell

## Folgepaket M42

M42 soll auf diesem neutralen RuntimeStatus aufsetzen und Scope-, Selection- und Status-ViewModels ergaenzen. Dazu gehoeren insbesondere ein sichtbares Statusmodell, Selection-Zustand, Scope-Wechsel-Verhalten und die Anzeige neutral verfuegbarer Operationen ohne Ziel-App-Fachlogik.
