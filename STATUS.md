# STATUS - UI-Editor-kit

## 1. Zweck

Diese Datei ist das Baufortschritts- und Abnahmeprotokoll zum UI-Editor-kit.

Sie wird direkt gegen `docs/EDITOR_GESAMT_LV.md` gefuehrt.

Jede Position in dieser Datei verweist auf eine LV-Position.

Kein neuer Bauauftrag ohne LV-Position.

Kein Haken ohne Nachweis.

Keine neue Hauptspur ohne vorherige LV-Ergaenzung.

## 2. Fuehrende Unterlagen

Vor jedem neuen Auftrag sind mindestens diese Dateien zu lesen:

1. `STATUS.md`
2. `docs/EDITOR_GESAMT_LV.md`
3. `docs/EDITOR_BAUPLAN.md`
4. `docs/UI_ELEMENT_KATALOG.md`
5. `docs/UI_BAU_UND_PRUEFREGELN.md`
6. `docs/ZIEL_APP_ANBINDUNG.md`
7. `codex/AGENTS_UI_EDITOR_BLOCK.md`

Wenn ein Auftrag nicht zu einer LV-Position passt, gilt: STOPP.

## 3. Aktueller Projektstand

Aktueller Stand:

- K11.0 erledigt: Repo auf UI-Editor-Kernvertrag bereinigt.
- K11.1 erledigt: Beispiel-UI-/HTML-/data-ui-Restspur entfernt.
- K11.2 erledigt: `docs/EDITOR_GESAMT_LV.md` als Gesamt-LV angelegt.
- K11.3 erledigt: `STATUS.md` aus dem Gesamt-LV abgeleitet.
- K12.0 erledigt: `src/core/ui-element-model.cjs` und Modelltest gebaut.
- K12.1 erledigt: `src/core/ui-element-registry.cjs` und Registry-Test gebaut.
- K12.2 erledigt: `src/core/ui-element-validator.cjs` und Validator-Test gebaut.
- K12.3 erledigt: Parent-Validator fuer Listenstruktur gebaut.
- K12.4 erledigt: Tabellen-/Metaspalten-Validator gebaut.
- K13.0 erledigt: `src/core/editor-core.cjs` liest und validiert vorhandene Registry.
- K13.1 erledigt: `src/core/editor-core.cjs` erzeugt Elementbaum aus validierter Registry.
- K13.2 erledigt: `src/core/editor-core.cjs` liefert Elementdetails per ID.
- K13.3 erledigt: `src/core/editor-core.cjs` leitet erlaubte, gesperrte und verfuegbare Operationen je Element ab.
- K14.0 erledigt: `src/core/change-request-model.cjs` beschreibt fachneutrale Aenderungsauftraege.
- K14.1 erledigt: `src/core/change-request-validator.cjs` prueft Aenderungsauftraege gegen den Editor-Core.
- K15.0 erledigt: `src/core/host-adapter-contract.cjs` und `src/core/test-host-adapter.cjs` technisch gebaut.
- K16.0 erledigt: `src/core/layout-state-model.cjs` und `src/core/layout-state-store.cjs` technisch gebaut.
- K17.0 erledigt: neutrale Elementbaum-Anzeige-Struktur und Editor-UI-State technisch gebaut.
- K17.1 erledigt: neutrale Elementdetails- und Operationsanzeige-Strukturen technisch gebaut.

M2 Fundament ist nach gruenem `npm test` abgenommen.
M3 Editor-Core ist nach gruenem `npm test` abgeschlossen und abgenommen.
M4 Aenderungsauftrag ist nach gruenem `npm test` abgeschlossen und abgenommen.
M5 Host-Adapter ist nach gruenem `npm test` abgeschlossen und abgenommen.
M6 Layoutspeicherung ist nach gruenem `npm test` abgeschlossen und abgenommen.
M7 Editor-UI ist teilweise gebaut; I1 und I2 sind umgesetzt, I3 bleibt offen.

Aktueller naechster Bauabschnitt nach K17.1:

- K17.2: Aenderungsentwurf-Anzeige, ausgerichtet an LV-Position I3 - Aenderungsentwurf-Anzeige.

## 4. Statuswerte

Erlaubte Statuswerte:

- `[ ] offen`
- `[~] in Bau`
- `[x] gebaut`
- `[A] abgenommen`
- `[S] gesperrt`

Bedeutung:

- gebaut: Datei, Code oder Regel ist vorhanden.
- abgenommen: Nachweis/Test liegt vor und Ergebnis ist gruen.
- gesperrt: Darf nicht gebaut werden, solange keine neue LV-Ergaenzung vorliegt.

## 5. Baufortschritt nach LV-Positionen

| LV | Status | Paket / Inhalt | Nachweis | Naechster Schritt |
|---|---:|---|---|---|
| A1 | [A] | Fuehrende Projektunterlagen | Kernunterlagen vorhanden, `npm test` gruen | fortlaufend pflegen |
| A2 | [x] | Gesamt-LV | `docs/EDITOR_GESAMT_LV.md` angelegt | mit STATUS abgleichen |
| A3 | [A] | STATUS als Baufortschritt | `STATUS.md` vorhanden, `npm test` gruen | fortlaufend pflegen |
| B1 | [x] | UI-Element-Datenmodell | Modell + Test vorhanden, `npm test` gruen | nach B1 Registry bauen |
| B2 | [x] | Elementtypen-Katalog als Plan | `docs/UI_ELEMENT_KATALOG.md` | technisch im Validator abbilden |
| B3 | [x] | Rollen-Katalog als Plan | `docs/UI_ELEMENT_KATALOG.md` | technisch im Validator abbilden |
| B4 | [x] | Operations-Katalog als Plan | `docs/UI_ELEMENT_KATALOG.md` | technisch im Validator abbilden |
| C1 | [x] | Registry-Grundstruktur | Registry + Test vorhanden, `npm test` gruen | nach C1 Validator-Grundlage bauen |
| C2 | [ ] | Registry-Beispieldaten ohne HTML | offen | nach C1 |
| D1 | [x] | Pflichtfeld-Validator | Validator + Test vorhanden, `npm test` gruen | nach D1 Parent-Regeln separat bauen |
| D2 | [x] | Typen- und Rollen-Validator | Validator + Test vorhanden, `npm test` gruen | nach D2 bei Bedarf erweitern |
| D3 | [x] | Parent-Validator | Validator + Test vorhanden, `npm test` gruen | abgeschlossen |
| D4 | [x] | Operations-Validator | Validator + Test vorhanden, `npm test` gruen | nach D4 Tabellenlogik getrennt bauen |
| D5 | [x] | Tabellen- und Metaspalten-Validator | Validator + Test vorhanden, `npm test` gruen | abgeschlossen |
| E1 | [x] | Editor-Core liest Registry | Core + Test vorhanden, `npm test` gruen | nach E1 Elementbaum bauen |
| E2 | [x] | Elementbaum erzeugen | Core-Baum + Test vorhanden, `npm test` gruen | nach E2 Elementdetails liefern |
| E3 | [x] | Elementdetails liefern | Core-Details + Test vorhanden, `npm test` gruen | nach E3 Operationen ableiten |
| E4 | [x] | Operationen ableiten | Core + Test vorhanden, `npm test` gruen | nach E4 F1 bauen |
| F1 | [x] | Aenderungsauftrag-Datenmodell | Modell + Test vorhanden, `npm test` gruen | nach F1 F2 bauen |
| F2 | [x] | Aenderungsauftrag pruefen | Validator + Test vorhanden, `npm test` gruen | nach F2 G1 vorbereiten |
| G1 | [A] | Host-Adapter-Vertrag technisch vorbereitet | Vertrag + Testadapter vorhanden, `npm test` gruen | nach G1 H1/K16.0 |
| H1 | [A] | Speichervertrag fuer Layoutdaten | Modell + In-Memory-Store + Tests vorhanden, `npm test` gruen | nach H1 I1/K17.0 |
| I1 | [A] | Elementbaum-Anzeige | neutrales Tree-ViewModel + UI-State, `npm test` gruen | nach I1 I2/K17.1 |
| I2 | [A] | Elementdetails- und Operationsanzeige | neutrales Details-ViewModel + Test vorhanden, `npm test` gruen | nach I2 I3/K17.2 |
| I3 | [ ] | Aenderungsentwurf-Anzeige | offen | nach F1/F2 |
| J1 | [x] | Ziel-App-Bootstrap als Plan | `codex/CODEX_BOOTSTRAP_ZIEL_APP.md` | spaeter auf konkrete Ziel-App anwenden |
| K1 | [A] | Kern-Testlauf | `npm test` gruen | vor jedem Commit ausfuehren |
| K2 | [A] | Regression gegen falsche Nebenstrecken | Cleanup-Test prueft MUST_NOT_EXIST | fortlaufend |

## 6. Meilenstein-Gates

| Meilenstein | Status | Gate |
|---|---|---|
| M1 - Planung / Vertrag / LV | abgenommen | Fuehrende Unterlagen und Gesamt-LV liegen vor. |
| M2 - Fundament: Datenmodell, Registry, Validator | abgenommen | Status nach diesem Paket: abgenommen, weil K12.3 und K12.4 gebaut sind und `npm test` gruen ist. |
| M3 - Editor-Core | abgenommen | E1 bis E4 gebaut, `npm test` gruen; K13.3 schliesst M3 ab. |
| M4 - Aenderungsauftrag | abgenommen | F1 bis F2 gebaut, `npm test` gruen; nach K14.1 abgeschlossen. |
| M5 - Host-Adapter | abgenommen | G1 gebaut und mit `npm test` gruen abgenommen; nach K15.0 abgeschlossen. |
| M6 - Layoutspeicherung | abgenommen | H1 gebaut und mit `npm test` gruen abgenommen; nach K16.0 abgeschlossen. |
| M7 - Editor-UI | teilweise gebaut | I1/K17.0 und I2/K17.1 gebaut und abgenommen; I3 offen. |
| M8 - Ziel-App-Bootstrap / erste Ziel-App | offen | Kein Bau vor ausdruecklichem Ziel-App-Auftrag. |

Regel:

Nach K12.4 ist die Fundamentphase beendet. Danach keine weiteren K12.x-Pakete ohne ausdrueckliche LV-Ergaenzung.

## 7. Abgeschlossene Pakete

### K11.0 - Repo auf UI-Editor-Kernvertrag bereinigen

Status: abgenommen

Ergebnis:

- alte Browser-/HTML-/Demo-/Mini-Inspector-/Layoutdaten-Schiene entfernt
- Kernvertrag wieder fuehrend
- Cleanup-Test vorhanden
- `npm test` gruen

Nachweis:

- Commit `8886ff0` laut lokalem Log: `K11.0 Repo auf UI-Editor-Kernvertrag bereinigen`

### K11.1 - Beispiel-UI-Restspur entfernen

Status: abgenommen

Ergebnis:

- `examples/beispiel-ui/README.md` entfernt
- `examples/beispiel-ui/beispiel.html` entfernt
- Cleanup-Test angepasst
- `npm test` gruen

Nachweis:

- lokaler Testlauf gruen nach Anpassung

### K11.2 - Gesamt-LV erstellen

Status: gebaut

Ergebnis:

- `docs/EDITOR_GESAMT_LV.md` angelegt
- LV-Positionen A bis N definiert
- Bauteile mit Zweck, Mindestinhalt, Qualitaet, Schnittstellen, Nicht-Zielen, Abnahme und Abhaengigkeiten beschrieben

Nachweis:

- Datei im Repo vorhanden

### K11.3 - STATUS aus Gesamt-LV ableiten

Status: abgenommen

Ergebnis:

- `STATUS.md` angelegt
- LV-Positionen als Baufortschrittsliste uebernommen
- naechster Bauabschnitt K12.0 festgelegt
- `npm test` gruen

Nachweis:

- `STATUS.md` vorhanden
- `npm test` gruen

### K12.0 - UI-Element-Datenmodell technisch umsetzen

Status: gebaut

Ergebnis:

- `src/core/ui-element-model.cjs` angelegt
- fachneutrale Konstanten fuer Typen, Rollen, Operationen und Pflichtfelder exportiert
- Basishilfen fuer bekannte Feldgruppen und zwei neutrale Modellfunktionen angelegt
- `scripts/tests/ui-element-model.test.cjs` prueft Modellinhalt und Abgrenzung gegen verbotene Nebenstrecken
- `npm test` gruen

### K12.1 - Registry-Grundstruktur technisch umsetzen

Status: gebaut

Ergebnis:

- `src/core/ui-element-registry.cjs` angelegt
- Registry erstellt, registriert, liest per ID, listet in Registrierungsreihenfolge und leert neutral
- Registrierung nutzt `src/core/ui-element-model.cjs` zur Normalisierung
- doppelte IDs und fehlende/leere string-IDs werden mit klarer Fehlermeldung abgelehnt
- Rueckgaben sind Kopien, damit interne Daten nicht durch aeussere Mutation veraendert werden
- `scripts/tests/ui-element-registry.test.cjs` prueft C1-Funktionen und Abgrenzung gegen verbotene Nebenstrecken
- `npm test` gruen

### K12.2 - Validator-Grundlage technisch umsetzen

Status: gebaut

Ergebnis:

- `src/core/ui-element-validator.cjs` angelegt
- `validateUiElement()` prueft Elementform, Pflichtfelder, Typ, Rolle und Operationsgrundregeln
- `validateUiElementList()` prueft mehrere Elemente und sammelt Fehler ohne Parent- oder Tabellenlogik
- Validator ergaenzt keine Werte, normalisiert nicht still und mutiert Eingaben nicht
- fachliche Operationen werden abgelehnt, ebenso ungueltige Ops-Arrays und Doppelbelegungen erlaubt/gesperrt
- `scripts/tests/ui-element-validator.test.cjs` prueft D1, D2, D4 und die Abgrenzung gegen verbotene Nebenstrecken
- `npm test` gruen

### K12.3 - Parent-Validator

Status: gebaut

Ergebnis:

- `validateUiElementList()` prueft genau ein root-Element.
- root-Parent wird auf null oder leeren String begrenzt.
- Nicht-root-Elemente brauchen einen vorhandenen Parent.
- unbekannte Parents, verwaiste Elemente und Parent-Zyklen werden mit klaren Fehlercodes abgelehnt.
- Parent-Beziehungen werden nicht geraten und nicht aus name/type/role abgeleitet.
- `scripts/tests/ui-element-validator.test.cjs` prueft die D3-Pflichtfaelle.
- `npm test` gruen

### K12.4 - Tabellen- und Metaspalten-Validator

Status: gebaut

Ergebnis:

- `validateUiElementList()` prueft `tableColumn`-Elemente gegen erlaubte `columnRole`-Werte.
- `tableColumn` braucht ein `table`-Element als Parent.
- Metaspalten wie `metaColumn`, `structureColumn`, `statusColumn`, `dateColumn`, `responsibleColumn` und `visibilityColumn` sind erlaubt.
- `actionColumn` wird akzeptiert, solange keine fachliche Operation als Editoroperation gefuehrt wird.
- Der Validator klassifiziert Spalten nicht selbst und raet keine `columnRole`.
- `scripts/tests/ui-element-validator.test.cjs` prueft die D5-Pflichtfaelle.
- `npm test` gruen

### K13.0 - Editor-Core liest Registry

Status: gebaut

Ergebnis:

- `src/core/editor-core.cjs` angelegt
- `createEditorCore(registry)` liest ausschliesslich eine vorhandene Registry ueber `listElements()`
- die gelesene Elementliste wird mit `validateUiElementList(elements)` geprueft
- ungueltige Registry oder ungueltige Elementliste wird mit Validation-Result abgelehnt
- `listElements()`, `getValidationResult()` und `size()` liefern geschuetzte Rueckgaben
- kein Elementbaum, keine Elementdetails, keine Operationsableitung und kein Aenderungsauftrag gebaut
- `scripts/tests/editor-core.test.cjs` prueft E1-Faelle und die Abgrenzung gegen verbotene Nebenstrecken
- `npm test` gruen

### K13.1 - Elementbaum erzeugen

Status: gebaut

Ergebnis:

- `src/core/editor-core.cjs` um `getElementTree()` erweitert
- Root wird aus der validierten Elementliste ueber `type = root` gelesen
- Parent-/Child-Beziehungen werden ueber vorhandene `parentId`-Werte aufgebaut
- Kinder werden je Knoten nach `order` sortiert
- Baumknoten liefern nur `element` und `children` und erfinden keine neuen Felder
- Rueckgaben sind Kopien, damit Mutationen am gelieferten Baum den Core nicht veraendern
- keine neue Validatorlogik, keine Elementdetails, keine Operationsableitung und kein Aenderungsauftrag gebaut
- `scripts/tests/editor-core.test.cjs` prueft E2-Faelle und die Abgrenzung gegen verbotene Nebenstrecken
- `npm test` gruen

### K13.2 - Elementdetails liefern

Status: gebaut

Ergebnis:

- `src/core/editor-core.cjs` um `hasElement(elementId)` und `getElementDetails(elementId)` erweitert
- Elementdetails werden ausschliesslich aus der validierten Elementliste gelesen
- bekannte IDs liefern eine Kopie des passenden Elements, unbekannte IDs liefern `null`
- optionale Felder bleiben erhalten, es werden keine neuen Felder erfunden
- Rueckgaben sind kopiert, damit Mutationen den Core nicht veraendern
- keine neue Validatorlogik, keine Operationsableitung und kein Aenderungsauftrag gebaut
- `scripts/tests/editor-core.test.cjs` prueft E3-Faelle und die Abgrenzung gegen verbotene Nebenstrecken
- `npm test` gruen

### K13.3 - Operationen ableiten

Status: gebaut

Ergebnis:

- `src/core/editor-core.cjs` um `getElementOperations(elementId)` und `canElementPerformOperation(elementId, operation)` erweitert
- der Core leitet `allowedOps`, `lockedOps` und `availableOps` ausschliesslich aus der validierten Elementliste ab
- `availableOps` enthaelt nur erlaubte Operationen, die nicht gesperrt sind; `lockedOps` uebersteuert die Verfuegbarkeit
- unbekannte Element-IDs liefern bei `getElementOperations()` sauber `null` und bei `canElementPerformOperation()` `false`
- Rueckgaben sind kopiert, damit Mutationen an Operationen den Core nicht veraendern
- keine neue Validatorlogik, kein Aenderungsauftrag, kein Host-Adapter und keine UI-/Ziel-App-Anbindung gebaut
- `scripts/tests/editor-core.test.cjs` prueft E4-Faelle und die Abgrenzung gegen verbotene Nebenstrecken
- `npm test` gruen

## 8. Naechste Baupakete

### K14.0 - Aenderungsauftrag-Datenmodell

Status: gebaut

LV-Bezug:

- F1

Ergebnis:

- `src/core/change-request-model.cjs` angelegt
- `normalizeChangeRequest(values)` uebernimmt nur bekannte Auftragsfelder und entfernt unbekannte Felder
- `createChangeRequest(values)` erzeugt ausschliesslich den beschriebenen Auftrag und fuehrt keine Aenderung aus
- `payload` wird kopiert, damit nachtraegliche Eingabemutationen den Auftrag nicht veraendern
- Pflichtfelder werden nicht automatisch erfunden; `createdAt` bleibt ein uebergebener Wert
- verbotene Fachfelder werden als Liste bereitgestellt und vom Modell nicht uebernommen
- `scripts/tests/change-request-model.test.cjs` prueft F1-Faelle und die Abgrenzung gegen verbotene Nebenstrecken
- `npm test` gruen

### K14.1 - Aenderungsauftrag pruefen

Status: gebaut

LV-Bezug:

- F2

Ergebnis:

- `src/core/change-request-validator.cjs` angelegt
- `validateChangeRequestShape(changeRequest)` prueft Objektform, Pflichtfelder, `payload` und verbotene Fachfelder
- `validateChangeRequest(changeRequest, editorCore)` prueft zusaetzlich den vorhandenen Editor-Core-Vertrag
- unbekannte Elemente werden abgelehnt
- nicht erlaubte, unbekannte oder gesperrte Operationen werden mit klaren Fehlern abgelehnt
- Ergebnisformat ist `{ ok, errors }`; Fehler enthalten Code, Meldung und passende Kontextfelder
- Validator veraendert weder Auftrag noch Editor-Core und fuehrt keine Aenderung aus
- kein Host-Adapter, keine Layoutspeicherung, keine Editor-UI und keine Ziel-App-Anbindung gebaut
- `scripts/tests/change-request-validator.test.cjs` prueft F2-Faelle und die Abgrenzung gegen verbotene Nebenstrecken
- `npm test` gruen

Nach K14.1 ist M4 abgeschlossen; keine weiteren K14.x-Pakete ohne ausdrueckliche LV-Ergaenzung.

### K15.0 - Host-Adapter-Vertrag technisch vorbereiten

Status: abgenommen

LV-Bezug:

- G1

Ergebnis:

- `src/core/host-adapter-contract.cjs` angelegt
- Pflichtmethoden `getRegistry`, `getCurrentLayoutState` und `submitChangeRequest` werden als Kopie bereitgestellt
- `validateHostAdapterContract(adapter)` prueft den neutralen Adapter-Vertrag ohne Adapter-Methoden auszufuehren
- Ergebnisformat ist `{ ok, errors }`; Fehler enthalten Code, Meldung und bei fehlenden Methoden den Methodennamen
- `src/core/test-host-adapter.cjs` angelegt
- Test-Adapter liefert eine uebergebene Registry, kopiert Layoutzustand und nimmt Aenderungsauftraege nur entgegen
- eingereichte Aenderungsauftraege werden intern kopiert, koennen fuer Tests gelistet und geloescht werden und werden nicht ausgefuehrt
- keine echte Ziel-App, keine Layoutspeicherung, keine Editor-UI, keine Datenbankaktion, keine Fachlogik und keine Fachdaten eingefuehrt
- `scripts/tests/host-adapter-contract.test.cjs` prueft G1-Vertrag und Abgrenzung gegen verbotene Nebenstrecken
- `scripts/tests/test-host-adapter.test.cjs` prueft Test-Adapter, Kopierverhalten, Nicht-Ausfuehrung und Abgrenzung gegen verbotene Nebenstrecken
- `npm test` gruen

Nach K15.0 ist M5 abgeschlossen; keine weiteren K15.x-Pakete ohne ausdrueckliche LV-Ergaenzung.

Naechster Bauabschnitt: K16.0 - Speichervertrag fuer Layoutdaten.

### K16.0 - Speichervertrag fuer Layoutdaten technisch vorbereiten

Status: abgenommen

LV-Bezug:

- H1

Ergebnis:

- `src/core/layout-state-model.cjs` angelegt
- fachneutraler Speichervertrag mit Pflichtfeldern fuer Layoutprofil, technische Ziel-App-ID, UI-Scope, Element-ID, Aenderungs-ID, Editoroperation, Layoutwert, Version und Zeitwerte definiert
- optionale neutrale Felder fuer Quelle, Notiz, Vorversion und Anwenderkennung definiert
- verbotene Fachfelder werden beim Normalisieren nicht uebernommen, auch nicht innerhalb von `layoutValue`
- `src/core/layout-state-store.cjs` angelegt
- neutrale In-Memory-Test-Speicherung erstellt, die Datensaetze normalisiert, kopiert, listet, technisch filtert, nach Einfuegereihenfolge den letzten passenden Datensatz liefert, zuruecksetzt und leert
- fachliche oder unbekannte Filter werden klar abgelehnt
- keine echte Datenbank, keine Dateispeicherung, keine Ziel-App-Anbindung, keine Host-Adapter-Erweiterung, keine Editor-UI und keine Fachlogik eingefuehrt
- `scripts/tests/layout-state-model.test.cjs` prueft H1-Modell, Kopierverhalten und Abgrenzung gegen verbotene Nebenstrecken
- `scripts/tests/layout-state-store.test.cjs` prueft In-Memory-Store, Filter, Rueckgabe-Kopien, Reset und Abgrenzung gegen verbotene Nebenstrecken
- `npm test` gruen

Nach K16.0 ist M6 abgeschlossen; keine weiteren K16.x-Pakete ohne ausdrueckliche LV-Ergaenzung.

K17.0 wurde nach K16.0 als naechster Bauabschnitt umgesetzt.

### K17.0 - Editor-UI Grundstruktur / Elementbaum-Anzeige vorbereiten

Status: abgenommen

LV-Bezug:

- I1

Ergebnis:

- `src/core/editor-ui-tree-view-model.cjs` angelegt
- neutrale Elementbaum-Darstellungsstruktur aus `editorCore.getElementTree()` vorbereitet
- optionale Detail- und Operationsinformationen werden nur lesend fuer Anzeigezusammenfassungen genutzt
- Auswahl-, Aufklapp-, Fehler- und Moduszustand in `src/core/editor-ui-state.cjs` fachneutral vorbereitet
- K17.0 baut nur die neutrale Elementbaum-Anzeige-Struktur fuer eine spaetere Oberflaeche
- keine echte UI-App, keine Ziel-App-Anbindung, keine Integrationsstrecke, keine Layoutspeicher-Erweiterung und keine Aenderungsausfuehrung eingefuehrt
- `scripts/tests/editor-ui-tree-view-model.test.cjs` prueft Baumstruktur, Tiefe, technische ID-Pfade, Sichtbarkeitsfilter, Operationszusammenfassung und Nur-Lese-Verhalten
- `scripts/tests/editor-ui-state.test.cjs` prueft neutralen UI-State, Kopierverhalten, Auswahl, Aufklappstatus, Modi und Fehlerzustand
- `npm test` gruen

Nach K17.0 ist M7 teilweise gebaut; I2 und I3 bleiben offen.

Naechster Bauabschnitt: K17.1 - Elementdetails- und Operationsanzeige, ausgerichtet an LV-Position I2 - Elementdetails- und Operationsanzeige.

### K17.1 - Elementdetails- und Operationsanzeige vorbereiten

Status: abgenommen

LV-Bezug:

- I2

Ergebnis:

- `src/core/editor-ui-details-view-model.cjs` angelegt
- neutrale Elementdetails-Darstellungsstruktur aus `editorCore.getElementDetails(elementId)` vorbereitet
- neutrale Operationsanzeige-Struktur aus `editorCore.getElementOperations(elementId)` vorbereitet, wenn der Editor-Core diese Funktion bereitstellt
- erlaubte, gesperrte und verfuegbare Operationen werden nur als Anzeigezeilen abgebildet
- K17.1 baut nur neutrale Elementdetails- und Operationsanzeige-Strukturen fuer eine spaetere Oberflaeche
- keine echte UI-App, keine Ziel-App-Anbindung, keine Integrationsstrecke, keine Layoutspeicher-Erweiterung und keine Aenderungsausfuehrung eingefuehrt
- `scripts/tests/editor-ui-details-view-model.test.cjs` prueft Details, Operationszeilen, Kopierverhalten, Nur-Lese-Verhalten und Abgrenzung gegen gesperrte Nebenstrecken
- `npm test` gruen

Nach K17.1 ist M7 teilweise gebaut; I3 bleibt offen.

Naechster Bauabschnitt: K17.2 - Aenderungsentwurf-Anzeige, ausgerichtet an LV-Position I3 - Aenderungsentwurf-Anzeige.

## 9. Gesperrte Nebenstrecken

Diese Punkte sind gesperrt, solange keine ausdrueckliche LV-Ergaenzung erfolgt:

| Status | Nebenstrecke | Grund |
|---:|---|---|
| [S] | Browser-Demo als Architektur | fuehrte von der Kernspur weg |
| [S] | HTML-Beispiel als Kernbeispiel | alte data-ui-Restspur entfernt |
| [S] | DOM-Scanning | widerspricht klassifizierter UI-Elementliste |
| [S] | automatische UI-Erkennung | Editor soll nicht raten |
| [S] | Mini-Inspector-Demo als Hauptspur | entfernt |
| [S] | Host-App-Demo als Hauptspur | entfernt |
| [S] | Ziel-App-spezifische Fachlogik | Kernprojekt ist fachneutral |
| [S] | direkte BBM-Integration ohne Bootstrap | Ziel-App muss zuerst Vertrag uebernehmen |
| [S] | Fachdaten-Speicherung | Editor speichert nur Layoutdaten, spaeter und getrennt |

## 10. Regel fuer neue Codex-Auftraege

Jeder neue Codex-Auftrag muss enthalten:

- LV-Position
- Ziel
- Nicht-Ziel
- zu aendernde Dateien
- Abnahmekriterien
- Testbefehl

Standard-Testbefehl:

```bash
npm test
```

Wenn ein Auftrag keine LV-Position nennt, wird er nicht gestartet.

Wenn ein Auftrag neue Ideen einfuehrt, die nicht im LV stehen, gilt: STOPP.

## 11. Aktueller naechster Schritt

Naechster Schritt nach K17.1:

```text
K17.2 - Aenderungsentwurf-Anzeige (LV I3 - Aenderungsentwurf-Anzeige)
```

Nicht vorher:

- keine weiteren K17.1-Erweiterungen ohne ausdrueckliche LV-Ergaenzung bauen
- keine Editor-UI ausserhalb LV I3 bauen
- keine Ziel-App anbinden

M2 ist abgeschlossen; weitere K12.x-Pakete sind ohne ausdrueckliche LV-Ergaenzung gesperrt.
Nach K13.3 ist M3 abgeschlossen; keine weiteren K13.x-Pakete ohne ausdrueckliche LV-Ergaenzung.
Nach K14.1 ist M4 abgeschlossen; keine weiteren K14.x-Pakete ohne ausdrueckliche LV-Ergaenzung.
Nach K15.0 ist M5 abgeschlossen; keine weiteren K15.x-Pakete ohne ausdrueckliche LV-Ergaenzung.
