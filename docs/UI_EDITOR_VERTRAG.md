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

## Ziel-App-Vertrag v1.0

Ab M39 ist der Ziel-App-Vertrag v1.0 der generische Vertrag zwischen UI-Editor und beliebiger Ziel-App. Die Ziel-App entscheidet explizit, was editierbar ist; der Editor scannt nicht, erkennt nicht automatisch und registriert nichts automatisch.

Die Ziel-App muss bereitstellen:

- eine Registry mit allen editorrelevanten Elementen;
- einen HostAdapter als technische Schnittstelle;
- einen aktuellen LayoutState als neutralen Layoutzustand;
- einen UI-Scope fuer den sichtbaren Zielbereich in der Ziel-App;
- einen Layout-Scope fuer den Speicher-/Profilbereich von Layoutzustaenden;
- erlaubte Operationen pro Element und Scope;
- gesperrte Operationen pro Element und Scope;
- Save-/Load-/Reset-Verhalten ausschliesslich fuer Layoutdaten.

Die Ziel-App bleibt fachlich verantwortlich. Sie prueft und verwirft Aenderungsauftraege, wenn Scope, Element, Operation oder Payload nicht zum Ziel-App-Vertrag passen.

## UI-Scope und Layout-Scope

`uiScope` bezeichnet den sichtbaren Bereich oder die Oberflaeche in der Ziel-App, die der Editor bearbeiten darf. `layoutScope` bezeichnet den Speicher- oder Profilbereich, in dem Layoutzustaende abgelegt werden.

Ein UI-Scope darf explizit auf einen Layout-Scope abgebildet werden, z. B. wenn mehrere sichtbare Bereiche dasselbe Layoutprofil nutzen. Diese Beziehung muss die Ziel-App im Manifest oder HostAdapter bereitstellen. Der Editor darf Scope-Beziehungen nicht erraten.

## HostAdapter-Pflichtumfang v1.0

Pflichtmethoden bleiben bewusst klein:

- `getRegistry()` liefert die Ziel-App-Registry.
- `getCurrentLayoutState()` liefert den aktuellen neutralen LayoutState.
- `submitChangeRequest()` nimmt einen validierten Aenderungsauftrag entgegen und laesst die Ziel-App final entscheiden.

Optional und nur bei tatsaechlicher Layout-Persistenz sinnvoll sind `saveLayoutState()`, `loadLayoutState()`, `resetLayoutState()` und `getAdapterManifest()`. Diese Methoden duerfen keine Fachaktionen ausloesen.

## Save / Load / Reset

Speichern, Laden und Reset betreffen im UI-Editor-Vertrag ausschliesslich Layoutdaten. Sie duerfen keine Fachdaten, keine Fachlogik, keine Datenbank-Fachaktionen und keine fachlichen Nebenwirkungen ausloesen.

## Status- und Blockadecodes

Der generische Vertrag verwendet fachneutrale Codes, insbesondere `unknown_scope`, `unknown_element`, `wrong_scope`, `no_selection`, `operation_not_allowed`, `operation_locked`, `invalid_payload`, `forbidden_field` und `target_rejected_change`.

## Layout-Payload-Grenzen

Erlaubt sind nur neutrale Layoutwerte wie `x`, `y`, `width`, `height`, `spacing`, `order` sowie `visibility`/`visible` nur mit ausdruecklicher Freigabe. `label` ist nur zulaessig, wenn es fachneutral ist und separat freigegeben wurde.

Verboten sind Fachwerte, Datensatz-IDs, SQL-/DB-Inhalte, fachliches Speichern/Loeschen/Upload/Import/Export, Statuswerte aus Fachmodulen, Kunden-/Projekt-/Personendaten, automatische DOM-Analyse, automatische UI-Erkennung und automatische Registry-Befuellung.
