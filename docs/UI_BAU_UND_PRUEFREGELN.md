# UI-Bau- und Pruefregeln

## 1. Zweck

Diese Datei beschreibt verbindlich, wie eine neue oder geaenderte UI gebaut werden muss, damit sie editorfaehig ist.

Sie richtet sich an Codex und an jede Person, die eine UI fuer eine Anwendungs-App plant oder umbaut.

Der Grundsatz lautet:

Eine editorfaehige UI ist erst fertig, wenn ihre relevanten Elemente klassifiziert, registriert und erfolgreich geprueft wurden.

Der Ziel-App-Regelpaket-Bootstrap ist nur eine Regelpaket-Installation mit Installationspruefung. Er macht eine bestehende UI nicht automatisch editorfaehig.

## 2. Fuehrende Unterlagen

Vor jeder editorrelevanten UI-Umsetzung muessen diese Unterlagen beachtet werden:

- `docs/EDITOR_BAUPLAN.md`
- `docs/UI_ELEMENT_KATALOG.md`
- `docs/UI_EDITOR_VERTRAG.md`
- `docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md`
- `codex/AGENTS_UI_EDITOR_BLOCK.md`

Wenn eine dieser Grundlagen fehlt oder widerspruechlich ist, darf keine editorfaehige UI gebaut werden.

## 3. Vor dem UI-Bau

Vor dem Bau oder Umbau einer UI muss eine Entwurfsentscheidung vorliegen.

Diese Entscheidung muss klaeren:

- ob die UI editorfaehig sein soll
- welche Bereiche editorfaehig sind
- welche Gruppen editorfaehig sind
- welche Untergruppen editorfaehig sind
- welche Komponenten editorfaehig sind
- welche Tabellen editorfaehig sind
- welche Spalten editorfaehig sind
- welche Buttons editorfaehig sind
- welche Felder editorfaehig sind
- welche Fachaktionen nicht editorfaehig sind
- welche Operationen erlaubt sind
- welche Operationen gesperrt sind

Ohne vollstaendige Entwurfsentscheidung gilt: STOPP.

Bestehende UI darf nicht per UI-Analyse, Bestandsanalyse, UI-Erkennung oder UI-Scan nachtraeglich automatisch klassifiziert werden.

Bestehende UI-Elemente duerfen aber nachtraeglich bewusst registriert werden, wenn das Element bekannt ist, bewusst ausgewaehlt wird, eine stabile ID bekommt, einen Registry-Eintrag bekommt, der Render-Code einen passenden Marker bekommt, erlaubte Operationen festgelegt werden und Tests ergaenzt werden.

Nachtraegliche bewusste Registrierung ist keine UI-Analyse, keine automatische Bestandserkennung, kein Scan und keine Migration.

## 4. Beim UI-Bau

Beim Bau der UI muss jedes editorrelevante Element klassifiziert und registriert werden.

Kein relevantes UI-Element ohne Eintrag in der UI-Elementliste.

Jeder Eintrag muss mindestens enthalten:

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

Die erlaubten Werte fuer `type`, `role`, `columnRole` und Operationen stehen im `docs/UI_ELEMENT_KATALOG.md`.

## 5. Namens- und ID-Regeln

Jede ID muss eindeutig und stabil sein.

Eine ID darf nicht zufaellig erzeugt werden, wenn sie fuer die Editorfaehigkeit relevant ist.

Empfohlenes Format:

```text
appBereich.teilbereich.element
```

Beispiele:

```text
workspace.main
workspace.main.toolbar
workspace.main.table
workspace.main.table.column.status
workspace.main.table.column.responsible
```

Die ID beschreibt die technische Einordnung, nicht den aktuellen Fachdateninhalt.

Nicht erlaubt:

- IDs aus aktuellen Datensaetzen
- IDs aus Namen von Personen
- IDs aus Terminen
- IDs aus zufaelligen Laufzeitwerten

## 6. Parent-Regeln

Jedes editorrelevante Element ausser Root braucht einen Parent.

Der Parent muss selbst in der UI-Elementliste enthalten sein.

Parent-Beziehungen duerfen nicht geraten werden.

Die Struktur muss nachvollziehbar sein:

```text
Root
  Bereich
    Gruppe
      Untergruppe
        Element
```

Komplexe Komponenten wie Tabellen, Listen, Karten und Dialoge duerfen eigene Unterelemente besitzen, muessen diese aber ebenfalls registrieren.

## 7. Filterleisten, Toolbars und Header-Editierbereiche

Filterleisten, Toolbars und headerartige Editierbereiche sind zusammengesetzte UI-Strukturen.

Diese Regel gilt sowohl beim Neubau einer editorfaehigen UI als auch bei nachtraeglicher bewusster Registrierung bestehender UI-Elemente.

Sie duerfen direkte Felder, direkte Selects, direkte Checkboxen, direkte Radio-Buttons, direkte einzelne Buttons, Gruppen, Untergruppen, Button-Gruppen, Radio-Gruppen und Checkbox-Gruppen enthalten.

Felder, Selects, Checkboxen und Radio-Buttons duerfen editorrelevante Elemente sein.

Gruppen sind erlaubt, aber nicht zwingend. Gruppen sind nur zu verwenden, wenn die echte UI eine optische, fachliche oder layoutbezogene Gruppe bildet.

Ein Button muss nicht kuenstlich gruppiert werden, wenn er real direkt zur Filterbar oder Toolbar gehoert. Buttons muessen nur dann in eine Gruppe, wenn die echte UI eine optische, fachliche oder layoutbezogene Button-Gruppe bildet.

Die Parent-Struktur darf nicht geraten und nicht kuenstlich verschachtelt werden. Die Parent-Struktur muss die reale deklarierte UI-Struktur abbilden.

Der UI-Editor darf Layout, Sichtbarkeit, Reihenfolge, Groesse oder Label bearbeiten, sofern die jeweilige Operation erlaubt ist.

Fachwerte und Fachaktionen bleiben ausserhalb des UI-Editors. Der UI-Editor darf keine Filterwerte setzen, keine Checkbox fachlich umschalten, keine Radio-Auswahl fachlich aendern und keine Button-Fachaktion ausfuehren.

Zulaessig ohne Gruppe:

```text
screen.root
  screen.filterbar
    screen.filterbar.search.input
    screen.filterbar.status.select
    screen.filterbar.action.reset
```

Zulaessig mit Gruppen:

```text
screen.root
  screen.filterbar
    screen.filterbar.group.search
      screen.filterbar.search.input
    screen.filterbar.group.actions
      screen.filterbar.action.reset
      screen.filterbar.action.refresh
```

Nachtraegliche Registrierung:

```text
Bestehende UI-Elemente duerfen nachtraeglich bewusst registriert werden.
Das ist keine UI-Analyse.
Das ist keine automatische Bestandserkennung.
Das ist kein Scan.
Das ist keine Migration.
```

## 8. Tabellen-Regeln

Tabellen sind Composite-Elemente.

Eine Tabelle darf nicht nur als ein einziges flaches Element behandelt werden, wenn ihre Spalten oder Teilbereiche editorrelevant sind.

Editorrelevante Tabellen muessen ihre Bestandteile klassifizieren, zum Beispiel:

- Tabelle
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

Jede editorrelevante Spalte ist ein eigenes Element.

Metaspalten sind Normalfall und muessen klassifiziert werden.

Der Editor darf nicht selbst entscheiden, ob eine Spalte Fachspalte, Metaspalte oder Aktionsspalte ist.

## 9. Button- und Aktionsregeln

Buttons koennen editorrelevante UI-Elemente sein.

Die fachliche Aktion eines Buttons ist aber keine Editoroperation.

Ein Button darf fuer den Editor beispielsweise sichtbar, verschiebbar oder umbenennbar sein, wenn dies freigegeben wurde.

Der Editor darf den Button aber nicht fachlich ausloesen.

Nicht editorfaehig sind insbesondere:

- fachliches Speichern
- fachliches Anlegen
- fachliches Loeschen
- Import
- Upload
- Export
- Datenbankaktion
- fachlicher IPC-Aufruf

## 10. Operationen

Der Editor darf nur Operationen anbieten, die in `allowedOps` stehen.

Operationen in `lockedOps` sind gesperrt.

Eine Operation darf nicht gleichzeitig in `allowedOps` und `lockedOps` stehen.

Wenn eine Operation nicht ausdruecklich erlaubt ist, gilt sie als nicht erlaubt.

## 11. Nach dem UI-Bau

Nach dem Bau oder Umbau einer editorfaehigen UI muss ein Vertragscheck laufen.

Der Check ist Teil der Fertigstellung.

Eine UI ist nicht fertig, solange der Check fehlschlaegt.

Wenn Fehler gefunden werden, muss Codex reparieren und den Check erneut ausfuehren.

## 12. Mindestpruefungen

Der Vertragscheck muss mindestens pruefen:

- alle Pflichtfelder vorhanden
- alle IDs eindeutig
- alle Parent-Bezuege gueltig
- alle Elementtypen erlaubt
- alle Rollen erlaubt
- alle Spaltenrollen erlaubt
- alle Operationen erlaubt
- keine Operation gleichzeitig erlaubt und gesperrt
- Tabellenbestandteile klassifiziert
- Metaspalten klassifiziert
- keine Fachaktion als Editoroperation markiert
- keine unzulaessigen Datensatz-, Personen- oder Terminwerte in IDs
- keine unvollstaendige UI-Elementliste

## 13. Reparaturpflicht

Wenn der Check fehlschlaegt, darf Codex die UI nicht als fertig melden.

Codex muss:

1. Fehler nennen
2. Ursache beheben
3. Check erneut ausfuehren
4. Ergebnis melden

Erst ein gruener Check gilt als abnahmefaehig.

## 14. Was Codex nicht tun darf

Codex darf beim Bau editorfaehiger UI nicht:

- UI-Elemente ohne Klassifizierung bauen
- Parent-Strukturen raten
- Parent-Strukturen kuenstlich verschachteln
- bestehende UI analysieren
- bestehende UI scannen
- automatische Bestandserkennung durchfuehren
- automatische Elementerkennung durchfuehren
- automatische UI-Elementlisten erzeugen
- bestehende Legacy-UIs automatisch migrieren
- Tabellen ohne Spaltenklassifizierung bauen
- Metaspalten ignorieren
- Buttons als fachliche Editoroperationen behandeln
- Fachlogik in die UI-Elementliste schreiben
- Fachdaten in IDs oder Metadaten schreiben
- HTML, DOM oder eine Demo-Technik zur Kernarchitektur erklaeren
- UI als fertig melden, wenn der Vertragscheck rot ist

## 15. Abnahmebericht nach UI-Bau

Nach jedem editorrelevanten UI-Bau muss Codex berichten:

- welche UI gebaut oder geaendert wurde
- welche Bereiche editorfaehig sind
- welche Gruppen und Untergruppen registriert wurden
- welche Tabellen und Spalten registriert wurden
- welche Buttons und Felder registriert wurden
- welche Fachaktionen ausgeschlossen wurden
- welches Ergebnis der Vertragscheck geliefert hat
- ob Reparaturen erforderlich waren
- ob die UI editorfaehig abnahmefaehig ist

## 16. Kernaussage

Editorfaehige UI wird nicht nachtraeglich geraten oder automatisch erkannt.

Sie wird beim Neubau geplant, klassifiziert, registriert und geprueft oder bei bestehender UI nachtraeglich bewusst ausgewaehlt, stabil markiert, registriert und geprueft.

Nur eine erfolgreich gepruefte UI-Elementliste ist Grundlage fuer den Editor.
