# Selection Target Contract v1.0

Vertragsversion: `selection-target-contract-v1.0`.

## Zweck

Dieser Vertrag beschreibt eine framework- und plattformneutrale Schnittstelle fuer visuelle UI-Auswahl, Hover-Markierung und dauerhafte Auswahlmarkierung.

## Rollenverteilung

- Das Kit validiert Metadaten, Host-Funktionen und Controller-Formen.
- Die Zielanwendung besitzt UI-Elemente, Auswahlstatus und konkrete Laufzeitreferenzen.
- Referenzen werden ausdruecklich gebunden und entfernt.
- Fehlende Referenzen gelten als nicht verfuegbar.
- Das Kit erzeugt keine Registry aus der sichtbaren Oberflaeche und sucht keine Elemente selbst.

## Registry und RefResolver

Die Registry liefert serialisierbare Metadaten. Ein separater `ElementRefResolver` liefert zur `elementId` die aktuelle Laufzeitreferenz.

## UiElementTarget

- `elementId`: eindeutige Zeichenkette
- `label`: optionaler Anzeigename
- `parentId`: optionale Hierarchieinformation
- `selectable`: optional, Standard `true`
- `metadata`: optionale hosteigene Daten

Konkrete Referenzen gehoeren nicht in die Registry-Metadaten.

## SelectionHost

Mindestens erforderlich:

- `listSelectableElementIds()` oder `listSelectableTargets()`
- `getElementRef(elementId)`
- `getSelectedElementId()`
- `selectElement(elementId)`

Optional:

- `getElementMeta(elementId)`
- `isExcludedTarget(eventTarget)`
- `onStateChange(state)`
- `onSelection(selection)`

## SelectionController

Der Controller-Vertrag umfasst:

- `start()`
- `stop()`
- `destroy()`
- `isActive()`
- `getState()`
- `refreshHover()`
- `syncWithSelection()`

`start` und `stop` sind idempotent. `destroy` entfernt alle Listener und visuellen Elemente. Der Controller besitzt keinen zweiten fachlichen Auswahlstatus.

## Markierungen

Hover- und Auswahlmarkierung erhalten ausschliesslich explizite Referenzen, veraendern das Ziel nicht und speichern keinen fachlichen Auswahlstatus. Pro Rolle gibt es hoechstens eine Markierung.

## Zielaufloesung

Treffer werden nur aus explizit gelieferten Referenzen berechnet. Bei verschachtelten Treffern gewinnt zuerst die tiefere registrierte Hierarchie, danach die kleinere sichtbare Flaeche und zuletzt die stabile Registry-Reihenfolge.

Nicht erlaubt sind automatische Zielerkennung, strukturweite Abfragen, Selektorersatz oder automatische Registry-Befuellung.

## Ausschlussbereiche

Ausschlussbereiche werden ausdruecklich vom Host geliefert. Ereignisse in ausgeschlossenen Bereichen werden nicht abgefangen.

## Selection-State

```js
{
  active: true,
  hoveredElementId: "app.card.title",
  selectedElementId: "app.header",
  boundTargetCount: 2,
  unavailableElementIds: []
}
```

`selectedElementId` wird ausschliesslich aus dem Host gelesen.

## Fehlerverhalten

Resolver-, Auswahl- oder Markierungsfehler duerfen die Zielanwendung nicht unbedienbar machen. Mehrfaches Starten, Stoppen und Synchronisieren erzeugt keine doppelten Listener oder Markierungen.

## Sicherheitsgrenzen

Keine automatische Zielerkennung, keine Selektoren als Referenzersatz, keine sichtbare Oberflaechenstruktur als Registry, keine Fachlogik, keine Fachdaten und keine zielanwendungsspezifischen Namen im Kit-Vertrag.

## Versionierung

Kompatible Klarstellungen behalten `selection-target-contract-v1.0`. Breaking Changes erfordern eine neue Vertragsversion.
