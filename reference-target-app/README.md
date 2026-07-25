# Referenz-Ziel-App – M73.3

`reference-target-app/` enthält die native C#-/WPF-Referenzanwendung auf .NET 10. M73.3 ergänzt für die unveränderte M73.2-Registry des Bereichs „Auftragskopf“ einen echten nativen HostAdapter. Die normale sichtbare Oberfläche, die Fachdaten und die fachlichen Aktionen bleiben unverändert.

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

## Voraussetzungen

- Windows 10 oder Windows 11
- .NET SDK 10 mit `Microsoft.WindowsDesktop.App` 10
- Node.js und npm nur für die unveränderten Prüfungen des übergeordneten UI-Editor-Kits

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
│  ├─ ReferenceTargetApp.EditorIntegration/  UI-Registry, neutrale Modelle und nativer HostAdapter
│  └─ ReferenceTargetApp.Wpf/                native Oberfläche und explizite Adapter-Anbindung
└─ tests/
   └─ ReferenceTargetApp.Tests/               Fachmodell-, Registry- und WPF-Integrationstests
```

Die Abhängigkeitsrichtung bleibt klein:

```text
ReferenceTargetApp.Wpf ──> EditorIntegration (WPF-Registry und HostAdapter, ohne Domain-Abhängigkeit)
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

## Verbindliche Grenze von M73.3

M73.3 stellt nur den nativen HostAdapter, neutrale Änderungs-/Ergebnismodelle, aktuelles Layoutlesen, kontrolliertes Anwenden und unmittelbaren Rollback für den registrierten Auftragskopf bereit. Es existieren ausdrücklich:

- kein dauerhafter Layoutspeicher und kein Laden nach Neustart;
- keine Editor-Session, keine Selektion und kein sichtbares Editorfenster;
- kein Node-Prozess, keine JSON-Zeilen-Kommunikation und kein Prozesslebenszyklus;
- keine Ziel-App-Auswahl, kein Windows-Manager und keine PDF-Funktion;
- keine automatische Registrierung und keine Visual-Tree-Heuristik;
- keine Browser-, HTML-, DOM-, Electron- oder WebView-Lösung.

## Offen für M73.4 und spätere Meilensteine

Prozesskommunikation, Editoraktivierung, Sessionsteuerung, dauerhafte Layoutspeicherung, Wiederherstellung nach Neustart und sichtbare Editoroberflächen bleiben ihren ausdrücklich freizugebenden späteren Meilensteinen vorbehalten.
