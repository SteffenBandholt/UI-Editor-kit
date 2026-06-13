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
- neutrale Panel-Drag-Positionsberechnung auf Basis der DragRuntime

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
src/runtime/panel/panelDrag.cjs
src/runtime/panel/panelDrag.mjs
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
- `PANEL_DRAG_COORDINATE_SYSTEM`
- `normalizePanelDragInput`
- `buildPanelDragResult`
- `calculatePanelDragPosition`

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

## Panel-Drag-Helper

Der Panel-Drag-Helper kapselt nur die neutrale Positionsrechnung fuer schwebende Panels.
Er nutzt intern die DragRuntime und akzeptiert fuer Panel-Drag aktuell ausschliesslich
`coordinateSystem: "css-pixels"`.

Beispieleingabe:

```js
{
  panelId: "preview-panel",
  startBounds: {
    x: 100,
    y: 80,
    width: 320,
    height: 240
  },
  delta: {
    x: 30,
    y: -20
  },
  viewportBounds: {
    x: 0,
    y: 0,
    width: 1200,
    height: 800
  },
  coordinateSystem: "css-pixels"
}
```

`buildPanelDragResult(input)` liefert ein Ergebnisobjekt:

```js
{
  ok: true,
  errors: [],
  panelId: "preview-panel",
  bounds: {
    x: 130,
    y: 60,
    width: 320,
    height: 240
  },
  changed: true,
  coordinateSystem: "css-pixels"
}
```

Die Panelgroesse bleibt erhalten. Die Position wird gegen `viewportBounds`
begrenzt, damit das Panel im sichtbaren Bereich bleibt.

`calculatePanelDragPosition(input)` ist der neutrale Recheneinstieg fuer Hosts,
die nur die neue Panelposition aus Startbounds, Delta und Viewport berechnen
wollen.

`normalizePanelDragInput(input)` normalisiert die Eingabe defensiv und bildet
aus `viewportBounds` die DragRuntime-Constraints.

Ungueltige Eingaben liefern `ok: false` mit Fehlerliste. Abgelehnt werden
insbesondere ungueltige Bounds, ungueltige Delta-Werte und andere Coordinate-
Systems als `css-pixels`.

Der Helper bindet keine DOM-, Mouse- oder Pointer-Events an. Hosts bleiben fuer
Startpositionsermittlung, Event-Anbindung, Style-Setzen, Speicherung und
Lifecycle verantwortlich. Fuer PDF-, Canvas- oder Plan-Flaechen bleibt die
generische DragRuntime der richtige Baustein, nicht der Panel-Helper.

## Nicht enthalten

Nicht Teil der Panel-Runtime sind:

- DOM-Panel
- Drag-Controller oder Event-Anbindung
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
