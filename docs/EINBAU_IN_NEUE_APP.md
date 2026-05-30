# Einbau in eine neue App

## Ziel

Dieses Kit wird in eine neue App uebernommen, bevor dort UI- oder PDF-Strukturen gebaut werden.

Fuer einen dokumentierten Trockenlauf ohne echte Ziel-App siehe `docs/UEBERNAHME_TROCKENLAUF.md`.

Fuer neue Apps zuerst den Bootstrap-Auftrag aus `codex/CODEX_BOOTSTRAP_ZIEL_APP.md` verwenden.

## Verbindliche Reihenfolge vor dem ersten UI-/PDF-Auftrag

1. Kit in neues App-Repository uebernehmen.
2. AGENTS-Block aus `codex/AGENTS_UI_EDITOR_BLOCK.md` in `AGENTS.md` der Ziel-App einfuegen.
3. `docs/UI_EDITOR_VERTRAG.md` in der Ziel-App verfuegbar machen.
4. `scripts/ui-editor-contract-check.cjs` in der Ziel-App verfuegbar machen.
5. Vertragscheck einmal mit Beispiel oder Ziel-UI ausfuehren.
6. Erst danach die erste UI-/PDF-Aufgabe an Codex geben.
7. Codex muss vor jeder Umsetzung eine vollstaendige UI-/PDF-Entwurfsentscheidung liefern.

## Beispiel fuer den Vertragscheck

```bash
node scripts/ui-editor-contract-check.cjs examples/beispiel-ui/beispiel.html
```

## Minimal zu uebernehmende Dateien

- `docs/UI_EDITOR_VERTRAG.md`
- `docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md`
- `codex/AGENTS_UI_EDITOR_BLOCK.md`
- `codex/CODEX_STARTREGEL_UI_PDF.md`
- `scripts/ui-editor-contract-check.cjs`
- `docs/EINBAU_IN_NEUE_APP.md`
- `docs/KIT_UEBERNAHME_CHECKLISTE.md`

## Was ausdruecklich nicht passieren darf

- Keine UI-/PDF-Umsetzung ohne Entwurfsentscheidung.
- Keine Fachaktionen als Editor-Ziele planen.
- Keine Ableitung von Fachlogik durch den Editor.
- Kein Raten ueber Metadaten oder Parent-Strukturen.

## Grundsatz

Die Dateien dieses Kits sind die Quelle der Wahrheit fuer den fachneutralen UI-/PDF-Editor in neuen Apps.

Der Editor ist fachneutral.

Die Fach-App liefert editorfaehige Elemente ueber Metadaten.

Der Editor liest nur diese Metadaten und bearbeitet Darstellungseigenschaften.

Der Editor raet nicht und scannt keine Fachlogik.
