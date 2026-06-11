# Panel-Runtime-API

## Zweck

Die Panel-Runtime ist eine fachneutrale Daten- und ViewModel-Schicht fuer ein spaeteres UI-Editor-Panel.

Sie beschreibt nur:

- Panel-State
- Panel-Position
- offene/geschlossene Anzeige
- Ziel- und Preview-Ziel-Daten
- erlaubte und gesperrte Operationen
- vorbereitete Aenderungen als Summary
- Reset-/Verwerfen-Faehigkeit
- ein datengetriebenes Buttonmodell

Sie rendert keine UI.

## Zielpfad

```text
src/runtime/panel/
```

Enthaltene Einstiege:

```text
src/runtime/panel/index.cjs
src/runtime/panel/index.mjs
```

Interne Module:

```text
src/runtime/panel/panelState.cjs
src/runtime/panel/panelState.mjs
src/runtime/panel/panelViewModel.cjs
src/runtime/panel/panelViewModel.mjs
```

## Package-Subpath

Der offizielle Subpath lautet:

```text
ui-editor-kit/runtime/panel
```

`package.json` bildet ihn auf CommonJS und ESM ab:

```json
{
  "exports": {
    "./runtime/panel": {
      "import": "./src/runtime/panel/index.mjs",
      "require": "./src/runtime/panel/index.cjs"
    }
  }
}
```

## Exporte

Die Panel-Runtime exportiert:

- `PANEL_DEFAULT_POSITION`
- `createDefaultPanelState`
- `normalizePanelPosition`
- `updatePanelPosition`
- `setPanelOpen`
- `buildPanelViewModel`
- `createPreviewButtons`

## State-Vertrag

`createDefaultPanelState()` liefert:

```js
{
  isOpen: true,
  position: {
    left: null,
    top: 132,
    right: 24,
    bottom: null
  }
}
```

`normalizePanelPosition(position)` normalisiert Positionswerte defensiv:

- ungueltige Werte werden zu `null`
- negative Werte werden auf `0` begrenzt
- Zahlenstrings werden akzeptiert
- fehlendes `top` faellt auf den Standardwert zurueck
- wenn weder `left` noch `right` gesetzt ist, wird `right` auf den Standardwert gesetzt

`updatePanelPosition(state, position)` gibt einen neuen State mit normalisierter Position zurueck.

`setPanelOpen(state, isOpen)` gibt einen neuen State mit stabilem Boolean fuer `isOpen` zurueck.

## ViewModel-Vertrag

`buildPanelViewModel(input)` erzeugt aus neutralen Daten ein ViewModel:

```js
{
  isOpen,
  position,
  title,
  targetLabel,
  targetId,
  previewTargetLabel,
  previewTargetId,
  allowedOps,
  lockedOps,
  pendingChangeSummary,
  canReset,
  canDiscard,
  statusText,
  buttons
}
```

`buttons` enthaelt nur Datenobjekte:

```js
{
  id,
  label,
  operation,
  payload,
  isEnabled,
  kind
}
```

Preview-Buttons werden aus `allowedOps`, `lockedOps` und vorhandenem Ziel abgeleitet.
Reset und Verwerfen werden aus `canReset`, `canDiscard` oder der Summary abgeleitet.

## Nicht enthalten

Nicht Teil der Panel-Runtime sind:

- DOM-Panel
- Drag-Controller
- HTML-Strings
- DOM-Knoten
- Host-App-Integration
- Speicherung
- Datei-Schreibwege
- Datenbank
- IPC
- localStorage
- Fachlogik
- Druck- oder PDF-Logik
- alte Editorpfade

## Tests und Guardrails

Tests:

- `scripts/tests/panel-runtime.test.cjs`
- `scripts/tests/panel-runtime-esm.test.cjs`
- `scripts/tests/panel-runtime-package-export.test.cjs`
- `scripts/tests/panel-runtime-guardrail.test.cjs`

Der Guardrail-Test prueft, dass die Panel-Runtime keine Host-App-, Fach-, Speicher-, IPC-, Datenbank-, DOM- oder PDF-Fragmente enthaelt.
