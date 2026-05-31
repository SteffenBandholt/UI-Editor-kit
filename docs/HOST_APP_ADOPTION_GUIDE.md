# Host-App Adoption Guide

## Zweck

Dieser Leitfaden zeigt einer beliebigen Host-App, wie sie den vorhandenen Browser-Host-Adapter fachneutral einbindet.

## Schrittfolge

### Schritt 1: Theme-Tokens einbinden

Die Host-App bindet die neutralen Theme-Tokens aus `styles/neutral-theme-tokens.css` ein.

### Schritt 2: Browser-Host-Adapter einbinden

Die Host-App laedt `browser/mini-inspector-host-adapter.js`.

### Schritt 3: Neutrale Metadaten setzen

Die Ziel-UI der Host-App erhaelt neutrale `data-ui-*` Metadaten an lesbaren Elementen.

### Schritt 4: Inspector-Container bereitstellen

Die Host-App stellt einen getrennten Inspector-Container bereit.

### Schritt 5: Adapter aufrufen

Die Host-App ruft auf:

`window.miniInspectorHostAdapter.updateMiniInspectorHostAdapter(rootElement, inspectorContainer, options)`

### Schritt 6: Ergebnis pruefen

Der Rueckgabestatus enthaelt:

- `ok`
- `itemCount`
- `errorCount`
- `scope`
- `version`
- `errors`

## Rollen

### Host-App

- baut die Ziel-UI
- besitzt die Fachdaten, falls vorhanden
- setzt neutrale `data-ui-*` Metadaten
- stellt den Inspector-Container bereit

### UI-Editor-Kit

- liest neutrale Metadaten
- erzeugt neutralen Status
- rendert nur in den Inspector-Container
- veraendert die Ziel-UI nicht

## Beispielpfade

- `examples/host-app-basic/index.html`
- `examples/host-app-basic/host-app-basic.js`
- `browser/mini-inspector-host-adapter.js`
- `styles/neutral-theme-tokens.css`

## Minimale HTML-Struktur

```html
<main>
  <section id="targetRoot" data-ui-demo-root="true" aria-label="Zielbereich">
    <section data-ui-inspector-id="beispiel.bereich-a" data-ui-layout-order="1">
      <strong>Bereich A</strong>
      <span>Element</span>
    </section>
    <section data-ui-inspector-id="beispiel.bereich-b" data-ui-layout-order="2">
      <strong>Bereich B</strong>
      <span>Element</span>
    </section>
  </section>

  <aside id="inspectorContainer" aria-live="polite"></aside>
</main>
```

## Minimale JavaScript-Struktur

```js
var rootElement = document.getElementById("targetRoot");
var inspectorContainer = document.getElementById("inspectorContainer");

window.miniInspectorHostAdapter.updateMiniInspectorHostAdapter(
  rootElement,
  inspectorContainer,
  { scope: "mini-inspector-demo.scope" }
);
```

## Grenzen

- kein Speichern
- kein localStorage
- kein sessionStorage
- keine Layout-Anwendung
- keine Ziel-UI-Mutation
- keine Fachlogik
- keine Fachdaten lesen
- kein Drag & Drop
- keine Bearbeitung von Layoutdaten

Der Adapter arbeitet rein lesend gegen die Ziel-UI und aktualisiert nur den Inspector-Container.
