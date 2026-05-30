# Beispiel-UI

Dieser Ordner enthaelt eine einfache, fachneutrale Demo-Struktur mit gueltigen Editor-Metadaten.

## Dateien

- `beispiel.html`

## Pruefung

Beispielbefehl:

```bash
node scripts/ui-editor-contract-check.cjs examples/beispiel-ui/beispiel.html
```

Der Vertragscheck prueft nur vorhandene `data-ui-*` Metadaten gemaess Vertrag.
