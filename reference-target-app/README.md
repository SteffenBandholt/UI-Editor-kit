# Referenz-Ziel-App – M73.2

`reference-target-app/` enthält die native C#-/WPF-Referenzanwendung auf .NET 10. M73.2 ergänzt ausschließlich eine explizite, lesbare UI-Registry für den ersten freigegebenen Bereich „Auftragskopf“. Die sichtbare Oberfläche, die Fachdaten und die fachlichen Aktionen bleiben unverändert.

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
│  ├─ ReferenceTargetApp.EditorIntegration/  UI-Registry, Validierung und sichere Diagnostik
│  └─ ReferenceTargetApp.Wpf/                native Oberfläche und explizite Control-Zuordnung
└─ tests/
   └─ ReferenceTargetApp.Tests/               Fachmodell-, Registry- und WPF-Integrationstests
```

Die Abhängigkeitsrichtung bleibt klein:

```text
ReferenceTargetApp.Wpf ──> EditorIntegration (WPF-Registry, ohne Domain-Abhängigkeit)
           ├─────────────> Infrastructure ──> Domain
           └────────────────────────────────> Domain

Tests ──> Wpf + EditorIntegration + Infrastructure + Domain
```

Fachdaten liegen ausschließlich in `Domain`; Registry-Metadaten und native WPF-Referenzen ausschließlich in `EditorIntegration`. Es gibt weiterhin keine Layoutdaten.

## Bauen, testen und starten

Vom Repository-Stamm:

```powershell
dotnet build reference-target-app
dotnet test reference-target-app
dotnet run --project reference-target-app/src/ReferenceTargetApp.Wpf/ReferenceTargetApp.Wpf.csproj
```

Die Buttons führen ausschließlich lokale fachliche Beispielaktionen aus. „Im Arbeitsspeicher sichern“ schreibt bewusst keine Datei oder Layoutdaten.

## Verbindliche Grenze von M73.2

M73.2 stellt nur Registry-Metadaten, native Elementreferenzen, unveränderliche Abfragen, Validierung und sichere Diagnostik für den Auftragskopf bereit. Es existieren ausdrücklich:

- kein HostAdapter und keine Anwendung von Editoroperationen;
- kein Layoutspeicher und keine Layoutänderung;
- keine Editor-Session, keine Selektion und kein sichtbares Editorfenster;
- kein Node-Prozess, keine JSON-Zeilen-Kommunikation und kein Prozesslebenszyklus;
- keine Ziel-App-Auswahl, kein Windows-Manager und keine PDF-Funktion;
- keine automatische Registrierung und keine Visual-Tree-Heuristik;
- keine Browser-, HTML-, DOM-, Electron- oder WebView-Lösung.

## Offen für M73.3 und spätere Meilensteine

Ein späterer, ausdrücklich freigegebener Meilenstein kann den HostAdapter und die kontrollierte Übersetzung bereits definierter Editoroperationen ergänzen. Prozesskommunikation, Editor-Session, Layoutanwendung, Layoutspeicherung und sichtbare Editoroberflächen bleiben ihren jeweiligen späteren Meilensteinen vorbehalten.
