# Editor-Gesamt-LV

## 1. Zweck dieses Dokuments

Dieses Dokument ist das verbindliche Gesamt-Leistungsverzeichnis fuer den UI-Editor.

Es beschreibt vor der technischen Ausfuehrung, was genau gebaut werden soll, aus welchen Bauteilen der Editor besteht, welche Qualitaet jedes Bauteil haben muss, welche Schnittstellen vorgesehen sind, was ausdruecklich nicht erlaubt ist und wie jedes Bauteil abgenommen wird.

Dieses Dokument verhindert, dass neue Chatwechsel, neue Codex-Laeufe oder neue Ideen die Hauptspur veraendern.

Kein technischer Bauauftrag darf ohne Bezug auf eine LV-Position aus diesem Dokument gestartet werden.

## 2. Gesamtziel

Der UI-Editor ist eine eigenstaendige Editor-App, die in eine Anwendungs-App als Modul eingebunden werden kann.

Der Editor bearbeitet keine Fachlogik und keine Fachdaten.

Der Editor arbeitet ausschliesslich mit einer klassifizierten UI-Elementliste, die von der jeweiligen Anwendungs-App beim Bau der UI bereitgestellt wird.

Der Editor soll produktionsfaehig werden und am Ende mindestens koennen:

- klassifizierte UI-Elementliste lesen
- UI-Struktur als Baum auswerten
- Elementdetails anzeigen
- erlaubte und gesperrte Operationen je Element erkennen
- Aenderungsauftraege erstellen
- Aenderungsauftraege pruefen
- erlaubte Layoutaenderungen an einen Host-Adapter uebergeben
- Layoutaenderungen getrennt von Fachdaten speichern
- Aenderungen rueckgaengig machen
- Standardzustand wiederherstellen

## 3. Nicht verhandelbare Grundregeln

Der Editor darf nicht:

- UI blind scannen
- Elemente erraten
- Elemente selbst klassifizieren
- Fachlogik lesen oder aendern
- Fachdaten lesen oder aendern
- fachliche Buttons ausfuehren
- Datenbankaktionen ausloesen
- Import, Export, Upload oder fachliches Speichern ausfuehren
- eine Demo-Technik zur Kernarchitektur machen

Der Editor darf nur mit registrierten und klassifizierten Elementen arbeiten.

Nicht registrierte Elemente gelten fuer den Editor als nicht vorhanden.

## 4. LV-Systematik

Jede LV-Position hat dieses Raster:

- Status: offen, in Bau, gebaut, abgenommen, gesperrt
- Zweck
- Bauteilbeschreibung
- Mindestinhalt
- Qualitaetsanforderung
- Schnittstellen
- Nicht erlaubt
- Abnahme
- Abhaengigkeiten

Der jeweilige Baufortschritt wird spaeter in `STATUS.md` gegen diese LV-Positionen abgehakt.

---

# A - Vertrags- und Planungsgrundlagen

## A1 - Fuehrende Projektunterlagen

Status: gebaut

Zweck:
Die fuehrenden Unterlagen definieren die Hauptspur des Projekts.

Bauteilbeschreibung:
Es muessen feste Dokumente vorhanden sein, die Zweck, Elementkatalog, Bau- und Pruefregeln, Ziel-App-Anbindung und Codex-Regeln beschreiben.

Mindestinhalt:
- `docs/EDITOR_BAUPLAN.md`
- `docs/UI_ELEMENT_KATALOG.md`
- `docs/UI_BAU_UND_PRUEFREGELN.md`
- `docs/ZIEL_APP_ANBINDUNG.md`
- `docs/UI_EDITOR_VERTRAG.md`
- `docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md`
- `codex/AGENTS_UI_EDITOR_BLOCK.md`
- `codex/CODEX_BOOTSTRAP_ZIEL_APP.md`

Qualitaetsanforderung:
Die Dokumente muessen fachneutral sein und duerfen keine Ziel-App-spezifische Fachlogik enthalten.

Schnittstellen:
- Codex-Auftraege muessen diese Unterlagen als Grundlage lesen.
- Ziel-Apps muessen diese Unterlagen uebernehmen oder eindeutig referenzieren.

Nicht erlaubt:
- widerspruechliche Regeln
- Demo-Technik als Hauptarchitektur
- Ziel-App-spezifische Begriffe im Kernvertrag

Abnahme:
- Dateien vorhanden
- `npm test` gruen
- Cleanup-Test prueft Kernbestand

Abhaengigkeiten:
Keine.

## A2 - Gesamt-LV

Status: in Bau

Zweck:
Dieses Dokument legt vor der Ausfuehrung fest, was insgesamt gebaut werden soll.

Bauteilbeschreibung:
Das Gesamt-LV beschreibt alle bekannten Bauteile des Editors einschliesslich Qualitaet, Schnittstellen, Abnahme und Ausschluessen.

Mindestinhalt:
- Gesamtziel
- Grundregeln
- LV-Positionen fuer Vertrag, Registry, Validator, Editor-Core, Aenderungsauftrag, Host-Adapter, Speicherung, Editor-UI, Ziel-App-Bootstrap und Tests
- Abnahme je LV-Position

Qualitaetsanforderung:
Kein Baupaket darf groesser sein als eine klar pruefbare LV-Position oder eine eindeutig benannte Gruppe von LV-Positionen.

Schnittstellen:
- `STATUS.md` referenziert die LV-Positionen
- Codex-Auftraege muessen die passende LV-Position nennen

Nicht erlaubt:
- grobe Sammelauftraege ohne Abnahmekriterium
- neue Hauptspur ohne LV-Ergaenzung

Abnahme:
- Datei vorhanden
- STATUS kann daraus abgeleitet werden

Abhaengigkeiten:
A1.

## A3 - STATUS als Baufortschritt

Status: offen

Zweck:
`STATUS.md` dokumentiert den Baufortschritt gegen dieses LV.

Bauteilbeschreibung:
`STATUS.md` enthaelt fuer jede LV-Position mindestens Status, Nachweis, letzter Commit und naechsten Schritt.

Mindestinhalt:
- Liste der LV-Positionen
- Haken fuer gebaut/abgenommen
- Hinweis auf offene Positionen
- naechster Auftrag
- ausgeschlossene Nebenstrecken

Qualitaetsanforderung:
Kein Haken ohne Nachweis. Kein neuer Auftrag ohne LV-Bezug.

Schnittstellen:
- Chatwechsel
- Codex-Auftraege
- Abnahmeprotokoll

Nicht erlaubt:
- Status als Ideensammlung
- erledigt markieren ohne Test/Nachweis

Abnahme:
- `STATUS.md` vorhanden
- K11.0 und K11.1 korrekt abgehakt
- K12.0 als naechster offener Bauabschnitt benannt

Abhaengigkeiten:
A2.

---

# B - UI-Elementvertrag

## B1 - UI-Element-Datenmodell

Status: offen

Zweck:
Ein UI-Element beschreibt ein editorfaehiges Bauteil einer Ziel-App.

Bauteilbeschreibung:
Das Datenmodell definiert, welche Felder ein Element mindestens haben muss und welche Zusatzfelder je Typ erforderlich sein koennen.

Mindestinhalt:
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

Zusatzfelder je nach Typ:
- `columnRole`
- `fieldKind`
- `actionKind`
- `componentKind`
- `width`
- `minWidth`
- `maxWidth`
- `layoutArea`

Qualitaetsanforderung:
- `id` eindeutig
- `type` aus Katalog
- `role` aus Katalog
- `parentId` gueltig oder `null` bei Root
- `allowedOps` nur aus erlaubtem Operationskatalog
- `lockedOps` nur aus erlaubtem Operationskatalog
- keine Operation gleichzeitig in `allowedOps` und `lockedOps`

Schnittstellen:
- Ziel-App liefert Elemente in diesem Format
- Registry nimmt Elemente in diesem Format auf
- Validator prueft Elemente in diesem Format
- Editor-Core liest Elemente in diesem Format

Nicht erlaubt:
- Fachdaten im Elementmodell
- Fachlogik im Elementmodell
- automatisch erratene Pflichtfelder

Abnahme:
- gueltiges Element wird akzeptiert
- Element ohne `id` wird abgelehnt
- Element mit ungueltigem `type` wird abgelehnt
- Element mit ungueltigem `role` wird abgelehnt
- Element mit doppelt belegter Operation wird abgelehnt

Abhaengigkeiten:
A1.

## B2 - Elementtypen-Katalog

Status: gebaut als Plan, technisch offen

Zweck:
Der Elementtypen-Katalog definiert die erlaubten Bauteilarten.

Bauteilbeschreibung:
Erlaubte technische Werte muessen eindeutig dokumentiert und spaeter technisch pruefbar sein.

Mindestinhalt:
- `root`
- `area`
- `group`
- `subgroup`
- `component`
- `componentPart`
- `table`
- `tableColumn`
- `list`
- `card`
- `dialog`
- `toolbar`
- `button`
- `field`
- `label`
- `statusIndicator`

Qualitaetsanforderung:
Nur Werte aus dem Katalog sind erlaubt.

Schnittstellen:
- Elementmodell
- Validator
- Editor-Core
- Ziel-App-Bootstrap

Nicht erlaubt:
- beliebige Freitexttypen
- Ziel-App-spezifische Typen im Kernkatalog ohne LV-Ergaenzung

Abnahme:
- Validator akzeptiert alle erlaubten Typen
- Validator lehnt unbekannte Typen ab

Abhaengigkeiten:
B1.

## B3 - Rollen-Katalog

Status: gebaut als Plan, technisch offen

Zweck:
Die Rolle beschreibt die Bedeutung eines Elements fuer Layout, Bedienstruktur oder Steuerung.

Mindestinhalt:
- `layout`
- `content`
- `meta`
- `structure`
- `status`
- `date`
- `responsible`
- `visibility`
- `action`
- `navigation`
- `system`

Qualitaetsanforderung:
Nur Werte aus dem Katalog sind erlaubt.

Nicht erlaubt:
- fachliche Aktionen als Rolle des Editors missverstehen
- Rollen erraten

Abnahme:
- Validator akzeptiert erlaubte Rollen
- Validator lehnt unbekannte Rollen ab

Abhaengigkeiten:
B1, B2.

## B4 - Operations-Katalog

Status: gebaut als Plan, technisch offen

Zweck:
Der Operations-Katalog definiert, welche Layout- und Editoroperationen moeglich sind.

Mindestinhalt:
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

Qualitaetsanforderung:
Wenn eine Operation nicht in `allowedOps` steht, ist sie nicht erlaubt.
Wenn eine Operation in `lockedOps` steht, ist sie gesperrt.

Nicht erlaubt:
- fachliches Speichern
- fachliches Loeschen
- fachliches Anlegen
- Import
- Export
- Upload
- Datenbankaktionen
- fachliches Ausfuehren eines Buttons

Abnahme:
- Validator akzeptiert erlaubte Operationen
- Validator lehnt unbekannte Operationen ab
- Validator lehnt Operationen ab, die gleichzeitig erlaubt und gesperrt sind

Abhaengigkeiten:
B1.

---

# C - UI-Element-Registry

## C1 - Registry-Grundstruktur

Status: offen

Zweck:
Die Registry ist die zentrale technische Sammlung aller editorfaehigen Elemente einer UI.

Bauteilbeschreibung:
Die Registry nimmt klassifizierte Elemente auf, speichert sie fuer den Editor-Core und gibt eine pruefbare Elementliste aus.

Mindestfunktionen:
- Registry erstellen
- Element registrieren
- Elementliste ausgeben
- Registry leeren
- Registry validieren

Qualitaetsanforderung:
- keine doppelten IDs
- stabile Reihenfolge nach `order`
- keine automatische Klassifizierung
- keine UI-Abhaengigkeit

Schnittstellen:
- Eingang: Ziel-App oder Testdaten liefern Elemente
- Ausgang: Editor-Core und Validator lesen Elemente

Nicht erlaubt:
- UI scannen
- DOM lesen
- Elemente erraten
- Fachlogik auswerten

Abnahme:
- leere Registry kann erstellt werden
- gueltiges Element kann registriert werden
- registrierte Elemente koennen gelesen werden
- Registry kann geleert werden
- doppelte ID wird abgelehnt

Abhaengigkeiten:
B1 bis B4.

## C2 - Registry-Beispieldaten

Status: offen

Zweck:
Beispieldaten pruefen die Registry ohne Ziel-App und ohne Demo-Oberflaeche.

Mindestinhalt:
- gueltige Beispiel-Registry
- ungueltige Beispiel-Registry
- Beispiel mit Tabelle und Metaspalten
- Beispiel mit Button, dessen Fachaktion nicht Editoroperation ist

Qualitaetsanforderung:
Beispieldaten duerfen keine Ziel-App-Fachbegriffe enthalten.

Nicht erlaubt:
- HTML-Beispiel als Kernbeispiel
- Demo-Oberflaeche als Architektur

Abnahme:
- gueltiges Beispiel wird akzeptiert
- ungueltiges Beispiel erzeugt erwartete Fehler

Abhaengigkeiten:
C1, D1 bis D4.

---

# D - Validator

## D1 - Pflichtfeld-Validator

Status: offen

Zweck:
Der Validator prueft, ob jedes editorfaehige Element alle Pflichtfelder enthaelt.

Mindestpruefungen:
- `id` vorhanden
- `name` vorhanden
- `type` vorhanden
- `role` vorhanden
- `parentId` vorhanden oder bei Root `null`
- `order` vorhanden
- `visible` boolean
- `editable` boolean
- `allowedOps` Array
- `lockedOps` Array

Qualitaetsanforderung:
Fehler muessen konkret benannt werden.

Abnahme:
- Element ohne Pflichtfeld wird abgelehnt
- Fehlermeldung nennt Feld und Element

Abhaengigkeiten:
B1.

## D2 - Typen- und Rollen-Validator

Status: offen

Zweck:
Pruefung gegen Elementtypen- und Rollen-Katalog.

Abnahme:
- erlaubte Typen/Rollen akzeptiert
- unbekannte Typen/Rollen abgelehnt

Abhaengigkeiten:
B2, B3.

## D3 - Parent-Validator

Status: offen

Zweck:
Die Parent-Struktur bildet die Lage des Elements im UI-Baum ab.

Mindestpruefungen:
- Root hat keinen Parent
- alle anderen Elemente haben Parent
- Parent existiert
- keine Zyklen
- keine verwaisten Elemente

Nicht erlaubt:
- Parent raten
- Parent aus Namen ableiten

Abnahme:
- gueltiger Baum akzeptiert
- fehlender Parent abgelehnt
- unbekannter Parent abgelehnt
- Zyklus abgelehnt

Abhaengigkeiten:
B1, C1.

## D4 - Operations-Validator

Status: offen

Zweck:
Prueft allowedOps und lockedOps.

Mindestpruefungen:
- alle Operationen im Katalog
- keine Doppelbelegung erlaubt/gesperrt
- fachliche Aktionen verboten

Abnahme:
- gueltige Operation akzeptiert
- unbekannte Operation abgelehnt
- fachliche Aktion abgelehnt

Abhaengigkeiten:
B4.

## D5 - Tabellen- und Metaspalten-Validator

Status: offen

Zweck:
Tabellen sind Composite-Elemente und muessen ihre editorrelevanten Bestandteile klassifizieren.

Mindestpruefungen:
- `table` darf `tableColumn` Kinder haben
- `tableColumn` braucht `columnRole`
- `columnRole` aus Katalog
- Metaspalten duerfen nicht unklassifiziert bleiben
- Aktionsspalten duerfen keine fachliche Aktion als Editoroperation fuehren

Spaltenrollen:
- `contentColumn`
- `metaColumn`
- `structureColumn`
- `statusColumn`
- `dateColumn`
- `responsibleColumn`
- `visibilityColumn`
- `actionColumn`

Abnahme:
- Tabelle mit klassifizierten Spalten akzeptiert
- Spalte ohne `columnRole` abgelehnt
- unbekannte `columnRole` abgelehnt
- Aktionsspalte mit fachlicher Editoroperation abgelehnt

Abhaengigkeiten:
B1 bis B4, C1.

---

# E - Editor-Core

## E1 - Registry lesen

Status: offen

Zweck:
Der Editor-Core liest ausschliesslich die Registry.

Mindestfunktion:
- Registry entgegennehmen
- validieren lassen
- gueltige Elemente intern bereitstellen

Nicht erlaubt:
- UI scannen
- Elemente suchen
- technische Oberflaeche interpretieren

Abnahme:
- gueltige Registry wird gelesen
- ungueltige Registry wird abgelehnt
- Core arbeitet nicht ohne Registry

Abhaengigkeiten:
C1, D1 bis D5.

## E2 - Elementbaum erzeugen

Status: offen

Zweck:
Aus Parent-Beziehungen wird ein strukturierter Elementbaum erzeugt.

Mindestfunktion:
- Root erkennen
- Kinder nach Parent zuordnen
- Reihenfolge nach `order`
- Elementpfade bereitstellen

Abnahme:
- Baum entspricht Parent-Struktur
- Reihenfolge stimmt
- verwaiste Elemente werden nicht akzeptiert

Abhaengigkeiten:
D3, E1.

## E3 - Elementdetails liefern

Status: offen

Zweck:
Der Editor muss fuer ein ausgewaehltes Element alle relevanten Informationen anzeigen koennen.

Mindestdaten:
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
- Zusatzfelder je Typ

Abnahme:
- Details fuer vorhandenes Element werden geliefert
- unbekannte ID wird sauber abgelehnt

Abhaengigkeiten:
E1, E2.

## E4 - Operationen ableiten

Status: offen

Zweck:
Der Editor bestimmt aus allowedOps und lockedOps, welche Aenderungen angeboten werden duerfen.

Abnahme:
- erlaubte Operation wird angezeigt
- gesperrte Operation wird nicht angeboten
- nicht genannte Operation wird nicht angeboten

Abhaengigkeiten:
B4, D4, E3.

---

# F - Aenderungsauftrag

## F1 - Aenderungsauftrag-Datenmodell

Status: offen

Zweck:
Aenderungen werden nicht direkt ausgefuehrt, sondern als Auftrag beschrieben.

Mindestfelder:
- `changeId`
- `elementId`
- `operation`
- `payload`
- `createdAt`
- `source`

Qualitaetsanforderung:
Der Auftrag darf keine Fachdaten enthalten.

Abnahme:
- gueltiger Auftrag kann erzeugt werden
- Auftrag ohne Element wird abgelehnt
- Auftrag mit verbotener Operation wird abgelehnt

Abhaengigkeiten:
E4.

## F2 - Aenderungsauftrag pruefen

Status: offen

Zweck:
Vor Anwendung wird jeder Auftrag gegen Registry und Regeln geprueft.

Mindestpruefungen:
- Element existiert
- Operation erlaubt
- Operation nicht gesperrt
- Payload formal gueltig
- keine Fachaktion

Abnahme:
- erlaubter Auftrag akzeptiert
- gesperrter Auftrag abgelehnt
- Auftrag fuer unbekanntes Element abgelehnt

Abhaengigkeiten:
F1, E4.

---

# G - Host-Adapter

## G1 - Host-Adapter-Vertrag

Status: offen

Zweck:
Der Host-Adapter verbindet Editor und Ziel-App.

Mindestfunktionen:
- Ziel-App liefert Registry
- Ziel-App liefert aktuellen Layoutzustand
- Editor uebergibt Aenderungsauftrag
- Ziel-App prueft Auftrag erneut
- Ziel-App meldet Erfolg oder Fehler zurueck

Nicht erlaubt:
- Fachlogik freigeben
- Fachdaten freigeben
- Editor direkt in Ziel-App schreiben lassen

Abnahme:
- Vertrag dokumentiert
- Testadapter kann Registry liefern
- Testadapter lehnt verbotenen Auftrag ab

Abhaengigkeiten:
C1, F2.

## G2 - Preview-Runtime-API-Vorbereitung

Status: offen

Zweck:
Die Preview-Runtime ist eine spaetere fachneutrale Laufzeitschicht fuer temporaere Editor-Vorschauen.

Bauteilbeschreibung:
Vor einer technischen Uebernahme aus einer Referenz-App muessen Zielstruktur, API-Vertrag, Datenstrukturen, Ausschluesse, Migrationsnotiz und Guardrail-Test im Kit vorbereitet werden.

Mindestinhalt:
- Zielpfad fuer die spaetere Runtime
- dokumentierter API-Vertrag
- dokumentierte Datenstrukturen fuer RegistryElement, Operationen, Preview-Ziel, HostContext und ChangeRequest
- Migrationsnotiz fuer spaetere Referenzdateien
- Guardrail gegen fach- oder host-spezifische Begriffe im Preview-Runtime-Pfad
- keine produktive Funktionslogik

Qualitaetsanforderung:
Die Vorbereitung muss fachneutral bleiben und darf keine konkrete Ziel-App, keine Speicherung und keine Ausfuehrung anbinden.

Schnittstellen:
- bestehendes UI-Elementmodell
- bestehender Editor-Core
- bestehendes ChangeRequest-Modell
- bestehender Host-Adapter-Vertrag

Nicht erlaubt:
- konkrete Host-App-Integration
- Ziel-App-spezifische Sonderlogik
- Speicherung
- Datenbank
- IPC
- PDF oder Druck
- automatische UI-Erkennung
- 1:1-Codeuebernahme ohne Kit-Anpassung

Abnahme:
- API-Dokument vorhanden
- Migrationsnotiz vorhanden
- vorbereitender Runtime-Pfad vorhanden
- Guardrail-Test vorhanden und in `npm test` eingebunden
- `npm test` gruen
- `git diff --check` gruen

Abhaengigkeiten:
E4, F1, F2, G1.

## G3 - Preview-Runtime-Implementierung

Status: offen

Zweck:
Die fachneutrale Preview-Runtime stellt die vorbereiteten Runtime-Funktionen technisch bereit.

Bauteilbeschreibung:
Die Implementierung umfasst Operationsermittlung, Zielmodell, temporaere Pending-ChangeRequests und einen oeffentlichen Runtime-Export unter `src/runtime/preview/index.cjs`, dem browserfaehigen nativen ESM-Einstieg `src/runtime/preview/index.mjs` sowie dem Package-Subpath `ui-editor-kit/runtime/preview`.

Mindestinhalt:
- Preview-Operationen fuer erlaubte und gesperrte Operationen
- Mapping von Preview-Operationen auf ChangeRequest-Operationen
- Zielmodell fuer eigenes Element und registrierten Parent
- temporaere In-Memory-Pending-ChangeRequests
- neutraler Host-Kontext mit Fallback `unknown-host`
- oeffentlicher CommonJS-Export
- browserfaehiger nativer ESM-Exportvertrag fuer spaetere ESM-Hosts und Renderer ohne Bundler
- offizieller Package-Subpath `./runtime/preview` mit `import`- und `require`-Ziel
- Runtime-Test und Guardrail-Test

Qualitaetsanforderung:
Die Runtime muss fachneutral bleiben. Sie darf keine Ziel-App anbinden, keine Speicherung ausfuehren, keine Fachlogik ausfuehren und keine PDF-/Drucklogik enthalten.

Schnittstellen:
- bestehender UI-Elementvertrag
- bestehender ChangeRequest-Vertrag
- spaetere HostContext-Uebergabe

Nicht erlaubt:
- konkrete Host-App-Integration
- CoreShell-Anbindung
- DOM-Panel oder Drag-Panel
- konkrete Ziel-App-Registry
- Speicherung
- Datenbank
- IPC
- localStorage
- Fachlogik
- PDF oder Druck

Abnahme:
- Preview-Runtime-Module vorhanden
- oeffentlicher Export funktioniert
- browserfaehiger ESM-Einstieg importierbar und frei von `.cjs`/`require`
- offizieller Package-Subpath per CommonJS und ESM testbar
- Runtime-Test gruen
- Guardrail-Test gruen
- `npm test` gruen
- `git diff --check` gruen

Abhaengigkeiten:
G2.

---

# H - Layoutspeicherung

## H1 - Speichervertrag fuer Layoutdaten

Status: offen

Zweck:
Layoutdaten werden getrennt von Fachdaten gespeichert.

Mindestinhalt:
- Layoutprofil
- Ziel-App-ID
- UI-Scope
- Element-ID
- Operation oder finaler Layoutzustand
- Version
- Zeitstempel

Nicht erlaubt:
- Fachdaten speichern
- Fachstatus speichern
- Datenbankstruktur der Ziel-App veraendern ohne eigenen Speichervertrag

Abnahme:
- Layoutdatenmodell dokumentiert
- Testdaten ohne Fachdaten
- Ruecksetzen moeglich geplant

Abhaengigkeiten:
F2, G1.

---

# I - Editor-UI

## I1 - Elementbaum-Anzeige

Status: offen

Zweck:
Die Editor-UI zeigt die registrierte Struktur an.

Mindestfunktion:
- Baum aus Registry anzeigen
- Typ und Rolle sichtbar machen
- nicht registrierte Elemente nicht anzeigen

Nicht erlaubt:
- Elemente aus sichtbarer UI ermitteln

Abnahme:
- Baum entspricht Registry
- unbekannte Elemente tauchen nicht auf

Abhaengigkeiten:
E2.

## I2 - Elementdetails- und Operationsanzeige

Status: offen

Zweck:
Ausgewaehltes Element mit erlaubten und gesperrten Operationen anzeigen.

Abnahme:
- Details korrekt
- allowedOps sichtbar
- lockedOps sichtbar
- verbotene Operation nicht ausfuehrbar

Abhaengigkeiten:
E3, E4.

## I3 - Aenderungsentwurf-Anzeige

Status: offen

Zweck:
Aenderungen werden vor Anwendung als Entwurf gezeigt.

Abnahme:
- Entwurf zeigt Element, Operation, Payload und Pruefergebnis
- abgelehnte Aenderung zeigt Grund

Abhaengigkeiten:
F1, F2.

---

# J - Ziel-App-Bootstrap

## J1 - Vertragsuebernahme in Ziel-App

Status: gebaut als Plan, technisch je Ziel-App offen

Zweck:
Eine Ziel-App muss den UI-Editor-Vertrag kennen, bevor editorfaehige UI gebaut wird.

Mindestinhalt:
- Bauplan
- Elementkatalog
- Bau- und Pruefregeln
- Ziel-App-Anbindung
- AGENTS-Block
- Vertragscheck

Nicht erlaubt:
- Ziel-App-Fachlogik aendern
- UI bauen
- Editor-Runtime bauen

Abnahme:
- Dateien in Ziel-App vorhanden
- AGENTS-Regelblock aktiv
- Self-Test laeuft

Abhaengigkeiten:
A1.

---

# K - Pruef- und Abnahmesystem

## K1 - Kern-Testlauf

Status: gebaut

Zweck:
Der Kern-Testlauf prueft, ob der aktuelle Repo-Kern sauber ist.

Mindestbefehl:

```bash
npm test
```

Qualitaetsanforderung:
Der Test muss vor jedem Commit gruen sein.

Abnahme:
- Self-Test gruen
- Cleanup-Test gruen

Abhaengigkeiten:
A1.

## K2 - Regression gegen falsche Nebenstrecken

Status: gebaut, fortlaufend

Zweck:
Verhindert Rueckfall in entfernte Demo-/HTML-/Browser-Schienen.

Mindestpruefung:
- entfernte Demo-Dateien duerfen nicht existieren
- alte Layoutdaten-Skripte duerfen nicht existieren
- alte Beispiel-UI darf nicht existieren

Abnahme:
- Cleanup-Test prueft MUST_NOT_EXIST-Liste

Abhaengigkeiten:
K1.

---

# L - Ausdruecklich ausgeschlossen

Diese Punkte sind nicht Teil des Kernprojekts, solange sie nicht per LV-Ergaenzung freigegeben werden:

- Browser-Demo als Architektur
- HTML-Beispiel als Kernbeispiel
- DOM-Scanning
- automatische UI-Erkennung
- Fachlogik-Editor
- Datenbank-Editor
- Ziel-App-spezifische Fachmodule
- direkte BBM-Integration ohne Ziel-App-Bootstrap
- Speicherung von Fachdaten

---

# M - Vorgesehene Bauabschnitte

## M1 - Schriftstand und Kernvertrag

Status: gebaut

Enthaelt:
- K11.0 Repo bereinigt
- K11.1 Beispiel-UI-Restspur entfernt
- K11.2 Gesamt-LV erstellen
- K11.3 STATUS aus LV ableiten

## M2 - Registry und Validator

Status: offen

Enthaelt:
- B1 bis B4 technisch umsetzen
- C1 bis C2 technisch umsetzen
- D1 bis D5 technisch umsetzen

## M3 - Editor-Core

Status: offen

Enthaelt:
- E1 bis E4 technisch umsetzen

## M4 - Aenderungsauftrag

Status: offen

Enthaelt:
- F1 bis F2 technisch umsetzen

## M5 - Host-Adapter

Status: offen

Enthaelt:
- G1 technisch umsetzen

## M6 - Layoutspeicherung

Status: offen

Enthaelt:
- H1 technisch planen und umsetzen

## M7 - Editor-UI

Status: offen

Enthaelt:
- I1 bis I3 technisch umsetzen

## M8 - Ziel-App-Bootstrap

Status: offen

Enthaelt:
- J1 fuer konkrete Ziel-App anwenden

---

# N - Regel fuer kuenftige Auftraege

Jeder neue Auftrag muss nennen:

- LV-Position
- Ziel
- Nicht-Ziel
- zu aendernde Dateien
- Abnahmekriterien
- Testbefehl

Ohne LV-Position kein Auftrag.

Ohne Abnahmekriterien kein Auftrag.

Ohne gruene Tests kein Haken in `STATUS.md`.
