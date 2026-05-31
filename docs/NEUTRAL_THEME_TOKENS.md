# Neutrale Theme-Tokens

## Zweck

Dieses Dokument leitet aus der bestehenden Browser-Demo unter `demo/mini-inspector/mini-inspector-demo.css` eine fachneutrale visuelle Referenz ab.

Die Palette beschreibt nur vorhandene Farben und Darstellungsprinzipien der Demo.

Die technische CSS-Referenzdatei ist `styles/neutral-theme-tokens.css`.
Die Browser-Demo nutzt diese Tokens ueber `demo/mini-inspector/mini-inspector-demo.css`.

## Token-Uebersicht

- Hintergrund: `--ui-neutral-bg` = `#f6f8fc`
- Panel/Karte: `--ui-neutral-panel` = `#ffffff`
- Linie/Rahmen: `--ui-neutral-line` = `#d8deea`
- Haupttext: `--ui-neutral-text` = `#1f2937`
- Sekundaertext: `--ui-neutral-muted` = `#5f6b7a`
- Status OK: `--ui-neutral-ok` = `#0f766e`
- Status Fehler: `--ui-neutral-error` = `#b42318`
- sanfte Flaeche: `--ui-neutral-soft` = `#eef6ff`

Weitere in der Demo verwendete visuelle Werte:

- neutrale Arbeitsflaeche innen: `--ui-neutral-surface-soft` = `#fbfdff`
- gestrichelter Rahmen: `--ui-neutral-border-muted` = `#9aa8bd`
- Schatten: `--ui-neutral-shadow-soft` = `0 10px 24px rgba(31, 41, 55, 0.06)`
- Status-Rahmen OK: `--ui-neutral-ok-border-soft` = `rgba(15, 118, 110, 0.45)`
- Status-Rahmen Fehler: `--ui-neutral-error-border-soft` = `rgba(180, 35, 24, 0.45)`

## Fachneutraler Verwendungszweck

Die vorhandene Palette eignet sich fachneutral fuer:

- Demo-/Inspector-Bereiche
- neutrale Arbeitsflaechen
- Statusanzeigen
- Karten- und Panel-Strukturen
- Diagnose- und Pruefbereiche

Die visuelle Wirkung der Demo bleibt dabei:

- ruhig
- gut lesbar
- klar getrennt
- professionell neutral

## Grenzen

- Die Palette ist fachneutral.
- Sie ist keine Fachlogik.
- Sie speichert nichts.
- Sie wendet keine Layoutdaten an.
- Sie veraendert keine Ziel-UI.
- Sie ist eine visuelle Referenz.
- Sie fuehrt keine Ziel-UI-Mutation aus.
- Sie fuehrt keine Speicherung ein.

## Quelle

- `styles/neutral-theme-tokens.css`
- `demo/mini-inspector/mini-inspector-demo.css`
