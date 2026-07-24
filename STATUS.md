# STATUS - UI-Editor-kit

> **VERBINDLICHE PRODUKTGRENZE**
>
> **DAS UI-EDITOR-KIT WIRD NIEMALS IM BROWSER STATTFINDEN.**

## 1. Zweck

Diese Datei ist das verbindliche Baufortschritts- und Abnahmeprotokoll zum UI-Editor-kit.

Sie wird direkt gegen `docs/EDITOR_GESAMT_LV.md` und `docs/EDITOR_FERTIGSTELLUNGSFAHRPLAN.md` gefuehrt.

Kein neuer Bauauftrag ohne Meilenstein. Kein Haken ohne Nachweis. Kein naechster Meilenstein ohne Abnahme des vorherigen.

## 2. Fuehrende Unterlagen

Vor jedem neuen Auftrag sind mindestens zu lesen:

1. `STATUS.md`
2. `docs/EDITOR_FERTIGSTELLUNGSFAHRPLAN.md`
3. `docs/EDITOR_GESAMT_LV.md`
4. `docs/EDITOR_BAUPLAN.md`
5. `docs/UI_ELEMENT_KATALOG.md`
6. `docs/UI_BAU_UND_PRUEFREGELN.md`
7. `docs/UI_EDITOR_VERTRAG.md`
8. `docs/ZIEL_APP_ANBINDUNG.md`
9. `codex/AGENTS_UI_EDITOR_BLOCK.md`

## 3. Verbindliche Steuerungsregel

Es wird immer nur an einem Meilenstein gearbeitet.

Neue Ideen erweitern den laufenden Meilenstein nicht. Sie werden einem spaeteren Meilenstein zugeordnet. Eine Aenderung des laufenden Umfangs ist nur nach ausdruecklicher Entscheidung des Projekteigentuemers erlaubt.

Die feste Reihenfolge lautet:

1. M73 - neue Ziel-App technisch anbinden,
2. M74 - native UI-Editoroberflaeche,
3. M75 - UI-Editor Ende-zu-Ende fertig,
4. M76 - PDF-Grundmodell und PDF-HostAdapter,
5. M77 - sichtbarer PDF-Editor und gemeinsamer End-to-End-Betrieb,
6. M78 - zentraler Windows-Manager und Installer,
7. M79 - bestehende Apps registrieren.

M79 bleibt bis zur Abnahme von M78 gesperrt.

## 4. Produktstand

Das UI-Editor-kit ist ein eigenstaendiges, fachneutrales Modul fuer Anwendungs-Apps.

Gebaut und geprueft sind:

- UI-Elementmodell und Registry,
- Validatoren fuer Pflichtfelder, Typen, Rollen, Parent-Beziehungen und Operationen,
- Editor-Core mit Elementbaum, Details und Operationsableitung,
- fachneutrale Aenderungsauftraege und Pruefung,
- HostAdapter-Vertrag und Testadapter,
- Layoutzustand und Speichervertrag,
- Runtime fuer Session, Baseline, Save, Load, Reset, Discard, Reapply und Rollback,
- Bedienpanel-Controller, ViewModels, Status- und Dialogmodell,
- getrennte Element- und Textbearbeitung,
- Schrittweiten, Grenzen und atomare Fehlerbehandlung,
- Ziel-App-Bootstrap, Installer und Deinstallation,
- oeffentliche Paket-API und Release-Pruefungen.

Noch nicht praktisch fertig sind:

- eine reale neue Referenz-Ziel-App mit echtem HostAdapter,
- die native sichtbare Windows-Editoroberflaeche,
- der UI-End-to-End-Betrieb,
- das technische PDF-Grundmodell,
- der PDF-HostAdapter und die PDF-Erzeugung,
- die sichtbare PDF-Bearbeitung,
- der zentrale Windows-Manager,
- der Registrationslauf fuer bestehende Apps.

Die Ziel-App bleibt Eigentuemerin von Registry, Element-Referenzen, HostAdapter, Layoutspeicher und Aktivierung.

Nicht Bestandteil des Produkts sind Fachlogik, Fachdaten, automatische UI-Erkennung oder eine Browser-/Web-Laufzeit.

## 5. Abgenommene Bauabschnitte

| Abschnitt | Status | Inhalt | Nachweis |
|---|---:|---|---|
| A1 | [A] | Fuehrende Projektunterlagen | Unterlagen vorhanden, Pflichtpruefungen gruen |
| B1-B3 | [A] | Elementmodell, Registry und Validator | automatisierte Core-Tests gruen |
| C1-C2 | [A] | Editor-Core und Operationen | automatisierte Core-Tests gruen |
| D1 | [A] | Aenderungsauftrag und Pruefung | Modell- und Validator-Tests gruen |
| E1 | [A] | HostAdapter-Vertrag | Adapter- und Rollback-Tests gruen |
| F1 | [A] | Layoutzustand und Speicherung | Speicher- und Reset-Tests gruen |
| G1 / M69 | [A] | Runtime und Session-/Layout-API | M69-Tests gruen |
| H1 / M70 | [A] | Bedienpanel-Controller und ViewModels | M70-Tests gruen |
| K4 / M71 | [A] | Plattformneutrale Host- und Integrationsschicht | Integrations- und Boundary-Tests gruen |
| K5 / M72 | [A] | Element- und Textbearbeitungslogik | M72-Tests und Gesamttest gruen |

## 6. Letzter Abnahmenachweis

Lokal unter Windows erfolgreich ausgefuehrt:

```bash
npm test
npm pack --dry-run
npm run release:check
git diff --check
```

Ergebnis:

- komplette Testsuite gruen,
- Package-Trockenlauf erfolgreich,
- Release-Readiness fuer `0.2.0` erfolgreich,
- keine Whitespace-Fehler.

## 7. Aktueller offener Meilenstein

### M73 - Neue Ziel-App technisch anbinden

Status: `[ ] offen`

Ziel:

- eine neue Referenz-Ziel-App anlegen,
- Editor-Paket lokal einbinden,
- vollstaendige Registry fuer einen ersten UI-Bereich bauen,
- echten HostAdapter bauen,
- dauerhaften lokalen Layoutspeicher anbinden,
- Editor aktivieren und deaktivieren,
- eine sichtbare Layoutaenderung ueber den neutralen Aenderungsweg ausfuehren,
- gespeichertes Layout nach Neustart wiederherstellen.

Nicht-Ziele:

- noch keine vollstaendige sichtbare Editoroberflaeche,
- noch kein PDF-Editor,
- kein Windows-Manager,
- keine alte App,
- kein Registrationslauf.

Abnahme nur, wenn alle Kriterien aus `docs/EDITOR_FERTIGSTELLUNGSFAHRPLAN.md` fuer M73 erfuellt und praktisch nachgewiesen sind.

## 8. Naechster Auftrag

Vor dem ersten M73-Code werden verbindlich festgelegt:

- Technik der neuen Referenz-Ziel-App,
- Repository- und Projektstruktur,
- erster editorfaehiger UI-Bereich,
- Start- und Aktivierungsweg des Editors,
- dauerhafter lokaler Speicherort fuer Layoutprofile.

Danach wird ausschliesslich M73 gebaut.

## 9. Statuswerte

- `[ ]` offen
- `[~]` in Bau
- `[x]` gebaut
- `[A]` abgenommen
- `[S]` gesperrt
