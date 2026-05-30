# Layoutdaten-Kern Referenz (K1)

## Zweck

Dieses Dokument markiert den K1-Layoutdaten-Kern als fachneutralen Referenzstand.

Der Referenzstand stellt die technische Basis fuer spaetere K2-Pakete bereit.

## Enthaltene Bausteine

- Layoutdaten-Modell: `docs/LAYOUTDATEN_MODELL.md`
- Layoutdaten-API-Vertrag: `docs/LAYOUTDATEN_API.md`
- Validator: `scripts/layout-data-validator.cjs`
- Extractor: `scripts/layout-data-extractor.cjs`
- Diagnose: `scripts/layout-data-diagnostics.cjs`
- Diagnose-CLI: `scripts/layout-data-diagnostics-cli.cjs`
- Tests: `scripts/tests/`
- Fixtures: `scripts/tests/fixtures/`

## Oeffentlicher Einstieg

- `scripts/layout-data-api.cjs`

Diese Datei ist der bevorzugte Einstieg fuer Validator, Extractor und Diagnose.

## Befehle

- Testbefehl: `npm test`
- CLI-Befehl: `npm run layout:diagnose`
- Optional mit Datei-Eingabe:
  `npm run layout:diagnose -- scripts/tests/fixtures/valid-layout-data.json`

## Klare Grenzen

- kein Speichern
- keine Layout-Anwendung
- keine UI-Erweiterung
- keine Fachlogik

## Referenzstand-Aussage

K1 ist der Referenzstand fuer spaetere K2-Pakete im UI-Editor-Kit.
