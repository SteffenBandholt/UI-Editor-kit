# M38 BBM-Pilotstand-Abgleich

## 1. Grundsatz

Das `UI-Editor-kit` ist das Produkt.

`BBM-Produktiv` ist nur Ziel-App, Pilot und Referenzumgebung. BBM beweist, wie eine Ziel-App den Editor anbinden kann, ist aber nicht die fachliche Grundlage des generischen Produkts.

`Restarbeiten` ist ein Pilot-Scope innerhalb BBM. `Protokoll/TOPS` ist ein zweiter Pilot-Scope innerhalb BBM. Beide Scopes bleiben Ziel-App-Kontext und duerfen nicht als generische Editor-Fachlogik in das Kit wandern.

Die Ziel-App liefert:

- eine explizite Registry je editorfaehigem Scope
- stabile IDs und Parent-Beziehungen
- erlaubte und gesperrte Operationen
- einen HostAdapter
- die Trennung von Layoutdaten und Fachdaten
- die fachliche Entscheidung, welche UI-Elemente editorfaehig sind

Der Editor scannt nicht. Er erkennt nicht automatisch. Er entscheidet nicht selbst, was editierbar ist. Nicht registrierte Elemente sind fuer den Editor nicht vorhanden.

Der Installer des `UI-Editor-kit` ist nur ein Ziel-App-Regelpaket-Bootstrap. Er analysiert keine bestehende UI, befuellt keine Registry automatisch und migriert keine bestehende Ziel-App-UI.

## 2. Stand UI-Editor-kit

### Vorhandener Vertrag

Vorhanden sind die fuehrenden Regeln in:

- `README.md`
- `docs/UI_EDITOR_VERTRAG.md`
- `docs/ZIEL_APP_ANBINDUNG.md`
- `docs/UI_BAU_UND_PRUEFREGELN.md`
- `docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md`

Der Vertrag ist fachneutral. Er legt fest:

- Editorfaehigkeit entsteht nur durch explizite Registrierung.
- Pflichtfelder wie `id`, `name`, `type`, `role`, `parentId`, `order`, `visible`, `editable`, `allowedOps` und `lockedOps` sind Grundlage.
- Parent-Strukturen duerfen nicht geraten werden.
- Tabellen, Spalten, Metaspalten, Toolbars, Filterleisten und Header-Editierbereiche muessen bewusst klassifiziert werden.
- Fachaktionen, Fachdaten, Datenbank-, Upload-, Import-, Export-, Save-, Delete- und Execute-Wege sind keine Editoroperationen.
- Layoutdaten und Fachdaten bleiben getrennt.
- Bestehende UI darf bewusst nachregistriert werden, aber nicht automatisch analysiert, gescannt, erkannt oder migriert werden.

### Vorhandener Core

`src/core/editor-core.cjs` kann bereits:

- eine Registry-Schnittstelle mit `listElements()` verlangen
- die UI-Elementliste validieren
- Elemente klonen und als unveraenderlichen Core-Stand halten
- Elemente nach ID finden
- Elementdetails liefern
- erlaubte, gesperrte und verfuegbare Operationen ableiten
- einen Elementbaum aus Parent-Beziehungen bilden

Der Core ist damit ein generischer Registry-Leser und Operationspruefer. Er ist noch keine komplette sichtbare EditorRuntime mit Scope-Wechsel, Auswahlpanel, Layoutbedienung oder Ziel-App-Speicherfluss.

### Vorhandener HostAdapter-Vertrag

`src/core/host-adapter-contract.cjs` verlangt aktuell mindestens:

- `getRegistry()`
- `getCurrentLayoutState()`
- `submitChangeRequest()`

Damit ist der Kernvertrag fuer Ziel-App-Anbindung vorhanden. Reset, Load-Semantik, Scope-Wechsel, Statusmeldungen und UI-Bedienfuehrung sind im Kit noch nicht als kompletter Ziel-App-Vertrag v1.0 festgezogen.

### Vorhandene ChangeRequest-Pruefung

`src/core/change-request-validator.cjs` prueft bereits:

- Form des Aenderungsauftrags
- Pflichtfelder
- verbotenes Fach-/Datenfeldinventar aus dem ChangeRequest-Modell
- vorhandenen Editor-Core
- bekannte Element-ID
- erlaubte und nicht gesperrte Operation

Damit ist der generische Schutz gegen unbekannte Elemente und nicht erlaubte Operationen im Kit vorhanden. Der Ziel-App-spezifische Schutz gegen nicht layoutneutrale Payloads wurde im BBM-Pilot bewiesen, ist aber im Kit noch als Produktvertrag zu schaerfen.

### Vorhandener Target-Contract

`src/core/target-contract.cjs` kann Registry-Elemente gegen DOM-Ziele pruefen:

- gueltiges Zielattribut
- eindeutige Registry-IDs
- vorhandene DOM-Ziele fuer nicht virtuelle Elemente
- gueltige Parent-Beziehungen
- DOM-Parent passend zur Registry
- Gruppen mit echtem DOM-Wrapper
- Surface-Contract-Pruefung fuer mehrere Oberflaechen

Das ist ein wichtiger generischer Ziel-App-Vertragsbaustein. Er ersetzt keine automatische UI-Erkennung, sondern prueft nur bewusst gelieferte Registry- und DOM-Zuordnungen.

### Vorhandenes Adapter-Manifest

`src/core/target-app-adapter-manifest.cjs` definiert und prueft ein fachneutrales Adapter-Manifest mit:

- Ziel-App- und Adapteridentitaet
- UI-Scope
- Layout-Profil
- unterstuetzten Elementtypen, Rollen und Operationen
- gesperrten Operationen
- Persistence-, Execution- und Risk-Modus
- Rollback- und Teststrategie

Verbotene Felder wie Datenbank-, Fach-, Personen-, Preis-, Datensatz-, Save-, Delete- und Upload-Begriffe werden abgewehrt. Damit ist ein generischer Manifestkern vorhanden, aber noch nicht vollstaendig als verpflichtender Ziel-App-Vertrag v1.0 ausformuliert.

### Vorhandener Installer

Vorhanden sind:

- `scripts/install-ui-editor-to-target.cjs`
- `scripts/start-installer-app.cjs`
- `src/core/target-app-installer-plan.cjs`
- Installer-Ausfuehrung, Preview und Uninstall-Bausteine

Der CLI-Installer schreibt Regelpaket, Registry-Hilfsstruktur, Launcher-Artefakte, Tests und Statusdateien in eine Ziel-App. Der Plan blockiert ausdruecklich:

- UI-Scan
- automatische Elementerkennung
- automatische Registrierung
- Ziel-App-UI-Aenderung
- Fachdaten-Schreiben
- Ausfuehren von Ziel-App-Fachaktionen

Der Browser-Installer existiert, der README benennt aber die CLI-Regelpaket-Installation als bevorzugten Weg.

### Vorhandene Tests

`package.json` enthaelt eine breite Testkette. Abgedeckt sind unter anderem:

- Vertrags-Selftest
- UI-Elementmodell, Registry und Validator
- Editor-Core
- ChangeRequest-Modell und Validator
- HostAdapter-Vertrag
- Test-HostAdapter
- Layout-State-Modell und Store
- Editor-UI-State und View-Modelle
- Target-Selection
- Target-Contract
- Target-App-Bootstrap
- Target-App-Test-Host-Flow
- Neutral-Minimal-Host
- Adapter-Manifest, Manifest-Check und Release-Gate
- Adapter-Plan und Plan-Safety-Check
- Installer-Plan, Installer-Ausfuehrung und Uninstall
- Target-App-Registry-Contract
- CLI-Installer
- Installer-App-Start

Das Kit hat damit bereits eine substanzielle generische Vertrags- und Installationsbasis.

## 3. Stand BBM-Pilot

Der BBM-Pilotstand M29 bis M37 beweist eine Ziel-App-Integration im App-Kontext. Die Belege liegen in BBM unter:

- `docs/M32_UI_EDITOR_APP_SMOKE_TEST.md`
- `docs/M33_UI_EDITOR_PROTOKOLL_SCOPE_ANBINDUNG.md`
- `docs/M34_UI_EDITOR_SCOPE_WECHSEL_BEDIENFUEHRUNG.md`
- `docs/M35_UI_EDITOR_BEDIENHINWEISE_ABNAHMEGRENZEN.md`
- `docs/M36_UI_EDITOR_FIXSTAND_ABNAHME.md`
- `docs/M37_UI_EDITOR_KLICK_ABNAHME.md`
- `docs/UI_INSPEKTOR_AUFGABENHEFT.md`
- `STATUS.md`

### Sichtbarer Editor im App-Kontext

BBM zeigt den UI-Editor-Launcher im DEV-Kontext im echten App-Fenster. M32 dokumentiert App-Start, sichtbares BBM-Fenster und sichtbaren `UI-Editor`-Launcher.

### Restarbeiten-Scope

Der sichtbare UI-Scope `restarbeiten.screen` wird im BBM-Pilot auf den Layout-Scope `restarbeiten.ui.main` abgebildet. Der Scope besitzt eine explizite BBM-Registry und einen BBM-HostAdapter.

Bewiesen wurde:

- registrierte Restarbeiten-Elemente koennen ausgewaehlt werden
- Layout-Scope wird angezeigt
- neutrale Layoutaenderungen koennen angewendet und gespeichert werden
- gespeicherte Layoutzustaende koennen geladen werden
- Reset setzt auf Standard zurueck
- unbekannte Elemente und unzulaessige Aenderungen werden blockiert

### Protokoll/TOPS-Scope

M33 bindet zusaetzlich `protokoll.topsScreen` an. Der Scope enthaelt unter anderem TOPS-Quicklane, Gruppen und Quicklane-Buttons.

Bewiesen wurde:

- `protokoll.topsScreen` ist als sichtbarer UI-Scope bedienbar
- der Layout-Scope ist ebenfalls `protokoll.topsScreen`
- registrierte TOPS-/Quicklane-Elemente koennen ausgewaehlt werden
- Anwenden/Speichern, Laden und Reset laufen ueber den neutralen EditorRuntime-/HostAdapter-Pfad
- Restarbeiten bleibt parallel bedienbar
- Fach-, DOM-, Datenbank- und Textpayloads werden blockiert

### Scope-Wechsel

M34 beweist:

- aktiver UI-Scope wird sichtbar als `Aktiver UI-Scope` angezeigt
- Wechsel zwischen `restarbeiten.screen` und `protokoll.topsScreen` loescht alte Auswahl und Markierung
- alte Ziele wirken nicht im neuen Scope weiter
- Speichern/Laden/Reset bleiben an den aktuell aufgeloesten Layout-Scope gebunden
- unbekannte Scopes werden sichtbar blockiert

### Auswahl-Reset

Beim Scope-Wechsel wird die bisherige Zielauswahl geloescht. Falsche Scope-/Element-Kombinationen werden verhindert oder sichtbar blockiert.

### Layout-Scope-Anzeige

Das BBM-Layoutpanel zeigt:

- ausgewaehltes Element
- Layout-Scope
- erlaubte neutrale Layoutoperationen
- aktuellen Speicher-/Lade-/Reset-Status
- blockierende Gruende

### Save/Load/Reset

Der BBM-Pilot beweist Save/Load/Reset fuer neutrale Layoutwerte in den angebundenen Scopes. Layoutdaten werden ueber Ziel-App-HostAdapter und Layoutspeicher gefuehrt, nicht ueber Fachlogik.

### Sichtbare Blockademeldungen

Sichtbar blockiert werden unter anderem:

- kein registriertes Element ausgewaehlt
- unbekannter Scope
- falscher Scope
- unbekanntes Element im aktiven Scope
- nicht erlaubte Operation
- gesperrte Operation
- nicht layoutneutrale Aenderung
- Fach-, DOM-, Datenbank- oder Datensatzpayloads

### Bedienhinweise

M35 zieht die sichtbaren Bediengrenzen fest:

- nur neutrale Layoutaenderungen
- keine Fachwerte
- PDF, Druck, Mail, Audio und DB-Fachlogik sind nicht Teil dieses Editors
- kein weiterer Fachscope wurde angebunden
- keine neue Editor-Architektur wurde eingefuehrt

### Klick-Abnahme-Doku

M37 dokumentiert die manuelle Klick-Abnahme als Pruefliste fuer das echte App-Fenster. Die detaillierte fachliche Klickfolge bleibt durch Nutzer/Fachabnahme zu bestaetigen; die technische Bedienfolge ist durch BBM-Tests flankiert.

## 4. Lueckenliste

### A) Muss ins UI-Editor-kit zurueckgefuehrt werden

Diese Punkte sind im BBM-Pilot bewiesen oder konkret sichtbar, gehoeren aber generisch ins Produkt zurueck:

- Ziel-App-Vertrag v1.0 fuer Scope, Registry, HostAdapter, Layout-Scope und Bedienstatus.
- Klare generische Semantik fuer UI-Scope vs. Layout-Scope.
- Generischer Scope-Wechsel-Vertrag: Auswahl resetten, aktive Registry wechseln, falsche Scope-/Element-Kombination blockieren.
- Generische Status- und Blockadecodes fuer unbekannten Scope, unbekanntes Element, keine Auswahl, Operation nicht erlaubt, Operation gesperrt, Payload nicht layoutneutral.
- HostAdapter-Vertrag erweitern oder dokumentarisch festziehen, ob `resetLayoutState()` und explizite Load/Reset-Flows zum Pflichtvertrag gehoeren.
- Generisches Layout-Change-Payload-Profil: welche neutralen Payloads fuer `move`, `resize`, `width`, `height`, `spacing`, `hide` und `show` erlaubt sind.
- Manifest-Pflicht fuer Ziel-App-Adapter mit Scope, Layoutprofil, Persistence-Modus, Execution-Modus, Risk-Klasse, Rollback und Teststrategie.
- Neutraler Test-Host-/Minimal-Host-Fluss als offizielle Referenz, damit BBM nicht laenger die einzige praktisch sichtbare Referenz bleibt.
- Referenzdoku fuer sichtbare Blockademeldungen, ohne BBM-Texte oder BBM-Scope-Namen zu uebernehmen.
- Abnahmecheckliste fuer Ziel-App-Integrationen: Launcher sichtbar, Registry gueltig, Auswahl, Scope-Wechsel, Save/Load/Reset, Blockaden, Nicht-Ziele.

### B) Bleibt BBM-spezifisch

Diese Punkte duerfen nicht in das generische Kit wandern:

- Scope-Namen `restarbeiten.screen`, `restarbeiten.ui.main` und `protokoll.topsScreen`.
- BBM-Modulnamen, Labels und Registry-Inhalte.
- Restarbeiten-Fachmodul, Restarbeiten-Datenmodell, Restarbeiten-IPC, Restarbeiten-Repository und Restarbeiten-Fachstatus.
- Protokoll-/TOPS-Fachlogik, TOPS-Quicklane-Fachbedeutung, Druck-, Vorschau-, Mail- oder Filteraktionen.
- BBM-spezifische Launcher-Position, Paneltexte und DEV-Kontext-Einbindung.
- BBM-spezifische Layoutspeicher-Implementierung.
- BBM-spezifische Tests wie `bbmUiEditorRuntimeLauncher.test.cjs`, `restarbeitenEditorHostAdapter.test.cjs`, `protokollEditorHostAdapter.test.cjs` und `bbmUiEditorRegistry.test.cjs`.
- Historische UI-Inspector-/Scan-Begriffe und alte BBM-Editor-Versuche.

### C) Bleibt Ziel-App-Verantwortung

Diese Punkte sind nicht Aufgabe des generischen Editors:

- Entscheidung, welche Oberflaechen editorfaehig sind.
- Bewusstes Registrieren von UI-Elementen.
- Stabile IDs, Parent-Struktur und DOM-Markierung der Ziel-App.
- Klassifizierung von Bereichen, Gruppen, Feldern, Buttons, Tabellen, Spalten und Metaspalten.
- Festlegen von `allowedOps` und `lockedOps`.
- Bereitstellen des HostAdapters.
- Pruefen, Anwenden, Speichern, Laden und Zuruecksetzen im Ziel-App-Kontext.
- Trennung von Layoutdaten und Fachdaten.
- Ausschluss fachlicher Aktionen wie Speichern, Loeschen, Drucken, Mail, Upload, Import, Export, Datenbank- oder IPC-Fachaufrufe.
- Fachliche Klick-Abnahme im echten App-Fenster.
- Bewusste Nachregistrierung bestehender UI, falls eine Ziel-App das will.

### D) Spaeteres Produkt-Thema

Diese Punkte sind sinnvoll, aber nicht Teil von M38:

- Vollstaendige generische sichtbare EditorRuntime als Produktoberflaeche.
- Generische Ziel-App-Demo ausserhalb BBM.
- Versionierte Layoutpersistenz als Produktmodul.
- Rollback-/Undo-/Redo-Konzept als Produktfunktion.
- Usability-Standards fuer generische Panels, Bedienhinweise und Statusmeldungen.
- Erweiterte Layoutoperationen jenseits der aktuell bewiesenen neutralen Operationen.
- Release-Gate fuer produktive Ziel-App-Freigaben.
- Migration alter Ziel-App-Registries, falls spaeter bewusst beauftragt.
- PDF-Editor-Produktpfad. M38 baut keine PDF-Funktion.

## 5. Konkreter Folgeschritt

Empfehlung:

**M39 = Ziel-App-Vertrag v1.0 im UI-Editor-kit festziehen.**

M39 sollte nicht BBM nachbauen. M39 sollte den generischen Vertrag im Produktrepo festschreiben:

- Pflichtstruktur einer Ziel-App-Registry
- Pflichtstruktur eines HostAdapters
- UI-Scope/Layout-Scope-Beziehung
- ChangeRequest- und Layout-Payload-Grenzen
- Save/Load/Reset-Verantwortung
- Status- und Blockadecodes
- Adapter-Manifest als verbindlicher Steckbrief
- Ziel-App-Abnahmecheckliste
- klare Nicht-Ziele: kein Scan, keine automatische Erkennung, keine automatische Registry-Befuellung, keine Fachlogik, keine PDF-/Druck-/Mail-/Audio-Funktion

BBM bleibt dafuer nur Referenznachweis. Das Produkt bleibt das `UI-Editor-kit`.
