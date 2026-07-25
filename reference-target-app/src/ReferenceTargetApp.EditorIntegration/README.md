# EditorIntegration – M73.5 und Abschluss von M73

Dieser Projektbereich besitzt die explizite WPF-UI-Registry aus M73.2, den nativen HostAdapter aus M73.3, die lokale Prozess-/Sessiongrenze aus M73.4 und den ziel-app-eigenen dauerhaften Layoutspeicher aus M73.5 für genau den Bereich `ui.order-header`.

## Bestehender HostAdapter

`IHostAdapter` stellt Registry und neutralen Layoutzustand bereit und führt neutrale Änderungsaufträge kontrolliert aus. Unterstützt werden `move`, `resize`, `resizeWidth`, `resizeHeight`, `textMove` und `textResize`. Der Adapter prüft Registry, Scope, Operation, Fähigkeit, Payload, native Referenz und Dispatcher, liest keine Feldtexte und führt keine Commands aus. Ein interner WPF-Snapshot stellt bei Fehlern innerhalb eines Auftrags den Ausgangszustand wieder her.

## Prozess

`Process/NodeEditorProcessClient` startet `src/process/editor-process-entry.cjs` mit `UseShellExecute = false`, `CreateNoWindow = true`, sicherem `ArgumentList`, festem Arbeitsverzeichnis und umgeleitetem `stdin`, `stdout` und `stderr`. Alle I/O-Wege sind asynchron und abbrechbar. Doppelte Starts werden abgewiesen.

Der Client korreliert Antworten über `messageId`/`replyTo`, prüft Protokollversion, erwarteten Nachrichtentyp und `sessionId` und verwirft ungültige oder doppelte Antworten kontrolliert. `stderr` wird separat in einem begrenzten Diagnosering gelesen. Unerwartetes Prozessende setzt die Integration auf Fehler; es gibt keinen automatischen Neustart.

## Protokoll 1.0

Jede JSONL-Nachricht enthält `protocolVersion`, `messageId`, `messageType`, `timestamp`, optional `sessionId`, optional `replyTo` und `payload`. Verwendete Typen:

- Handshake: `handshake` / `handshakeAccepted`
- Aktivierung: `activate` / `activated`
- Sessionstart: `startSession` / `requestRegistry`, danach `registry` / `requestLayoutState`, danach `layoutState` / `sessionStarted`
- Änderung: `diagnostic` / `submitChangeRequest`, danach `changeResult` / `changeResultAccepted`
- Sessionende: `endSession` / `sessionEnded`
- Deaktivierung: `deactivate` / `deactivated`
- Prozessende: `shutdown` / `shutdownComplete`
- Fehler und Diagnose: `error`, `log`

Unbekannte oder inkompatible Versionen werden nicht konvertiert. Falsche Sessionzuordnung, unbekannte Typen und ungültiges JSON führen zu strukturierten Fehlern oder begrenzten Diagnosen.

## Sessionzustand

`Session/EditorProcessCoordinator` besitzt die Zustände `Inactive`, `Activating`, `Active`, `StartingSession`, `SessionActive`, `EndingSession`, `Deactivating` und `Faulted`. Genau eine Session ist zulässig. Als aktiv gilt sie erst nach bestätigter Registry- und LayoutState-Übernahme. Neue Änderungen werden während Sessionende nicht angenommen.

Die Registryserialisierung enthält Metadaten und Operationsfreigaben, aber niemals native WPF-Referenzen. Der LayoutState enthält nur Element- und Textgeometrie. Ein vom Node-Core validierter Auftrag wird in das bestehende C#-`ChangeRequest`-Modell übersetzt, an den vorhandenen `WpfHostAdapter` weitergegeben und als `ChangeResult` zurückgesendet. Es existiert keine zweite Layoutänderungslogik.

## Timeouts und Ende

Getrennte Timeouts gelten für Prozessstart, Handshake, Aktivierung, Sessionstart, Sessionende, Deaktivierung und Shutdown. Bei Timeout oder App-Ende wird zunächst geordnet beendet und der konkrete Prozess nötigenfalls samt Prozessbaum beendet. Streams, Hintergrundaufgaben und CancellationToken werden freigegeben.

`--editor-process-diagnostic` führt nach `Loaded` den vollständigen Aktivierungs-/Sessionablauf mit genau einem nicht persistenten `resizeWidth`-Auftrag aus und beendet Node anschließend wieder. Der Normalstart erzeugt weder Prozess noch Editoroberfläche.

## Persistenz und Startup-Restore

`Persistence/` enthält den zentralen LocalApplicationData-Pfad, das strikt versionierte JSON-Dokument, den stabilen SHA-256-Registry-Fingerprint, vollständige Dokumentvalidierung, den atomaren JSON-Speicher und den Batch-Restore. Pro Element werden nur capability-gedeckte neutrale Geometriewerte serialisiert. Fachwerte und native WPF-Referenzen kommen im Persistenzmodell nicht vor.

`LayoutRestoreCoordinator` liest oder schreibt keine WPF-Eigenschaft direkt. Er sichert den vollständigen aktuellen LayoutState und reicht den Zielzustand in stabiler Registryreihenfolge ausschließlich als vorhandene ChangeRequests an `IHostAdapter.SubmitChangeRequest`. Bei einem Fehler wird der vollständige Ausgangszustand auf demselben Weg wiederhergestellt; Rollbackfehler bleiben strukturiert sichtbar.

Der Normalstart lädt nach `Loaded`, Registryaufbau und HostAdapter-Erzeugung. Fehlende Dateien sind kein Fehler. Beschädigte, fachlich unzulässige oder inkompatible Dateien werden nicht teilweise angewandt und blockieren die normale App nicht. `--layout-persistence-diagnostic` weist Speichern und Restore in zwei echten, nacheinander gestarteten WPF-Prozessen nach und räumt das isolierte Testprofil auf.

Nicht enthalten sind sichtbare Editoroberfläche, Selektion, Reset-/Discard-Bedienung, mehrere Profile oder Registry-Bereiche, PDF, Netzwerkkommunikation, automatische Registrierung oder Fachdatenspeicherung.
