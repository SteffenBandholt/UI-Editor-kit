# UI-Editor Vertrag

## Zweck

Dieser Vertrag legt verbindlich fest, wie neue oder neu strukturierte UIs editorfaehig aufgebaut werden.

Der Editor soll nicht raten. Eine editorfaehige UI liefert klare Metadaten direkt aus der UI.

## Geltung

Dieser Vertrag ist fachneutral.

Er gilt fuer jede neue App und jedes neue Modul, das den UI-/PDF-Editor verwenden soll.

Der Editor ist kein Fachmodul. Er kennt keine Restarbeiten, kein Protokoll, keine Pferdeverwaltung und keine sonstige Fachlogik.

## Pflichtattribute pro editorrelevantem Element

Jedes editorrelevante Element braucht:

- `data-ui-inspector-id`
- `data-ui-editor-kind`
- `data-ui-editor-label`
- `data-ui-editor-parent`
- `data-ui-editor-editable`
- optional: `data-ui-editor-ops`

## Erlaubte kind-Werte

- `frame`
- `field`
- `single`

Bedeutung:

- `frame` = Rahmen, Gruppe oder Container
- `field` = Eingabe-, Text- oder Listenfeld
- `single` = Button, Label, Anzeige oder kleines Einzelelement

## Parent-Regel

- Jedes Element ausser Root braucht einen Parent.
- Der Parent muss selbst als Editor-Ziel existieren.
- Parent-Beziehungen duerfen nicht geraten werden.

## Editor-Regeln

- Eine Auswahl = genau ein Ziel.
- Eine Aenderung = nur dieses Ziel.
- Keine automatische Aenderung von Parent, Child oder Geschwistern.
- Der Editor aendert Darstellung, keine Fachlogik.
- Der Editor erzeugt, aendert oder loescht keine Fachdaten.

## Trefferregel

- `elementFromPoint` + `closest("[data-ui-inspector-id]")`.
- Typ/Kind entscheidet, ob ein Ziel im aktuellen Modus erlaubt ist.
- Wenn `closest` nicht direkt aufloesbar ist, darf ein Ziel gewinnen, wenn dessen Element den Top-Treffer enthaelt.

## Verbotene Editor-Ziele

Nicht editorfaehig sind insbesondere:

- Fachaktionen,
- Speichern,
- Anlegen,
- Loeschen,
- Upload,
- Import,
- Autosave,
- fachliche IPC-/Datenaktionen,
- sonstige Fachdatenveraenderungen.

## Speichern

Solange nur Vorschau-/Editor-Entwicklung laeuft: keine Speicherung.

Spaeteres Speichern von Layoutdaten muss getrennt von Fachdaten erfolgen.

## Beispiel-DOM

```html
<div
  data-ui-inspector-id="app.screen.detailbereich"
  data-ui-editor-kind="frame"
  data-ui-editor-label="Detailbereich"
  data-ui-editor-parent="app.screen.root"
  data-ui-editor-editable="true"
  data-ui-editor-ops="move,resize,hide"
>
</div>
```
