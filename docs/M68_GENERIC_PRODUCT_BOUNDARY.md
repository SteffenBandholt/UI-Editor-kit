# M68: Generische Produktgrenze

## 1. Zweck

M68 legt die verbindliche Produktgrenze des eigenstaendigen UI-Editor-kit fest.

Das Kit bleibt fachneutral und unabhaengig von einer bestimmten Ziel-App oder Laufzeitumgebung.

## 2. Produktbestandteile

### UI-Editor-kit Core

- Registry-Modell und Validatoren
- neutrale Aenderungsauftraege
- Session- und Baseline-Logik
- strukturierte Ergebnisse und Fehlercodes
- Save, Load, Reset, Discard und Reapply
- Public Runtime API
- neutrale Inspect- und Statusdaten

### UI-Editor-kit UI/Runtime

- Bedienpanel
- Moduswahl und Schrittweiten
- Button-Intents und Dialogablaeufe
- Statusmeldungen
- Auswahlzustand
- Darstellung der Auswahl ueber neutrale Schnittstellen

Die Kit-UI erzeugt Intents und Aenderungsauftraege. Sie greift nicht direkt auf Fachdaten oder Fachlogik zu.

### Ziel-App HostAdapter

Die Ziel-App verantwortet:

- konkrete Element-Referenzen
- Anwendung und Ruecknahme von Layoutwerten
- Capture und Restore sichtbarer Zustaende
- Reapply nach notwendigen Neuaufbauten
- konkrete Storage-Adapter
- konkrete Scope- und Profilschluessel

### Ziel-App Registry

Die Ziel-App liefert:

- Element-IDs und Namen
- Hierarchie
- Editierbarkeit
- erlaubte und gesperrte Operationen
- Sichtbarkeit
- Grenzen und optionale Standardwerte

Das Kit erzeugt keine Registry-Eintraege automatisch.

## 3. Nicht Bestandteil des Kits

- Ziel-App-Fachlogik
- Ziel-App-Fachdaten
- automatische UI-Erkennung
- automatische Registry-Befuellung
- Ziel-App-spezifische IDs oder Texte
- direkte Datenbankaktionen
- fachliche Import-, Export-, Upload-, Speicher- oder Loeschaktionen
- eine bestimmte Laufzeitumgebung als Produktvoraussetzung
- Demo- oder Referenztechnik als Kernarchitektur

## 4. Oeffentliche API-Zielstruktur

| Bereich | API | Verantwortung |
|---|---|---|
| Runtime | `createUiEditorRuntime(...)` | Kit Core |
| Session | `beginSession`, `getSessionStatus`, `endSession` | Kit Core |
| Aenderung | `applyChange` | Kit Core + HostAdapter |
| Verwerfen | `discardElementChanges`, `discardAllChanges` | Kit Core + HostAdapter |
| Baseline | `resetSessionBaseline`, `resetSessionBaselineElement` | Kit Core |
| Speicherung | `saveLayout`, `loadLayout` | Kit Core + Storage |
| Reset | `resetLayoutToDefaults`, `resetElementToDefaults` | Kit Core + HostAdapter + Storage |
| Reapply | `reapplyCurrentLayoutState` | Runtime + HostAdapter |
| Inspect | `inspectElement`, `getPersistenceStatus` | Kit Core |
| Panel | Controller, ViewModel und Renderer | Kit UI/Runtime |

## 5. Datenfluss

1. Ziel-App registriert ein Element.
2. Editor liest Registry und aktuelle Layoutwerte.
3. Bedienpanel erzeugt einen fachneutralen Aenderungsauftrag.
4. Runtime prueft Operation, Grenze und Schrittweite.
5. HostAdapter prueft und wendet die Aenderung an.
6. Runtime liest das Ergebnis zur Kontrolle.
7. Bei Fehlern wird der gesicherte Ausgangszustand wiederhergestellt.
8. LayoutStorage speichert nur Layoutdaten.

## 6. Sicherheitsgrenzen

- Keine automatische Elementerkennung.
- Keine Fachlogik im Kit.
- Keine Fachdaten im Layoutspeicher.
- Keine direkte Umgehung des HostAdapters.
- Keine halben Aenderungen ohne Rollback.
- Keine produktive Abhaengigkeit von einer konkreten Ziel-App.
- Keine produktive Abhaengigkeit von einer konkreten Laufzeitumgebung.

## 7. Folgepakete

- M69: Runtime und Session-/Layout-API
- M70: Bedienpanel und ViewModels
- M71: plattformneutrale Host- und Integrationsschicht
- M72: Panel-, Element- und Textbearbeitung
- M73: Release Candidate, Public API, Packaging und Integrationshandbuch

## 8. Abnahme

- Produktgrenze eindeutig dokumentiert
- Verantwortungen von Kit und Ziel-App getrennt
- keine Fachlogik oder Fachdaten im Kit
- keine automatische UI-Erkennung
- keine fest vorgeschriebene Laufzeitumgebung
- `npm test` gruen
- `npm pack --dry-run` gruen
- `npm run release:check` gruen
- `git diff --check` gruen
