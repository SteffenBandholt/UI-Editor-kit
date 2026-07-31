# STATUS - UI-Editor-kit

> **VERBINDLICHE PRODUKTGRENZE**
>
> **DAS UI-EDITOR-KIT WIRD NIEMALS IM BROWSER STATTFINDEN.**

## 1. Zweck

### M82.7.3 – realen `textResize`-Istwert im Editor herstellen

- Status: `[A] abgenommen`; Implementierung, automatisierte Regression und sichtbare isolierte BBM-Zwei-Start-Abnahme sind abgeschlossen.
- Der gemeinsame Editor zeigt und verwendet ausschließlich den vom Host bestätigten Schrift-Istwert. Kleiner, Größer und direkte Eingabe bleiben bei fehlendem Readback gesperrt; Zielwechsel, Undo und Reset ersetzen veraltete Wunschwerte durch den neuen Hostzustand.
- Der Core bleibt frei von BBM-IDs. Dirty, Undo und Save entstehen nur nach einer vom Host bestätigten realen Änderung.
- Die sichtbare BBM-Abnahme bestätigte Kurz-/Langtext, normale Bezeichnung, Feld, Bewegung, Sichtbarkeit, Save und Neustart-Restore mit isolierter Testdatenbank und unveränderten Benutzerdateien.
- Detaildokument: `docs/M82_7_3_TEXTRESIZE_ISTWERT.md`.

### M82.7.1 – Freies Verschieben und eindeutige Aktionsrückmeldung

- Status: `[A] abgenommen`; gezielte Reparatur, Regression und sichtbare isolierte BBM-Diagnostic-Abnahme sind abgeschlossen.
- Wiederholte Verschiebungen und direkte X-/Y-Werte laufen kumulativ über den vorhandenen neutralen Change-Request-, HostAdapter-, Undo- und Profilweg. Visuelle Grenzen werden nicht als willkürliche Editorgrenze interpretiert; technische Ziel-App-Grenzen bleiben verbindlich.
- Erfolgreiche Aktionen nennen Anzeigename und alten/neuen Wert. Eine technisch abgelehnte oder unveränderte Aktion bleibt ohne neuen Dirty-/Undo-Eintrag und meldet den Grund im Hauptstatus statt eines wirkungslosen Klicks.
- Der Core bleibt appneutral: keine BBM-ID, keine Registryerzeugung, keine Ziel-App-UI und keine Topologieänderung.
- Detaildokument: `docs/M82_7_CAPABILITY_GESTEUERTER_EINFACHMODUS.md`.

### M82.7 – Capability-gesteuerter Einfachmodus für Restzeichenanzeigen

- Status: `[A] abgenommen`; Implementierung, Pflichtprüfungen und sichtbare isolierte BBM-Diagnostic-Abnahme sind abgeschlossen.
- Kompakte Text-/Statusziele mit `move`, `textResize` und `setVisibility` verwenden den vorhandenen Textbereich des Einfachmodus. Steuerkreuz, direkte Position, Schriftgröße, Sichtbarkeit, Original, Undo und Save laufen über denselben neutralen Change-Request- und Profilweg.
- Breite, Höhe, Tabellen- und Gruppengrößenfunktionen bleiben capability-gesteuert verborgen. Keine aktive Schaltfläche des M82.7-Arbeitswegs bleibt wirkungslos.
- Der Core enthält keine BBM-IDs und erzeugt weder Registry noch Ziel-App-UI. M82.5 und M82.6 bleiben unverändert grün.
- Detaildokument: `docs/M82_7_CAPABILITY_GESTEUERTER_EINFACHMODUS.md`.

### M82.6 – Topologieneutrales Feintuning und TopScreen-Modulabschluss

- Status: `[A] abgenommen`; Implementierung, vollständige Pflichtprüfungen und sichtbare BBM-Diagnostic-Abnahme sind abgeschlossen.
- Ziel-App und Editor bleiben strikt getrennt: Die Ziel-App erzeugt ihre Registry und liefert vorhandene Refs; der Editor liest nur und erzeugt weder Registryeinträge noch Ziel-App-UI.
- Logische Tabellen-/Gruppenziele funktionieren ohne zusätzliche Wrapper. Der Vertrag schreibt `preserveTarget` vor und weist einen benötigten Wrapper zurück.
- Electron und WPF besitzen einen reproduzierbaren Topologie-Fingerprint aus expliziten Deskriptoren; dynamische Fachzeilen werden nicht als Strukturregression gewertet.
- Die vollständigen Kit-Prüfungen sind grün. Ein beim ersten gepackten BBM-Start gefundener Rendererfehler durch `node:crypto` wurde browserfähig korrigiert; der Wiederholungslauf startete sichtbar normal.
- Die isolierte Diagnostic-Ausgabe schaltet beide BBM-Module über den vorhandenen internen Provider frei; die Release-Ausgabe bleibt auch mit gesetzten DEV-Umgebungsvariablen gesperrt. Restarbeiten und Protokoll bestanden Direktauswahl, Feintuning, Undo, Save, Recovery/Reset und Neustart-Restore.
- BBM liefert drei vollständige Protokoll-UI-Scopes aus ausschließlich vorhandenen Ziel-App-Refs. Die echte vierseitige Protokoll-PDF lief über den unveränderten BBM-Druckweg. Restarbeiten behält seinen ausdrücklich bestätigten Produktumfang als HTML-Ausgabevorschau ohne PDF-Erzeugung.
- Detaildokument: `docs/M82_6_TOPOLOGIENEUTRALES_FEINTUNING.md`.

Diese Datei ist das verbindliche Baufortschritts- und Abnahmeprotokoll zum UI-Editor-kit.

### M82.5 – Radikal vereinfachter Einfachmodus

- Status: `[A] abgenommen`; Implementierung, vollständige Pflichtläufe und sichtbare native UI-/PDF-Abnahme sind abgeschlossen.
- Der vorhandene native Editor startet mit Auswahl, Text/Element, Steuerkreuz, Größensteuerung, Schrittweite, Session-Undo und Save; **Erweitert** ist geschlossen.
- Anzeigenamen stehen im Haupttext, technische IDs und M82.2-/M82.3-/M82.4-Funktionen nur unter **Erweitert**.
- Direkte Werte und Tabellenaktionen verwenden denselben appneutralen Vertrag, HostAdapter und Profil-/Rollbackweg; es gibt keinen zweiten Editor oder zielappspezifischen Core.
- Sichtbar belegt sind Direktauswahl, Text-/Element-/Gruppenänderung, Save und Neustart-Restore, exaktes mehrstufiges Undo, Tabellen-Fit, bedienbare Fensterbreiten von 760/1180/1550 Pixel sowie eine echte zweiseitige BBM-PDF mit 28 Registryelementen.
- Detaildokument: `docs/M82_5_EINFACHMODUS.md`.

### M82.2 – Geführter und freier Bearbeitungsmodus

- Status: `[A] abgenommen`; die vollständige sichtbare UI-/PDF-Abnahme in der paketierten BBM-Diagnostic-Variante ist abgeschlossen.
- Die echte vierseitige BBM-PDF mit 28 Registryelementen wurde im normalen Benutzerprofil erzeugt. Geführt/Frei, Anzeigenamen und technische Details, Save/Neustart-Restore, Rollback mit direkter Weiterarbeit, Element-/Gesamtreset, Discard und Profil-Recovery sind sichtbar beziehungsweise automatisiert nachgewiesen.
- Ein gemeinsamer frameworkneutraler Risikovertrag trennt bestätigbare Grenz-/Überlappungsrisiken von weiterhin blockierten technischen Fehlern.
- „Geführt“ bietet Begrenzen, bewusstes Anwenden und Abbrechen; „Frei“ lässt bestätigte freie Positionen zu, ohne Registry-Parents oder Fachwerte zu verändern.
- Haupttexte verwenden Anzeigenamen, technische Daten stehen nur in „Details anzeigen“. Auswahl allein erzeugt keine Warnung.
- WPF und Electron verwenden ihre vorhandenen HostAdapter, denselben Apply-/Readback-/Rollbackweg und native Geometrievorschauen.
- Der Modus liegt als eigene atomare Benutzerpräferenz neben, aber nicht in UI-/PDF-Layoutprofilen.
- Detaildokument: `docs/M82_2_GEFUEHRT_FREI_BEARBEITEN.md`.

### M82.1 – Direktauswahl und sicheres Ziel-App-Feintuning

- Status: `[A] abgenommen`; alle Pflichtprüfungen und die vollständige sichtbare 56-Schritt-BBM-Abnahme im normalen Benutzerprofil sind abgeschlossen.
- Kompatible UI-Profile werden beim normalen Ziel-App-Start über einen gemeinsamen, manifest- und fingerprintgeprüften Dienst geladen; beschädigte oder inkompatible Profile fallen auf Baseline zurück und werden für M81.1 vorgemerkt.
- Eine Startquittung verhindert die Doppelanwendung beim späteren Editoröffnen und erhält die deklarierte Ziel-App-Baseline für Reset.
- Direktauswahl arbeitet ausschließlich auf expliziten Registry-Parents und unterscheidet Element, Gruppe und Bereich mit Linienart, Stärke und verständlichem Badge; Tab/Shift+Tab, Enter/Klick und Esc sind definiert.
- `elementOnly`, `groupWithChildren`, `layoutZone`, `parentReflowRequired` und `forbidden` sind deklarierte Wirkungsgrenzen. Der Manager zeigt die aktuelle Wirkung, die Ziel-App prüft tatsächliche Geometrie und rollt unerwartete Folgen zurück.
- Automatisiert grün: 36 neue Kit-Einzelfälle, bestehende Kit-Suite und nativer Doppelanwendungs-/Resettest. Sichtbarer BBM-Gesamtnachweis steht noch aus.
- Detaildokument: `docs/M82_1_DIREKTAUSWAHL_UND_LAYOUTSTABILISIERUNG.md`.

### M81.1 – Sicherer Profil-Restore für bestehende Benutzerprofile

- Status: `[A] abgenommen`; gezielte Tests und reale Abnahme im normalen BBM-Benutzerprofilpfad sind abgeschlossen.
- UI- und PDF-Profile werden unabhängig als kompatibel, migrationsfähig, inkompatibel, beschädigt, fehlend oder blockiert klassifiziert. Profilfehler werden nicht mehr als Verbindungsfehler gemeldet.
- Inkompatible oder beschädigte Originale werden vor Baseline/Migration byte-identisch und kollisionssicher mit technischer Metadaten-Sidecar-Datei archiviert; Abbruch und Archivfehler verändern das Original nicht.
- Nur unveränderte vollständig validierte Scopes dürfen sicher migriert werden; Parent-, Rollen-, Capability-, Element- oder Schemaänderungen werden nicht geraten.
- Ein erfolgreicher, vom Zielsystem normalisierter Restore startet sauber, ohne falsches Dirty und ohne Autosave. Save, echter Prozessneustart, PDF-Restore, Element-/Gesamtreset und Discard wurden praktisch geprüft.
- Keine neue Registry-, Layout-, PDF- oder Fachfunktion; die damalige Folgeaufgabe M82 ist inzwischen getrennt abgeschlossen.
- Entwurfsentscheidung: `docs/M81_1_PROFIL_RESTORE_ENTWURFSENTSCHEIDUNG.md`.

### M81 – BBM-PDF an den bestehenden PDF-Arbeitsbereich angebunden

- Status: `[A] abgenommen`; automatisierte Pflichtprüfungen und sichtbare native Abnahme sind abgeschlossen.
- Der bestehende M77-PDF-Arbeitsbereich verarbeitet die explizite BBM-Registry mit 28 Elementen über denselben lokalen Electron-Vertrag, dieselbe `PdfLayoutSession` und denselben Profilweg.
- Die reale BBM-Protokoll-PDF wird über den vorhandenen Druck-/Paginierungs-/`printToPDF`-Pfad erzeugt und anschließend im nativen Editor zurückgelesen; kein zweiter Core, Renderer oder Profilpfad wurde eingeführt.
- Titel, Label/Wert, TOP-Tabelle mit drei Spalten, Kopf-/Fuß- und Wiederholungsbereiche sind capability-gesteuert bearbeitbar. Fachwerte, Fachaktionen, Dateioperationen und Druckausführung bleiben gesperrt.
- Sichtbar geprüft: 28 Registry-Elemente, dreiseitige reale PDF, Livezustand/veraltete Vorschau, Regeneration, Save/Neustart-Restore, Reset, Discard und vollständiger Rollback bei ungültiger Spaltensumme.
- Die damalige Folgeaufgabe M82 ist inzwischen getrennt abgeschlossen.
- Entwurfsentscheidung: `docs/M81_BBM_PDF_ADAPTER_ENTWURFSENTSCHEIDUNG.md`.

### M80.2 – Restarbeiten-Header und Editbox direkt editierbar

- Status: `[A] abgenommen`; sichtbare native Abnahme und stabilisierter BBM-Pflichtprüfungsblock sind grün.
- Verhältnis-/Splitpfad wird aus der produktiven Registry entfernt und als gesperrter Alt-/Technikscope geführt.
- Der tatsächliche Filter-Header wird mit 31 Elementen vollständig registriert; `restarbeiten.edit.root` wird direkt in Breite, Höhe und Sichtbarkeit bearbeitbar.
- Die lange Hauptliste bleibt flexibler Scrollbereich und wird nicht mehr über eine gespeicherte Split-Höhe gesteuert.
- UI-Editor-kit-Prüfungen sind grün: 88 Manager-Tests, 51 Ziel-App-Tests, `npm test`, Pack-Dry-Run und Release-Check. Die gepackte BBM-Abnahme deckt Refresh, Markierung, Save/Restore, Reset, Discard, Rollback und Einzelinstanz ab.
- M80.2a beseitigt die BBM-Abschlussblocker durch feste Child-Prozess-Testgruppen und einen koordinierten Node-/Electron-ABI-Wechsel mit Wiederherstellung im Fehlerpfad; das UI-Editor-kit selbst wurde dabei funktional nicht geändert.
- M81 ist abgenommen; die damalige Folgeaufgabe M82 ist inzwischen getrennt abgeschlossen.
- Entwurfsentscheidung: `docs/M80_2_RESTARBEITEN_HEADER_EDITBOX_ENTWURFSENTSCHEIDUNG.md`.

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
7. M79 - bestehende Apps registrieren,
8. M80 - Electron-Ziel-App-Vertrag und BBM-UI-Pilot,
9. M80.1 - Bestands-App-Registrierung, Registry-Refresh und vollständige BBM-UI-Anbindung,
10. M80.2 - Restarbeiten-Header und Editbox direkt editierbar,
11. M81 - BBM-PDF-Anbindung an den bestehenden PDF-Arbeitsbereich,
12. M81.1 - sicherer Profil-Restore für bestehende Ziel-Apps,
13. M82 - App-Starterpaket.

M73 bis M82 sind abgenommen. Ein weiterer Meilenstein ist nicht beauftragt.

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
- kontrollierte read-only Bestands-App-Analyse fuer SDK-basiertes C#-/WPF mit XDocument und Roslyn,
- manuell zu pruefende Registrierungsvorschlaege, stabile IDs, Parentvalidierung und Fachaktionssperren,
- deterministische Registry-/HostAdapter-Erzeugung, exakte Hash-/Ownership-/Diffvorschau und Git-Schutz,
- transaktionale M79-Installation, Reanalyse, Update, Rollback und Deinstallation mit bytegleichem Original,
- frameworkneutraler Electron-Ziel-App-Vertrag, gehärtete lokale Named Pipe, Sichtbarkeit und asynchroner HostAdapter,
- sichtbarer BBM-UI-Pilot mit getrennten Labels/Feldern, bestätigter Restarbeiten-Tabelle, Save/Load/Discard/Reset und Rollback,
- oeffentliche Paket-API und Release-Pruefungen.

Der verbindlich festgelegte Umfang M73 bis M80 ist praktisch fertig und abgenommen.

Die Ziel-App bleibt Eigentuemerin von Registry, Element-Referenzen, HostAdapter, Layoutspeicher und Aktivierung.

Nicht Bestandteil des Produkts sind Fachlogik, Fachdaten, ungepruefte automatische UI-Registrierung, weitere unbelegte Frameworkadapter oder eine Browser-/Web-Laufzeit.

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
| K10 / M77 | [A] | Gemeinsamer nativer UI-/PDF-Editor mit Seitenuebersicht, Registrybaum, echter lokaler PDF-Vorschau, Baum-/Previewauswahl, Overlay, vollstaendiger PDF-Bedienung und gemeinsamem Dirty-/Neustartfluss | 48 .NET-Tests, npm-Gesamttest und echter Zwei-Prozess-Nachweis `--ui-pdf-end-to-end-diagnostic` gruen |
| K11 / M78 | [A] | Eigenstaendiger nativer Windows-Manager fuer vorbereitete neue Ziel-Apps mit LocalAppData-Bereitstellung, Desktop-Verknuepfung, Auswahl, Vertrag/Sicherheit, Vorschau, bekannten Apps, Installation, Update, Deinstallation, Prozessstart und Transaktionsrollback | 73 Manager-Tests, alle bestehenden Tests und sichtbarer `--manager-installer-diagnostic`-Nachweis aus der veroeffentlichten EXE gruen |
| K12 / M79 | [A] | Kontrollierte Registrierung bestehender SDK-C#-/WPF-Apps mit bytegleicher read-only XAML-/Roslyn-Analyse, manuellen Proposals, IDs/Parents/Actionlocks, Registry-/HostAdapter-Generator, lokaler Pipe-Anbindung an den vorhandenen M77-Editor, exakter Vorschau, Git-Schutz, Installation, Reanalyse, Update, Rollback und Deinstallation | 88 Manager-Tests, kontrollierte Bestandsfixture und sichtbarer `--existing-app-registration-diagnostic`-Nachweis aus der veroeffentlichten EXE gruen |
| K13 / M80 | [A] | Frameworkneutraler Electron-Ziel-App-Vertrag und BBM-UI-Pilot über denselben nativen Editor/Node-Core: Sichtbarkeit, getrennte Labels/Felder, explizite Registry/Refs, sichere lokale Pipe, ein Editorprozess, Profile und Rollback | npm-Gesamttests, 88 Manager- und 50 Referenz-App-Tests sowie sichtbarer Entwicklungs- und gepackter BBM-Ende-zu-Ende-Nachweis grün |
| K14 / M80.1 | [A] | Frameworkneutraler Bestands-App-Status, deterministischer Registry-Fingerprint, Refresh bei Öffnen/Fokus/Laufzeitereignissen, capability-basierter Profilabgleich sowie vollständige und gesperrte Scope-Inventare | npm-Gesamttests, 88 Manager- und 51 Referenz-App-Tests sowie sichtbarer gepackter BBM-Ende-zu-Ende-Nachweis mit Registry-Reload, Dirty-Konflikt, Restore und Rollback grün |
| K15 / M80.2 | [A] | Restarbeiten-Header vollständig registrieren, Editbox-Root direkt bearbeiten und lange Hauptliste ohne Splitüberlagerung scrollen | automatische Prüfungen, sichtbare native Abnahme und stabilisierter BBM-Pflichtprüfungsblock grün |
| K16 / M81 | [A] | Reale BBM-Protokoll-PDF über den bestehenden M77-PDF-Arbeitsbereich, denselben Core und denselben Profilweg bearbeiten | Vertrags-/Adaptertests, vollständige Pflichtläufe und sichtbare native Dreiseiten-PDF-Abnahme grün |

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
- 48 .NET-Tests einschliesslich aller M75-/M76-Regressionen sowie PDF-Preview-, Bounds-, Auswahl-, Persistenz-, Rendering-, Kompatibilitaets- und Rollbacktests gruen,
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
- gemeinsames Editorfenster mit den Arbeitsbereichen `Programmoberflaeche` und `PDF-Ausgabe`, getrennter UI-/PDF-Dirty-Anzeige und gemeinsamem Schliessschutz sichtbar bedient,
- PDF-Seitenuebersicht und Baum mit allen 26 Registryelementen, Details, sechs Spalten sowie Header-/Footer-, Tabellen-, Positions-, Groessen- und Textmodi nachgewiesen,
- native Vorschau ueber `Windows.Data.Pdf` direkt aus der atomar erzeugten Ausgabedatei, neutrale RenderBounds, Previewtreffer und skalierendes Overlay nachgewiesen,
- PDF Save/Load, Einzel-/Gesamtverwerfen, Einzel-/Gesamtreset, Vorschau aktuell/veraltet sowie getrennte UI-/PDF-Profile nachgewiesen,
- echter Zwei-Prozess-Neustart fuer UI- und PDF-Layout sowie Vorschau-/Ausgabeseitenzahl mit `--ui-pdf-end-to-end-diagnostic` und Exitcode 0 nachgewiesen,
- native Manager-EXE nach `%LOCALAPPDATA%\UI-Editor-kit\Manager\app` veroeffentlicht und aus diesem Pfad sichtbar gestartet,
- eigene Desktop-Verknuepfung erzeugt, geprueft und kontrolliert entfernt,
- neuer vorbereiteter Ziel-App-Klon per Root und Projektdatei ausgewaehlt; App ohne Opt-in auf M79 verwiesen,
- Sicherheits-/Schreibpruefung, deterministische Vorschau und ausdrueckliche Bestaetigung nachgewiesen,
- Installation, Update, Deinstallation, bekannte Apps, JSONL-Protokoll und Vertragsstatus nachgewiesen,
- Installations- und Updatefehler mit vollstaendigem Rollback sowie bytegleichen Projekt-, Fremd- und Profildateien nachgewiesen,
- Ziel-App und gemeinsamer UI-/PDF-Editor gestartet; UI-/PDF-Neustart-/Restore-Nachweis Exitcode 0,
- kontrollierte WPF-Bestandsfixture vor Registrierung gebaut und sichtbar gestartet,
- vollstaendiges Hashinventar vor/nach read-only XAML-/Roslyn-Analyse bytegleich; kein Zielbuild, keine Zieldatei und keine Fachaktion waehrend Analyse,
- Views, Container, Controls, Tabelle/Spalten, unbenannte/templatebasierte Unsicherheit sowie Click-/Command-/ICommand-Risiken mit konkreten Fundstellen erkannt,
- jeder installierte Vorschlag einzeln geprueft; ungepruefte Vorschlaege, ID-/Parent-/Actionfehler und Git-Dirty-Konflikt blockieren,
- deterministische Registry und kontrollierter WPF-HostAdapter aus bestaetigten Namen erzeugt; Fachaktionen bleiben gesperrt,
- vollstaendige Vorschau mit neuen/geaenderten Dateien, Ownership, alten/neuen Hashes, Backupbedarf und exaktem `.csproj`-Diff bestaetigt,
- echte Installation, Zielbuild, Vertragscheck, normaler Ziel-App-Start und lokaler HostAdapter-Registryabruf innerhalb der Transaktion nachgewiesen,
- vorhandenen nativen M77-UI-/PDF-Editor aus dem Manager per lokaler Named Pipe an die Bestands-App gekoppelt, registriertes Element real geaendert, UI-Profil gespeichert/restauriert und mehrseitige PDF erzeugt,
- Reanalyse, neues ungeprueftes Element und transaktionales Update nachgewiesen,
- provozierter Installations-, Build-, Vertrags-, Laufzeit- und Updatefehler jeweils vollstaendig zurueckgerollt,
- M79-Deinstallation entfernte nur eigene Dateien und stellte Projektdatei, Fremdschutzdatei und Ausgangsinventar bytegleich wieder her; UI-/PDF-Profile blieben erhalten,
- bestehender gemeinsamer M77-UI-/PDF-End-to-End- und Restore-Nachweis innerhalb der M79-Diagnose weiter gruen,
- keine temporaeren Speicherdateien sowie keine Node- oder WPF-Prozesse zurueckgelassen.

## 7. Letzter Meilenstein

### M81 - BBM-PDF-Anbindung an den bestehenden PDF-Arbeitsbereich

Status: `[A] abgenommen`

Die reale BBM-Protokoll-PDF ist über den optionalen lokalen PDF-Vertrag an den vorhandenen nativen M77-Arbeitsbereich angebunden. Registry, neutrale Layoutänderungen, kontrollierte Regeneration, Readback, Profilabgleich und Rollback bleiben in den vorhandenen Verantwortungsgrenzen. Die sichtbare Abnahme belegte 28 Elemente, drei PDF-Seiten, Bearbeitung mehrerer Elementarten, Save/Neustart-Restore, Reset, Discard und Fehlerrollback. Fachwerte und Fachaktionen blieben unverändert.

Commit/PR: keiner; gemäß Nutzeranweisung wurde weder committet noch gepusht.

### M80 - Electron-Ziel-App-Vertrag und BBM-UI-Pilot

Status: `[A] abgenommen`

Electron ist als zweiter Ziel-App-Adapter neben WPF praktisch belegt. BBM startet den vorhandenen nativen Editor über eine gehärtete lokale Named Pipe, liefert zwei explizite Restarbeiten-Scopes und bleibt Eigentümerin aller Fachwerte und Fachaktionen. Auswahl, Markierung, Layoutänderung, Sichtbarkeit, Save/Load, Neustart-Restore, Discard, Reset und vollständiger Rollback wurden mit echten sichtbaren Prozessen sowie im gepackten Verzeichnisbuild nachgewiesen. Der BBM-PDF-Tab bleibt ehrlich nicht angebunden.

Commit/PR: keiner; gemäß Nutzeranweisung wurde weder committet noch gepusht.

### M79 - Bestehende Apps registrieren

Status: `[A] abgenommen`

Ziel:

- kontrollierte Nachruestung bestehender Apps ueber Frameworkadapter und bestaetigte Registrierungsvorschlaege,
- stabile Registry- und HostAdapter-Erzeugung ohne blinde Entscheidungen,
- Vorschau, Vertragscheck und vollstaendiges Rollback.

Nicht-Ziele:

- kein Browser-, Netzwerk- oder Cloudbetrieb und keine unbestaetigte Fach-/Quellcodeaenderung.

M79 ist fuer den belegten SDK-basierten C#-/WPF-Erstframeworkadapter vollstaendig gebaut, automatisch geprueft und praktisch abgenommen. Weitere Frameworks wurden nicht vorgetaeuscht.

## 8. Meilensteinabschluss

M73 bis M82 sind abgenommen. Ein weiterer Meilenstein ist nicht beauftragt.

## 9. Statuswerte

- `[ ]` offen
- `[~]` in Bau
- `[x]` gebaut
- `[A]` abgenommen
- `[S]` gesperrt
# M82 - App-Starterpaket und zentraler Einstieg

- Status: `[A]`; Implementierung, Pflichtpruefungen und sichtbare native Abnahme sind abgeschlossen.
- Versioniertes `App-Starterpaket` mit gemeinsamem Regelkern sowie WPF-/Electron-Geruesten ist angelegt.
- Der vorhandene native Manager bietet getrennte Ablaeufe fuer neue/bestehende Apps, Registrierungsstatus und Editorstart.
- Schema-2-Manifest, Paket-SHA-256, Git-/Fremddateischutz, Vorschau/Bestaetigung, atomare Installation, Rollback, Update und Deinstallation sind implementiert.
- Neue Apps beginnen ehrlich mit `development` und ohne aktive Scopes. Bestehende WPF-Apps verweisen auf M79; BBM wird als bereits angebundene Electron-App ohne Doppelinstallation erkannt.
- Die sichtbare M82-Diagnose belegt neue WPF-/Electron-Apps, erste explizit registrierte Test-UIs, die WPF-Test-UI mit vorhandenem Editor, den vollstaendigen M79-Bestandsweg, BBM-Bestand und lokalen Electron-Editorstart, Update, Deinstallation, Profilerhalt sowie Installations-/Update-Rollback. Alle Pflichtpruefungen sind gruen; der bekannte globale BBM-Lint-Altstand bleibt getrennt dokumentiert.

# M82.3 - Spacer und kompakte Editoroberflaeche

- Status: `[A]`; Implementierung, Pflichtpruefungen und sichtbare native UI-/PDF-Abnahme sind abgeschlossen.
- Elementbreite, reservierter Platz, bewusstes Nachruecken, Gruppenbreite und Spacing sind appuebergreifend getrennt.
- WPF und Electron verwenden denselben neutralen Vertrag, die vorhandenen HostAdapter und denselben Profil-/Rollbackweg.
- Der native UI-/PDF-Workspace reagiert mit einer, zwei oder drei Spalten; feste Aktionen und interner Baumscrollbereich reduzieren den Scrollbedarf.
- BBM belegt Kurztext/Gegenstand, stabile Nachbarn, Gruppe/Spacer, Reset/Discard/Restore sowie 28 PDF-Registryelemente und eine reale zweitseitige A4-Vorschau.
- Commit/PR: keiner; gemaess Nutzeranweisung wurde weder committet noch gepusht.

# M82.4 – Tabellen- und Spaltenbearbeitung

- Status: `[A]`; gemeinsamer Vertrag, WPF-/Electron-Abbildung, BBM-Referenzintegration, Pflichtprüfungen und praktische Abnahme sind abgeschlossen.
- Echte Tabellenstrukturen sind direkt und im Baum als Tabelle, Kopf, Datenbereich, Zeile, Spalte, Header-/Datenzelle, Viewport und Scrollbereich unterscheidbar.
- Eine Spalte ist die einzige Breitenquelle für Header, Daten, Auswahl und Profilzustand. Viewport-/Überlaufmessung, Fit-Vorschau, Mindest-/Maximalbreiten, Umbruch, Ellipsis und begrenzte Zeilenhöhe sind neutral modelliert.
- Der vorhandene kompakte Editor, HostAdapter, Profil-, Start-Restore-, Reset-, Discard- und Rollbackweg werden weiterverwendet; es gibt keinen zweiten Editor oder Profilstore.
- Tabellenmetriken und betroffene Spaltenzustände bleiben über den Electron-Prozessvertrag erhalten. JavaScript und WPF bilden dieselben Tabellenrollen in demselben Scope-Fingerprint ab; Reset-Operationen werden nicht als wiederherzustellende Benutzeränderungen persistiert.
- Die gepackte BBM-Development-Abnahme belegte gemeinsame Header-/Datenbreiten, echten sichtbaren Text-Ellipsis, begrenzten inneren Überlauf bei 900/1400/maximierter Fensterbreite, Speichern und Neustart-Restore sowie Spaltenreset mit anschließendem Discard.
- Commit/PR: keiner; gemäß Nutzeranweisung wird weder committet noch gepusht.
## M82.7.2 – Generischer textResize-Weg

- Status: `[A]`; Implementierung, automatisierte Pflichtprüfungen und sichtbare paketierte BBM-Abnahme sind abgeschlossen.
- Der gemeinsame Vertrag überträgt normalisierte DIP-Werte, optionalen erwarteten Host-Istwert und strukturierten Readback mit Ausgangs-, Ziel- und tatsächlich angewandtem Wert.
- Erfolg setzt eine reale Hoständerung und passenden Istwert innerhalb 0,02 DIP voraus; No-op, Konflikt, fehlender Readback und Mismatch bleiben ohne Dirty und Undo.
- WPF setzt die echte `FontSize` von `Control` und `TextBlock`, erhält Bindings und liest nach `UpdateLayout` zurück; Electron überlässt die konkrete DOM-Abbildung der Ziel-App.
- Interne Undo-/Restore-Batches überspringen bereits erfüllte `textResize`-Ziele, ohne interaktive No-ops als Erfolg zu melden.
- Der gemeinsame Core enthält keine BBM-IDs; keine neue UI, Registry, automatische Erkennung oder Profilablage wurde ergänzt.
- Pflichtprüfungen: Solution-Build 0 Fehler/0 Warnungen, Manager-Tests 103/103, Referenz-App-Tests 106/106, `npm test`, `npm pack --dry-run` und `npm run release:check` grün.
- Commit/PR: keiner; gemäß Nutzeranweisung wurde weder committet noch gepusht.
