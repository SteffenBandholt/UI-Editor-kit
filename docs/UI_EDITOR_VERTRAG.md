# UI-Editor Vertrag

## Zweck

Dieser Vertrag legt verbindlich fest, wie neue oder neu strukturierte UIs editorfaehig aufgebaut werden.

Der Editor soll nicht raten.

Eine editorfaehige UI liefert eine klassifizierte UI-Elementliste.

Der Editor arbeitet ausschliesslich mit dieser Liste.

## Geltung

Dieser Vertrag ist fachneutral.

Er gilt fuer jede neue App und jedes neue Modul, das den UI-Editor verwenden soll.

Der Editor ist kein Fachmodul.

Er kennt keine Fachlogik und keine Fachdaten.

## Pflichtangaben pro editorrelevantem Element

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

Je nach Elementtyp koennen weitere Angaben erforderlich sein:

- `columnRole`
- `fieldKind`
- `actionKind`
- `componentKind`

## Grundregel

Ein UI-Element ist nur editorfaehig, wenn es in der UI-Elementliste enthalten ist.

Nicht registrierte Elemente sind fuer den Editor nicht vorhanden.

Der Editor darf keine Elemente erraten.

Der Editor darf keine Elemente selbst klassifizieren.

Der Editor analysiert keine bestehende UI, scannt keine bestehende UI, erzeugt keine automatische UI-Elementliste und migriert keine Legacy-UI automatisch.

## Parent-Regel

Jedes Element ausser Root braucht einen Parent.

Der Parent muss selbst als Editor-Ziel existieren.

Parent-Beziehungen duerfen nicht geraten werden.

## Editor-Regeln

- Eine Auswahl = genau ein Ziel.
- Eine Aenderung = nur dieses Ziel.
- Keine automatische Aenderung von Parent, Child oder Geschwistern ohne ausdruecklich erlaubte Operation.
- Keine UI-Analyse, Bestandsanalyse, UI-Erkennung oder automatische Klassifizierung bestehender UI.
- Der Editor aendert Layout und Darstellung, keine Fachlogik.
- Der Editor erzeugt, aendert oder loescht keine Fachdaten.
- Der Editor arbeitet nur mit erlaubten Operationen aus `allowedOps`.
- Operationen in `lockedOps` sind gesperrt.

## Tabellen-Regeln

Tabellen sind Composite-Elemente.

Editorrelevante Spalten werden als eigene Elemente registriert.

Metaspalten sind Normalfall und muessen klassifiziert werden.

Der Editor darf nicht selbst entscheiden, ob eine Spalte Fachspalte, Metaspalte oder Aktionsspalte ist.

## Verbotene Editor-Ziele

Nicht editorfaehig sind insbesondere:

- Fachaktionen
- fachliches Speichern
- fachliches Anlegen
- fachliches Loeschen
- Upload
- Import
- Export
- Autosave
- Datenbankaktionen
- fachliche IPC-/Datenaktionen
- fachliches Ausfuehren eines Buttons

## Speichern

Layoutdaten und Fachdaten bleiben strikt getrennt.

Der Editor darf keine Fachdaten speichern.

Spaeteres Speichern von Layoutdaten muss getrennt, versionierbar und ruecksetzbar erfolgen.

## Pruefung

Nach dem Bau oder Umbau einer editorfaehigen UI muss ein Vertragscheck laufen.

Wenn der Check Fehler meldet, ist die UI nicht fertig.

Codex muss dann reparieren und erneut pruefen.
