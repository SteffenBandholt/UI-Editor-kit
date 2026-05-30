# Einbau in eine neue App

## Ziel

Dieses Kit wird in eine neue App uebernommen, bevor dort UI- oder PDF-Strukturen gebaut werden.

## Schritte

1. Neues App-Repository anlegen.
2. Dieses UI-Editor-Kit als Quelle verwenden.
3. `docs/UI_EDITOR_VERTRAG.md` in die neue App uebernehmen.
4. Den Inhalt aus `codex/AGENTS_UI_EDITOR_BLOCK.md` in die `AGENTS.md` der neuen App uebernehmen.
5. Vor jeder UI-/PDF-Aufgabe eine UI-/PDF-Entwurfsentscheidung erstellen lassen.
6. UI/PDF nur mit den im Vertrag festgelegten Metadaten bauen lassen.
7. Erst danach den Editor verwenden.

## Minimal zu uebernehmende Dateien

- `docs/UI_EDITOR_VERTRAG.md`
- `docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md`
- `codex/AGENTS_UI_EDITOR_BLOCK.md`
- spaeter: `src/editor/`
- spaeter: `scripts/ui-editor-contract-check.cjs`

## Grundsatz

Der Editor ist fachneutral.

Die Fach-App liefert editorfaehige Elemente ueber Metadaten.

Der Editor liest nur diese Metadaten und bearbeitet Darstellungseigenschaften.
