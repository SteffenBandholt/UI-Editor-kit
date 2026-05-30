# AGENTS-Block UI-Editor

Diesen Block unveraendert in die `AGENTS.md` einer Ziel-App uebernehmen.

## Verbindliche Regel fuer UI/PDF-Aufgaben

Vor jeder UI- oder PDF-Umsetzung muss zuerst eine UI-/PDF-Entwurfsentscheidung vorliegen.

Die Entwurfsentscheidung muss enthalten:

- Art der Ausgabe: UI, PDF, beides oder nicht editorrelevant
- Editorfaehig: ja oder nein
- Editorfaehige Elemente
- Pflichtattribute je editorrelevantem Element:
  - `data-ui-inspector-id`
  - `data-ui-editor-kind`
  - `data-ui-editor-label`
  - `data-ui-editor-parent`
  - `data-ui-editor-editable`
  - optional: `data-ui-editor-ops`
- Nicht editorfaehige fachliche Aktionen
- Parent-Struktur
- Pruefung mit `scripts/ui-editor-contract-check.cjs` oder klarer Hinweis, falls die Pruefung noch fehlt

## Ausschluss fachlicher Aktionen als Editor-Ziele

Nicht editorfaehig sind insbesondere:

- Fachaktionen
- Speichern
- Anlegen
- Loeschen
- Upload
- Import
- Autosave
- fachliche IPC-/Datenaktionen

## Stop-Regel

Wenn die Entwurfsentscheidung fehlt oder unvollstaendig ist: STOPP.

In diesem Fall darf keine UI- oder PDF-Struktur umgesetzt werden.
