# Editor-Gesamt-LV

> **VERBINDLICHE PRODUKTGRENZE**
>
> **DAS UI-EDITOR-KIT WIRD NIEMALS IM BROWSER STATTFINDEN.**

## 1. Zweck

Dieses Dokument ist das verbindliche Gesamt-Leistungsverzeichnis fuer das eigenstaendige UI-Editor-kit.

Kein technischer Bauauftrag darf ohne Bezug auf eine LV-Position, klare Abnahmekriterien und einen Testbefehl begonnen werden.

## 2. Gesamtziel

Das UI-Editor-kit ist ein fachneutrales Modul, das in Anwendungs-Apps eingebunden werden kann.

Es bearbeitet ausschliesslich registrierte und klassifizierte UI-Elemente. Die Ziel-App liefert Registry, Element-Referenzen, HostAdapter, Layoutspeicher und Aktivierung.

Der Editor bearbeitet keine Fachlogik und keine Fachdaten.

## 3. Nicht verhandelbare Grundregeln

Der Editor darf nicht:

- UI blind durchsuchen,
- Elemente erraten oder selbst klassifizieren,
- Fachlogik oder Fachdaten lesen oder aendern,
- fachliche Aktionen ausfuehren,
- Datenbankaktionen ausloesen,
- automatisch Registry-Eintraege erzeugen,
- eine bestimmte Laufzeitumgebung zur Produktvoraussetzung machen,
- Demo- oder Referenztechnik zur Kernarchitektur machen.

Nicht registrierte Elemente gelten fuer den Editor als nicht vorhanden.

## 4. LV-Systematik

Jede LV-Position benoetigt:

- Status,
- Zweck,
- Mindestinhalt,
- Schnittstellen,
- Nicht-Ziele,
- Abnahmekriterien,
- Abhaengigkeiten,
- Testbefehl.

Der Baufortschritt wird in `STATUS.md` gefuehrt.

## A - Vertrags- und Planungsgrundlagen

### A1 - Fuehrende Projektunterlagen

Status: abgenommen

Pflichtunterlagen:

- `STATUS.md`
- `docs/EDITOR_GESAMT_LV.md`
- `docs/EDITOR_BAUPLAN.md`
- `docs/UI_ELEMENT_KATALOG.md`
- `docs/UI_BAU_UND_PRUEFREGELN.md`
- `docs/UI_EDITOR_VERTRAG.md`
- `docs/ZIEL_APP_ANBINDUNG.md`
- `codex/AGENTS_UI_EDITOR_BLOCK.md`

Abnahme: Dateien vorhanden und `npm test` gruen.

### A2 - Gesamt-LV und STATUS

Status: abgenommen

LV und STATUS muessen dieselbe Hauptspur beschreiben. Widerspruechliche oder plattformspezifische Produktziele sind unzulaessig.

## B - UI-Elementvertrag

### B1 - Elementmodell

Status: gebaut

Mindestfelder:

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

### B2 - Registry

Status: gebaut

Die Registry wird ausschliesslich von der Ziel-App bereitgestellt. Keine automatische Erkennung oder Befuellung.

### B3 - Validator

Status: gebaut

Pflichtfelder, Typen, Rollen, Parent-Beziehungen und Operationen werden vor Nutzung geprueft.

## C - Editor-Core

### C1 - Struktur und Details

Status: gebaut

Der Core liest eine validierte Registry, erzeugt den Elementbaum und liefert Elementdetails.

### C2 - Operationen

Status: gebaut

Erlaubte, gesperrte und nicht vorgesehene Operationen werden eindeutig getrennt.

## D - Aenderungsauftrag

### D1 - Modell und Pruefung

Status: gebaut

Aenderungen werden als fachneutrale Auftraege beschrieben und vor der Anwendung gegen Registry und Regeln geprueft.

## E - HostAdapter

### E1 - Ziel-App-Schnittstelle

Status: gebaut

Die Ziel-App:

- liefert Registry und aktuelle Layoutwerte,
- wendet freigegebene Aenderungen an,
- prueft Aenderungen erneut,
- meldet strukturierte Ergebnisse,
- stellt den Ausgangszustand bei Fehlern wieder her.

## F - Layoutzustand

### F1 - Speicherung

Status: gebaut

Layoutdaten werden getrennt von Fachdaten gespeichert. Save, Load, Reset, Discard und Reapply sind fachneutral.

## G - Runtime

### G1 - Session- und Layout-API

Status: abgenommen

Die Runtime verwaltet Session, Baseline, Layoutwerte, Persistenzaufrufe und Rollback.

## H - Bedienpanel

### H1 - Panel, ViewModels und Status

Status: abgenommen

Das Panel verwaltet Auswahl, Ebene, Modus, Schrittweite, Dialoge, Busy-Status und strukturierte Meldungen.

### H2 - Element- und Textbearbeitung

Status: abgenommen

Elementwerte und Textwerte werden getrennt bearbeitet. Textoperationen stehen nur bei ausdruecklicher Registrierung zur Verfuegung.

## I - Ziel-App-Integration

### I1 - Bootstrap und Installer

Status: gebaut

Der Installer schreibt nur bekannte Kit-Artefakte nach ausdruecklicher Bestaetigung. Ziel-App-Fachlogik und Fachdaten bleiben unangetastet.

### I2 - Integrationsvertrag

Status: gebaut

Ziel-Apps binden das Kit ueber Public API, Registry, HostAdapter und Layoutspeicher ein.

## J - Pruef- und Abnahmesystem

### J1 - Pflichtpruefungen

Status: abgenommen und fortlaufend

```bash
npm test
npm pack --dry-run
npm run release:check
git diff --check
```

Ohne gruene Pflichtpruefungen keine Abnahme.

## K - Produktfertigstellung

### K1 / M68 - Produktgrenze

Status: abgenommen

Core, Kit-UI/Runtime und Ziel-App-Verantwortung sind getrennt.

### K2 / M69 - Runtime

Status: abgenommen

### K3 / M70 - Bedienpanel

Status: abgenommen

### K4 / M71 - Host- und Integrationsschicht

Status: abgenommen

Zweck: Plattformneutrale Verbindung zwischen Runtime, Panel, Element-Referenzen, Auswahl, Darstellung und Layoutspeicher.

### K5 / M72 - Panel- und Textbearbeitung

Status: abgenommen

Zweck: Verschiebbares Bedienpanel, getrennte Element-/Textebene, Schrittweiten, Grenzen, Speicherung und Rollback.

### K6 / M73 - Neue Ziel-App technisch anbinden

Status: abgenommen

Zweck:

- native Referenz-Ziel-App bereitstellen,
- Registry und WpfHostAdapter anbinden,
- lokalen Node-Prozess und genau eine Session steuern,
- ziel-app-eigene Layoutpersistenz und Startup-Restore bereitstellen.

Nicht-Ziele:

- keine sichtbare Editoroberflaeche,
- keine Fachlogik,
- keine automatische UI-Erkennung,
- keine Browser- oder Netzwerkkommunikation.

Abnahme:

- Registry, HostAdapter, Prozess-/Sessionweg und Persistenz praktisch nachgewiesen,
- alle Pflichtpruefungen gruen.

### K7 / M74 - Native sichtbare UI-Editoroberflaeche

Status: abgenommen

Zweck: Native WPF-Bedienoberflaeche fuer den registrierten Scope mit Elementbaum, neutralen Details, Element-/Textmodi, Schrittweite, Richtungssteuerung und kontrolliertem Prozess-/Sessionlebenszyklus.

### K8 / M75 - UI-Betrieb vollstaendig

Status: abgenommen

Zweck: Sichtbare Save-/Load-/Discard-/Reset-Bedienung und vollstaendiger praktischer Layoutbetrieb auf der abgenommenen M74-Oberflaeche. Abgenommen mit zwei Scopes, zwei Profilen, direkter App-Auswahl, Startup-Restore und vollstaendigem Batchrollback.

### K9 / M76 - PDF-Grundmodell und PDF-HostAdapter

Status: abgenommen

Zweck: Bibliotheksneutrales A4-PDF-Modell mit expliziter Registry und Capability-Matrix, getrenntem PDF-HostAdapter und Profilspeicher sowie lokaler realer Mehrseiten-PDF-Erzeugung. Abgenommen mit reproduzierbarem Umbruch, Save/Load/Discard/Reset, vollständigem Batchrollback, unveränderten Fachdaten und technischem `--pdf-model-diagnostic`-Nachweis.

### K10 / M77 - Sichtbarer PDF-Editor und gemeinsamer End-to-End-Betrieb

Status: abgenommen

Zweck: Ein gemeinsames natives Editorfenster für Programmoberfläche und PDF-Ausgabe mit Seitenübersicht, Registrybaum, aus der realen Ausgabedatei gerenderter Windows-PDF-Vorschau, Bounds-Auswahl und Overlay, vollständiger capability-gesteuerter PDF-Bearbeitung, getrennten Profil-/Dirty-Zuständen und gemeinsamem Neustart-/Schließfluss. Abgenommen mit `--ui-pdf-end-to-end-diagnostic` in zwei echten WPF-Prozessen.

### K11 / M78 - Zentraler nativer Windows-Manager und Installer

Status: abgenommen

Zweck: Eigenstaendige native WPF-Verwaltung fuer ausdruecklich vorbereitete neue Ziel-Apps mit benutzerspezifischer LocalAppData-Bereitstellung und Desktop-Start, versioniertem Opt-in-/Paketvertrag, Sicherheits- und Schreibpruefung, vollstaendiger Vorschau/Bestaetigung, bekannten Apps, transaktionaler Installation, Update, Deinstallation und Ziel-App-/Editorstart. Abgenommen mit sichtbarem `--manager-installer-diagnostic`, echten Dateien/Prozessen, provoziertem Installations-/Updaterollback und erhaltenen UI-/PDF-Profilen.

### K12 / M79 - Bestehende Apps kontrolliert registrieren

Status: abgenommen

Zweck: Erweiterung desselben nativen Managers um den belegten SDK-C#-/WPF-Frameworkadapter, bytegleich geprüfte read-only XAML-/Roslyn-Analyse, ungeprüfte Registrierungsvorschläge, manuelle Einzelfreigabe, stabile IDs, reale statische Parentstruktur, Fachaktionssperren, deterministische Registry-/HostAdapter-Generierung, lokale Pipe-Anbindung an den vorhandenen M77-Editor, vollständige Hash-/Ownership-/Diffvorschau, Git-Schutz sowie transaktionale Installation, Reanalyse, Update, Rollback und Deinstallation. Abgenommen mit 88 Manager-Tests, der kontrollierten Bestandsfixture und sichtbarem `--existing-app-registration-diagnostic` einschließlich realer registrierter UI-Änderung, Profil-Restore, PDF-Erzeugung und weiter grünem UI-/PDF-End-to-End-Nachweis.

### K13 / M80 - Electron-Ziel-App-Vertrag und BBM-UI-Pilot

Status: abgenommen

Zweck: Den vorhandenen nativen Editor und Node-Core über einen engen lokalen Electron-HostAdapter an die explizite BBM-Registry anbinden, ohne Browser-, Netzwerk-, Scan- oder zweiten Profilpfad.

### K14 / M80.1 - Bestands-App-Registrierung und Registry-Refresh

Status: abgenommen

Zweck: Versionierte vollständige Scope-Inventare, deterministischen Fingerprint, kontrollierten Laufzeit-Refresh sowie capability-basierten Profilabgleich für stabile, neue und entfernte IDs bereitstellen.

### K15 / M80.2 - Restarbeiten-Header und Editbox direkt editierbar

Status: abgenommen

Zweck: Den unnötigen Splitpfad sperren, den tatsächlichen Restarbeiten-Header vollständig registrieren, den stabilen Editbox-Root direkt und begrenzt größenfähig machen sowie die Hauptliste als flexiblen Scrollbereich absichern. Keine neue Editoroberfläche, keine Fachaktion und keine PDF-Anbindung. Automatisierte Pflichtprüfungen, sichtbare native Abnahme und der stabilisierte BBM-Pflichtprüfungsblock sind grün.

### K16 / M81 - BBM-PDF an den bestehenden PDF-Arbeitsbereich anbinden

Status: abgenommen

Zweck: Die reale BBM-Protokoll-PDF über einen optionalen lokalen Electron-PDF-Vertrag an den vorhandenen M77-PDF-Arbeitsbereich anbinden. BBM bleibt Eigentümerin der expliziten 28-Element-Registry, des neutralen Layoutzustands und des vorhandenen Druck-/Paginierungs-/`printToPDF`-Pfads. Der native Editor verwendet denselben PDF-Core, dieselbe Session, denselben atomaren Profilweg sowie vorhandene Save-/Reset-/Discard-/Rollback-Mechanismen. Fachwerte, Fachaktionen, Dateioperationen, zweite Renderer und Netzwerkpfade bleiben ausgeschlossen. Automatisierte Prüfungen und die sichtbare native Dreiseiten-PDF-Abnahme sind grün.

## L - Regel fuer kuenftige Auftraege

Jeder Auftrag muss nennen:

- LV-Position,
- Ziel,
- Nicht-Ziel,
- zu aendernde Dateien,
- Abnahmekriterien,
- Testbefehl.

Ohne LV-Position kein Auftrag. Ohne Nachweis kein Haken in `STATUS.md`.
