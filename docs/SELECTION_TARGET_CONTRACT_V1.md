# Selection Target Contract v1.0

Vertragsversion: `selection-target-contract-v1.0`.

## Zweck

Dieser Vertrag beschreibt eine frameworkneutrale Schnittstelle fuer visuelle UI-Auswahl, Hover-Markierung und dauerhafte Auswahlmarkierung. Das Kit definiert nur Vertrag, Validierung und Architektur. Eine vollstaendige Selection-Runtime, Browser-Overlays und Event-Listener werden in diesem Paket noch nicht implementiert.

## Rollenverteilung Kit / Zielanwendung

- Das Kit validiert Metadaten, Host-Funktionen und Controller-Formen.
- Die Zielanwendung besitzt UI-Elemente, fachlichen Auswahlstatus und echte `HTMLElement`-Referenzen.
- Die Zielanwendung bindet und entfernt Referenzen ausdruecklich.
- Fehlende Referenzen sind erlaubt und gelten als nicht verfuegbar.
- Das Kit erzeugt keine Registry aus der Dokumentstruktur und sucht keine Elemente selbst.

## Registry vs. RefResolver

Die Registry liefert serialisierbare Metadaten. Ein separater `ElementRefResolver` liefert zur `elementId` die aktuelle `HTMLElement`-Referenz:

```js
const selectionHost = {
  listSelectableElementIds: () => ["app.header", "app.card.title"],
  getElementMeta: (elementId) => registry.get(elementId) || null,
  getElementRef: (elementId) => elementRefs.get(elementId) || null,
  getSelectedElementId: () => selectionStore.currentId,
  selectElement: (elementId) => selectionStore.select(elementId),
};
```

HTMLElement-Referenzen werden dadurch nicht serialisiert, nicht ueber Prozessgrenzen transportiert und nicht als CSS-Selektor ersetzt.

## UiElementTarget

`UiElementTarget` ist die neutrale Metadatenform:

- `elementId`: nicht leere, eindeutige Zeichenkette.
- `label`: optionaler Anzeigename.
- `parentId`: optionale Hierarchieinformation.
- `selectable`: optionaler boolean, Standard `true`.
- `metadata`: optionale hosteigene Daten.

`elementRef` gehoert nicht in die Registry-Metadaten. Echte Referenzen kommen ausschliesslich aus `getElementRef(elementId): HTMLElement | null`.

## SelectionHost

Ein `SelectionHost` stellt mindestens bereit:

- `listSelectableElementIds()` oder `listSelectableTargets()`.
- `getElementRef(elementId): HTMLElement | null`.
- `getSelectedElementId(): string | null`.
- `selectElement(elementId): void | result`.

Optional:

- `getElementMeta(elementId)`.
- `isExcludedTarget(eventTarget): boolean`.
- `onStateChange(state)`.
- `onSelection(selection)`.

Der Host ist die einzige fachliche Quelle fuer Auswahl. Der Controller delegiert Auswahl ueber `selectElement` und liest Anzeigezustand ueber `getSelectedElementId`.

## SelectionController

Eine spaetere Runtime kann `createSelectionController(options)` bereitstellen. Der oeffentliche Controller-Vertrag umfasst:

- `start()`.
- `stop()`.
- `destroy()`.
- `isActive()`.
- `getState()`.
- `refreshHover()`.
- `syncWithSelection()`.

Verbindliches Verhalten:

- `start` ist idempotent und installiert aktive Listener hoechstens einmal.
- `stop` ist idempotent und beendet nur den Auswahlmodus.
- `destroy` ist endgueltiger Cleanup.
- Ausserhalb des aktiven Auswahlmodus gibt es keine Auswahlmodus-Listener.
- Escape ruft `stop` auf.
- Nach erfolgreicher Auswahl bleibt der Auswahlmodus aktiv.
- Klicks auf gueltige Ziele werden nur im aktiven Modus abgefangen.
- Ausgeschlossene Bereiche bleiben normal bedienbar.
- Der Controller besitzt keinen zweiten fachlichen Auswahlstatus.

## HoverOverlay

`HoverOverlay` ist nur im aktiven Auswahlmodus sichtbar. Es zeigt einen Hover-Rahmen mit optionalem Label, verschwindet bei `stop`, Escape oder `destroy`, setzt `pointer-events: none` und veraendert das Ziel nicht.

## SelectedOverlay

`SelectedOverlay` zeigt den bestehenden Auswahlstatus des Hosts. Es bleibt unabhaengig vom aktiven Auswahlmodus sichtbar, verschwindet bei leerer Auswahl oder `destroy`, setzt `pointer-events: none` und veraendert das Ziel nicht.

## Gemeinsame Overlay-Regeln

- Overlays erhalten ein explizites `HTMLElement`.
- Positionierung erfolgt ueber `getBoundingClientRect()`.
- Overlays kennen keine Registry.
- Overlays speichern keine fachliche Auswahl.
- Je Rolle gibt es maximal einen Rahmen.
- Scroll- und Resize-Synchronisation erfolgt ereignisbasiert ohne permanente Render-Schleife.
- Alle Listener und visuellen Elemente werden vollstaendig entfernt.

## Zielaufloesung

Treffer werden nur aus explizit gelieferten `HTMLElement`-Referenzen berechnet. Ein Ereignisziel passt, wenn es identisch mit einer Zielreferenz ist oder von ihr enthalten wird. Bei verschachtelten Treffern gewinnt das konkreteste Ziel: zuerst die tiefere explizite `parentId`-Hierarchie, danach die kleinere `getBoundingClientRect()`-Flaeche. Bleibt ein Gleichstand, entscheidet die Reihenfolge aus `listSelectableElementIds()` beziehungsweise `listSelectableTargets()` deterministisch.

Nicht erlaubt sind strukturweite Dokumentabfragen, automatische Zielerkennung, Selektorersatz, DOM-Scans, Beobachter zur Registry-Befuellung oder Datenattribute als Registry.

## Ausschlussbereiche

Ausschlussbereiche werden ausdruecklich vom Host geliefert, bevorzugt ueber `isExcludedTarget(eventTarget): boolean`. Alternativ kann eine Runtime explizite ausgeschlossene Elementreferenzen akzeptieren. Es gibt keine Selektoren. Klicks in ausgeschlossenen Bereichen werden nicht verhindert, und der Hover-Rahmen wird dort entfernt.

## Hover/Selected-Zusammenspiel

- Hover auf nicht ausgewaehltem Ziel: Hover- und Auswahlrahmen duerfen gleichzeitig sichtbar sein.
- Hover auf ausgewaehltem Ziel: kein identischer doppelter Rahmen.
- Auswahlwechsel: `SelectedOverlay` wechselt sofort auf das neue Host-Ziel.
- Aendert sich der Auswahlstatus bei unveraendertem Hoverziel, synchronisiert `syncWithSelection()` den Hover sofort; keine weitere Mausbewegung ist erforderlich.
- Reset: `SelectedOverlay` verschwindet.
- Escape: Hover verschwindet, Auswahl bleibt.

## Selection-State

Der neutrale Anzeigestate lautet:

```js
{
  active: true,
  hoveredElementId: "app.card.title",
  selectedElementId: "app.header",
  boundTargetCount: 2,
  unavailableElementIds: []
}
```

`selectedElementId` ist ausschliesslich aus `getSelectedElementId()` abgeleitet. Der Controller darf diesen Wert nicht als zweite fachliche Auswahlhaltung fuehren.

## Fehlerverhalten und Lifecycle

- Resolver-Fehler fuehren dazu, dass das Ziel uebersprungen oder der Auswahlmodus sicher beendet wird.
- Overlay-Fehler duerfen die Zielanwendung nicht unbedienbar machen.
- Fehler in `selectElement` werden kontrolliert behandelt; Listener und Overlays bleiben konsistent.
- Mehrfaches `start`, `stop`, `refreshHover` und `syncWithSelection` erzeugt keine doppelten Listener oder Overlays.
- `destroy` entfernt alle Listener und visuellen Elemente.

## Sicherheitsgrenzen

Keine automatische Zielerkennung, keine CSS-Selektoren als Ersatz fuer Referenzen, keine Dokumentstruktur als Registry, keine IPC-Abhaengigkeit, keine LayoutStore-Abhaengigkeit, kein Inline-Style-Eingriff am Ziel und keine zielanwendungsspezifischen Namen im Kit-Vertrag.

## Integrationsbeispiel

```js
const registry = new Map([
  ["app.root", { elementId: "app.root", label: "Root" }],
  ["app.action", { elementId: "app.action", parentId: "app.root", label: "Action" }],
]);
const elementRefs = new Map();

export function bindElement(elementId, element) {
  elementRefs.set(elementId, element);
}

export function unbindElement(elementId) {
  elementRefs.delete(elementId);
}

export const host = {
  listSelectableElementIds: () => [...registry.keys()],
  getElementMeta: (elementId) => registry.get(elementId) || null,
  getElementRef: (elementId) => elementRefs.get(elementId) || null,
  getSelectedElementId: () => currentSelectionId,
  selectElement: (elementId) => setCurrentSelectionId(elementId),
  isExcludedTarget: (eventTarget) => editorPanelRef.current === eventTarget || editorPanelRef.current?.contains(eventTarget),
};
```

## Migrationsweg fuer BBM

M55/M56 bleiben zunaechst unveraendert. In einem spaeteren Paket wandert eine generische Runtime ins Kit. Die Anwendung liefert dann nur Registry, `ElementRefResolver`, Host-Callbacks und Ausschlussbereich. Lokale Controller- und Overlay-Dateien der Anwendung werden erst entfernt, wenn die Kit-Runtime praktisch gleichwertig geprueft ist.

## Migrationsweg fuer eine zweite Zielanwendung

Eine zweite Anwendung bringt eigene Registry, eigenen `ElementRefResolver`, eigenen Auswahlstatus und eigenen Adapter mit. Sie kopiert keinen Anwendungscode aus der Referenzintegration.

## Versionierungsregel

`selection-target-contract-v1.0` ist unabhaengig von der Paketversion. Kompatible Klarstellungen behalten die Vertragsversion. Breaking Changes erfordern eine neue Vertragsversion und duerfen bestehende Exports nicht stillschweigend veraendern.
