# M72: Eigenständiger Editor mit Panel- und Textbearbeitung

## Produktrolle

Das UI-Editor-kit ist eine eigenständige, fachneutrale Editor-Runtime. Eine Zielanwendung schaltet den Editor ein und aus und liefert Registry, explizite Element-Referenzen, HostAdapter, Scope/Profil sowie Storage. Das Kit scannt kein DOM, registriert nichts automatisch und kennt weder BBM-Logik noch Fachdaten.

Die Browser-Referenz unter `examples/browser-reference` bleibt ein isolierter technischer Testaufbau. Sie ist nicht das Produkt und bestimmt nicht die Architektur. PR #51 wird für diese Neuausrichtung nicht benötigt und darf nicht gemergt werden.

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

Nur gesetzte Operationen sind erlaubt. Nicht registrierte Elemente und nicht erlaubte Werte werden blockiert. Die bisherigen Felder `id`/`name` und `allowedOps` bleiben lesbar, damit bestehende M69–M72-Adapter weiter funktionieren; neue Integrationen verwenden den obigen Vertrag.

## Layout- und Sitzungsmodell

Element- und Textwerte sind getrennt:

```js
{
  elementId: "customer.name",
  element: { x: 0, y: 0, width: 280, height: 40, visible: true },
  text: { offsetX: 12, offsetY: 0, fontSize: 16 }
}
```

Fehlende Felder werden nicht ergänzt. Runtime und HostAdapter wenden eine Änderung atomar an. Schlägt Apply oder anschließendes Lesen fehl, stellt die Runtime den vollständigen Snapshot aus Element- und Textwerten wieder her.

Die Session unterscheidet Start-Baseline, aktuellen Zustand und gespeichertes Layout. Der Mittelpunkt des Steuerkreuzes verwirft die Änderungen des ausgewählten Elements bis zur aktuellen Session-Baseline. „Alle Änderungen verwerfen“, Speichern/Laden, dauerhaftes Löschen eines Elements und Gesamtreset bleiben getrennte Aktionen.

LayoutStorage wird durch `targetContext` nach Zielanwendung, Modul, Scope und Profil getrennt. Ein Entry ist zusätzlich über `elementId` adressiert.

## HostAdapter-Vertrag

Die Runtime ruft ausschließlich den HostAdapter auf:

- `validateElementRef(elementId)`
- `captureElementLayoutState(elementId)`
- `getCurrentLayoutEntry(elementId)`
- `applyLayoutEntry(elementId, entry)`
- `clearElementLayout(elementId, registryElement)`
- `restoreElementLayoutState(elementId, snapshot)`
- optional `reapplyLayoutEntries(entries)`

`applyLayoutEntry` bildet die getrennten Felder eindeutig auf Elementposition, Breite, Höhe, Sichtbarkeit, Textposition X/Y und Schriftgröße ab. Der generische BrowserHostAdapter implementiert dies für ausdrücklich übergebene Element-Refs. Er sucht keine Elemente. Bei Eingabefeldern wirken `textIndent`, `paddingTop` und `fontSize` gleichermaßen auf Platzhalter und Eingabetext; Breite, Höhe und Element-Transform bleiben bei reinen Textänderungen unverändert.

## Panel und Einbindung

```js
const {
  createUiEditorRuntime,
  createUiEditorPanelController,
  createUiEditorPanel,
  createPanelPositionStore,
} = require("ui-editor-kit");

const runtime = createUiEditorRuntime({ registry, hostAdapter, layoutStorage, targetContext });
runtime.beginSession();

const positionStore = createPanelPositionStore({
  storage: window.localStorage,
  targetAppId: targetContext.targetAppId,
});

let panel;
function setEditorEnabled(enabled) {
  if (enabled && !panel) {
    const controller = createUiEditorPanelController({
      runtime,
      registry,
      onClose: () => setEditorEnabled(false),
    });
    panel = createUiEditorPanel({
      controller,
      mountTarget: document.body,
      windowAdapter: window,
      positionStore,
    });
  } else if (!enabled && panel) {
    panel.destroy();
    panel = null;
  }
}
```

Die Zielanwendung bindet `styles/ui-editor-panel.css` ein. Die Kopfzeile startet den Pointer-Drag, stoppt die Ereignisweitergabe, klemmt das Panel vollständig in den sichtbaren Viewport und persistiert erst am Drag-Ende. Beim Start und bei `resize` werden ungültige beziehungsweise nicht mehr erreichbare Positionen korrigiert. Der Positionsschlüssel ist vom LayoutStorage getrennt; Layout-Resets verändern ihn nicht.

Die Zielanwendung verbindet außerdem ihren expliziten SelectionHost und OverlayHost. Nur registrierte Refs sind auswählbar. Panel-Ereignisse bleiben im Panel; Klicks auf freie Host-Flächen können die Auswahl über `bridge.clearSelection()` aufheben. Der orange Auswahlrahmen wird über den OverlayHost nach jeder Änderung synchronisiert.

## Bearbeitung

Das Panel bietet die Ebenen `ELEMENT` und `TEXT`. `TEXT` ist nur aktiv, wenn `textMove` oder `textResize` registriert wurde. Elementmodi sind Verschieben, Breite und Höhe; Textmodi sind Position und Größe. Nicht unterstützte Modi und Richtungen sind sichtbar deaktiviert. Schrittweite und Registry-Grenzen werden vor dem Host-Aufruf geprüft.
