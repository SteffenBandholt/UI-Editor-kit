# EditorIntegration – UI-Layoutbetrieb M75 und PDF-Grundmodell M76

Dieser Projektbereich besitzt die expliziten WPF-UI-Registries, den nativen HostAdapter, die lokale Prozess-/Sessiongrenze und den ziel-app-eigenen dauerhaften Layoutspeicher. M75 betreibt `ui.order-header` und `ui.customer-details`. M76 ergänzt additiv unter `Pdf/` ein getrenntes neutrales PDF-Modell, die PDF-Registry, den `PdfHostAdapter`, PDF-Profilzustände und Batchkoordination.

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
- M74-UI-Zustand: `getEditorUiState` / `editorUiState`
- M74-Auswahl und Bedienzustand: `selectEditorElement`, `setEditorLayer`, `setEditorMode`, `setEditorStep`, jeweils beantwortet mit `editorUiState`
- M74-Richtung: `activateEditorDirection` / `submitChangeRequest`, danach unverändert `changeResult` / `changeResultAccepted`
- Sessionende: `endSession` / `sessionEnded`
- Deaktivierung: `deactivate` / `deactivated`
- Prozessende: `shutdown` / `shutdownComplete`
- Fehler und Diagnose: `error`, `log`

Unbekannte oder inkompatible Versionen werden nicht konvertiert. Falsche Sessionzuordnung, unbekannte Typen und ungültiges JSON führen zu strukturierten Fehlern oder begrenzten Diagnosen.

## Sessionzustand

`Session/EditorProcessCoordinator` besitzt die Zustände `Inactive`, `Activating`, `Active`, `StartingSession`, `SessionActive`, `EndingSession`, `Deactivating` und `Faulted`. Genau eine Session ist zulässig. Als aktiv gilt sie erst nach bestätigter Registry- und LayoutState-Übernahme. Neue Änderungen werden während Sessionende nicht angenommen.

Die Registryserialisierung enthält Metadaten und Operationsfreigaben, aber niemals native WPF-Referenzen. Der LayoutState enthält nur Element- und Textgeometrie. Ein vom Node-Core validierter Auftrag wird in das bestehende C#-`ChangeRequest`-Modell übersetzt, an den vorhandenen `WpfHostAdapter` weitergegeben und als `ChangeResult` zurückgesendet. Es existiert keine zweite Layoutänderungslogik.

## M74-UI-Koordination

`EditorUi/EditorUiState` übersetzt ausschließlich neutrale Baum-, Detail-, Panel- und Layoutwerte. `EditorProcessCoordinator` serialisiert Auswahl, Ebene, Modus, Schrittweite und Richtungsintent innerhalb der bereits aktiven Session. Die Node-Seite erzeugt den Änderungsauftrag über den vorhandenen M70-Panelcontroller und die bestehenden Baum-/Detail-ViewModels. Der C#-Coordinator gibt den Auftrag unverändert an den vorhandenen HostAdapter weiter und liest Details erst nach dem `ChangeResult` neu.

Die Einzelfensterregel und die WPF-Fensterereignisse liegen in der WPF-Schicht. EditorIntegration kennt kein Fenster und schreibt keine native Layoutproperty. Die explizite UTF-8-Kodierung ohne BOM sichert deutsche Anzeigenamen und Statusmeldungen über alle drei Prozessstreams.

## M75 Scope-, Profil- und Zustandskoordination

`LayoutProfileSession` hält die beim Registryaufbau erfasste unveränderliche App-Baseline, den letzten erfolgreichen Saved-/Loaded-Zustand und den jeweils frisch über alle Adapter erfassten Working-Zustand auseinander. Dirty-Vergleiche sind profilbezogen, scopeübergreifend und verwenden die neutrale numerische Toleranz. Alle Layoutänderungen werden als bestehende `ChangeRequest`s über `IHostAdapter` angewandt.

`LayoutProfileCatalog` definiert ausschließlich `standard` und `compact`. `AtomicJsonLayoutProfileStore` speichert je Profil ein vollständig validiertes Schema-2-Dokument atomar. `ActiveLayoutProfileStore` persistiert die zuletzt aktive ID. `LayoutProfileStartupCoordinator` stellt das aktive Profil über beide Registries wieder her, bevor ein Editor oder Node-Prozess geöffnet wird.

Load, Gesamtverwerfen, Gesamtreset und Profilwechsel sichern zunächst beide sichtbaren Scopezustände. Beim ersten Adapterfehler werden alle bereits berührten Scopes in stabiler Reihenfolge vollständig zurückgerollt; Saved-/Loaded-Zustände werden nur nach Gesamterfolg übernommen. Der kontrollierte Diagnosefehler im `WpfHostAdapter` ist nur programmgesteuert armierbar und besitzt keine Produktbedienung.

Die additiven Prozessnachrichten `selectEditorScope` und `refreshEditorLayoutStates` wechseln den aktiven Scope und aktualisieren beide neutralen Layoutzustände innerhalb derselben Node-Session. Alte Ein-Scope-Nachrichten und Operationen bleiben unverändert.

Fenster, native Dialoge und die explizite Zuordnung registrierter WPF-Controlreferenzen liegen weiterhin ausschließlich in der WPF-Schicht. Domain bleibt frei von WPF-, PDFsharp-, JSON-, Datei- und Prozessabhängigkeiten. Das M76-PDF-Modell ist vom UI-Prozessvertrag getrennt und verändert keine vorhandene Nachricht oder Operation.

## M76 PDF-Integration

`Pdf/` definiert A4 in Millimetern, 26 registrierte `pdf.`-Elemente, Capability-Matrix, Parentstruktur, SHA-256-Fingerprint, neutralen LayoutState, Validierung, einen eigenen `IPdfHostAdapter`/`PdfHostAdapter` sowie das feste Profil `pdf-standard`. UI- und PDF-IDs, Adapter und Persistenzdokumente sind gegenseitig inkompatibel. Save, Load, Discard, Reset und Batchrollback laufen programmgesteuert ohne sichtbare M77-Bedienung. Details stehen in `Pdf/README.md`.

M77 bindet dieses Fundament sichtbar an, ohne Prozessprotokoll oder Schreibwege zu erweitern. Elementbezogenes PDF-Discard/Reset erzeugt weiterhin ausschließlich vorhandene neutrale Requests über denselben `PdfHostAdapter`. Der UI-Arbeitsbereich hält seine einzige Node-Session auch beim Wechsel zur PDF-Ausgabe; PDF-Rendering und Vorschau bleiben vollständig in .NET.

## Timeouts und Ende

Getrennte Timeouts gelten für Prozessstart, Handshake, Aktivierung, Sessionstart, Sessionende, Deaktivierung und Shutdown. Bei Timeout oder App-Ende wird zunächst geordnet beendet und der konkrete Prozess nötigenfalls samt Prozessbaum beendet. Streams, Hintergrundaufgaben und CancellationToken werden freigegeben.

`--editor-process-diagnostic` führt nach `Loaded` den vollständigen Aktivierungs-/Sessionablauf mit genau einem nicht persistenten `resizeWidth`-Auftrag aus und beendet Node anschließend wieder. Der Normalstart erzeugt weder Prozess noch Editoroberfläche.

## Persistenz und Startup-Restore

`Persistence/` enthält den zentralen LocalApplicationData-Pfad, das strikt versionierte JSON-Dokument, den stabilen SHA-256-Registry-Fingerprint, vollständige Dokumentvalidierung, den atomaren JSON-Speicher und den Batch-Restore. Pro Element werden nur capability-gedeckte neutrale Geometriewerte serialisiert. Fachwerte und native WPF-Referenzen kommen im Persistenzmodell nicht vor.

`LayoutRestoreCoordinator` liest oder schreibt keine WPF-Eigenschaft direkt. Er sichert den vollständigen aktuellen LayoutState und reicht den Zielzustand in stabiler Registryreihenfolge ausschließlich als vorhandene ChangeRequests an `IHostAdapter.SubmitChangeRequest`. Bei einem Fehler wird der vollständige Ausgangszustand auf demselben Weg wiederhergestellt; Rollbackfehler bleiben strukturiert sichtbar.

Der Normalstart lädt nach `Loaded`, Registryaufbau und HostAdapter-Erzeugung. Fehlende Dateien sind kein Fehler. Beschädigte, fachlich unzulässige oder inkompatible Dateien werden nicht teilweise angewandt und blockieren die normale App nicht. `--layout-persistence-diagnostic` weist Speichern und Restore in zwei echten, nacheinander gestarteten WPF-Prozessen nach und räumt das isolierte Testprofil auf.

Nicht enthalten sind Reset-/Discard-/Save-/Load-Bedienung, mehrere Profile oder Registry-Bereiche, PDF, Netzwerkkommunikation, automatische Registrierung oder Fachdatenspeicherung.
