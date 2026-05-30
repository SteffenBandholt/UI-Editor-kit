# UI-/PDF-Entwurfsentscheidung

Diese Datei beschreibt den Pflichtschritt vor dem Bau einer editorfaehigen UI oder PDF-Struktur.

Vor der Umsetzung muss festgelegt werden:

- Art der Ausgabe: UI, PDF, beides oder nicht editorrelevant
- Editorfaehigkeit: ja oder nein
- editorfaehige Elemente mit ihren Pflichtattributen
- nicht editorfaehige fachliche Aktionen
- Parent-Struktur
- passende Pruefung oder Hinweis, dass noch keine Pruefung vorhanden ist

## Pflichtattribute pro editorfaehigem Element

- `data-ui-inspector-id`
- `data-ui-editor-kind`
- `data-ui-editor-label`
- `data-ui-editor-parent`
- `data-ui-editor-editable`
- `data-ui-editor-ops`

## Regel

Ohne vollstaendige Entwurfsentscheidung wird die UI oder PDF-Struktur nicht gebaut.

Der Editor selbst entscheidet spaeter nichts fachlich. Er liest nur vorhandene Metadaten.
