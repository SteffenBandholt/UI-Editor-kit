# UI-Elementkatalog

## 1. Zweck

Dieser Katalog definiert die gemeinsame Sprache zwischen Anwendungs-App und UI-Editor.

Er legt fest:

- welche UI-Elementtypen erlaubt sind
- welche Rollen erlaubt sind
- welche Operationen erlaubt sind
- welche Angaben je editorrelevantem Element mindestens vorhanden sein muessen
- wie Tabellen, Spalten und Metaspalten zu behandeln sind

Der Editor arbeitet nur mit Elementen, die nach diesem Katalog klassifiziert und in der UI-Elementliste registriert wurden.

## 2. Grundregel

Ein UI-Element ist nur editorfaehig, wenn es in der UI-Elementliste vorkommt.

Nicht registrierte Elemente sind fuer den Editor nicht vorhanden.

Der Editor darf keine Elemente erraten, keine Elemente selbst klassifizieren und keine Oberflaeche blind scannen.

## 3. Pflichtangaben je Element

Jedes editorrelevante Element braucht mindestens:

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

Die technischen Werte bleiben englisch. Die Anzeige und Erklaerung duerfen deutsch sein.

## 4. Elementtypen

### `root`

Wurzelelement einer editorfaehigen UI-Struktur.

Verwendung:

- oberster Einstiegspunkt
- besitzt keinen Parent
- enthaelt Bereiche

### `area`

Bereich einer UI.

Beispiele:

- Arbeitsbereich
- Seitenbereich
- Kopfbereich
- Detailbereich

### `group`

Gruppe innerhalb eines Bereichs.

Beispiele:

- Formulargruppe
- Tabellengruppe
- Aktionsgruppe

### `subgroup`

Untergruppe innerhalb einer Gruppe.

Verwendung fuer feinere Gliederung, wenn eine Gruppe mehrere logische Teile enthaelt.

### `component`

Komplexes UI-Bauteil.

Beispiele:

- Tabelle
- Liste
- Karte
- Dialog
- Toolbar

Wenn ein genauerer Typ vorhanden ist, soll dieser verwendet werden.

### `componentPart`

Teil eines komplexen Bauteils.

Beispiele:

- Tabellenkopf
- Filterbereich
- Fussbereich
- Dialogkopf
- Dialoginhalt

### `table`

Tabelle als Composite-Element.

Eine Tabelle ist nicht nur ein einzelnes Element. Editorrelevante Spalten und Teilbereiche werden als eigene Elemente registriert.

### `tableColumn`

Spalte einer Tabelle.

Jede editorrelevante Spalte ist ein eigenes Element.

### `list`

Liste oder Listendarstellung.

### `card`

Karte oder Kachel.

### `dialog`

Dialog, Modal oder vergleichbares Einblendfenster.

### `toolbar`

Werkzeugleiste oder Aktionsleiste.

Toolbars, Filterleisten und headerartige Editierbereiche sind zusammengesetzte UI-Strukturen. Sie koennen direkte Felder, direkte Selects, direkte Checkboxen, direkte Radio-Buttons, direkte einzelne Buttons, Gruppen, Untergruppen, Button-Gruppen, Radio-Gruppen und Checkbox-Gruppen enthalten.

Gruppen sind nur zu verwenden, wenn die echte UI eine optische, fachliche oder layoutbezogene Gruppe bildet. Ein Button muss nicht kuenstlich gruppiert werden, wenn er real direkt zur Filterbar oder Toolbar gehoert.

Die Parent-Struktur muss die reale deklarierte UI-Struktur abbilden und darf nicht geraten oder kuenstlich verschachtelt werden.

### `button`

Schaltflaeche.

Wichtig: Ein Button kann editorrelevant sein, aber seine fachliche Aktion ist keine Editoroperation.

### `field`

Eingabefeld, Anzeigefeld oder Auswahlfeld.

### `label`

Beschriftung oder reines Anzeigeelement.

### `statusIndicator`

Statusanzeige, Ampel, Badge oder vergleichbare visuelle Statusdarstellung.

## 5. Rollen

Die Rolle beschreibt die Bedeutung des Elements fuer Layout und Bedienstruktur.

### `layout`

Element dient vor allem der Gliederung oder Anordnung.

### `content`

Element zeigt fachlichen oder inhaltlichen Nutzinhalt an.

### `meta`

Element zeigt Steuerungs-, Ordnungs- oder Zusatzinformation an.

### `structure`

Element beschreibt Hierarchie, Nummerierung oder Struktur.

Beispiele:

- T1
- T2
- T3
- Positionsnummer
- Ebene

### `status`

Element zeigt Status oder Bearbeitungszustand.

### `date`

Termin- oder Datumsbezug.

### `responsible`

Verantwortlichkeitsbezug.

### `visibility`

Sichtbarkeits- oder Ausblenden-Steuerung.

### `action`

Aktionselement.

Wichtig: Die fachliche Aktion selbst ist nicht Aufgabe des Editors.

### `navigation`

Navigation, Wechsel, Aufklappen oder Auswahl von Bereichen.

### `system`

System-, Pflicht- oder Schutzfunktion.

## 6. Tabellenmodell

Tabellen sind Composite-Elemente.

Eine Tabelle kann enthalten:

- Tabellenkopf
- Inhaltsspalten
- Metaspalten
- Strukturspalten
- Statusspalten
- Terminspalten
- Verantwortlich-Spalten
- Sichtbarkeitsspalten
- Aktionsspalten
- Toolbar
- Filterbereich
- Zeilenbereich
- Fussbereich

Jede editorrelevante Spalte wird als eigenes Element vom Typ `tableColumn` registriert.

Der Editor darf nicht selbst entscheiden, ob eine Spalte Fachspalte, Metaspalte oder Aktionsspalte ist.

## 7. Spaltenrollen

Bei `type = tableColumn` soll zusaetzlich `columnRole` verwendet werden.

Erlaubte Werte:

- `contentColumn`
- `metaColumn`
- `structureColumn`
- `statusColumn`
- `dateColumn`
- `responsibleColumn`
- `visibilityColumn`
- `actionColumn`

### `contentColumn`

Normale Inhalts- oder Fachspalte.

### `metaColumn`

Steuerungs-, Ordnungs- oder Zusatzspalte.

### `structureColumn`

Struktur-, Nummerierungs- oder Hierarchiespalte.

Beispiele:

- T1
- T2
- T3
- Positionsnummer
- Ebene

### `statusColumn`

Statusspalte.

### `dateColumn`

Termin- oder Datums-Spalte.

### `responsibleColumn`

Verantwortlich-Spalte.

### `visibilityColumn`

Spalte fuer Sichtbarkeit, Ausblenden oder Einblenden.

### `actionColumn`

Spalte mit Buttons oder Zeilenaktionen.

## 8. Operationen

Der Editor darf nur Operationen anbieten, die fuer das jeweilige Element in `allowedOps` freigegeben sind.

Erlaubte technische Operationen:

- `inspect`
- `show`
- `hide`
- `move`
- `resize`
- `reorder`
- `rename`
- `changeWidth`
- `pin`
- `unpin`
- `reset`
- `applyPreset`

## 9. Gesperrte Operationen

`lockedOps` enthaelt Operationen, die fuer das jeweilige Element ausdruecklich gesperrt sind.

Eine Operation darf nicht gleichzeitig in `allowedOps` und `lockedOps` stehen.

Fachaktionen sind keine Editoroperationen.

Nicht als Editoroperation zulaessig sind insbesondere:

- fachliches Speichern
- fachliches Anlegen
- fachliches Entfernen
- Import
- Upload
- Export
- Datenbankaktion
- fachliches Ausfuehren eines Buttons

## 10. Beispiel: Tabelle mit Metaspalten

```json
{
  "id": "screen.table",
  "name": "Tabelle",
  "type": "table",
  "role": "content",
  "parentId": "screen.area",
  "order": 10,
  "visible": true,
  "editable": true,
  "allowedOps": ["inspect", "move", "resize"],
  "lockedOps": []
}
```

```json
{
  "id": "screen.table.column.t1",
  "name": "T1",
  "type": "tableColumn",
  "role": "structure",
  "columnRole": "structureColumn",
  "parentId": "screen.table",
  "order": 1,
  "visible": true,
  "editable": false,
  "allowedOps": ["inspect", "changeWidth"],
  "lockedOps": ["hide", "rename"]
}
```

```json
{
  "id": "screen.table.column.status",
  "name": "Status",
  "type": "tableColumn",
  "role": "status",
  "columnRole": "statusColumn",
  "parentId": "screen.table",
  "order": 5,
  "visible": true,
  "editable": true,
  "allowedOps": ["inspect", "move", "changeWidth"],
  "lockedOps": []
}
```

## 11. Beispiel: Button

```json
{
  "id": "screen.toolbar.button.new",
  "name": "Neu",
  "type": "button",
  "role": "action",
  "parentId": "screen.toolbar",
  "order": 1,
  "visible": true,
  "editable": false,
  "allowedOps": ["inspect"],
  "lockedOps": ["move", "rename"]
}
```

Der Button ist fuer den Editor sichtbar, aber seine fachliche Aktion ist keine Editoroperation.

## 12. Regel fuer neue UI

Beim Bau einer neuen editorfaehigen UI muss jedes relevante Element nach diesem Katalog klassifiziert werden.

Diese Regel gilt ebenso fuer die nachtraegliche bewusste Registrierung bestehender UI-Elemente: Ein bekanntes bestehendes Element wird bewusst ausgewaehlt, bekommt eine stabile ID, einen Registry-Eintrag, einen passenden Marker im Render-Code, festgelegte erlaubte Operationen und ergaenzte Tests.

Kein relevantes UI-Element ohne Eintrag in der UI-Elementliste.

Keine Tabelle ohne klassifizierte Spalten.

Keine Metaspalte ohne Rolle.

Keine fachliche Aktion als Editoroperation.

Nachtraegliche bewusste Registrierung ist keine UI-Analyse, keine automatische Bestandserkennung, kein Scan, keine automatische Elementerkennung und keine Migration.
