# Codex-Startregel UI/PDF

Vor UI- oder PDF-Arbeiten muss Codex eine Startentscheidung ausgeben.

## Mindestinhalt

- Art der Ausgabe
- Editorfaehig: ja oder nein
- Editorfaehige Elemente
- Nicht editorfaehige Elemente
- Parent-Struktur
- Pruefung

## Kopierbares Startformular

```text
UI-/PDF-Entwurfsentscheidung
- Art der Ausgabe:
- Editorfaehig (ja/nein):
- Editorfaehige Elemente:
- Nicht editorfaehige Elemente:
- Parent-Struktur:
- Pruefung (z. B. scripts/ui-editor-contract-check.cjs):
- Ergebnis: GO / STOPP
```

## Grundsatz

Erst entscheiden, dann bauen.

Der Editor liest spaeter nur die fertigen Metadaten.

Der Editor raet nicht und scannt keine Fachlogik.

Codex analysiert keine bestehende UI, scannt keine bestehende UI, erzeugt keine automatische UI-Elementliste und migriert keine Legacy-UI automatisch.
