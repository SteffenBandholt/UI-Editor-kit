# M40 BBM-Runtime-Rueckfuehrung Plan

## 1. Grundsatz

Das `UI-Editor-kit` ist das Produkt.

`BBM-Produktiv` ist Referenz-Ziel-App. BBM beweist Runtime-Erfahrungen, liefert aber keine Produktfachlogik fuer das Kit.

`Restarbeiten` und `Protokoll/TOPS` sind Referenz-Scopes innerhalb BBM. Ihre Scope-Namen, Modulnamen, Fachbedeutungen und Registry-Inhalte bleiben BBM-spezifisch.

Die Ziel-App liefert weiterhin explizit:

- Registry
- HostAdapter
- UI-Scope
- Layout-Scope
- Scope-Informationen
- LayoutState
- erlaubte und gesperrte Operationen
- Save-/Load-/Reset-Verhalten fuer neutrale Layoutdaten

Der Editor scannt nicht, erkennt nicht automatisch und registriert nichts automatisch. Nicht registrierte Elemente sind fuer den Editor nicht vorhanden oder werden sichtbar blockiert.

M40 ist kein grosser Umbau. M40 plant nur, welche Runtime-Erfahrungen aus BBM M29 bis M37 generisch in das `UI-Editor-kit` zurueckgefuehrt werden sollen.

Ausgangsstand:

- M38: BBM-Pilotstand wurde mit dem Kit abgeglichen.
- M39: Ziel-App-Vertrag v1.0 ist festgezogen.
- Fixstand-Tag: `target-app-contract-v1.0`
- BBM bleibt Referenz-Ziel-App.

## 2. BBM-Runtime-Erfahrungen, die generisch relevant sind

### Sichtbarer Runtime-Launcher

BBM beweist einen sichtbaren Launcher im App-Kontext. Der Launcher:

- ist nur im freigegebenen Kontext sichtbar
- toggelt einen neutralen Aktivzustand
- setzt Attribute wie aktiv/inaktiv
- oeffnet ein Status-/Bedienpanel
- bindet installierte Launcher- und Selection-Artefakte ein

Generisch relevant ist nicht die BBM-Position oder der BBM-DEV-Schalter, sondern das Modell:

- Launcher-Artefakt
- Aktivzustand
- Install-/Uninstall-Lifecycle
- sichtbares Statuspanel
- keine Fachaktion beim Oeffnen

### Aktiver UI-Scope

BBM zeigt einen aktiven UI-Scope sichtbar an. Dieser UI-Scope beschreibt die aktuell bedienbare Ziel-App-Oberflaeche.

Generisch relevant:

- aktiver Scope als Runtime-State
- Scope-Anzeige als ViewModel
- Registry-Aufloesung ueber aktiven Scope
- unbekannter Scope als blockierter Zustand

### Layout-Scope

BBM beweist, dass UI-Scope und Layout-Scope nicht immer identisch sein muessen:

- `restarbeiten.screen` wird auf `restarbeiten.ui.main` abgebildet
- `protokoll.topsScreen` nutzt `protokoll.topsScreen`

Generisch relevant:

- expliziter `uiScope` -> `layoutScope` Resolver
- keine Scope-Ableitung durch den Editor
- Layoutaktionen immer gegen den aufgeloesten Layout-Scope
- Anzeige des Layout-Scope im Bedienmodell

### Scope-Wechsel

BBM beweist den Wechsel zwischen mehreren Scopes.

Generisch relevant:

- aktive Registry wechseln
- aktive Zielauswahl loeschen
- Markierung entfernen
- Layoutstatus zuruecksetzen
- Selection-Controller neu initialisieren
- falsche Scope-/Element-Kombinationen blockieren

### Auswahl-Reset bei Scope-Wechsel

Beim Scope-Wechsel darf eine alte Auswahl nicht weiterwirken. BBM loescht Auswahl und Markierung.

Generisch relevant:

- `clearSelection()` als Pflichtverhalten beim Scope-Wechsel
- Status danach: keine Auswahl
- keine stillen Folgeaktionen auf altem Element

### Registrierte Elementauswahl

BBM beweist Klickauswahl auf Elemente mit `data-ui-editor-id` und Registry-Abgleich.

Generisch relevant:

- Target-Selection nur gegen Registry
- sichtbare Markierung registrierter Ziele
- Hover-/Selection-State
- Parent-Auswahl ueber explizite Bedienhandlung
- Eingabefelder bleiben fachlich bedienbar, solange keine Editoraktion ausgefuehrt wird

Im Kit existiert bereits `src/core/target-selection.cjs`. M40 sieht hier keinen Neubau, sondern eine Einbettung in eine generische Runtime-Schicht.

### Falscher Scope / falsches Element blockieren

BBM blockiert Elemente, die im aktiven Scope nicht registriert sind. Ein Restarbeiten-Ziel wirkt nicht im Protokoll-Scope und umgekehrt.

Generisch relevant:

- `wrong_scope`
- `unknown_element`
- Auswahl-Hinweis
- Layoutbedienung blockiert
- keine Aenderung an Ziel-App

### No Selection blockieren

BBM zeigt die Layoutbedienung, blockiert aber Layoutaktionen, wenn kein registriertes Element ausgewaehlt ist.

Generisch relevant:

- Statuscode `no_selection`
- Layoutpanel bleibt erklaerbar
- keine ChangeRequest-Erzeugung ohne Element

### AllowedOps / LockedOps anzeigen

BBM zeigt erlaubte neutrale Layoutoperationen fuer das ausgewaehlte Element.

Im Kit existieren bereits:

- `editor-core.cjs` mit `getElementOperations()`
- `editor-ui-details-view-model.cjs`
- `editor-ui-tree-view-model.cjs`
- `editor-ui-change-draft-view-model.cjs`

Generisch relevant:

- ViewModel fuer erlaubte, gesperrte und verfuegbare Operationen
- Ableitung neutraler Layoutoperationen aus `allowedOps` minus `lockedOps`
- keine Anzeige fachlicher Operationen als Editoraktion

### ChangeRequest erzeugen

BBM erzeugt aus Element, Operation, Payload und Scope einen ChangeRequest und reicht ihn an den HostAdapter.

Im Kit existieren bereits:

- `change-request-model.cjs`
- `change-request-validator.cjs`
- neutrale Payload-Felder
- verbotene Fachfelder

Generisch relevant:

- Runtime-ViewModel fuer ChangeRequest-Draft
- Quelle `editor-runtime`
- `targetAppId`, `uiScope`/`layoutScope`, `elementId`, `operation`, `payload`
- Validierung vor Submit
- finale Annahme oder Ablehnung durch Ziel-App

### Save / Load / Reset Bedienmodell

BBM beweist:

- Anwenden/Speichern fuer neutrale Layoutwerte
- Laden gespeicherter Layoutwerte
- Reset auf Standard
- Status nach jeder Aktion
- Blockade bei unbekanntem Scope oder unbekanntem Element

Generisch relevant:

- Layout-Control-ViewModel
- Control-IDs fuer Apply/Save, Load und Reset
- Statusmodell `ready`, `success`, `blocked`
- optionaler HostAdapter-Umfang fuer Reset/Load
- keine Fachspeicherung

### Statusmeldungen

BBM zeigt Status fuer:

- aktiv/inaktiv
- aktiver UI-Scope
- Layout-Scope
- Hover
- Auswahl
- Layoutstatus
- Grund einer Blockade

Generisch relevant ist nicht der exakte BBM-Text, sondern ein fachneutraler Status-ViewModel-Vertrag.

### Blockademeldungen

BBM beweist sichtbare Blockaden fuer:

- unbekannter Scope
- falscher Scope
- unbekanntes Element
- keine Auswahl
- Operation nicht erlaubt
- Operation gesperrt
- Payload nicht layoutneutral
- Fach-/DOM-/DB-/Datensatzpayload

M39 hat die generischen Codes bereits dokumentiert. M40 plant die Rueckfuehrung in Runtime-ViewModels.

### Bedienhinweise

BBM zeigt die Bediengrenze:

- nur neutrale Layoutaenderungen
- keine Fachwerte
- PDF, Druck, Mail, Audio und DB-Fachlogik nicht Teil dieses Editors

Generisch relevant:

- fachneutrale Boundary-Hinweise
- Ziel-App kann zusaetzliche Hinweise liefern
- Produkttext darf keine BBM-Fachbegriffe enthalten

### Neutrale Layoutoperationen

BBM beweist neutrale Operationen wie:

- `move`
- `resize`
- `width`
- `height`
- `spacing`
- `hide`
- `show`

Im Kit existieren bereits neutrale Payload-Grenzen in `change-request-validator.cjs`. Aus BBM ist zusaetzlich relevant:

- `hide`/`show` als Layoutoperation sauber mit `visible` verbinden
- Layoutwerte normalisieren
- Fach-, DOM- und DB-Schluessel tief blockieren

### HostAdapter-Grenzen

BBM beweist, dass der HostAdapter final entscheidet:

- Registry liefern
- LayoutState liefern
- ChangeRequest pruefen
- neutrale Layoutwerte speichern
- Reset ausfuehren
- unbekannte Elemente blockieren
- Fachpayloads blockieren

Generisch relevant:

- Pflichtumfang klein halten
- optionale Persistenzmethoden klar benennen
- HostAdapter darf keine Fachlogik fuer den Editor freigeben

## 3. Rueckfuehrungskandidaten ins UI-Editor-kit

### A) Muss generisch ins Kit

- Generische Runtime-/Launcher-Schicht ohne BBM-Namen.
- Runtime-State fuer `active`, `activeUiScope`, `layoutScope`, `selectedElement`, `hoverElement`, `layoutStatus`.
- Generischer Scope-Resolver-Vertrag: Ziel-App liefert verfuegbare UI-Scopes und UI-Scope-zu-Layout-Scope-Abbildung.
- Generischer Selection-Lifecycle: installieren, deinstallieren, Auswahl setzen, Auswahl loeschen, Hover loeschen.
- Pflichtverhalten: Scope-Wechsel loescht Auswahl und Markierung.
- Generisches Status-ViewModel fuer aktiv/inaktiv, UI-Scope, Layout-Scope, Auswahl, erlaubte Operationen und Blockadegrund.
- Generisches Layout-Control-ViewModel fuer Apply/Save, Load und Reset.
- Generische Blockadecodes aus M39 in Runtime-Status ueberfuehren.
- ChangeRequest-Draft aus Auswahl, Operation und neutralem Payload erzeugen.
- No-selection-Blockade vor ChangeRequest-Erzeugung.
- Wrong-scope-/unknown-element-Blockade vor HostAdapter-Submit.
- Safe-Layout-Operations-Liste und Payload-Normalisierung als Produktbaustein.
- Neutraler Minimal-Host als Referenz gegen die neue Runtime-Schicht nutzen.
- Tests fuer Runtime-State, Scope-Wechsel, Selection-Reset, Status-ViewModels und Layout-Control-Flows.

### B) Kann spaeter ins Kit

- Sichtbares Standardpanel mit konkretem HTML/CSS.
- Verschiebbares, einklappbares und ausblendbares Panel als generische UI-Komponente.
- Generische Launcher-CSS-Auslieferung als installierbares Artefakt.
- Tastaturbedienung fuer Parent-/Child-Auswahl.
- Undo-/Redo-Modell.
- Versionierte Layoutpersistenz als Kit-Modul.
- Mehrere Layoutprofile pro Ziel-App.
- Produktive Freigabe-/Risk-Gates fuer echte Ziel-App-Aktivierung.
- Erweiterte Usability-Texte und Lokalisierung.

### C) Bleibt Ziel-App-Verantwortung

- Liste verfuegbarer UI-Scopes.
- Aktiver Default-Scope.
- UI-Scope-zu-Layout-Scope-Mapping.
- Registry je Scope.
- DOM-Markierung mit stabilen `data-ui-editor-id` Werten.
- HostAdapter je Layout-Scope oder Zielbereich.
- LayoutState-Speicherort.
- Persistenzstrategie, Versionierung und Rollback.
- Fachliche Entscheidung, welche Elemente editorfaehig sind.
- Freigabe von `allowedOps` und `lockedOps`.
- Fachliche Klick-Abnahme im echten App-Fenster.

### D) Bleibt BBM-spezifisch

- Scope-Namen `restarbeiten.screen`, `restarbeiten.ui.main` und `protokoll.topsScreen`.
- Modulnamen `restarbeiten` und `protokoll`.
- TOPS-Quicklane-Struktur und Buttonbedeutungen.
- Restarbeiten-Registry und Protokoll/TOPS-Registry.
- BBM-HostAdapter-Factory.
- BBM-Katalogstruktur mit Modul-Labels.
- BBM-DEV-Kontext und Header-Freigabe.
- BBM-spezifische Texte und Panelposition.
- BBM-Tests als Ziel-App-Tests.

### E) Ausdruecklich nicht uebernehmen

- Restarbeiten-Fachlogik.
- Protokoll-Fachlogik.
- PDF-, Druck-, Mail-, Audio- oder DB-Funktionen.
- Fachliche Button-Ausfuehrung.
- IPC-/Datenbankwege aus BBM.
- Automatische UI-Erkennung.
- Automatische Registry-Befuellung.
- DOM-Scan oder MutationObserver-basierte Bestandserkennung.
- Migration bestehender UI.
- Historische UI-Inspector-/Scan-Begriffe als Produktziel.
- Eine grosse Editor-App-Shell in diesem Paket.

## 4. Konkrete Umsetzungsreihenfolge

### M41: generische Runtime-/Launcher-Schicht im UI-Editor-kit

Ziel:

Eine kleine, fachneutrale Runtime-Schicht, die den vorhandenen Core, Target-Selection und Ziel-App-Vertrag verbindet, ohne BBM-Abhaengigkeit und ohne grosse App-Shell.

Empfohlener Umfang:

- `createEditorRuntimeState()`
- `createEditorRuntimeLauncherModel()`
- Aktiv/inaktiv-Modell
- Host-/Document-unabhaengiger Kern, DOM-Anbindung optional
- Anschluss an vorhandenes `target-selection.cjs`
- Lifecycle: install, uninstall, activate, deactivate
- keine sichtbare grosse UI-Shell
- keine Persistenz
- keine Ziel-App-Fachaktion

Abnahmekriterien:

- Launcher-State toggelt neutral.
- Aktivzustand beeinflusst nur EditorRuntime-State.
- Keine automatische Erkennung oder Registry-Befuellung.
- Neutraler Minimal-Host kann die Runtime initialisieren.

### M42: generische Scope-/Selection-/Status-ViewModels

Ziel:

Die in BBM bewiesene Bedienlogik als reine ViewModels ins Kit bringen.

Empfohlener Umfang:

- Scope-Liste normalisieren
- aktiven UI-Scope setzen
- Layout-Scope aus explizitem Resolver lesen
- Scope-Wechsel loescht Auswahl
- Selection-Status fuer registriertes Element
- no-selection, unknown-scope, wrong-scope und unknown-element als Status
- AllowedOps/LockedOps/AvailableOps als ViewModel
- Layout-Control-ViewModel fuer Apply/Save, Load, Reset
- ChangeRequest-Draft fuer neutrale Layoutoperationen

Abnahmekriterien:

- Falsches Element wird blockiert.
- Keine Auswahl erzeugt keinen ChangeRequest.
- Scope-Wechsel entfernt Auswahl und Markierung.
- Statuscodes sind fachneutral.
- Tests laufen ohne DOM und ohne BBM.

### M43: BBM als Referenz-Ziel-App gegen offiziellen Kit-Vertrag pruefen

Ziel:

BBM nicht umbauen, sondern als Referenz-Ziel-App gegen die offiziellen Kit-Vertraege und Runtime-Modelle pruefen.

Empfohlener Umfang:

- BBM-Registry gegen Kit-Vertrag pruefen.
- BBM-HostAdapter-Shape gegen Kit-Vertrag pruefen.
- BBM-Scope-Mapping gegen M39/M42-Vertrag pruefen.
- BBM-Runtime-Tests mit offiziellen Kit-ViewModels vergleichen.
- Abweichungen dokumentieren.

Abnahmekriterien:

- BBM bleibt fachlich unveraendert.
- BBM-spezifische Namen bleiben nur in BBM.
- Offizielle Kit-Vertraege koennen BBM als Referenzfall beschreiben.
- Kein BBM-Code wird ohne separaten Auftrag migriert.

## 5. Nicht-Ziele

- Keine BBM-Dateien aendern.
- Keine Restarbeiten-Fachlogik uebernehmen.
- Keine Protokoll-Fachlogik uebernehmen.
- Keine PDF-Funktion bauen.
- Keine Druck-, Mail-, Audio- oder DB-Funktion bauen.
- Keine automatische UI-Erkennung einfuehren.
- Keine automatische Registry-Befuellung einfuehren.
- Keine bestehende UI migrieren.
- Keine grosse Editor-App-Shell bauen.
- Keine produktive Ziel-App-Freigabe in M40.
- Kein Commit in M40 automatisch erstellen.

## 6. Empfehlung

M40 sollte als Planungs- und Schneidungspaket abgeschlossen werden.

Die naechste technische Arbeit sollte klein und produktnah bleiben:

1. **M41** baut die generische Runtime-/Launcher-Schicht ohne sichtbare grosse Shell.
2. **M42** baut die generischen Scope-/Selection-/Status-ViewModels.
3. **M43** prueft BBM als Referenz-Ziel-App gegen den offiziellen Kit-Vertrag.

Damit wandert die in BBM bewiesene Runtime-Erfahrung in das Produkt zurueck, ohne BBM-Fachlogik in das `UI-Editor-kit` zu ziehen.
