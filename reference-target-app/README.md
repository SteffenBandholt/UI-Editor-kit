# Referenz-Ziel-App – M73.4

`reference-target-app/` enthält die native C#-/WPF-Referenzanwendung auf .NET 10. M73.4 bindet den vorhandenen Node.js-Editor-Kern als explizit gestarteten lokalen Unterprozess an die unveränderte M73.2-Registry und den nativen HostAdapter aus M73.3 an. Die normale sichtbare Oberfläche, die Fachdaten und die fachlichen Aktionen bleiben unverändert.

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
│  ├─ ReferenceTargetApp.EditorIntegration/  Registry, HostAdapter, Prozessprotokoll und Sessionkoordination
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

## Verbindliche Grenze von M73.4

M73.4 stellt zusätzlich nur den lokalen Node-Unterprozess, Protokoll `1.0`, kontrollierte Aktivierung/Deaktivierung, genau eine Session, fachneutrale Registry-/Layoutübertragung und den ChangeRequest-/ChangeResult-Weg zum vorhandenen HostAdapter bereit. Es existieren ausdrücklich:

- kein dauerhafter Layoutspeicher und kein Laden nach Neustart;
- keine dauerhafte Session, keine Selektion und kein sichtbares Editorfenster;
- kein HTTP, WebSocket, Netzwerkdienst oder anderes Transportprotokoll neben lokalem JSONL über `stdin`/`stdout`;
- keine Ziel-App-Auswahl, kein Windows-Manager und keine PDF-Funktion;
- keine automatische Registrierung und keine Visual-Tree-Heuristik;
- keine Browser-, HTML-, DOM-, Electron- oder WebView-Lösung.

## Offen für den nächsten Schritt und spätere Meilensteine

Dauerhafte Layoutspeicherung, Wiederherstellung nach Neustart und die weitere technische M73-Vervollständigung bleiben dem nächsten ausdrücklichen Schritt vorbehalten. Eine sichtbare Editoroberfläche bleibt M74 vorbehalten.
