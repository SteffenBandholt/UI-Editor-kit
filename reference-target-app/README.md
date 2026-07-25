# Referenz-Ziel-App – M77 gemeinsamer nativer UI-/PDF-Editor

`reference-target-app/` enthält die native C#-/WPF-Referenzanwendung auf .NET 10. M73 stellt Anbindung und Persistenz bereit, M74 die sichtbare native Editoroberfläche. M75 vervollständigt darauf den praktischen UI-Betrieb mit zwei Scopes, zwei Profilen, Save, Load, Verwerfen, Reset, direkter App-Auswahl und Neustart-Restore; Fachdaten und fachliche Aktionen bleiben unverändert.

## Entwurfsentscheidung M73.2

Die Registry wird erst im `Loaded`-Ereignis des WPF-Hauptfensters aus ausdrücklich benannten nativen Controls aufgebaut. Es gibt keine Visual-Tree-Suche, keine Heuristik und keine automatische Registrierung. Die Einträge und ihre Abfragen sind nach dem Aufbau unveränderlich.

Der erste Registry-Umfang aus M73.2 besteht aus:

| Element-ID | Parent-ID | Typ | erlaubte Fähigkeiten |
| --- | --- | --- | --- |
| `ui.order-header` | – | Bereich/Scope | keine |
| `ui.order-header.group.core` | `ui.order-header` | Gruppe | Position, Breite, Höhe |
| `ui.order-header.order-number` | `ui.order-header.group.core` | Eingabefeld | Position, Breite, Höhe, Textposition, Schriftgröße |
| `ui.order-header.order-date` | `ui.order-header.group.core` | Eingabefeld | Position, Breite, Höhe, Textposition, Schriftgröße |
| `ui.order-header.due-date` | `ui.order-header.group.core` | Eingabefeld | Position, Breite, Höhe, Textposition, Schriftgröße |
| `ui.order-header.subject` | `ui.order-header.group.core` | Eingabefeld | Position, Breite, Höhe, Textposition, Schriftgröße |
| `ui.order-header.responsible-person` | `ui.order-header.group.core` | Eingabefeld | Position, Breite, Höhe, Textposition, Schriftgröße |
| `ui.order-header.status` | `ui.order-header` | Statusanzeige | Position, Breite, Höhe, Textposition, Schriftgröße |

Die Parent-/Child-Struktur ist damit:

```text
ui.order-header
├─ ui.order-header.group.core
│  ├─ ui.order-header.order-number
│  ├─ ui.order-header.order-date
│  ├─ ui.order-header.due-date
│  ├─ ui.order-header.subject
│  └─ ui.order-header.responsible-person
└─ ui.order-header.status
```

M75 ergänzt als zweiten echten Scope `ui.customer-details` mit eigener Gruppe, Unternehmen, Ansprechperson, E-Mail, Straße, PLZ/Ort und dem ausdrücklich registrierten Button `ui.customer-details.check-customer`. Positionstabelle, Summenbereich und alle übrigen fachlichen Buttons bleiben unregistriert. Eine Registry-Abfrage liest nur Metadaten und native Referenzen; sie löst keine fachliche Aktion und keine Layoutänderung aus.

## HostAdapter-Entscheidung M73.3

Die C#-Schnittstelle `IHostAdapter` bildet den vorhandenen Node-Vertrag eindeutig ab:

- `GetRegistry()` stellt exakt die M73.2-Registry bereit;
- `GetCurrentLayoutState()` liest den aktuellen neutralen Zustand aller registrierten Elemente;
- `SubmitChangeRequest()` validiert und wendet genau einen neutralen Änderungsauftrag atomar an.

Die aktuelle Node-Runtime hat bei den Operationsnamen Vorrang. Alle Zahlen sind WPF-unabhängige Device Independent Pixels (1/96 Zoll):

| Bedeutung | Operation | Payload |
| --- | --- | --- |
| Position | `move` | `{ "x": Zahl, "y": Zahl }`, mindestens eine Achse |
| Breite | `resizeWidth` | `{ "width": positive Zahl }` |
| Höhe | `resizeHeight` | `{ "height": positive Zahl }` |
| Breite/Höhe kombiniert | `resize` | `{ "width": positive Zahl, "height": positive Zahl }`, mindestens eine Achse |
| Textposition | `textMove` | `{ "text": { "offsetX": nicht-negative Zahl, "offsetY": nicht-negative Zahl } }`, mindestens eine Achse |
| Schriftgröße | `textResize` | `{ "text": { "fontSize": positive Zahl } }` |

Die WPF-Abbildung ist reproduzierbar und ändert das bestehende Grid nicht:

- Position wird relativ über einen `TranslateTransform` des registrierten Controls abgebildet.
- Breite und Höhe werden kontrolliert über `FrameworkElement.Width` beziehungsweise `Height` gesetzt; bei `Auto` wird der aktuelle `ActualWidth`-/`ActualHeight`-Wert gelesen.
- Textposition verwendet bei den registrierten TextBoxen und der Statusanzeige deren `Padding` links/oben.
- Schriftgröße verwendet `Control.FontSize`; bei der Statusanzeige wird die vererbbare WPF-Textgröße gesetzt.

Jeder Auftrag wird vollständig auf Pflichtfelder, bekannte Operation, Scope, Registry-Fähigkeit, Payload-Felder, endliche Zahlen, zulässige Größen, native Referenz und Dispatcher-Verfügbarkeit geprüft. Fachfelder werden als `forbidden_field` abgewiesen; unbekannte Elemente, falsche Scopes, unzulässige Operationen und ungültige Payloads erhalten fachneutrale Fehlercodes.

Vor dem Anwenden wird der vollständige native Rohzustand des Zielelements gesichert. Schlägt Anwenden oder anschließendes Lesen fehl, stellt der Adapter diesen Zustand unmittelbar wieder her und meldet das Ergebnis strukturiert. Dies ist nur transaktionale Sicherung eines einzelnen Auftrags, kein Undo-Speicher.

Alle WPF-Lese- und Schreibzugriffe laufen auf dem Dispatcher des nativen Controls. Aufrufe von anderen Threads werden synchron und ohne zusätzliche Session auf diesen Dispatcher geleitet.

Für den programmgesteuerten Sichtnachweis kann die App ausdrücklich mit `--host-adapter-diagnostic` gestartet werden. Der Schalter führt nach `Loaded` genau einen nicht persistenten `textResize`-Auftrag für `ui.order-header.order-number` aus. Er ergänzt keinen UI-Button, ändert keinen Fachwert und ist bei normalem Start wirkungslos.

## Lokale Prozess- und Sessionarchitektur M73.4

Der produktive Node-Einstiegspunkt ist `src/process/editor-process-entry.cjs`. Er verwendet direkt die vorhandenen Module für Registry, Editor-Core, ChangeRequest-Prüfung, LayoutState und SessionState. Die WPF-App startet ihn ausschließlich auf explizite Aktivierung als Unterprozess ohne Shellfenster, mit festem Arbeitsverzeichnis und umgeleitetem `stdin`, `stdout` und `stderr`. Es gibt kein Netzwerkprotokoll.

Das JSON-Zeilenprotokoll hat die feste Version `1.0`. Jede Zeile enthält genau eine Nachricht mit `protocolVersion`, `messageId`, `messageType`, `timestamp`, optionaler `sessionId`, optionalem `replyTo` und einem Objekt `payload`. Die Zustandsfolge lautet:

```text
handshake → handshakeAccepted
activate → activated
startSession → requestRegistry
registry → requestLayoutState
layoutState → sessionStarted
diagnostic → submitChangeRequest
changeResult → changeResultAccepted
endSession → sessionEnded
deactivate → deactivated
shutdown → shutdownComplete
```

Der Node-Core prüft die fachneutral serialisierte Registry und den LayoutState. Native WPF-Referenzen werden nicht serialisiert. Ein `submitChangeRequest` wird in das bestehende C#-Modell übersetzt und ausschließlich an `WpfHostAdapter.SubmitChangeRequest()` weitergereicht; `changeResult` bringt dessen strukturiertes Ergebnis zum Node-Prozess zurück. Es existiert genau eine aktive Session. Doppelte Aktivierung ist idempotent, eine zweite Session wird abgewiesen.

Prozessstart, Handshake, Aktivierung, Sessionstart/-ende, Deaktivierung und Shutdown besitzen begrenzte Timeouts. `stdout` wird asynchron als Protokoll gelesen, `stderr` separat und begrenzt als Diagnose. Ungültiges JSON, unbekannte oder doppelte Antworten, falsche Sessionzuordnung und inkompatible Versionen werden strukturiert behandelt. Bei Timeout oder App-Ende wird der genaue Prozess nach kurzer Shutdownfrist beendet; es gibt keinen automatischen Neustart.

Der vollständige programmgesteuerte Nachweis ist:

```powershell
dotnet run --project reference-target-app/src/ReferenceTargetApp.Wpf/ReferenceTargetApp.Wpf.csproj -- --editor-process-diagnostic
```

Er startet Node, aktiviert den Kern, eröffnet eine Session, überträgt Registry und LayoutState, lässt Node genau einen neutralen `resizeWidth`-Auftrag für die registrierte Auftragsnummer senden, gibt das Adapterergebnis zurück und beendet Session sowie Prozess wieder. Die Breitenänderung bleibt nur im laufenden WPF-Prozess; es wird nichts gespeichert. Ein Normalstart startet keinen Node-Prozess.

## Dauerhafter Layoutspeicher M73.5

Die Ziel-App besitzt genau ein lokales Profil `order-header-default` für den Scope `ui.order-header`. Der Produktionspfad lautet:

```text
%LOCALAPPDATA%\UI-Editor-kit\ReferenceTargetApp\layouts\order-header-default.layout.json
```

Das versionierte JSON-Dokument (`schemaVersion: 1`) enthält `applicationId`, `profileId`, `scopeId`, `savedAt`, einen SHA-256-Registry-Fingerprint und den neutralen LayoutState. Der Fingerprint wird stabil aus Element-ID, Scope, Parent-ID, Elementart und sortierten Capabilities gebildet. Anzeigenamen, native Referenzen und Fachwerte werden nicht einbezogen.

Vor Save und Load werden Dokumentstruktur, Profilzuordnung, Registry-Kompatibilität, vollständige registrierte Elementmenge, erlaubte Felder und Capabilities sowie endliche und zulässige Zahlen geprüft. Das Schreiben erfolgt über eine temporäre Datei im selben Ordner mit Flush auf den Datenträger und anschließendem kontrolliertem Replace. Eine vorhandene gültige Datei bleibt bei Schreibfehlern unverändert.

Beim normalen Start wird nach `Loaded` zuerst die Registry und danach der bestehende `WpfHostAdapter` aufgebaut. Eine vorhandene gültige Datei wird dann vollständig validiert und atomar reapplied. Alle Einzeländerungen und der Gesamtrollback laufen ausschließlich über `IHostAdapter.SubmitChangeRequest`. Eine fehlende Datei ist ein normaler Erststart; beschädigte oder inkompatible Dateien blockieren die App nicht und ändern das Ausgangslayout nicht. Der Normalstart startet weiterhin keinen Node-Prozess.

Der echte Zwei-Prozess-Nachweis lautet:

```powershell
dotnet run --project reference-target-app/src/ReferenceTargetApp.Wpf/ReferenceTargetApp.Wpf.csproj -- --layout-persistence-diagnostic
```

Der Diagnoseprozess verwendet ein isoliertes Profil unter LocalApplicationData, startet einen ersten echten WPF-Prozess zum Ändern und Speichern und erst nach dessen Ende einen zweiten WPF-Prozess. Dieser stellt das Layout über den normalen Startup-Pfad wieder her, prüft die sichtbare Geometrie, den unveränderten Fachwert und den bestehenden Button-/Statusfluss und entfernt danach Datei, Hilfsdaten und Diagnoseordner.

## Native Editoroberfläche M74

Der Button `UI bearbeiten` öffnet ein nichtmodales natives WPF-Fenster für genau den Registry-Scope `ui.order-header`. Pro Ziel-App-Instanz existiert höchstens ein Editorfenster: Ein erneuter Klick aktiviert das vorhandene Fenster, ohne einen zweiten Node-Prozess oder eine zweite Session zu starten.

Das Fenster zeigt links den ausschließlich aus der Registry aufgebauten Baum mit allen acht Elementen. Rechts stehen neutrale Elementdetails einschließlich ID, Art, Scope, Parent, Rolle, erlaubten Operationen sowie aktueller Element- und Textgeometrie. Die Bearbeitung verwendet die vorhandenen M70-/M72-Panelmodelle für:

- Ebene `ELEMENT`: Verschieben, Breite und Höhe;
- Ebene `TEXT`: Textposition und Schriftgröße;
- positive endliche Schrittweite in DIP, mit deutscher oder invarianter Dezimalschreibweise;
- Richtungstasten: Position und Textposition auf allen vier Achsen, Breite mit links/rechts, Höhe mit oben/unten, Schriftgröße mit links kleiner/rechts größer.

Nicht erlaubte Ebenen, Modi und Richtungen sind deaktiviert und bleiben zusätzlich im Node-Core und im HostAdapter validiert. Ein Klick erzeugt genau einen neutralen `ChangeRequest`. Die Kette lautet:

```text
EditorWindow -> vorhandener Panelcontroller/ViewModels -> JSONL-Prozesssession
             -> ChangeRequest -> WpfHostAdapter -> ChangeResult -> aktualisierte Details
```

Das Editorfenster schreibt keine WPF-Layoutproperty direkt. Es ändert keine Feldtexte, speichert keine Fachwerte und löst keinen Fachcommand aus. Status und strukturierte Fehler erscheinen im unteren Fensterbereich. Während eines Requests sind weitere Richtungsaktionen gesperrt.

Schließen per Button oder X beendet zuerst die Session und anschließend den Node-Prozess; die Ziel-App bleibt geöffnet. Beim Beenden der Ziel-App wird ein offener Editor auf demselben Weg aufgeräumt. Danach kann der Editor erneut geöffnet werden.

Der sichtbare End-to-End-Nachweis ist:

```powershell
dotnet run --project reference-target-app/src/ReferenceTargetApp.Wpf/ReferenceTargetApp.Wpf.csproj -- --editor-ui-diagnostic
```

Er öffnet echte WPF-Fenster, prüft einen Node-Prozess und eine Session, Baum und Details, alle fünf M74-Operationen, eine deaktivierte Capability, unveränderte Fachwerte, den normalen Fachbutton, Schließen und Wiederöffnen sowie vollständiges Prozessende.

M75 ergänzt die zuvor bewusst ausgesparten Save-, Load-, Discard- und Reset-Funktionen sowie mehrere Profile und Scopes. PDF-, Manager-, Browser- und Netzwerkfunktionen bleiben ausgeschlossen.

## Voraussetzungen

- Windows 10 oder Windows 11
- .NET SDK 10 mit `Microsoft.WindowsDesktop.App` 10
- Node.js für die explizite lokale Prozessaktivierung sowie npm für die Prüfungen des übergeordneten UI-Editor-Kits

Prüfen:

```powershell
dotnet --list-sdks
dotnet --list-runtimes
```

## Projektstruktur

```text
reference-target-app/
├─ ReferenceTargetApp.slnx
├─ src/
│  ├─ ReferenceTargetApp.Domain/             reines Fachmodell ohne WPF- oder Editor-Abhängigkeit
│  ├─ ReferenceTargetApp.Infrastructure/     Erzeugung realistischer In-Memory-Beispieldaten
│  ├─ ReferenceTargetApp.EditorIntegration/  Registry, HostAdapter, Prozess/Session und lokale Layoutpersistenz
│  ├─ ReferenceTargetApp.PdfRendering/       gekapselte lokale PDFsharp-Zeichenschicht
│  ├─ ReferenceTargetApp.PdfPreview/         native Windows-PDF-Seitenvorschau und Hit-Testing
│  └─ ReferenceTargetApp.Wpf/                native Oberfläche und explizite Adapter-Anbindung
└─ tests/
   └─ ReferenceTargetApp.Tests/               Fachmodell-, Registry- und WPF-Integrationstests
```

Die Abhängigkeitsrichtung bleibt klein:

```text
ReferenceTargetApp.Wpf ──> EditorIntegration (Registry, HostAdapter und lokale Prozessanbindung)
           ├─────────────> Infrastructure ──> Domain
           └────────────────────────────────> Domain

Tests ──> Wpf + EditorIntegration + Infrastructure + Domain
```

Fachdaten liegen ausschließlich in `Domain`; Registry-Metadaten, neutrale Layoutzustände und native WPF-Abbildung ausschließlich in `EditorIntegration`. Layoutzustände enthalten keine Feldtexte, Statuswerte, Commands oder anderen Fachwerte.

## Bauen, testen und starten

Vom Repository-Stamm:

```powershell
dotnet build reference-target-app
dotnet test reference-target-app
dotnet run --project reference-target-app/src/ReferenceTargetApp.Wpf/ReferenceTargetApp.Wpf.csproj
```

Die Buttons führen ausschließlich lokale fachliche Beispielaktionen aus. „Im Arbeitsspeicher sichern“ schreibt bewusst keine Datei oder Layoutdaten.

## M75-Zustands- und Bedienmodell

- `BASELINE` ist das unveränderte Layout beider Ziel-App-Registries vor jedem Restore und die Quelle für Reset.
- `SAVED` ist die zuletzt erfolgreich gespeicherte oder vollständig geladene Version des aktiven Profils und die Quelle für Verwerfen.
- `WORKING` ist der aktuell sichtbare, scopeübergreifend erfasste Zustand; numerisch normalisierte Abweichungen bestimmen den Dirty-Status.
- `LOADED` wird erst nach vollständiger Validierung und erfolgreicher atomarer Anwendung aller Scopes übernommen.

`Speichern` erfasst und validiert beide Scopes und ersetzt genau eine Profildatei atomar. `Laden` liest diese Datei erneut vom Datenträger. Einzelaktionen betreffen genau eine registrierte Element-ID; Gesamtaktionen sichern beide Scopes und rollen bei jedem Adapterfehler vollständig zurück. Verwerfen ändert zurück auf `SAVED`, Reset zurück auf `BASELINE` und überschreibt die Datei erst durch ein späteres Speichern.

Die festen Profile `standard` und `compact` besitzen getrennte Schema-2-Dateien. `active-layout-profile.json` hält die aktive Wahl benutzerspezifisch. Der Normalstart baut beide Registries auf, validiert das aktive Profil und stellt beide Scopes atomar ohne Node-Prozess wieder her. Eine vorhandene M73.5-Schema-1-Datei wird kontrolliert als Altformat erkannt und nicht still migriert.

Die native Scopewahl umfasst `ui.order-header` und `ui.customer-details`. Die Baumwahl und der Modus `In App auswählen` liefern ausschließlich registrierte neutrale IDs. Im Auswahlmodus werden Klicks auf geschützte Fachbuttons abgefangen; nach Abbruch arbeitet der Fachbutton wieder normal. Dirty-Profilwechsel und Dirty-Schließen sind geschützt; der Schließen-Dialog bietet Speichern, ohne Speichern und Abbrechen.

Der praktische Nachweis `ReferenceTargetApp.exe --ui-full-operation-diagnostic` verwendet echte sichtbare WPF-Fenster, einen Node-Prozess je geöffnetem Editorfenster und zwei nacheinander gestartete Ziel-App-Prozesse. Er prüft beide Scopes und Profile, alle sechs Speicher-/Verwerfen-/Resetaktionen, App-Auswahl und Commandschutz, die drei Schließen-Wege, Neustart-Restore sowie einen provozierten scopeübergreifenden Rollback. Isolierte Diagnosedateien werden abschließend entfernt.

## Verbindliche Grenze nach Abschluss von M75

M73 stellt die technische Anbindung bereit; M74 das native Editorfenster; M75 den vollständigen Layoutbetrieb für die zwei explizit registrierten Scopes. Es existieren ausdrücklich:

- keine dauerhafte Session außerhalb eines geöffneten Editorfensters;
- kein HTTP, WebSocket, Netzwerkdienst oder anderes Transportprotokoll neben lokalem JSONL über `stdin`/`stdout`;
- keine automatische Ziel-App-Erkennung, kein Windows-Manager und keine PDF-Funktion;
- keine automatische Registrierung und keine Visual-Tree-Heuristik;
- keine Browser-, HTML-, DOM-, Electron- oder WebView-Lösung.

## Abgenommener gemeinsamer UI-/PDF-Betrieb M77

Das einzelne native Editorfenster besitzt die zustandserhaltenden Arbeitsbereiche `Programmoberfläche` und `PDF-Ausgabe`. Der M75-UI-Ablauf und seine einzige Node-Session bleiben unverändert aktiv. Der PDF-Bereich zeigt alle erzeugten Seiten, die 26 Einträge der M76-Registry, neutrale Details, capability-gesteuerte Element-/Textmodi, sechs Spalten sowie Header und Footer. Save, Load, Einzel-/Gesamtverwerfen und Einzel-/Gesamtreset verwenden die bestehende M76-Session und das getrennte Profil `pdf-standard`.

Die Vorschau wird lokal über die in Windows enthaltene API `Windows.Data.Pdf` direkt aus der echten PDF-Ausgabedatei in Speicherbitmaps gerendert. Es gibt keine zusätzliche Bibliothek oder Lizenz. Der PDF-Renderer liefert neutrale Bounds aus demselben Layoutlauf; Baumwahl und Klick in der Vorschau synchronisieren Seite, Details und ein rein visuelles WPF-Overlay. Layout-Dirty und Vorschau aktuell/veraltet bleiben getrennt. Der Schließdialog nennt ungespeicherte UI-/PDF-Bereiche und der Startup-Restore stellt beide Profilarten wieder her.

Der praktische Nachweis lautet `ReferenceTargetApp.exe --ui-pdf-end-to-end-diagnostic`. Er verwendet zwei echte WPF-Prozesse, den echten Node-Prozess, echte Profile und mehrseitige PDFs und entfernt anschließend sämtliche Diagnoseartefakte. M78 ist der nächste offene Meilenstein; Windows-Manager und M79-Registrationslauf wurden nicht vorgezogen.

## PDF-Grundmodell und Erzeugung M76

Die PDF-Integration ist additiv und vom M75-UI-Betrieb getrennt:

- `EditorIntegration/Pdf` enthält das neutrale A4-Modell in Millimetern, die Registry mit 26 `pdf.order-document`-Elementen, Validatoren, Fingerprint, LayoutState, eigenen HostAdapter, Zustandskoordination und das Schema-1-Profil `pdf-standard`.
- `PdfRendering` kapselt ausschließlich PDFsharp 6.2.4 (MIT) und wandelt Millimeter zentral in PDF-Punkte um. Domain besitzt weiterhin keine PDF-, JSON-, Datei-, Prozess- oder Editorabhängigkeit.
- PDF-Profile liegen unter `%LOCALAPPDATA%\UI-Editor-kit\ReferenceTargetApp\pdf-layouts\` und können UI-Profile weder überschreiben noch laden.
- Die Ausgabe enthält reales A4, Vektorlogo, Firmen-/Kundendaten, sechs Tabellenspalten, deutsche Eurobeträge, Summen, wiederholten Header/Tabellenkopf/Footer und Seitenzahlen. Tabellenzeilen werden nicht geteilt; der Summenblock wechselt bei Bedarf vollständig auf die nächste Seite.
- Save, Load, Discard, Reset, Dirty-State und vollständiger Batchrollback arbeiten auf dem neutralen Modell. Layoutprofile enthalten keine Fachwerte.

Der programmgesteuerte Realnachweis ist:

```powershell
dotnet build reference-target-app
reference-target-app\src\ReferenceTargetApp.Wpf\bin\Debug\net10.0-windows\ReferenceTargetApp.exe --pdf-model-diagnostic
```

Er erzeugt und öffnet technisch geprüfte Mehrseiten-PDFs, belegt Änderungen an Position, Breite, Höhe, Textposition und Schriftgröße, prüft Save/Load/Discard/Reset sowie Fehlerrollback und löscht danach alle Diagnoseartefakte. Der Normalstart zeigt keine PDF-Funktion und startet keinen Node-Prozess.
