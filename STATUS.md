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
- native sichtbare Windows-Editoroberflaeche und vollstaendiger UI-End-to-End-Betrieb,
- zwei getrennte Scopes und zwei dauerhaft getrennte Layoutprofile,
- Save, Load, Discard, Reset, native App-Auswahl, Dirty-Schutz und Neustart-Restore,
- neutrales A4-PDF-Modell, PDF-Registry, PDF-HostAdapter und getrenntes PDF-Profil,
- lokale reale Mehrseiten-PDF-Erzeugung mit reproduzierbarem Umbruch und Batchrollback,
- Ziel-App-Bootstrap, Installer und Deinstallation,
- oeffentliche Paket-API und Release-Pruefungen.

Noch nicht praktisch fertig sind:

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
| K6 / M73 | [A] | Neue WPF-Ziel-App technisch angebunden: M73.1 Grundgeruest, M73.2 Registry, M73.3 HostAdapter, M73.4 Node-Prozess/Session, M73.5 dauerhafter Layoutspeicher und Neustart-Restore | .NET-/npm-Tests und echter Zwei-Prozess-Nachweis gruen |
| K7 / M74 | [A] | Native sichtbare UI-Editoroberflaeche mit Registry-Baum, neutralen Details, Element-/Textebene, fuenf Modi, Schrittweite, Richtungssteuerung und Einzelfenster-Lebenszyklus | 21 .NET-Tests, npm-Gesamttest und sichtbarer `--editor-ui-diagnostic`-Nachweis gruen |
| K8 / M75 | [A] | Vollstaendiger nativer UI-Betrieb mit Save, Load, Einzel-/Gesamtverwerfen, Einzel-/Gesamtreset, zwei Scopes, zwei Profilen, direkter App-Auswahl, Neustart-Restore und Batchrollback | 29 .NET-Tests, npm-Gesamttest und echter Zwei-Prozess-Nachweis `--ui-full-operation-diagnostic` gruen |
| K9 / M76 | [A] | Neutrales PDF-Dokument-/Seitenmodell, Registry mit 26 Elementen, PDF-HostAdapter, getrenntes Profil, Save/Load/Discard/Reset, Rollback und lokale reale Mehrseiten-PDF | 38 .NET-Tests, npm-Gesamttest und echter `--pdf-model-diagnostic`-Nachweis gruen |

## 6. Letzter Abnahmenachweis

Lokal unter Windows erfolgreich ausgefuehrt:

```bash
npm test
npm pack --dry-run
npm run release:check
git diff --check
dotnet build reference-target-app
dotnet test reference-target-app
```

Ergebnis:

- komplette Testsuite gruen,
- Package-Trockenlauf erfolgreich,
- Release-Readiness fuer `0.2.0` erfolgreich,
- keine Whitespace-Fehler,
- 38 .NET-Tests einschliesslich aller M75- sowie PDF-Modell-, Registry-, Persistenz-, Rendering-, Kompatibilitaets- und Rollbacktests gruen,
- sichtbare Breite nach Neustart von 368 px auf 398 px bei 125 % DPI wiederhergestellt (= +24 DIP),
- natives M74-Editorfenster sichtbar geoeffnet; exakt acht registrierte Elemente, neutrale Details und capability-gesteuerte Modi angezeigt,
- Position, Breite, Hoehe, Textposition und Schriftgroesse ueber Panelcontroller, Node-Session und WpfHostAdapter unmittelbar sichtbar geaendert,
- Einzelfensterregel, Schliessen per Button und X sowie Wiedereroeffnung mit jeweils vollstaendig beendetem Node-Prozess nachgewiesen,
- Fachwert `AU-2026-0471` unveraendert und fachlicher Button-/Statusfluss weiterhin funktionsfaehig,
- M75-Zustandsmodell BASELINE/SAVED/WORKING/LOADED sowie Save, Load, Einzel-/Gesamtverwerfen und Einzel-/Gesamtreset fuer `ui.order-header` und `ui.customer-details` nachgewiesen,
- getrennte Profile `standard` und `compact`, aktive Profilwahl und atomarer Schema-2-Startup-Restore ueber beide Scopes nach echtem Prozessneustart nachgewiesen,
- Baum- und direkte native App-Auswahl, Unterdrueckung fachlicher Commands im Auswahlmodus, Dirty- und Profilwechselschutz sowie alle drei Schliessen-Entscheidungen nachgewiesen,
- provozierter Adapterfehler mit vollstaendigem scopeuebergreifendem Rollback und unveraenderten Fachwerten nachgewiesen,
- reale lokal erzeugte A4-PDF mit reproduzierbarer Mehrseitigkeit, wiederholtem Header, Tabellenkopf und Footer, Summenbereich, Seitenzahlen und registriertem Vektorlogo technisch geprueft,
- Position, Breite, Hoehe, Textposition und Schriftgroesse ueber neutrale PDF-ChangeRequests in LayoutState und Rendergeometrie nachgewiesen,
- getrenntes `pdf-standard`-Profil mit Save, Load vom Datentraeger, Discard zu SAVED, Reset zu BASELINE und gegenseitiger Ablehnung von UI-/PDF-Profilen nachgewiesen,
- provozierter PDF-Adapter- und Renderfehler mit vollstaendigem Batchrollback, strukturiertem Rollbackfehler, unveraenderter vorhandener PDF und unveraenderten Fachdaten nachgewiesen,
- echter WPF-Diagnoseprozess `--pdf-model-diagnostic` mit Exitcode 0 ausgefuehrt und alle PDF-/Profil-Diagnoseartefakte entfernt,
- keine temporaeren Speicherdateien sowie keine Node- oder WPF-Prozesse zurueckgelassen.

## 7. Aktueller offener Meilenstein

### M77 - Sichtbarer PDF-Editor und gemeinsamer End-to-End-Betrieb

Status: `[ ] offen`

Ziel:

- sichtbarer nativer Arbeitsbereich `PDF-Ausgabe`,
- PDF-Seitenuebersicht, registrierter Elementbaum und native Vorschau,
- gemeinsamer sichtbarer UI-/PDF-End-to-End-Betrieb auf dem abgenommenen M76-Fundament.

Nicht-Ziele:

- kein Windows-Manager und kein Registrationslauf.

Abnahme nur, wenn alle Kriterien aus `docs/EDITOR_FERTIGSTELLUNGSFAHRPLAN.md` fuer M77 erfuellt und praktisch nachgewiesen sind.

## 8. Naechster Auftrag

Der naechste Bauauftrag ist ausschliesslich M77. Die abgenommenen UI-Vertraege aus M73 bis M75 und das technische PDF-Fundament aus M76 bleiben unveraendert; Windows-Manager und Registrationslauf bleiben gesperrt.

## 9. Statuswerte

- `[ ]` offen
- `[~]` in Bau
- `[x]` gebaut
- `[A]` abgenommen
- `[S]` gesperrt
