# KIT-Uebernahme-Checkliste

Diese Checkliste hilft beim Uebernehmen des UI-Editor-Kits in eine neue App.

## 1) Welche Dateien muessen uebernommen werden?

- `README.md` (als Orientierung)
- `VERSION.md`
- `docs/UI_EDITOR_VERTRAG.md`
- `docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md`
- `docs/EINBAU_IN_NEUE_APP.md`
- `docs/ARCHITEKTUR.md`
- `codex/AGENTS_UI_EDITOR_BLOCK.md`
- `codex/CODEX_STARTREGEL_UI_PDF.md`
- `scripts/ui-editor-contract-check.cjs`
- spaeter bei Bedarf: `src/editor/README.md`

## 2) Wo wird der AGENTS-Block eingefuegt?

- Inhalt aus `codex/AGENTS_UI_EDITOR_BLOCK.md` in die `AGENTS.md` der Ziel-App uebernehmen.
- Der Block muss vor dem ersten UI-/PDF-Auftrag in der Ziel-App vorhanden sein.

## 3) Was muss vor dem ersten UI-/PDF-Auftrag erledigt sein?

- Uebernommene Dateien liegen in der Ziel-App vor.
- Codex-Startregel ist in der Ziel-App aktiv.
- Es gibt eine vollstaendige UI-/PDF-Entwurfsentscheidung.
- Editorfaehige Elemente sind mit `data-ui-*` Metadaten geplant.
- Vertragscheck in der Ziel-App laeuft auf den UI-/PDF-Quellen.

## 4) Was darf nicht fehlen?

- Klarer Hinweis: Das Kit ist fachneutral.
- Klarer Hinweis: Dieses Repo ist die Quelle der Wahrheit.
- Regel: Erst Entwurfsentscheidung, dann UI/PDF-Bau.
- Regel: Der Editor raet nicht.
- Regel: Der Editor scannt keine Fachlogik.
- Regel: Der Editor liest nur vorhandene `data-ui-*` Metadaten.
- Regel: Vertragscheck vor Editor-Einsatz laufen lassen.
- Ausschluss: Fachaktionen, Speichern, Anlegen, Loeschen, Upload, Import, Autosave sind keine Editor-Ziele.
