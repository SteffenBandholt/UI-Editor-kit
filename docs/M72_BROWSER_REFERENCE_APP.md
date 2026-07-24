# M72 Browser-Referenzanwendung

## Zweck

M72 baut eine eigenständige, sichtbare Browser-Referenzanwendung fuer den fachneutralen UI-Editor. Sie verwendet Runtime, Panel, BrowserHostAdapter, ElementRef-Registry, SelectionHost, OverlayHost, BrowserStorage und BrowserBridge ausschliesslich ueber den oeffentlichen Einstieg `src/index.cjs`.

## Start

```bash
npm run reference:build
npm run reference:browser
```

Die lokale URL wird vom Startskript ausgegeben. In der Cloud-Ausfuehrung gilt M72 nur als gebaut; die echte manuelle Browserabnahme bleibt offen, bis die Checkliste in einem interaktiven Browser durchgefuehrt wurde.

## Dateistruktur

- `examples/browser-reference/index.html`
- `examples/browser-reference/reference-app.cjs`
- `examples/browser-reference/reference-app.css`
- `examples/browser-reference/reference-registry.cjs`
- `examples/browser-reference/reference-context.cjs`
- `examples/browser-reference/README.md`
- `scripts/reference/build-browser-reference.cjs`
- `scripts/reference/start-browser-reference.cjs`

## Initialisierungsreihenfolge

1. Registry erzeugen.
2. ElementRefs fuer feste Demo-IDs registrieren.
3. BrowserHostAdapter erzeugen.
4. BrowserStorage mit explizitem Storage-Objekt erzeugen.
5. Runtime erzeugen.
6. Runtime-Session beginnen.
7. PanelController erzeugen.
8. Panel mounten.
9. SelectionHost erzeugen.
10. OverlayHost erzeugen.
11. BrowserBridge erzeugen.
12. Gespeichertes Layout automatisch laden.

## Registry und ElementRefs

Die Registry ist eine eigenständige Datenquelle und enthält `demo.card`, `demo.heading`, `demo.action`, `demo.info` und `demo.locked`. ElementRefs werden einzeln per fester ID registriert; es gibt keine automatische DOM-Suche und keine Inventur.

## TargetContext und Profile

Standardkontext:

```js
{
  targetAppId: "ui-editor-reference",
  moduleId: "browser-demo",
  scopeId: "main",
  layoutProfileId: "default"
}
```

Das Kontextmodul kennt zusätzlich das neutrale Profil `compact`; Tests sichern die Trennung der Speicherschluessel.

## Auswahl, Panel und Overlay

Jedes Demo-Element hat eine ausdrueckliche Clickbindung auf `selectionHost.select(elementId)`. Hintergrundklick loescht die Auswahl kontrolliert. Panelklicks stoppen Propagation. Das Overlay wird vom M71-OverlayHost gerendert und bleibt pointer-events none.

## Storage und Autoload

Der Bootstrap liest `window.localStorage` nicht direkt im HTML. `createReferenceApp()` kapselt den Browser-Storage-Zugriff in `resolveBrowserStorage()`; bei SecurityError oder vergleichbaren Fehlern startet die App mit nicht verfuegbarem BrowserStorage weiter. Leerer Storage ist neutral; ungueltige oder nicht lesbare Daten werden mit strukturiertem Ergebniscode sichtbar gemeldet. Ohne Storage bleiben Sessionaenderungen moeglich, Speichern wird blockiert und es gibt keinen Memory-Fallback.

## Lifecycle

`startReferenceApp()` zeigt kontrollierte Bootstrapfehler im Dokument an. `createReferenceApp()` liefert Runtime, Controller, SelectionHost, OverlayHost, Bridge, ElementRefs und `destroy()`. Destroy entfernt Panel und Overlay, loest DOM-Listener und Controller-Subscription und deregistriert eigene Refs.

## Nicht-Ziele und M73

Keine Produktiv-Ziel-App, keine externe Fachanbindung, kein Drag-and-drop, keine Mehrfachauswahl und kein Autosave. M73 bleibt der Release-Candidate-Schritt.

## Editor-Layoutmodell, Text-Refs und Schrittweiten

M72 verwendet fuer editierbare Layoutwerte das verschachtelte Modell `{ elementId, element, text }`. Elementwerte bleiben unter `element` (`x`, `y`, `width`, `height`, `visible`), Textwerte bleiben unter `text` (`offsetX`, `offsetY`, `fontSize`). Flache Root-Textfelder wie `textOffsetX`, `textOffsetY` oder `fontSize` sind kein produktives Layoutmodell.

Der BrowserHostAdapter darf Textdarstellung nur ueber explizit von der Zielanwendung gelieferte `textRefs` oder `getTextRef(elementId)` bearbeiten. Er sucht keine Unterelemente automatisch, verwendet kein DOM-Scanning und kein `querySelector`. Text-Offsets sind relative Editorwerte: der urspruengliche Inline- beziehungsweise wirksame Computed-Wert wird vor der ersten Textaenderung erfasst und der Editorwert wird darauf addiert. `text.fontSize` ist ein absoluter Editor-Zielwert; ohne Editorwert bleibt die wirksame Ausgangsschriftgroesse massgeblich.

Reine Textbearbeitung darf die aeussere Elementgeometrie nicht veraendern. `text.offsetY` wird mit explizitem Text-Ref per Text-Transform angewendet; ohne Text-Ref wird eine vertikale Textverschiebung strukturiert blockiert, statt `paddingTop` oder eine andere box-modellveraendernde Technik auf dem aeusseren Element zu verwenden. Restore und Clear stellen die urspruenglichen Inlinewerte exakt wieder her, geben reine Stylesheetwerte wieder frei und entfernen editor-eigene CSS-Variablen. Panelposition und Elementzustand werden davon nicht beschaedigt.

Delta-Clients wie der PanelController verwenden `resolveOperationStep(...)`. Die Prioritaet lautet: `steps.resizeWidth` vor `steps.resize` vor Panel-Fallback, `steps.resizeHeight` vor `steps.resize` vor Panel-Fallback, `steps.move` vor Panel-Fallback, `steps.textMoveX`/`steps.textMoveY` vor `steps.textMove` vor Panel-Fallback sowie `steps.fontSize` vor Panel-Fallback. Nur positive, endliche Schrittweiten sind gueltig. Der Controller berechnet daraus Deltas und sendet verschachtelte Payloads; bei Textposition wird nur das geaenderte Textfeld gesendet. Direkte Runtime-Aufrufe liefern absolute Zielwerte und werden weiterhin anhand erlaubter Operationen, Felder und Limits validiert. Wenn die Registry eine positive endliche Schrittweite fuer das betroffene Feld definiert, prueft die Runtime die Differenz zwischen aktuellem Wert und angefordertem Zielwert mit derselben `resolveOperationStep(...)`-Logik und blockiert nicht schrittgerechte Zwischenwerte mit `VALUE_NOT_ALIGNED_TO_STEP`, bevor Host oder Session veraendert werden.
