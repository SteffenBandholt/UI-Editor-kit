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

### K6 / M73 - Release Candidate

Status: offen

Zweck:

- Public API festschreiben,
- Packaging und lokale Moduleinbindung absichern,
- Integrationshandbuch konsolidieren,
- HostAdapter-/Registry-/Storage-Vertraege finalisieren,
- Release-Candidate-Pruefung definieren,
- verbleibende plattformspezifische Produktannahmen ausschliessen.

Nicht-Ziele:

- keine zweite Ziel-App als zwingende Voraussetzung,
- keine bestimmte Laufzeitumgebung als Produktziel,
- keine Fachlogik,
- keine automatische UI-Erkennung,
- noch kein Release-Tag ohne abgeschlossene Abnahme.

Abnahme:

- Dokumentation widerspruchsfrei,
- Public API dokumentiert,
- Package-Inhalt geprueft,
- Integrationsvertrag vollstaendig,
- alle Pflichtpruefungen gruen.

## L - Regel fuer kuenftige Auftraege

Jeder Auftrag muss nennen:

- LV-Position,
- Ziel,
- Nicht-Ziel,
- zu aendernde Dateien,
- Abnahmekriterien,
- Testbefehl.

Ohne LV-Position kein Auftrag. Ohne Nachweis kein Haken in `STATUS.md`.
