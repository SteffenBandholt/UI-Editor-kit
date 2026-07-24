# STATUS - UI-Editor-kit

## 1. Zweck

Diese Datei ist das verbindliche Baufortschritts- und Abnahmeprotokoll zum UI-Editor-kit.

Sie wird direkt gegen `docs/EDITOR_GESAMT_LV.md` gefuehrt.

Kein neuer Bauauftrag ohne LV-Position. Kein Haken ohne Nachweis.

## 2. Fuehrende Unterlagen

Vor jedem neuen Auftrag sind mindestens zu lesen:

1. `STATUS.md`
2. `docs/EDITOR_GESAMT_LV.md`
3. `docs/EDITOR_BAUPLAN.md`
4. `docs/UI_ELEMENT_KATALOG.md`
5. `docs/UI_BAU_UND_PRUEFREGELN.md`
6. `docs/UI_EDITOR_VERTRAG.md`
7. `docs/ZIEL_APP_ANBINDUNG.md`
8. `codex/AGENTS_UI_EDITOR_BLOCK.md`

## 3. Produktstand

Das UI-Editor-kit ist ein eigenstaendiges, fachneutrales Modul fuer Anwendungs-Apps.

Gebaut und geprueft sind:

- UI-Elementmodell und Registry,
- Validatoren fuer Pflichtfelder, Typen, Rollen, Parent-Beziehungen und Operationen,
- Editor-Core mit Elementbaum, Details und Operationsableitung,
- fachneutrale Aenderungsauftraege und Pruefung,
- HostAdapter-Vertrag und Testadapter,
- Layoutzustand und Speichervertrag,
- Runtime fuer Session, Baseline, Save, Load, Reset, Discard, Reapply und Rollback,
- Bedienpanel, ViewModels, Status- und Dialogmodell,
- Auswahl und explizite Element-Referenzen,
- getrennte Element- und Textbearbeitung,
- Schrittweiten, Grenzen und atomare Fehlerbehandlung,
- Ziel-App-Bootstrap, Installer und Deinstallation,
- oeffentliche Paket-API und Release-Pruefungen.

Die Ziel-App bleibt Eigentuemerin von Registry, Element-Referenzen, HostAdapter, Layoutspeicher und Aktivierung.

Nicht Bestandteil des Produkts sind Fachlogik, Fachdaten, automatische UI-Erkennung oder eine fest vorgeschriebene Laufzeitumgebung.

## 4. Abgenommene Bauabschnitte

| Abschnitt | Status | Inhalt | Nachweis |
|---|---:|---|---|
| A1 | [A] | Fuehrende Projektunterlagen | Unterlagen vorhanden, Pflichtpruefungen gruen |
| B1-B3 | [A] | Elementmodell, Registry und Validator | automatisierte Core-Tests gruen |
| C1-C2 | [A] | Editor-Core und Operationen | automatisierte Core-Tests gruen |
| D1 | [A] | Aenderungsauftrag und Pruefung | Modell- und Validator-Tests gruen |
| E1 | [A] | HostAdapter-Vertrag | Adapter- und Rollback-Tests gruen |
| F1 | [A] | Layoutzustand und Speicherung | Speicher- und Reset-Tests gruen |
| G1 / M69 | [A] | Runtime und Session-/Layout-API | M69-Tests gruen |
| H1 / M70 | [A] | Bedienpanel und ViewModels | M70-Tests gruen |
| K4 / M71 | [A] | Plattformneutrale Host- und Integrationsschicht | Integrations- und Boundary-Tests gruen |
| K5 / M72 | [A] | Panel-, Element- und Textbearbeitung | M72-Tests und Gesamttest gruen |

## 5. Letzter Abnahmenachweis

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

## 6. Aktueller offener Bauabschnitt

### K6 / M73 - Release Candidate

Status: `[ ] offen`

Ziel:

- Public API final festschreiben,
- Packaging und lokale Moduleinbindung absichern,
- Integrationshandbuch konsolidieren,
- HostAdapter-, Registry- und Speichervertraege finalisieren,
- Release-Candidate-Abnahme definieren und ausfuehren.

Nicht-Ziele:

- keine Fachlogik,
- keine Fachdaten,
- keine automatische UI-Erkennung,
- keine zweite Ziel-App als zwingende Voraussetzung,
- keine bestimmte Laufzeitumgebung als Produktziel,
- noch kein Tag oder Release ohne abgeschlossene Abnahme.

## 7. Naechster Auftrag

M73-Spezifikation erstellen und gegen folgende Kriterien pruefen:

- eindeutige Public API,
- eindeutiger Package-Inhalt,
- vollstaendiger Integrationsvertrag,
- widerspruchsfreie Dokumentation,
- alle Pflichtpruefungen gruen.

## 8. Statuswerte

- `[ ]` offen
- `[~]` in Bau
- `[x]` gebaut
- `[A]` abgenommen
- `[S]` gesperrt
