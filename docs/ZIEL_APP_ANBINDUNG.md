# Ziel-App-Anbindung

## 1. Zweck

Diese Datei beschreibt, was eine Ziel-App bereitstellen muss, damit der UI-Editor dort als Modul arbeiten kann.

Eine Ziel-App kann eine bestehende Anwendung oder eine neue Anwendung sein.

Der UI-Editor bleibt eine eigenstaendige Editor-App. Er kann in die Ziel-App als Modul eingebunden werden, arbeitet aber nur ueber definierte Schnittstellen und Regeln.

## 2. Grundsatz

Die Ziel-App bleibt fachlich verantwortlich.

Der UI-Editor darf keine Fachlogik uebernehmen, keine Fachdaten veraendern und keine fachlichen Aktionen ausloesen.

Der UI-Editor arbeitet nur mit einer von der Ziel-App gelieferten, klassifizierten UI-Elementliste.

Nicht registrierte Elemente sind fuer den Editor nicht vorhanden.

Die Regelpaket-Installation ist nur ein Ziel-App-Regelpaket-Bootstrap. Sie analysiert, scannt, erkennt, registriert oder migriert keine bestehende UI.

Eine Ziel-App darf bestehende bekannte UI-Elemente nachtraeglich bewusst registrieren. Dazu muss ein konkretes bestehendes Element bewusst ausgewaehlt werden, eine stabile ID bekommen, einen Registry-Eintrag bekommen, im Render-Code passend markiert werden, erlaubte Operationen bekommen und durch Tests abgesichert werden.

Das ist keine UI-Analyse, keine automatische Bestandserkennung, kein Scan, keine automatische Elementerkennung und keine Migration.

## 3. Voraussetzungen in der Ziel-App

Eine Ziel-App muss mindestens bereitstellen:

- UI-Editor-Vertrag im Repository
- UI-/PDF-Entwurfsentscheidung vor UI-Bau
- UI-Elementkatalog als gemeinsame Sprache
- klassifizierte UI-Elementliste je editorfaehiger UI
- Host-Adapter als Anschluss zwischen Ziel-App und UI-Editor
- Vertragscheck nach UI-Bau oder UI-Umbau
- klare Trennung von Layoutdaten und Fachdaten
- Regelblock fuer Codex in `AGENTS.md` oder gleichwertiger Regeldatei

## 4. Uebernahme des UI-Editor-Vertrags

Die Ziel-App muss die fuehrenden Regeln aus dem UI-Editor-kit uebernehmen oder eindeutig darauf verweisen.

Fuehrende Unterlagen sind:

- `docs/EDITOR_BAUPLAN.md`
- `docs/UI_ELEMENT_KATALOG.md`
- `docs/UI_BAU_UND_PRUEFREGELN.md`
- `docs/UI_EDITOR_VERTRAG.md`
- `docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md`
- `codex/AGENTS_UI_EDITOR_BLOCK.md`

Die Ziel-App darf diese Regeln nicht stillschweigend abschwaechen.

Bei Widerspruch zwischen Ziel-App-Regeln und UI-Editor-Vertrag gilt: STOPP und klaeren.

## 5. UI-Elementliste der Ziel-App

Die Ziel-App muss fuer jede editorfaehige UI eine klassifizierte UI-Elementliste liefern.

Diese Liste ist die einzige Datenquelle des Editors.

Sie muss alle editorrelevanten Elemente enthalten, insbesondere:

- Bereiche
- Gruppen
- Untergruppen
- Komponenten
- Tabellen
- Tabellenspalten
- Metaspalten
- Buttons
- Felder
- Listen
- Karten
- Dialoge
- Toolbars
- Filterleisten
- headerartige Editierbereiche
- Statusanzeigen

Jedes Element muss nach dem UI-Elementkatalog klassifiziert werden.

Filterleisten, Toolbars und headerartige Editierbereiche duerfen direkte Felder, direkte Selects, direkte Checkboxen, direkte Radio-Buttons, direkte einzelne Buttons, Gruppen, Untergruppen, Button-Gruppen, Radio-Gruppen und Checkbox-Gruppen enthalten. Gruppen sind optional und nur dann zu verwenden, wenn die echte UI eine Gruppe bildet. Die Parent-Struktur muss die reale deklarierte UI-Struktur abbilden.

## 6. Host-Adapter

Zwischen Ziel-App und UI-Editor steht ein Host-Adapter.

Der Host-Adapter hat folgende Aufgaben:

- UI-Elementliste der Ziel-App bereitstellen
- aktuellen Layoutzustand bereitstellen
- erlaubte und gesperrte Operationen je Element bereitstellen
- Aenderungsauftraege des Editors entgegennehmen
- Aenderungsauftraege gegen Ziel-App-Regeln pruefen
- nur erlaubte Layoutaenderungen an die Ziel-App uebergeben
- Rueckmeldungen an den Editor liefern

Der Host-Adapter darf keine Fachlogik fuer den Editor freigeben.

## 7. Aenderungen durch den Editor

Der Editor erstellt Aenderungsauftraege.

Eine Aenderung darf nur ausgefuehrt werden, wenn:

- das Element registriert ist
- die Operation erlaubt ist
- die Operation nicht gesperrt ist
- die Parent-Struktur gueltig bleibt
- keine Fachlogik betroffen ist
- keine Fachdaten betroffen sind
- die Ziel-App die Aenderung annimmt

Die Ziel-App wendet Aenderungen kontrolliert an.

Der Editor darf nicht heimlich direkt in die Ziel-App eingreifen.

## 8. Speicherung

Layoutdaten und Fachdaten muessen getrennt bleiben.

Die Ziel-App muss festlegen:

- wo Layoutaenderungen gespeichert werden
- wie Layoutaenderungen versioniert werden
- wie ein Standardzustand wiederhergestellt wird
- wie Aenderungen rueckgaengig gemacht werden koennen

Der Editor darf keine Fachdaten speichern.

## 9. Vertragscheck in der Ziel-App

Nach jedem Bau oder Umbau einer editorfaehigen UI muss ein Vertragscheck laufen.

Der Check muss mindestens pruefen:

- alle Pflichtfelder vorhanden
- alle IDs eindeutig
- alle Parent-Bezuege gueltig
- alle Typen erlaubt
- alle Rollen erlaubt
- alle Spaltenrollen erlaubt
- alle Operationen erlaubt
- Tabellen und Spalten vollstaendig klassifiziert
- Metaspalten klassifiziert
- keine Fachaktion als Editoroperation markiert
- keine Fachdaten in IDs oder Metadaten

Wenn der Check fehlschlaegt, ist die UI nicht fertig.

Codex muss reparieren und erneut pruefen.

## 10. Codex-Regel in der Ziel-App

In der Ziel-App muss Codex vor jeder UI- oder PDF-Umsetzung pruefen:

- ist die Ausgabe editorrelevant?
- liegt eine UI-/PDF-Entwurfsentscheidung vor?
- sind editorfaehige Elemente benannt?
- sind Parent-Struktur und Operationen festgelegt?
- sind Fachaktionen ausgeschlossen?
- ist ein Vertragscheck vorhanden?

Wenn diese Angaben fehlen, darf Codex keine editorfaehige UI bauen.

## 11. Nicht erlaubt

Die Ziel-App darf dem Editor nicht erlauben:

- Fachlogik auszufuehren
- Fachdaten zu aendern
- bestehende UI zu analysieren
- bestehende UI zu scannen
- eine automatische Bestandserkennung oder UI-Elementliste zu erzeugen
- bestehende Legacy-UIs automatisch zu migrieren
- nachtraegliche bewusste Registrierung als automatische Analyse, Scan, Erkennung oder Migration auszufuehren
- Datenbankaktionen auszufuehren
- fachliche Buttons auszufuehren
- Speicher-, Loesch-, Upload-, Import- oder Exportaktionen als Editoroperation zu behandeln
- nicht registrierte Elemente zu veraendern
- UI-Strukturen ohne Vertragscheck freizugeben

## 12. Mindestablauf fuer eine neue Ziel-App

1. UI-Editor-Vertrag uebernehmen.
2. Codex-Regelblock in der Ziel-App aktivieren.
3. Vertragscheck verfuegbar machen.
4. Vor UI-Bau Entwurfsentscheidung erstellen.
5. UI mit klassifizierter Elementliste bauen.
6. Vertragscheck ausfuehren.
7. Fehler reparieren.
8. Erst nach gruenem Check gilt die UI als editorfaehig.

## 13. Kernaussage

Eine Ziel-App kann nur dann mit dem UI-Editor arbeiten, wenn sie dieselbe Sprache spricht.

Diese Sprache besteht aus:

- UI-Editor-Bauplan
- UI-Elementkatalog
- Bau- und Pruefregeln
- klassifizierter UI-Elementliste
- Host-Adapter
- Vertragscheck

Ohne diese Voraussetzungen darf der Editor in der Ziel-App nicht produktiv arbeiten.
