# Hidden-Elements-Runtime-API

## Zweck

Die Hidden-Elements-Runtime ist eine fachneutrale Daten- und ViewModel-Schicht fuer ausgeblendete UI-Editor-Elemente.

Sie beschreibt nur:

- welche registrierten Elemente aktuell ausgeblendet sind
- wie viele ausgeblendete Elemente vorhanden sind
- ob ein kompakter Button sichtbar und aktiv ist
- welche Eintraege ein spaeteres Popover anzeigen kann
- welche neutrale Aktion je Eintrag angeboten wird

Sie rendert keine UI.

## Zielpfad

```text
src/runtime/hiddenElements/
```

Enthaltene Einstiege:

```text
src/runtime/hiddenElements/index.cjs
src/runtime/hiddenElements/index.mjs
```

Interne Module:

```text
src/runtime/hiddenElements/hiddenElementsViewModel.cjs
src/runtime/hiddenElements/hiddenElementsViewModel.mjs
```

## Package-Subpath

Der offizielle Subpath lautet:

```text
ui-editor-kit/runtime/hidden-elements
```

`package.json` bildet ihn auf CommonJS und ESM ab:

```json
{
  "exports": {
    "./runtime/hidden-elements": {
      "import": "./src/runtime/hiddenElements/index.mjs",
      "require": "./src/runtime/hiddenElements/index.cjs"
    }
  }
}
```

## Exporte

Die Hidden-Elements-Runtime exportiert:

- `normalizeHiddenElement`
- `getHiddenElements`
- `buildHiddenElementsButtonViewModel`
- `buildHiddenElementsPopoverViewModel`
- `buildHiddenElementsViewModel`

## Eingabevertrag

Die Runtime akzeptiert neutrale Elementdaten:

```js
{
  elements: [
    {
      elementId: "example.field",
      label: "Beispielfeld",
      visible: false,
      canShow: true
    }
  ]
}
```

`visible: false` bedeutet: Das Element ist ausgeblendet.

Ein Element wird dadurch nicht entfernt. Registry, Layout-State und spaeterer Host-Kontext bleiben die Quelle.

## ViewModel-Vertrag

`buildHiddenElementsViewModel(input)` erzeugt:

```js
{
  hiddenCount: 2,
  button: {
    visible: true,
    enabled: true,
    label: "Ausgeblendete: 2",
    hiddenCount: 2
  },
  popover: {
    title: "Ausgeblendete Elemente",
    items: [
      {
        elementId: "example.field",
        label: "Beispielfeld",
        action: "show",
        enabled: true
      }
    ]
  }
}
```

## Button-Vertrag

`buildHiddenElementsButtonViewModel(input)` liefert:

- `visible: false` und `enabled: false`, wenn keine ausgeblendeten Elemente vorhanden sind
- `visible: true` und `enabled: true`, wenn mindestens ein ausgeblendetes Element vorhanden ist
- `label: "Ausgeblendete: N"`

Wenn ein Host den Button auch bei leerer Liste anzeigen will, kann `showWhenEmpty: true` uebergeben werden.

## Popover-Vertrag

`buildHiddenElementsPopoverViewModel(input)` liefert:

- neutralen Titel
- Liste ausgeblendeter Elemente
- je Eintrag `action: "show"`
- je Eintrag `enabled` aus `canShow`

Das Popover selbst wird nicht gerendert.

## Nicht enthalten

Nicht Teil der Hidden-Elements-Runtime sind:

- DOM
- HTML-Strings
- DOM-Knoten
- Events
- Drag
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

- `scripts/tests/hidden-elements-runtime.test.cjs`
- `scripts/tests/hidden-elements-runtime-esm.test.cjs`
- `scripts/tests/hidden-elements-runtime-package-export.test.cjs`
- `scripts/tests/hidden-elements-runtime-guardrail.test.cjs`

Der Guardrail-Test prueft, dass die Hidden-Elements-Runtime keine Host-App-, Fach-, Speicher-, IPC-, Datenbank-, DOM- oder PDF-Fragmente enthaelt.
