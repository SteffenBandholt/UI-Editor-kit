# Uebernahme-Trockenlauf

## A) Ausgangslage

Es gibt eine neue Ziel-App.

Die Ziel-App soll spaeter UI-/PDF-Editorfaehigkeit bekommen.

Das UI-Editor-Kit wird uebernommen, bevor UI-/PDF-Strukturen gebaut werden.

## B) Dateien, die uebernommen werden

- `docs/UI_EDITOR_VERTRAG.md`
- `docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md`
- `docs/EINBAU_IN_NEUE_APP.md`
- `docs/KIT_UEBERNAHME_CHECKLISTE.md`
- `codex/AGENTS_UI_EDITOR_BLOCK.md`
- `codex/CODEX_STARTREGEL_UI_PDF.md`
- `scripts/ui-editor-contract-check.cjs`
- spaeter: `src/editor/`

## C) Reihenfolge in der Ziel-App

1. Kit-Dateien uebernehmen.
2. AGENTS-Block in `AGENTS.md` der Ziel-App einfuegen.
3. Vertragscheck verfuegbar machen.
4. Vor dem ersten UI-/PDF-Auftrag Entwurfsentscheidung verlangen.
5. Erst nach sauberer Entwurfsentscheidung UI/PDF bauen.
6. Danach Vertragscheck ausfuehren.
7. Erst danach Editor einsetzen.

## D) Beispielbefehle

Beispiel fuer lokalen Check im Kit:

```bash
node scripts/ui-editor-contract-check.cjs examples/beispiel-ui/beispiel.html
```

Beispiel fuer spaetere Ziel-App:

```bash
node scripts/ui-editor-contract-check.cjs <pfad-zur-ziel-ui.html>
```

## E) Harte Stop-Punkte

- Kein AGENTS-Block vorhanden -> STOPP.
- Keine Entwurfsentscheidung -> STOPP.
- Pflichtattribute fehlen -> STOPP.
- Parent-Struktur unklar -> STOPP.
- Fachaktionen als Editor-Ziele geplant -> STOPP.

## F) Klarstellung

Der Trockenlauf baut keine App.

Der Trockenlauf baut keinen Editor.

Der Trockenlauf prueft nur die Uebernahmefaehigkeit des Kits.
