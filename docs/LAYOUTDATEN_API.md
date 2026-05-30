# Layoutdaten-API

## Zweck

Diese API buendelt die fachneutralen Layoutdaten-Bausteine des UI-Editor-Kits.

Sie ist der bevorzugte Einstieg fuer Validator, Extractor und Diagnose, damit spaetere Pakete nicht viele interne Einzeldateien direkt importieren muessen.

## Oeffentlicher Einstieg

- `scripts/layout-data-api.cjs`

## Oeffentliche Export-Funktionen

- `validateLayoutData`
- `extractLayoutDataFromDom`
- `extractAndValidateLayoutData`
- `createLayoutDataDiagnostics`
- `createLayoutDataDiagnosticsFromLayoutData`

## Interne Dateien (weiterhin vorhanden)

Diese Dateien bleiben intern separat und duerfen bestehen:

- `scripts/layout-data-validator.cjs`
- `scripts/layout-data-extractor.cjs`
- `scripts/layout-data-diagnostics.cjs`

Direkte Imports aus diesen internen Dateien sollen kuenftig vermieden werden, wenn die API ausreicht.

## Rueckgabeformate

### Validator (`validateLayoutData`)

Rueckgabe:

- `ok: boolean`
- `errors: Array<{ path, code, message }>`

### Extractor (`extractLayoutDataFromDom`)

Rueckgabe (Layoutdaten-Modell):

- `version: number`
- `scope: string`
- `items: object`

### Diagnose (`createLayoutDataDiagnostics`, `createLayoutDataDiagnosticsFromLayoutData`)

Rueckgabe:

- `ok: boolean`
- `layoutData: object`
- `validation: { ok, errors }`
- `errors: Array`
- `summary: { itemCount, errorCount, scope, version }`

## Abgrenzung

Die Layoutdaten-API:

- speichert nichts
- schreibt keine Dateien
- wendet keine Layoutdaten auf UI/DOM an
- enthaelt keine Fachlogik
- setzt keine Fachdaten voraus

## Stabilitaetsvertrag (K1.9)

- `scripts/layout-data-api.cjs` ist der bevorzugte oeffentliche Einstieg.
- Direkte Imports aus internen Einzeldateien sollen vermieden werden, wenn die API ausreicht.
- Bestehende interne Dateien duerfen bleiben.
- Rueckgabeformen mit `ok`, `errors`, `summary`, `layoutData` gelten als stabiler Vertrag.
- Erweiterungen duerfen additiv erfolgen.
- Bestehende Felder duerfen nicht ohne neues Paket entfernt oder umbenannt werden.

## Beispiel (Node/CommonJS)

```js
const {
  validateLayoutData,
  extractLayoutDataFromDom,
  createLayoutDataDiagnostics,
} = require("./scripts/layout-data-api.cjs");

const validation = validateLayoutData({
  version: 1,
  scope: "neutral.scope",
  items: {},
});

// Optional: Diagnose auf einer DOM-/Mock-Struktur
// const report = createLayoutDataDiagnostics(rootElement, { scope: "neutral.scope" });
```
