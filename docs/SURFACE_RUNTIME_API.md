# Surface-Runtime-API

## Zweck

Die Surface-Runtime ist ein neutrales Modell fuer spaetere Editor-Faehigkeiten auf unterschiedlichen Oberflaechen.

Sie beschreibt nur:

- Surface-Identitaet
- Surface-Typ
- Koordinatensystem
- optionale Seitendaten
- Elemente
- Sichtbarkeit
- optionale Bounds
- optionale Element-Faehigkeiten

Sie rendert keine Oberflaeche und speichert keine Daten.

## Zielpfad

```text
src/runtime/surface/
```

Enthaltene Einstiege:

```text
src/runtime/surface/index.cjs
src/runtime/surface/index.mjs
```

## Package-Subpath

Der offizielle Subpath lautet:

```text
ui-editor-kit/runtime/surface
```

## Unterstuetzte Surface-Typen

- `ui-screen`
- `panel`
- `pdf-page`
- `canvas`
- `plan`

## Modell

```js
{
  surfaceId: "protokoll.topsScreen",
  surfaceType: "ui-screen",
  coordinateSystem: "css-pixels",
  elements: [
    {
      elementId: "example.element",
      label: "Beispiel",
      visible: true,
      bounds: {
        x: 0,
        y: 0,
        width: 100,
        height: 30
      },
      capabilities: {
        canHide: true,
        canMove: false,
        canResize: false
      }
    }
  ]
}
```

Fuer spaetere Seitenmodelle ist nur das Modell vorbereitet:

```js
{
  surfaceId: "pdf.plan.page.1",
  surfaceType: "pdf-page",
  pageNumber: 1,
  coordinateSystem: "pdf-points",
  elements: []
}
```

## Exporte

- `SUPPORTED_SURFACE_TYPES`
- `normalizeSurfaceElement(input)`
- `normalizeSurfaceModel(input)`
- `validateSurfaceElement(input)`
- `validateSurfaceModel(input)`
- `isSupportedSurfaceType(surfaceType)`

## Grenzen

- Das Kit speichert nicht.
- Der Host bleibt fuer Persistenz, Rechte, Scopes und fachliche Freigaben verantwortlich.
- Seiten- und Canvas-Unterstuetzung ist nur modellseitig vorbereitet.
- Es gibt keine produktive Renderlogik, keine produktive Drag-Aenderung und keinen Speicherweg.
