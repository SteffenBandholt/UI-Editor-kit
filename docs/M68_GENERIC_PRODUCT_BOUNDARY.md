# M68 Generic Product Boundary

## 1. Zweck und Ziel

M68 ist ein Architektur-, Inventar- und Vertrags-Paket. Es legt fest, wie die in einer externen BBM-Zielanwendung praktisch bewaehrten Editorfunktionen aus M63C bis M67 in ein fachneutrales, eigenstaendiges UI-Editor-kit ueberfuehrt werden, ohne Code blind zu kopieren und ohne eine BBM-Abhaengigkeit in das Kit einzubauen.

BBM ist in M68 nur Zielanwendung und externe Referenz. BBM ist kein Editorbestandteil. Eine spaetere Zielanwendung kann BBM, Zugpferd, eine andere Electron-Anwendung, eine Browser-Anwendung oder eine unabhaengige Referenzanwendung sein.

## 2. Heutiger Stand im UI-Editor-kit

Das Kit besitzt heute den fachneutralen Core: Registry-Modell, Validatoren, Editor-Core, Change-Request-Modell, HostAdapter-Vertrag, LayoutState-Vertrag, MemoryLayoutStateStore, RuntimeLauncher, ViewModels, Selection-Vertrag und oeffentliche CommonJS-Exports. Release `0.2.0` betrifft diesen Core-Stand. `0.2.0` ist noch nicht der vollstaendige visuelle Editor als eigenstaendiges Produkt.

Vorhanden sind generische Regeln gegen DOM-Scan, automatische UI-Erkennung, Fachlogik, Fachdaten und Ziel-App-spezifische IDs. Noch nicht vorhanden sind die produktreife generische Editor-Runtime fuer Move/Resize/Save/Load/Reset, das vollstaendige Bedienpanel, ein Browser-Referenzhost und eine unabhaengige Referenzanwendung.

## 3. Heutiger Stand in BBM M63C-M67

Die folgenden Punkte sind aus BBM als externe Referenz inventarisiert. Sie beschreiben Zielverhalten, nicht zu uebernehmende BBM-Implementierungsdetails.

### M63C

- Kleine Layout-Steuerkonsole.
- Modi Move, Breite und Hoehe.
- D-Pad mit Schrittweite 5.
- Mittlerer Ruecksprung-Button.
- Strukturierte `allowedOps` und `effectiveOps`.
- Auswahlzustand und lesbarer Elementname.
- Keine capability-zu-operation-Ableitung.
- Keine ID-Sonderfaelle im Panel.

### M64

- Explizite Testflaeche.
- Auswahl registrierter Elemente.
- Orangefarbener Auswahlrahmen.
- Explizite HTMLElement-Refs.
- Move/Resize ueber HostAdapter.
- Sessionbeginn.
- Verwerfen von Sitzungsänderungen.
- Keine DOM-Suche und keine automatische Registrierung.

### M65

- Persistentes Speichern und Laden.
- Klare Trennung zwischen Sessionstore und persistentem Store.
- Status fuer `available` und `persistent`.
- Kein stiller Memory-Fallback bei produktiv fehlender Persistenz.
- Baseline nach erfolgreichem Speichern oder Laden.
- Neustart-Roundtrip.

### M66

- Gesamten Scope auf CSS-/Registry-Standard zuruecksetzen.
- Gespeicherten Scope-/Profilstatus loeschen.
- Inline-`transform`, `width` und `height` entfernen.
- CSS und natuerlicher Dokumentfluss sind Standardwahrheit der Ziel-App.
- Sichtbarer Reset.
- Strukturierter Status.
- Rollback.
- Scope-/Profil-Isolation.
- Bestaetigungsdialog.

### M67

- Ausschliesslich ausgewaehltes Element dauerhaft auf Standard setzen.
- Nur dessen persistenten und Session-Eintrag entfernen.
- Baseline nur dieses Elements aktualisieren.
- Kind-, Eltern- und Geschwisterelemente unveraendert lassen.
- Auswahl und Overlay erhalten.
- Dialog ohne Neuaufbau der Testflaechen-Refs.
- Rollback nur des betroffenen Elements.
- Reapply aktueller Sessionwerte nach tatsaechlich notwendigen Ref-Neuaufbauten.
- M63C-Kompatibilitaet bei fehlender Persistenz.

## 4. Funktionsmatrix

| Funktion | aktueller Ort | Zielort | UI-Editor-kit Core | UI-Editor-kit UI | Ziel-App HostAdapter | Ziel-App Registry | BBM-spezifisch | Folgepaket | Risiko | Nachweis |
|---|---|---|---|---|---|---|---|---|---|---|
| M63C kleine Layout-Steuerkonsole | BBM-Referenz | Kit UI/Runtime | Liefert Ops-/Statusdaten | Panel rendert neutral | keine | Elementnamen/Ops | konkrete Integrationstexte | M70 | Panel koennte Ziel-App-IDs kennen | ViewModel-/UI-Test |
| M63C Modi Move/Breite/Hoehe | BBM-Referenz | Core + UI | normalisiert Change Requests | Moduswahl | wendet Delta an | allowedOps/lockedOps | keine | M69/M70 | falsche Ops-Ableitung | Ops-Test |
| M63C D-Pad Schrittweite 5 | BBM-Referenz | Kit UI | erzeugt neutrale Deltas | D-Pad inkl. Step 5 | applyLayoutEntry | minWidth/minHeight | keine | M70 | fixe Pixelannahmen | ChangeRequest-Test |
| M63C mittlerer Ruecksprung-Button | BBM-Referenz | Core + UI | discard/reset fuer Element | Button und Status | restore/capture | Defaultwerte optional | keine | M69/M70 | Resetbereich zu gross | Elementreset-Test |
| M63C allowedOps/effectiveOps | Core teils vorhanden | Core | berechnet aus Registry ohne Capabilities | zeigt Ergebnis | keine | allowedOps/lockedOps/editable | keine | M69 | capability-Mapping schleicht ein | Public-API-Test |
| M63C Auswahl und lesbarer Name | Core/ViewModels teils vorhanden | UI/Runtime | SelectionStatus | Anzeige | optional SelectionHost | name | keine | M70/M71 | Anzeigenamen als Logik | Selection-Test |
| M64 explizite Testflaeche | BBM-Referenz | Referenz-App | keine | Beispielpanel | liefert Refs | Test-Registry | BBM-Testflaechen-IDs verboten | M72 | Testflaeche wird Produktlogik | Referenz-App-Test |
| M64 Auswahl registrierter Elemente | Selection-Vertrag teils vorhanden | Runtime/UI | prueft Registry | Auswahlzustand | ElementRefResolver/SelectionHost | IDs/Huerarchie | keine | M70/M71 | DOM-Suche | Boundary-Test |
| M64 orangefarbener Auswahlrahmen | BBM-Referenz | UI/Runtime + Host | Overlay-State | visuelle Referenz | Overlay/SelectionHost rendert | keine | konkrete Farbe optional Theme | M71 | CSS-Kopplung | Overlay-Test |
| M64 explizite HTMLElement-Refs | Selection teils vorhanden | HostAdapter | validiert Vertrag | keine | stellt Refs/Resolver | IDs | konkrete Refs | M71 | automatische Ref-Erkennung | Ref-Vertrag-Test |
| M64 Move/Resize ueber HostAdapter | HostAdapter teils vorhanden | Core + Host | Change Request + Status | Controls | applyLayoutEntry | allowedOps/min | keine | M69 | direkte DOM-Manipulation | Adapter-Test |
| M64 Sessionbeginn | teils RuntimeLauncher | Core | beginSession | Statusmeldung | optional Capture | Scope | keine | M69 | implizite Sessions | Session-Test |
| M64 Session verwerfen | LayoutStore teils vorhanden | Core | discardElementChanges/discardAllChanges | Dialog/Status | restore visible state | keine | keine | M69/M70 | unklarer Rollback | Session-Test |
| M65 persistentes Speichern | LayoutStateStore teils vorhanden | Core + Storage | saveLayout, Kontrolllesen | Status | StorageAdapter | Scope/Profile Keys | BBM-localStorage verboten | M69/M71 | stiller Fallback | Persistence-Test |
| M65 Laden | LayoutStateStore teils vorhanden | Core + Storage | loadLayout + Baseline | Status | apply entries | Scope/Profile | keine | M69/M71 | Baseline drift | Roundtrip-Test |
| M65 available/persistent | teils ViewModel | Core | getPersistenceStatus | Anzeige | Storage meldet Status | keine | BBM-Statusformulierungen | M69/M70 | Status unstrukturiert | Status-Test |
| M65 kein Memory-Fallback produktiv | Regel vorhanden | Core | Fehlercode statt Fallback | Warnung | Storage required | keine | keine | M69 | Datenverlust | Guardrail-Test |
| M66 Scope-Reset | BBM-Referenz | Core + Host + Storage | resetLayoutToDefaults | Confirm/Status | clearElementLayout | Scope/Profile | keine | M69/M70/M71 | Scope vermischt | Reset-Test |
| M66 persistenten Scope loeschen | BBM-Referenz | Core + Storage | clear/replaceEntries | Status | StorageAdapter | Scope/Profile | BBM-Schluessel verboten | M69/M71 | falscher Key | Storage-Test |
| M66 Inline transform/width/height entfernen | BBM-Referenz | HostAdapter | fordert clear an | keine | clearElementLayout konkret | keine | Ziel-App-CSS | M71 | Kit interpretiert CSS | Host-Test |
| M66 CSS als Standardwahrheit | BBM-Referenz | Ziel-App Host | Baseline nach Clear | Status | natuerlicher Flow | Defaults optional | keine | M71 | Editor-CSS-Wahrheit | Referenz-App-Test |
| M66 strukturierter Status/Rollback | BBM-Referenz | Core | Resultcodes + Snapshots | Anzeige | capture/restore | keine | Texte | M69/M70/M71 | halber Reset | Rollback-Test |
| M66 Bestaetigungsdialog | BBM-Referenz | Kit UI | provides intent/result | Dialog | keine | keine | konkrete BBM-Texte | M70 | Dialog loest DOM-Aktion aus | ViewModel-Test |
| M67 Einzelreset | BBM-Referenz | Core + Host + Storage | resetElementToDefaults | Confirm/Status | clear one ref | Element-ID | keine | M69/M70/M71 | Nachbarn veraendert | Elementreset-Test |
| M67 Baseline nur Element | BBM-Referenz | Core | resetSessionBaselineElement | Status | getCurrentLayoutEntry | keine | keine | M69 | globale Baseline | Session-Test |
| M67 Overlay/Auswahl erhalten | BBM-Referenz | UI/Runtime | SelectionStatus bleibt | Overlay Sync | SelectionHost | Element-ID | keine | M70/M71 | Auswahlverlust | Selection-Test |
| M67 Ref-Neuaufbau vermeiden/Reapply | BBM-Referenz | Runtime + Host | reapplyCurrentLayoutState | Status | optional reapply | keine | Testflaechen-Refs | M69/M71 | Sessionwerte verschwinden | Reapply-Test |
| M67 Kompatibilitaet ohne Persistenz | BBM-Referenz | Core/UI | structured unavailable status | deaktiviert Save/Reset persistent | Storage unavailable | keine | keine | M69/M70 | Ausnahme statt Status | Persistence-Test |

## 5. Produktgrenze

### A. UI-Editor-kit Core

Dauerhaft in den Core gehoeren Registry-Modell und Validator, neutrale Change Requests, Sessionstatus, Baseline-Logik, strukturierte Resultate, Fehlercodes, neutrale Save/Load/Reset-Abläufe, Public Runtime API, generische Inspect- und Statusdaten sowie generische ViewModel-Daten ohne konkrete DOM-Implementierung.

### B. UI-Editor-kit UI/Runtime

In Kit UI/Runtime gehoeren Bedienpanel, Moduswahl, D-Pad, Button-Intents, Dialogabläufe, Statusmeldungen, Auswahlzustand und Overlay-Steuerung ueber neutrale Schnittstellen. Die UI erzeugt nur Intents und Change Requests; sie greift nicht direkt auf DOM, localStorage oder Fachdaten zu.

### C. Ziel-App HostAdapter

Die Zielanwendung verantwortet konkrete HTMLElement-Refs, Ref-Resolver, Style-Anwendung, Entfernen von Inline-`transform`/`width`/`height`, `hidden`, Capture/Restore sichtbarer Layoutzustaende, Reapply nach notwendigen Ref-Neuaufbauten, konkrete Storage-Adapter und konkrete Scope-/Profil-Schluessel.

### D. Ziel-App Registry

Die Zielanwendung liefert konkrete Element-IDs, Namen, Hierarchie, `editable`, `allowedOps`, `lockedOps`, `visible`, `minWidth`, `minHeight` und optionale Layout-Defaults. Das Kit erzeugt keine Registry-Eintraege automatisch.

### E. Ausschliesslich BBM

Externe BBM-Referenzen und verbotene Abhaengigkeiten sind: `bbm-produktiv`, `bbm.main`, `bbm.main-layout`, `bbm.uiEditorTest.*`, Restarbeiten-IDs, Protokoll-IDs, BBM-Statusformulierungen, BBM-localStorage-Schluessel und BBM-spezifische Panelintegration. Diese Begriffe duerfen im produktiven Kit nicht entstehen; dokumentarische Nennung ist nur als externe Referenz oder verbotene Abhaengigkeit erlaubt.

## 6. Oeffentliche API-Zielstruktur

| Bereich | geplante API | Verantwortung | Rueckgabe/Fehler |
|---|---|---|---|
| Runtime-Erzeugung | `createUiEditorRuntime({ registry, hostAdapter, layoutStorage, targetContext, messages })` | Kit Core | Runtime oder Fehlercode bei fehlendem Vertrag |
| Session | `beginSession(scopeId)` | Kit Core | SessionStatus mit Baseline |
| Session | `getSessionStatus(scopeId)` | Kit Core | dirty, changedElements, baselineVersion |
| Session | `discardElementChanges(scopeId, elementId)` | Kit Core + Host | Rollback nur Element |
| Session | `discardAllChanges(scopeId)` | Kit Core + Host | Scope-Rollback |
| Session | `resetSessionBaseline(scopeId)` | Kit Core | neue Scope-Baseline |
| Session | `resetSessionBaselineElement(scopeId, elementId)` | Kit Core | neue Element-Baseline |
| Session | `endSession(scopeId)` | Kit Core | finaler SessionStatus |
| Layout | `applyChange(changeRequest)` | Kit Core + Host | accepted/applied/errors |
| Layout | `saveLayout(scopeId)` | Kit Core + Storage | Kontrolllesen, persistent-Status |
| Layout | `loadLayout(scopeId)` | Kit Core + Storage + Host | angewandte Entries + Baseline |
| Layout | `resetLayoutToDefaults(scopeId)` | Kit Core + Host + Storage | Scope-Reset mit Rollbackgrenze |
| Layout | `resetElementToDefaults(scopeId, elementId)` | Kit Core + Host + Storage | Einzelreset ohne Nachbarn |
| Layout | `reapplyCurrentLayoutState(scopeId)` | Runtime/Host | Reapply aktueller Sessionwerte |
| Inspect | `inspectScope(scopeId)` | Kit Core | Registry-, Session-, Persistence-Uebersicht |
| Inspect | `inspectElement(scopeId, elementId)` | Kit Core | Elementstatus, Ops, Layout |
| Status | `getPersistenceStatus(scopeId, elementId?)` | Kit Core + Storage | available/persistent/readResult |
| Status | `getAllowedOperations(scopeId, elementId)` | Kit Core | allowedOps/effectiveOps |
| Selection | `getSelectionStatus()` | Kit Runtime | selectedElementId/name/overlayStatus |

Auswahl und Overlay liegen als Zustand und ViewModel im Kit. Die konkrete DOM-Auswahl, der Overlay-Container und die Ref-Ermittlung benoetigen einen neutralen SelectionHost der Zielanwendung, weil nur die Zielanwendung ihre echten HTMLElement-Refs und Lebenszyklen kennt.

## 7. Datenfluss

Generischer Bedienfluss:

```text
Ziel-App Registry
-> UI-Editor Core
-> Auswahl/Bedienpanel
-> neutraler Change Request
-> Runtime/Inspector
-> HostAdapter
-> Ziel-App Element-Ref
-> Session-LayoutState
-> optional persistenter Storage
```

Resetpfad:

```text
Bedienpanel
-> Runtime
-> HostAdapter
-> Sessionstore
-> persistenter Storage
-> Baseline
-> Selection/Overlay-Sync
```

Keine direkte Verbindung:

```text
Panel -> DOM
Panel -> localStorage
Panel -> Ziel-App-Fachdaten
```

## 8. Eigentuemerschaft von Status und Layoutwahrheit

Der Core besitzt die editorische Wahrheit ueber Registry-Gueltigkeit, Operationen, Session-Deltas, Dirty-Status, Baseline und strukturierte Resultate. Die Zielanwendung besitzt die visuelle Wahrheit ueber CSS, natuerlichen Dokumentfluss, konkrete HTMLElement-Refs und fachliche UI-Lebenszyklen. Persistenter Layoutzustand gehoert einem StorageAdapter, der vom Ziel-App-Kontext instanziiert wird und keine Fachdaten speichert.

CSS-Standard ist keine aus dem Kit abgeleitete Wahrheit. Beim Reset fordert das Kit den HostAdapter auf, Layoutwerte zu entfernen; die Zielanwendung stellt dadurch ihren CSS-/Registry-Standard wieder her.

## 9. Fehler- und Rollbackgrenzen

Jede mutierende Runtime-Operation liefert strukturierte Resultate mit `ok`, `code`, `scopeId`, optional `elementId`, `changedEntries`, `rolledBack` und `errors`. Rollback ist auf den tatsaechlich betroffenen Scope oder das betroffene Element begrenzt. Gesamtreset darf nur den aktuellen Scope und das aktuelle Profil beruehren. Einzelreset darf Eltern, Kinder und Geschwister nicht veraendern.

Bei fehlender produktiver Persistenz meldet der Core `persistence_unavailable` und nutzt keinen stillen Memory-Fallback. Wenn ein Write scheitert oder das Kontrolllesen nicht den geschriebenen Zustand bestaetigt, muss der Core den sichtbaren Ziel-App-Zustand ueber HostAdapter-Snapshots zurueckrollen.

## 10. Ref- und Selection-Vertrag

Der HostAdapter muss mindestens bereitstellen:

- `validateElementRef(scopeId, elementId)`
- `applyLayoutEntry(scopeId, elementId, layoutEntry)`
- `clearElementLayout(scopeId, elementId)`
- `captureElementLayoutState(scopeId, elementId)`
- `restoreElementLayoutState(scopeId, elementId, capturedState)`
- `getCurrentLayoutEntry(scopeId, elementId)`
- optional `reapplyCurrentLayoutState(scopeId)`
- Registry-/Scope-Validierung fuer Ziel-App-Lebenszyklen

Der optionale SelectionHost muss explizite Element-Refs oder einen vertraglich begrenzten Ref-Resolver erhalten. Er darf keine Ziel-App-DOM-Struktur scannen und keine Elemente automatisch registrieren.

## 11. Persistenzvertrag

Der LayoutStorage-Adapter muss mindestens melden oder liefern:

- `available`
- `persistent`
- `readResult`
- `write(scopeId, layoutProfileId, entries)`
- `clear(scopeId, layoutProfileId)`
- optional `deleteEntry(scopeId, layoutProfileId, elementId)`
- optional `replaceEntries(scopeId, layoutProfileId, entries)`
- Fehlercodes fuer unavailable, read_failed, write_failed, verify_failed, clear_failed
- Kontrolllesen nach Schreibvorgaengen
- keine stillen Fallbacks

Scope-, Profil- und Ziel-App-Schluessel werden von `targetContext` und Ziel-App-Adapter geliefert; das Kit kennt keine konkreten Ziel-App-Schluessel.

## 12. Verbotene Abhaengigkeiten

Das UI-Editor-kit darf nicht Ziel-App-DOM scannen, automatisch Elemente erkennen, automatisch Registry-Eintraege erzeugen, Fachlogik enthalten, Fachdaten speichern, Ziel-App-CSS als Editorwahrheit interpretieren, konkrete Ziel-App-IDs kennen, direkt BBM-localStorage verwenden, Layoutzustand aus deutschen Anzeigetexten ableiten, bestehende UI-Strukturen automatisch migrieren oder Ziel-App-Quellen ungefragt veraendern.

Die Zielanwendung muss ausdruecklich liefern: `targetAppId`, `moduleId`, `scopeId`, `layoutProfileId`, Registry, HostAdapter, explizite Element-Refs oder Ref-Resolver-Vertrag, LayoutStorage-Adapter, optional Text-/Uebersetzungsadapter und optional Overlay-/SelectionHost.

## 13. Migrationsstrategie ohne Codekopie

M68 uebernimmt Verhalten als Vertrag, nicht BBM-Code. Fuer jede BBM-Funktion wird zuerst ein neutraler Akzeptanztest formuliert, dann ein generisches Core-/Runtime-Verhalten implementiert, danach ein neutraler Browser-Host gebaut und erst danach eine Referenzanwendung angebunden. BBM-spezifische IDs, Texte, localStorage-Schluessel, Testflaechen und Panelintegration bleiben ausserhalb des Kits.

## 14. Folgepakete M69-M73

- M69: Generische Runtime und Session-/Layout-API im UI-Editor-kit.
- M70: Generisches Bedienpanel und neutrale Dialog-/Status-ViewModels.
- M71: Generischer Browser-Host, Ref-Vertrag, Overlay- und Persistenz-Referenzadapter.
- M72: Unabhaengige Browser-Referenzanwendung ohne BBM-Abhaengigkeit.
- M73: Release Candidate, Public API, Integrationshandbuch, Packaging und Abnahmetest fuer eine zweite Zielanwendung.

M74 ist der erste produktive Pilot im externen BBM-Repo und gehoert nicht zu M68. M74 darf in M68 nicht umgesetzt werden.

## 15. Abnahmekriterien fuer BBM-Unabhaengigkeit

Der Editor gilt erst dann als BBM-unabhaengig abgenommen, wenn:

1. Eine Referenzanwendung ausserhalb BBM laeuft.
2. Keine Datei aus BBM importiert wird.
3. Keine BBM-ID im Kit enthalten ist.
4. Registry und HostAdapter vollstaendig von der Referenzanwendung geliefert werden.
5. Move, Breite, Hoehe, Save, Load, Session-Verwerfen, Einzelreset und Gesamtreset funktionieren.
6. Neustart-Persistenz funktioniert.
7. CSS-Standard der Referenzanwendung korrekt wiederhergestellt wird.
8. Andere Elemente beim Einzelreset unveraendert bleiben.
9. Das Kit ueber dokumentierte Public APIs eingebunden wird.
10. Alle Tests ohne BBM-Repo verfuegbar und gruen sind.

## 16. Risiken und offene Entscheidungen

- BBM-Referenzdateien waren in diesem Arbeitsbaum nicht vorhanden; M68 dokumentiert deshalb die vorgegebenen M63C-M67-Verhaltensmerkmale als externe Referenz und baut keine BBM-Dateien ein.
- Der genaue Fehlercode-Katalog wird in M69 technisch finalisiert.
- Die konkrete Panel-Optik wird in M70 entschieden, darf aber keine Ziel-App-ID-Logik enthalten.
- Die konkrete Browser-Overlay-Implementierung wird in M71 entschieden; sie muss auf expliziten Refs basieren.
- Persistenzadapter duerfen Memory nur als expliziten Testadapter nutzen, nicht als stillen produktiven Fallback.
