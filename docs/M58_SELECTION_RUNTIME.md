# M58 Selection Runtime

## Zweck
M58 fuehrt die erste generische, frameworkneutrale Selection-Runtime fuer den Vertrag `selection-target-contract-v1.0` ein. Sie nutzt ausschliesslich explizit gelieferte Element-Referenzen des `SelectionHost`, zeigt Hover- und Selected-Rahmen und kennt keine Zielanwendung.

## Architektur
Die Runtime besteht aus `selectionController`, `targetResolver`, `overlayBase`, `hoverOverlay` und `selectedOverlay`. Sie erzeugt keine Registry und fuehrt keinen DOM-Scan aus.

## SelectionHost
Der Host liefert `listSelectableTargets()` oder `listSelectableElementIds()`, `getElementRef()`, `getSelectedElementId()` und `selectElement()`. Optional kann er `getElementMeta()`, `isExcludedTarget()`, `onStateChange()`, `onSelection()` und `onError()` anbieten.

## InteractionRoot
`getInteractionRoot()` ist eine optionale Runtime-Erweiterung. Ist sie vorhanden, werden Interaktions-Listener dort installiert. Der `document`-Fallback wird nur genutzt, wenn er explizit als Option uebergeben wurde. Es gibt keine automatische Root-Suche.

## TargetResolver
`resolveSelectionTarget()` prueft nur explizite Referenzen. Treffer entstehen durch Element-Identitaet oder `contains()`. Nicht verfuegbare Referenzen und `selectable: false` werden uebersprungen. Bei mehreren Treffern gewinnt deterministisch: hoehere optionale `priority`, tiefere `parentId`-Hierarchie, kleinere sichtbare Flaeche, dann Registry-Reihenfolge.

## Controller-Lifecycle
`start()` ist idempotent und installiert Listener einmal. `stop()` entfernt Modus-Listener und den Hoverrahmen. `destroy()` entfernt Listener und Overlays dauerhaft; ein spaeteres `start()` bleibt wirkungslos und meldet einen Fehler.

## HoverOverlay
Das HoverOverlay verwaltet maximal einen festen Rahmen mit `pointer-events: none`, optionalem Label und `getBoundingClientRect()`-Positionierung. Ziel-Styles werden nicht veraendert.

## SelectedOverlay
Das SelectedOverlay verwaltet maximal einen festen orangefarbenen Rahmen. Es synchronisiert sich ueber `syncWithSelection()` mit der Host-Wahrheit und bleibt bei `stop()` sowie Escape sichtbar. Solange es sichtbar ist, verwaltet es eigene Scroll-/Resize-Listener fuer Positionsupdates; `clear()` und `destroy()` entfernen diese Listener.

## Host-Wahrheit
`selectedElementId` wird immer aus `host.getSelectedElementId()` gelesen. Interne Werte dienen nur Hover- und Overlay-Technik.

## Klickablauf
Ein gueltiger Klick im aktiven Modus ruft `preventDefault()`, stoppt Propagation, ruft `host.selectElement(elementId)` synchron oder asynchron auf, synchronisiert anschliessend die Auswahl und meldet `onSelection()`.

## Escape-Verhalten
Escape stoppt den Modus, entfernt Hover und loescht keine Host-Auswahl. Das SelectedOverlay bleibt sichtbar.

## Fehlerverhalten
Fehler werden an `options.onError()`, `host.onError()` oder `host.onStateChange()` gemeldet. Eventhandler erzeugen keine unkontrollierten Exceptions oder Promise-Rejections. Bei `selectElement()`-Fehlern wird Hover bereinigt und der Modus bleibt aktiv.

## Scroll-/Resize-Synchronisation
Scroll und Resize aktualisieren sichtbare Overlays ohne Dauerschleife und ohne Observer. Overlays registrieren ihre eigenen Listener nur solange ein Ziel sichtbar ist; Document-Scroll wird im Capture-Modus abonniert, damit verschachtelte Scrollcontainer Positionsupdates ausloesen. `clear()` und `destroy()` entfernen diese Listener vollstaendig.

## Sicherheitsgrenzen
Keine Zielanwendungsnamen, keine Electron- oder IPC-Abhaengigkeit, kein LayoutStore, keine Fachlogik, keine automatische Zielerkennung, keine CSS-Selektoren, keine DOM-Marker und keine Mutation der Zieloberflaeche.

## Integrationsbeispiel
```js
const controller = createSelectionController({ host, document, window });
controller.start();
controller.syncWithSelection();
```

## Bekannte Einschraenkungen
M58 liefert nur Selection, Hover und Selected-Rahmen. Drag, Resize, Persistenz, Undo, Eigenschaftenpanel und Layoutvorschau sind nicht enthalten.

## Migrationsplan fuer BBM
BBM liefert spaeter `listSelectableTargets()`, `getElementRef()`, `getSelectedElementId()`, `selectElement()`, `isExcludedTarget()`, `getInteractionRoot()` und `getElementMeta()`. BBM-lokale Dateien aus M55/M56 bleiben bis zur praktischen Gleichwertigkeit bestehen. M58 aktiviert BBM nicht.

## Naechster Schritt M59
M59 sollte die Runtime gegen eine konkrete Host-Adapter-Schicht pilotieren, ohne die fachneutralen Sicherheitsgrenzen aufzuweichen.
