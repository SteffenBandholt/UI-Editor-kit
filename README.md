# UI-Editor-Kit

Wiederverwendbares, fachneutrales UI-/PDF-Editor-Kit.

Dieses Repository ist die zentrale Quelle fuer:

- den UI-Editor-Vertrag,
- die Codex-Regeln fuer UI-/PDF-Entwurfsentscheidungen,
- die Einbauanleitung fuer neue Apps,
- spaetere Editor-Core-Dateien,
- generische Vertragspruefungen.

Diese Struktur ist die Quelle der Wahrheit fuer den fachneutralen UI-/PDF-Editor.

## Grundsatz

Der Editor kennt keine Fachmodule.

Er kennt nicht:

- Restarbeiten,
- Protokoll,
- Pferdeverwaltung,
- Speichern von Fachdaten,
- Anlegen oder Loeschen fachlicher Datensaetze,
- Upload, Import oder Autosave.

Er kennt nur editorfaehige Elemente mit expliziten Metadaten:

- `data-ui-inspector-id`
- `data-ui-editor-kind`
- `data-ui-editor-label`
- `data-ui-editor-parent`
- `data-ui-editor-editable`
- `data-ui-editor-ops`

Der Editor scannt keine Fachlogik und leitet keine Fachbeziehungen her.

## Ziel

Neue Apps sollen dieses Kit uebernehmen, bevor UI- oder PDF-Strukturen gebaut werden.

Der entscheidende Moment liegt vor der Umsetzung:

1. UI-/PDF-Aufgabe wird formuliert.
2. Codex muss eine UI-/PDF-Entwurfsentscheidung liefern.
3. Erst danach darf gebaut werden.
4. Die UI/PDF wird mit klaren Editor-Metadaten erstellt.
5. Der Editor liest spaeter nur diese Metadaten.

## Einstieg fuer neue Apps

Siehe:

- `docs/EINBAU_IN_NEUE_APP.md`
- `docs/UI_EDITOR_VERTRAG.md`
- `codex/AGENTS_UI_EDITOR_BLOCK.md`

## Status

Startversion des fachneutralen Kits. Der Editor-Core wird schrittweise ergaenzt.
