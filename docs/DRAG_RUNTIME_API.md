# Drag-Runtime-API

## Zweck

Die Drag-Runtime ist eine neutrale Modell- und Berechnungsschicht fuer spaetere Editor-Bewegungen.

Sie beschreibt nur:

- Bounds
- Delta
- optionale Constraints
- Koordinatensystem
- berechnetes Ergebnis

Sie bindet keine Ereignisse an und rendert keine Oberflaeche.

## Zielpfad

```text
src/runtime/drag/
```

Enthaltene Einstiege:

```text
src/runtime/drag/index.cjs
src/runtime/drag/index.mjs
```

## Package-Subpath

Der offizielle Subpath lautet:

```text
ui-editor-kit/runtime/drag
```

## Unterstuetzte Koordinatensysteme

- `css-pixels`
- `pdf-points`
- `canvas-pixels`

## Modell

```js
{
  elementId: "example.element",
  startBounds: {
    x: 10,
    y: 20,
    width: 100,
    height: 30
  },
  delta: {
    x: 15,
    y: -5
  },
  constraints: {
    minX: 0,
    minY: 0,
    maxX: 1000,
    maxY: 800
  },
  coordinateSystem: "css-pixels"
}
```

Ergebnis:

```js
{
  elementId: "example.element",
  bounds: {
    x: 25,
    y: 15,
    width: 100,
    height: 30
  },
  changed: true
}
```

## Exporte

- `SUPPORTED_DRAG_COORDINATE_SYSTEMS`
- `normalizeDragBounds(input)`
- `validateDragBounds(input)`
- `normalizeDragDelta(input)`
- `validateDragDelta(input)`
- `applyDragDelta(bounds, delta)`
- `clampBoundsToConstraints(bounds, constraints)`
- `buildDragResult(input)`
- `isSupportedDragCoordinateSystem(coordinateSystem)`

## Grenzen

- Keine DOM-Events.
- Keine Maus- oder Pointer-Anbindung.
- Keine Persistenz.
- Kein Speichern im Kit.
- Der Host bleibt fuer Rechte, Speicherort, Scope-Freigaben und konkrete Anwendung verantwortlich.
- PDF- und Canvas-Unterstuetzung ist nur koordinatenmodellseitig vorbereitet.
