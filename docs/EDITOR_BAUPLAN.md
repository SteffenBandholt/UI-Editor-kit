# Editor-Bauplan

## 1. Zweck

Der UI-Editor ist eine eigenstaendige Editor-App, die in eine Anwendungs-App als Modul eingebunden werden kann.

Er bearbeitet nicht die Fachlogik der Anwendungs-App.

Er arbeitet ausschliesslich mit UI-Elementen, die beim Bau der Anwendungs-UI vorher klassifiziert und registriert wurden.

Der Editor raet nicht.
Der Editor scannt nicht blind.
Der Editor erfindet keine Elemente.
Der Editor arbeitet nur mit der freigegebenen UI-Elementliste.
Der Editor analysiert keine bestehende UI und migriert keine Legacy-UI automatisch.

## 2. Grundprinzip

Eine editorfaehige Anwendungs-App muss ihre UI beim Bau beschreiben.

Diese Beschreibung besteht aus einer klassifizierten UI-Elementliste.

Diese Liste enthaelt alle Elemente, die der Editor sehen, pruefen oder veraendern darf.

Nicht registrierte Elemente gelten fuer den Editor als nicht vorhanden.

Bestehende UI wird nicht nachtraeglich per Bestandsanalyse, UI-Erkennung oder UI-Scan in eine automatische UI-Elementliste ueberfuehrt.

## 3. Eigenstaendige Editor-App

Der Editor wird als eigenstaendige Editor-App geplant.

Diese Editor-App kann in eine Anwendungs-App als Modul installiert oder eingebunden werden.

Die Anwendungs-App bleibt fachlich verantwortlich.

Der Editor erhaelt von der Anwendungs-App nur die freigegebene UI-Elementliste und definierte Aenderungsregeln.

## 4. Voraussetzungen in der Anwendungs-App

Eine Anwendungs-App ist nur editorfaehig, wenn sie folgende Voraussetzungen erfuellt:

- editorrelevante UI-Elemente werden beim Bau klassifiziert
- jedes editorrelevante Element hat eine eindeutige ID
- jedes editorrelevante Element hat Typ, Rolle und Parent-Bezug
- erlaubte und gesperrte Operationen sind je Element festgelegt
- Tabellen, Spalten, Metaspalten, Buttons, Felder und Dialoge werden nicht geraten, sondern klassifiziert
- nach dem Bau laeuft ein Vertragscheck
- bei Fehlern muss repariert werden
- erst nach gruenem Check gilt die UI als editorfaehig

## 5. UI-Elementliste

Die UI-Elementliste ist die zentrale Datenquelle des Editors.

Jedes Element enthaelt mindestens:

- id
- name
- type
- role
- parentId
- order
- visible
- editable
- allowedOps
- lockedOps

Je nach Elementtyp koennen weitere Angaben erforderlich sein, zum Beispiel:

- columnRole
- fieldKind
- actionKind
- componentKind
- width
- minWidth
- maxWidth
- layoutArea

## 6. Grundstruktur der UI

Die UI kann aus folgenden Grundbausteinen bestehen:

- Root
- Bereich
- Gruppe
- Untergruppe
- Komponente
- Tabelle
- Tabellenspalte
- Liste
- Karte
- Dialog
- Toolbar
- Button
- Feld
- Label
- Statusanzeige

Komplexe Bauteile wie Tabellen, Listen, Karten und Dialoge sind nicht nur ein einzelnes Element.

Sie koennen eigene Unterelemente besitzen.

## 7. Tabellen

Tabellen sind Composite-Elemente.

Eine Tabelle kann enthalten:

- Tabellenkopf
- Inhaltsspalten
- Metaspalten
- Statusspalten
- Terminspalten
- Verantwortlich-Spalten
- Sichtbarkeitsspalten
- Aktionsspalten
- Toolbar
- Filterbereich
- Zeilenbereich
- Fussbereich

Jede editorrelevante Spalte wird als eigenes UI-Element klassifiziert.

Metaspalten wie Struktur-, Status-, Termin-, Verantwortlich- oder Sichtbarkeitsspalten sind Normalfall und muessen ebenfalls klassifiziert werden.

Der Editor darf nicht selbst entscheiden, ob eine Spalte Fachspalte, Metaspalte oder Aktionsspalte ist.

## 8. Erlaubte Operationen

Der Editor darf nur Operationen anbieten, die fuer das jeweilige Element freigegeben sind.

Moegliche Operationen sind:

- inspect
- show
- hide
- move
- resize
- reorder
- rename
- changeWidth
- pin
- unpin
- reset
- applyPreset

Nicht jede Operation ist fuer jedes Element erlaubt.

## 9. Verbotene Operationen

Der Editor darf niemals:

- Fachdaten aendern
- Fachlogik aendern
- Datenbankaktionen ausfuehren
- fachliche Buttons ausloesen
- Speichern-, Loeschen-, Upload-, Import- oder Exportaktionen fachlich ausfuehren
- Elemente veraendern, die nicht registriert sind
- Elemente selbst erfinden
- Parent-/Child-Strukturen ungeprueft umbauen
- eine UI ohne gueltige Elementliste bearbeiten

## 10. Aenderungen

Der Editor soll produktionsfaehig geplant werden.

Er soll den vollstaendigen Arbeitsablauf beherrschen:

- UI-Elementliste lesen
- UI-Struktur anzeigen
- Element auswaehlen
- erlaubte Aenderungen anzeigen
- Aenderung vorbereiten
- Aenderung pruefen
- Aenderung anwenden
- Aenderung speichern
- Aenderung rueckgaengig machen
- Standardzustand wiederherstellen

Die Umsetzung erfolgt abschnittsweise, aber jeder Bauabschnitt muss auf diesen vollstaendigen Produktivbetrieb einzahlen.

## 11. Aenderungsausfuehrung

Der Editor aendert nicht heimlich die Anwendungs-App.

Der Ablauf lautet:

1. Editor erstellt Aenderungsauftrag.
2. Editor prueft Aenderungsauftrag gegen Elementliste und Regeln.
3. Host-Adapter uebergibt den Auftrag an die Anwendungs-App.
4. Anwendungs-App wendet nur erlaubte Aenderungen an.
5. Layoutaenderungen werden getrennt von Fachdaten behandelt.

## 12. Speicherung

Produktionsfaehigkeit umfasst Speicherung.

Layoutdaten und Fachdaten bleiben strikt getrennt.

Der Editor darf keine Fachdaten speichern.

Layoutaenderungen muessen separat gespeichert, versioniert und zuruecksetzbar sein.

## 13. Pruefung nach UI-Bau

Nach dem Bau oder Umbau einer editorfaehigen UI muss ein Vertragscheck laufen.

Der Check prueft mindestens:

- alle IDs eindeutig
- alle Parent-Bezuege gueltig
- alle Typen erlaubt
- alle Rollen erlaubt
- alle Operationen erlaubt
- Tabellen vollstaendig klassifiziert
- Metaspalten klassifiziert
- keine Fachaktion als Editorziel markiert
- maximale Strukturregeln eingehalten
- keine unvollstaendigen Elementangaben

Wenn der Check fehlschlaegt, ist die UI nicht fertig.

Codex muss dann reparieren und den Check erneut ausfuehren.

## 14. Codex-Regel

Codex darf keine editorfaehige UI bauen, wenn die UI-/PDF-Entwurfsentscheidung fehlt.

Vor dem Bau muss festgelegt sein:

- welche Bereiche editorfaehig sind
- welche Gruppen editorfaehig sind
- welche Untergruppen editorfaehig sind
- welche Tabellen editorfaehig sind
- welche Spalten editorfaehig sind
- welche Buttons editorfaehig sind
- welche Felder editorfaehig sind
- welche Operationen erlaubt sind
- welche Operationen gesperrt sind
- welche Fachaktionen ausdruecklich nicht editorfaehig sind

Kein relevantes UI-Element ohne Klassifizierung.

## 15. Ziel

Der UI-Editor soll nicht erraten, was eine Oberflaeche enthaelt.

Die Anwendungs-App liefert eine klassifizierte UI-Elementliste.

Der Editor liest diese Liste, prueft sie und veraendert spaeter nur Elemente, die in dieser Liste freigegeben sind.
