# Referenz-Ziel-App – M73 abgeschlossen mit M73.5

`reference-target-app/` enthält die native C#-/WPF-Referenzanwendung auf .NET 10. M73.1 bis M73.5 stellen Grundgerüst, explizite Registry, nativen HostAdapter, lokalen Node-Prozess mit Sessionsteuerung sowie ziel-app-eigene Layoutpersistenz und Wiederherstellung nach Neustart bereit. Die normale sichtbare Oberfläche, die Fachdaten und die fachlichen Aktionen bleiben unverändert.

## Entwurfsentscheidung M73.2

Die Registry wird erst im `Loaded`-Ereignis des WPF-Hauptfensters aus ausdrücklich benannten nativen Controls aufgebaut. Es gibt keine Visual-Tree-Suche, keine Heuristik und keine automatische Registrierung. Die Einträge und ihre Abfragen sind nach dem Aufbau unveränderlich.

Der erste Registry-Umfang besteht exakt aus:

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

Kundendaten, Positionstabelle, Summenbereich und fachliche Buttons sind ausdrücklich nicht registriert. Eine Registry-Abfrage liest nur Metadaten und native Referenzen; sie löst keine fachliche Aktion und keine Layoutänderung aus.

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

## Verbindliche Grenze nach Abschluss von M73

M73 stellt ausschließlich die technische Anbindung der Referenz-Ziel-App einschließlich lokalem Prozess-/Sessionweg und einem dauerhaften lokalen Layoutprofil bereit. Es existieren ausdrücklich:

- keine dauerhafte Session, keine Selektion und kein sichtbares Editorfenster;
- kein HTTP, WebSocket, Netzwerkdienst oder anderes Transportprotokoll neben lokalem JSONL über `stdin`/`stdout`;
- keine Ziel-App-Auswahl, kein Windows-Manager und keine PDF-Funktion;
- keine automatische Registrierung und keine Visual-Tree-Heuristik;
- keine Browser-, HTML-, DOM-, Electron- oder WebView-Lösung.

## Offen ab M74 und in späteren Meilensteinen

Eine sichtbare native Editoroberfläche mit Elementbaum, Details, Modi und Bedienung bleibt vollständig M74 vorbehalten. Reset/Discard-Bedienung, mehrere Profile und mehrere Scopes bleiben M75 vorbehalten; PDF beginnt erst mit M76.
