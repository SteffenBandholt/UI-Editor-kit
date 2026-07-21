# M71 Generic Browser Host

## Zweck

M71 ergänzt das UI-Editor-kit um eine fachneutrale Browser-Verbindungsschicht zwischen M69 Runtime, M70 Panel und explizit von einer Zielanwendung gelieferten HTMLElement-ähnlichen Refs.

## Abgrenzung

Die Ziel-App liefert Registry, ElementRefs, TargetContext, Storage-Namespace, Auswahlereignisse und MountTargets. M71 scannt kein DOM, registriert nichts automatisch und kennt keine Fachlogik.

## Ref-Registry

`createElementRefRegistry()` verwaltet ausschließlich laufzeitliche Refs der Ziel-App-Instanz. `register`, `unregister`, `get`, `has`, `listIds`, `clear` und `subscribe` liefern strukturierte Resultate. Ungültige IDs, ungültige Refs, doppelte Registrierung und fehlende Refs werden mit `INVALID_ELEMENT_ID`, `INVALID_ELEMENT_REF`, `ELEMENT_REF_ALREADY_REGISTERED` und `ELEMENT_REF_MISSING` blockiert.

## BrowserHostAdapter

`createBrowserHostAdapter()` erfüllt den M69-Vertrag: Ref-Validierung, Capture, Apply, Clear, Restore, Current-Entry und Reapply. Der Adapter speichert nicht persistent und verwendet nur explizit übergebene Refs.

## Layoutsemantik

`getCurrentLayoutEntry()` liefert `{ elementId, x, y, width, height, visible }`. `x` und `y` sind Editor-Verschiebungen, nicht absolute Seitenkoordinaten. `width` und `height` werden aus Editor-Properties, Inline-Style, Computed-Style oder Bounding-Rect gelesen. Nicht messbare Werte führen zu strukturierten Fehlern.

## Transform- und Ownership-Strategie

M71 überschreibt bestehende Ziel-App-Transforms nicht. Editor-eigene Verschiebungen werden über CSS Custom Properties `--ui-editor-x`, `--ui-editor-y` und eine eigene Property `--ui-editor-transform` beschrieben. Breite, Höhe und Sichtbarkeit werden über `--ui-editor-width`, `--ui-editor-height`, `--ui-editor-visible` und eine interne WeakMap als Editor-eigene Änderungen markiert. `clearElementLayout()` entfernt nur diese Editor-Anteile und lässt fremde Inline-Styles erhalten.

## SelectionHost

`createBrowserSelectionHost()` akzeptiert ausschließlich explizite `select(elementId)`-Aufrufe. Der Host bindet keine globalen Clicklistener und durchsucht kein Dokument. Auswahlwechsel melden `selectedElementId`, `selectedElementName` und `elementRefAvailable`.

## OverlayHost

`createBrowserOverlayHost()` rendert einen neutralen Auswahlrahmen im expliziten Overlay-MountTarget. Das Overlay ist layoutneutral, verwendet `pointer-events: none`, ist thematisierbar und berechnet seine Position über injizierbare Rect-Reader. Scroll-/Resize-Listener werden nur über den übergebenen Window-Adapter registriert und in `destroy()` entfernt.

## BrowserStorage

`createBrowserLayoutStorage()` nutzt nur die injizierte Storage-Schnittstelle `getItem`, `setItem`, `removeItem`. Der Schlüssel lautet `ui-editor-layout::<targetAppId>::<moduleId>::<scopeId>::<layoutProfileId>`. Gespeichert wird Schema Version 1 mit `context`, `entries` und `savedAt`. Ungültiges JSON, falsche Schema-Version und Storage-Fehler werden strukturiert blockiert; es gibt keinen Memory-Fallback.

## Bridge

`createUiEditorBrowserBridge()` verbindet SelectionHost, PanelController und OverlayHost: Auswahl ruft `controller.selectElement()` und `overlayHost.show()` auf, Clear versteckt das Overlay und Layout-/Load-/Reset-/Discard-/Reapply-Ereignisse aktualisieren das Overlay ohne Runtime-Fachlogik zu duplizieren.

## Cleanup

SelectionHost, OverlayHost und Bridge besitzen `destroy()`. Nach `destroy()` werden Listener entfernt, Subscriptions gelöst und das Overlay entfernt beziehungsweise versteckt. Die Ref-Registry wird nicht automatisch geleert.

## Fehlercodes

M71 exportiert `BROWSER_ERROR_CODES` mit neutralen Codes für Ref-, Host-, Overlay-, Storage- und Bridge-Fehler, darunter `OVERLAY_MOUNT_MISSING`, `OVERLAY_MEASURE_FAILED`, `STORAGE_PARSE_FAILED`, `STORAGE_SCHEMA_UNSUPPORTED` und `BRIDGE_DESTROYED`.

## Beispielintegration

```js
const refs = createElementRefRegistry();
refs.register("header.title", titleElement);
const hostAdapter = createBrowserHostAdapter({ elementRefs: refs });
const selectionHost = createBrowserSelectionHost({ registry, elementRefs: refs });
const overlayHost = createBrowserOverlayHost({ overlayMountTarget });
const storage = createBrowserLayoutStorage({ storage: window.localStorage, namespace: "ui-editor-layout" });
```

Die Ziel-App bindet eigene Clickhandler bewusst selbst und ruft dann `selectionHost.select(elementId)` auf.

## Nicht-Ziele

M71 liefert keine Demo-App, keine BBM-Anbindung, keinen Installer, keinen DOM-Scan, kein Drag-and-drop, keine Mehrfachauswahl, kein Autosave und keine Fachlogik.

## Übergang zu M72

M72 baut auf M71 auf und liefert die unabhängige sichtbare Browser-Referenzanwendung. M71 ist dafür die generische, produktunabhängige Verbindungsschicht.
