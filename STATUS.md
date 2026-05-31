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
- K11.3 in Bau: `STATUS.md` aus dem Gesamt-LV ableiten.

Aktueller naechster Bauabschnitt nach K11.3:

- K12.0: UI-Element-Datenmodell technisch umsetzen.

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
| A3 | [~] | STATUS als Baufortschritt | diese Datei | nach Sync testen und committen |
| B1 | [ ] | UI-Element-Datenmodell | offen | K12.0 |
| B2 | [x] | Elementtypen-Katalog als Plan | `docs/UI_ELEMENT_KATALOG.md` | technisch im Validator abbilden |
| B3 | [x] | Rollen-Katalog als Plan | `docs/UI_ELEMENT_KATALOG.md` | technisch im Validator abbilden |
| B4 | [x] | Operations-Katalog als Plan | `docs/UI_ELEMENT_KATALOG.md` | technisch im Validator abbilden |
| C1 | [ ] | Registry-Grundstruktur | offen | nach B1 |
| C2 | [ ] | Registry-Beispieldaten ohne HTML | offen | nach C1 |
| D1 | [ ] | Pflichtfeld-Validator | offen | nach B1 |
| D2 | [ ] | Typen- und Rollen-Validator | offen | nach B2/B3 |
| D3 | [ ] | Parent-Validator | offen | nach C1 |
| D4 | [ ] | Operations-Validator | offen | nach B4 |
| D5 | [ ] | Tabellen- und Metaspalten-Validator | offen | nach D1-D4 |
| E1 | [ ] | Editor-Core liest Registry | offen | nach C/D |
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

## 6. Abgeschlossene Pakete

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

Status: in Bau

Ergebnis:

- `STATUS.md` angelegt
- LV-Positionen als Baufortschrittsliste uebernommen
- naechster Bauabschnitt K12.0 festgelegt

Abnahme noch offen:

- lokal synchronisieren
- `npm test` ausfuehren
- `git diff --check` pruefen
- committen und pushen

## 7. Naechste Baupakete

### K12.0 - UI-Element-Datenmodell technisch umsetzen

LV-Bezug:

- B1

Ziel:

- technisches Datenmodell fuer UI-Elemente anlegen
- Pflichtfelder abbilden
- erlaubte Typen, Rollen und Operationen noch nicht vollstaendig validieren, aber strukturell vorbereiten

Nicht-Ziel:

- keine Editor-UI
- kein Host-Adapter
- keine Layoutspeicherung
- keine Ziel-App-Anbindung
- kein Scanning
- keine Demo-Oberflaeche

Abnahmekriterien:

- Datenmodell vorhanden
- gueltiges Element kann beschrieben werden
- Element ohne Pflichtfelder kann im naechsten Validator-Paket geprueft werden
- `npm test` gruen

### K12.1 - Registry-Grundstruktur

LV-Bezug:

- C1

Ziel:

- Registry erstellen
- Element registrieren
- Elementliste ausgeben
- Registry leeren
- doppelte IDs ablehnen

### K12.2 - Validator-Grundlage

LV-Bezug:

- D1, D2, D4

Ziel:

- Pflichtfelder pruefen
- Typen pruefen
- Rollen pruefen
- Operationen pruefen

### K12.3 - Parent-Validator

LV-Bezug:

- D3

Ziel:

- Parent-Beziehungen pruefen
- Root pruefen
- verwaiste Elemente ablehnen
- Zyklen ablehnen

### K12.4 - Tabellen- und Metaspalten-Validator

LV-Bezug:

- D5

Ziel:

- Tabellen als Composite pruefen
- Spaltenrollen pruefen
- Metaspalten pruefen
- Aktionsspalten gegen Fachaktionen absichern

## 8. Gesperrte Nebenstrecken

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

## 9. Regel fuer neue Codex-Auftraege

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

## 10. Aktueller naechster Schritt

Naechster Schritt nach Abnahme dieser Datei:

```text
K12.0 - UI-Element-Datenmodell technisch umsetzen
```

Nicht vorher:

- keine Registry bauen
- keinen Editor-Core bauen
- keinen Host-Adapter bauen
- keine Ziel-App anbinden

Erst B1 sauber bauen, dann weiter.
