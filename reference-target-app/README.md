# Referenz-Ziel-App – M73.1

`reference-target-app/` enthält das belastbare Grundgerüst der neuen nativen Windows-Referenzanwendung. Die Anwendung ist eine echte C#-/WPF-Desktop-App auf .NET 10 und zeigt einen realistischen Beispielauftrag mit Auftragskopf, Kundendaten, Eingabefeldern, gruppierten Bereichen, Positionstabelle, Summen, Status und fachlichen Beispielaktionen.

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
│  ├─ ReferenceTargetApp.Wpf/                native Oberfläche, ViewModel und fachliche UI-Aktionen
│  └─ ReferenceTargetApp.EditorIntegration/  reservierte, noch funktionslose Prozessgrenze
└─ tests/
   └─ ReferenceTargetApp.Tests/               Fachmodell- und Architekturtests
```

Die Abhängigkeitsrichtung ist bewusst klein:

```text
ReferenceTargetApp.Wpf ──> Infrastructure ──> Domain
           └───────────────────────────────> Domain

EditorIntegration   (in M73.1 isoliert und von der WPF-App nicht referenziert)
Tests ────────────────> Infrastructure + Domain
```

Fachdaten liegen ausschließlich als Domainobjekte vor. Es gibt in M73.1 keine Layoutdaten. Der für spätere Layout- und Editornachrichten reservierte Integrationsbereich ist strukturell vom Fachmodell getrennt.

## Bauen

Vom Repository-Stamm:

```powershell
dotnet build reference-target-app
```

## Testen

```powershell
dotnet test reference-target-app
```

Die Tests prüfen insbesondere, dass das Fachmodell ohne WPF gebaut wird, keine Abhängigkeit zum UI-Editor-Kit oder Integrationsprojekt besitzt und vollständige Beispieldaten samt Summen erzeugt werden können. Der Solution-Build ist der automatisierte Buildnachweis für alle Projekte einschließlich WPF.

## Starten

```powershell
dotnet run --project reference-target-app/src/ReferenceTargetApp.Wpf/ReferenceTargetApp.Wpf.csproj
```

Die Buttons führen ausschließlich lokale fachliche Beispielaktionen aus. „Im Arbeitsspeicher sichern“ schreibt bewusst keine Datei oder Layoutdaten.

## Verbindliche Grenze von M73.1

Entwurfsentscheidung für diesen Teilschritt:

- Art der Ausgabe: native Windows-UI;
- editorfähig in M73.1: nein;
- editorfähige Bereiche, Gruppen, Tabellen, Spalten, Buttons und Felder: noch keine;
- Registry und Klassifizierung: erst in M73.2 nach eigener vollständiger Entwurfsentscheidung;
- fachliche Buttons: normale Beispielaktionen, niemals Editoroperationen;
- PDF: nicht Bestandteil.

Der Ordner `ReferenceTargetApp.EditorIntegration` definiert nur die spätere Zuständigkeit für eine lokale, versionierte JSON-Zeilen-Kommunikation über `stdin`/`stdout`. In M73.1 wird kein Node-Prozess gestartet und es existieren ausdrücklich:

- keine UI-Registry und keine automatische Registrierung;
- kein HostAdapter;
- kein Layoutspeicher und keine Layoutänderung;
- keine Editor-Session und kein sichtbares Editorfenster;
- keine Ziel-App-Auswahl, kein Windows-Manager und keine PDF-Funktion;
- keine Browser-, HTML-, DOM-, Electron- oder WebView-Lösung.

## Offen für M73.2

M73.2 muss vor der Implementierung die vollständige Editor-Entwurfsentscheidung für den ersten UI-Bereich festlegen. Danach folgen erst die explizite Registry, native Elementreferenzen, ein echter HostAdapter, die versionierte JSON-Zeilen-Schnittstelle zum vorhandenen Node.js-Kern, kontrollierter Prozesslebenszyklus und die zugehörigen Vertrags- und Integrationstests. Layoutspeicherung oder sichtbare Editoroberflächen bleiben an ihren jeweils freigegebenen Meilenstein gebunden.
