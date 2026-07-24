# M72: Eigenständiger Editor mit Panel- und Textbearbeitung

## Produktrolle

Das UI-Editor-kit ist eine eigenständige, fachneutrale Editor-Runtime. Eine Zielanwendung schaltet den Editor ein und aus und liefert Registry, explizite Element-Referenzen, HostAdapter, Scope/Profil sowie Storage.

Das Kit sucht keine UI-Elemente, registriert nichts automatisch und kennt weder Ziel-App-Fachlogik noch Fachdaten.

## Registry-Vertrag

Jedes bearbeitbare Element wird ausdrücklich registriert:

```js
{
  elementId: "customer.name",
  displayName: "Kundenname",
  scope: "customer-form",
  operations: {
    move: true,
    resizeWidth: true,
    resizeHeight: true,
    textMove: true,
    textResize: true
  },
  limits: {
    minWidth: 120,
    maxWidth: 400,
    minHeight: 30,
    maxHeight: 80,
    minFontSize: 8,
    maxFontSize: 40,
    minTextOffsetX: -10,
    maxTextOffsetX: 24
  }
}
```

Nur ausdruecklich gesetzte Operationen sind erlaubt. Nicht registrierte Elemente und nicht erlaubte Werte werden blockiert.

## Layout- und Sitzungsmodell

Element- und Textwerte sind getrennt:

```js
{
  elementId: "customer.name",
  element: { x: 0, y: 0, width: 280, height: 40, visible: true },
  text: { offsetX: 12, offsetY: 0, fontSize: 16 }
}
```

Fehlende Felder werden nicht ergaenzt. Runtime und HostAdapter wenden Aenderungen atomar an. Schlaegt Anwendung oder anschliessendes Lesen fehl, stellt die Runtime den vollstaendigen Snapshot wieder her.

Die Session unterscheidet Start-Baseline, aktuellen Zustand und gespeichertes Layout. Einzelverwerfen, Gesamtverwerfen, Speichern, Laden und Reset bleiben getrennte Aktionen.

LayoutStorage wird durch `targetContext` nach Zielanwendung, Modul, Scope und Profil getrennt. Ein Entry ist zusaetzlich ueber `elementId` adressiert.

## HostAdapter-Vertrag

Die Runtime ruft ausschliesslich den HostAdapter auf:

- `validateElementRef(elementId)`
- `captureElementLayoutState(elementId)`
- `getCurrentLayoutEntry(elementId)`
- `applyLayoutEntry(elementId, entry)`
- `clearElementLayout(elementId, registryElement)`
- `restoreElementLayoutState(elementId, snapshot)`
- optional `reapplyLayoutEntries(entries)`

`applyLayoutEntry` bildet die getrennten Felder eindeutig auf Elementposition, Breite, Hoehe, Sichtbarkeit, Textposition und Schriftgroesse ab.

Die Zielanwendung kann getrennte Text-Referenzen oder `getTextRef(elementId)` bereitstellen. Der Adapter sucht oder erkennt keine Unterelemente automatisch.

Textoffsets sind relative Editorwerte. Vor der ersten Aenderung sichert der Adapter den Ausgangszustand samt Ownership. Reine Textaenderungen lassen die aeussere Elementposition und -groesse unveraendert. Clear, Verwerfen und Reset stellen den urspruenglichen Zustand wieder her.

## Panel und Einbindung

```js
const {
  createUiEditorRuntime,
  createUiEditorPanelController,
  createUiEditorPanel,
  createPanelPositionStore,
} = require("ui-editor-kit");

const runtime = createUiEditorRuntime({
  registry,
  hostAdapter,
  layoutStorage,
  targetContext,
});

runtime.beginSession();

const controller = createUiEditorPanelController({
  runtime,
  registry,
  onClose: () => setEditorEnabled(false),
});

const panel = createUiEditorPanel({
  controller,
  mountTarget,
  positionStore,
  environmentAdapter,
});
```

Die Zielanwendung liefert Mount-Ziel, Umgebungsadapter, Auswahlsteuerung und Darstellung der Auswahl. Das Panel verwaltet nur seine eigenen Bedienelemente und veraendert keine Fachlogik.

Die Panelposition wird getrennt vom Ziel-Layout gespeichert. Layout-Resets veraendern die Panelposition nicht.

## Bearbeitung

Das Panel bietet die Ebenen `ELEMENT` und `TEXT`.

`TEXT` ist nur aktiv, wenn `textMove` oder `textResize` registriert wurde. Elementmodi sind Verschieben, Breite und Hoehe; Textmodi sind Position und Groesse.

Nicht unterstuetzte Modi und Richtungen sind sichtbar deaktiviert. Schrittweite und Registry-Grenzen werden vor dem Host-Aufruf geprueft.

`resolveOperationStep(...)` priorisiert operationsbezogene Schrittweiten und verwendet nur positive endliche Werte. Ohne gueltige Vorgabe gilt ein sicherer interner Standard.

## Abnahme

- Element- und Textwerte bleiben getrennt.
- Nicht registrierte Operationen werden blockiert.
- Grenzen und Schrittweiten werden vor Anwendung geprueft.
- Fehler fuehren zum vollstaendigen Rollback.
- Panelposition und Ziel-Layout bleiben getrennt.
- Ziel-App-Fachlogik und Fachdaten bleiben unangetastet.
- `npm test`, `npm pack --dry-run`, `npm run release:check` und `git diff --check` sind gruen.
