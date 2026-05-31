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

M2 Fundament ist nach gruenem `npm test` abgenommen.

Aktueller naechster Bauabschnitt nach K13.0:

- K13.1: Elementbaum erzeugen.

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
| E2 | [ ] | Elementbaum erzeugen | offen | nach E1 |
| E3 | [ ] | Elementdetails liefern | offen | nach E2 |
| E4 | [ ] | Operationen ableiten | offen | nach E3 |
| F1 | [ ] | Aenderungsauftrag-Datenmodell | offen | nach E4 |
| F2 | [ ] | Aenderungsauftrag pruefen | offen | nach F1 |
| G1 | [ ] | Host-Adapter-Vertrag technisch vorbereiten | offen | nach F2 |
| H1 | [ ] | Speichervertrag fuer Layoutdaten | offen | nach G1 |
| I1 | [ ] | Elementbaum-Anzeige | offen | nach E2 |
| I2 | [ ] | Elementdetails- und Operationsanzeige | offen | nach E3/E4 |
| I3 | [ ] | Aenderungsentwurf-Anzeige | offen | nach F1/F2 |
| J1 | [x] | Ziel-App-Bootstrap als Plan | `codex/CODEX_BOOTSTRAP_ZIEL_APP.md` | spaeter auf konkrete Ziel-App anwenden |
| K1 | [A] | Kern-Testlauf | `npm test` gruen | vor jedem Commit ausfuehren |
| K2 | [A] | Regression gegen falsche Nebenstrecken | Cleanup-Test prueft MUST_NOT_EXIST | fortlaufend |

## 6. Meilenstein-Gates

| Meilenstein | Status | Gate |
|---|---|---|
| M1 - Planung / Vertrag / LV | abgenommen | Fuehrende Unterlagen und Gesamt-LV liegen vor. |
| M2 - Fundament: Datenmodell, Registry, Validator | abgenommen | Status nach diesem Paket: abgenommen, weil K12.3 und K12.4 gebaut sind und `npm test` gruen ist. |
| M3 - Editor-Core | in Bau | E1 gebaut; naechster Schritt K13.1 - Elementbaum erzeugen. |
| M4 - Aenderungsauftrag | offen | Kein Bau vor Abschluss des Editor-Core-Abschnitts. |
| M5 - Host-Adapter | offen | Kein Bau vor Aenderungsauftrag. |
| M6 - Layoutspeicherung | offen | Kein Bau vor Host-Adapter-Vertrag. |
| M7 - Editor-UI | offen | Kein Bau vor den fachneutralen Kernvertraegen. |
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

## 8. Naechste Baupakete

### K13.1 - Elementbaum erzeugen

LV-Bezug:

- E2

Ziel:

- Elementbaum aus validierten Parent-Beziehungen erzeugen.
- Reihenfolge und Struktur ohne neue UI-Schiene bereitstellen.

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

Naechster Schritt nach K13.0:

```text
K13.1 - Elementbaum erzeugen
```

Nicht vorher:

- keinen Aenderungsauftrag bauen
- keinen Host-Adapter bauen
- keine Editor-UI bauen
- keine Ziel-App anbinden

M2 ist abgeschlossen; weitere K12.x-Pakete sind ohne ausdrueckliche LV-Ergaenzung gesperrt.
