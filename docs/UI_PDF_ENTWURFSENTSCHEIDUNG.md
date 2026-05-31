# UI-/PDF-Entwurfsentscheidung

Diese Datei beschreibt den Pflichtschritt vor dem Bau einer editorfaehigen UI oder PDF-Struktur.

Dieses Repository ist die Quelle der Wahrheit fuer diesen Pflichtschritt.

Vor der Umsetzung muss festgelegt werden:

- Art der Ausgabe: UI, PDF, beides oder nicht editorrelevant
- Editorfaehigkeit: ja oder nein
- editorfaehige Bereiche
- editorfaehige Gruppen
- editorfaehige Untergruppen
- editorfaehige Komponenten
- editorfaehige Tabellen
- editorfaehige Spalten einschliesslich Metaspalten
- editorfaehige Buttons
- editorfaehige Felder
- Parent-Struktur
- erlaubte Operationen
- gesperrte Operationen
- nicht editorfaehige fachliche Aktionen
- passende Pruefung oder Hinweis, dass noch keine Pruefung vorhanden ist

## Pflichtangaben pro editorfaehigem Element

Jedes editorfaehige Element braucht mindestens:

- `id`
- `name`
- `type`
- `role`
- `parentId`
- `order`
- `visible`
- `editable`
- `allowedOps`
- `lockedOps`

Je nach Elementtyp koennen weitere Angaben erforderlich sein:

- `columnRole`
- `fieldKind`
- `actionKind`
- `componentKind`

## Regel

Ohne vollstaendige Entwurfsentscheidung wird die UI oder PDF-Struktur nicht gebaut.

Der Editor entscheidet spaeter nichts fachlich.

Er liest nur die vorhandene klassifizierte UI-Elementliste.

Er raet nicht.

Er scannt nicht blind.

Er erfindet keine Elemente.
