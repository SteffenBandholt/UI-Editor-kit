# UI-Editor Manager (M78/M79)

Der UI-Editor Manager ist die eine native WPF-Anwendung für vorbereitete neue Ziel-Apps (M78) und die kontrollierte Registrierung bestehender SDK-basierter C#-/WPF-Apps (M79). Er verwendet die in M73–M77 festgelegten UI-/PDF-, Registry-, HostAdapter- und Profilverträge; es gibt keinen zweiten Manager und keine Browser-/Netzwerkstrecke.

## Aufbau und Pfade

- `Domain`: neutrale Zustände, Manifest-, Plan-, Status- und Protokollmodelle; keine WPF-, Datei- oder Prozessabhängigkeit.
- `Core`: Vertragsprüfung, Pfadregeln und deterministische Installationsplanung.
- `Infrastructure`: lokale JSON-Speicher, SHA-256, atomare Dateien, Backup/Rollback, Prozessstart und `.lnk`.
- `Wpf`: natives Hauptfenster, Windows-Ordner-/Dateidialoge, Vorschau, Bestätigung und Statusanzeige.

Die Veröffentlichung liegt unter `%LOCALAPPDATA%\UI-Editor-kit\Manager\app`. Daten, Logs, Backups, Pakete und Diagnosen haben eigene Unterordner. Bekannte Apps stehen versioniert in `data\known-target-apps.json`; das strukturierte Protokoll steht in `logs\manager.jsonl`. Der reguläre Betrieb benötigt weder Administratorrechte noch Netzwerk.

## Bereitstellung und Diagnose

`windows-manager/scripts/run-manager-installer-diagnostic.ps1` veröffentlicht die Manager-EXE nach LocalAppData und startet dort `UiEditorManager.exe --manager-installer-diagnostic`. Der sichtbare Nachweis erzeugt und prüft eine benutzerspezifische Verknüpfung `UI-Editor Manager.lnk`, verwendet einen sauberen neuen Ziel-App-Klon plus explizites Opt-in-Manifest und entfernt Verknüpfung, Fixture, Staging und Backups wieder.

Die Diagnose deckt Auswahl per Ordner und Projektdatei, Ablehnung ohne Opt-in, Schreibprobe, Vorschau/Bestätigung, Installation, provozierten Installations- und Updatefehler, Rollback, Update, Ziel-App-/Editorstart, UI-/PDF-Restore und Deinstallation ab. Layoutprofile und fremde Schutzdateien werden per SHA-256 als bytegleich bestätigt.

Das native Managerprodukt einschließlich M79-Frameworkadapter, Generator, Fixture und Prozessdiagnose ist bewusst nicht im npm-Paket enthalten (`.npmignore`); seine lokale Paketquelle wird beim `dotnet publish` als `packages/current` mitgeführt. Die M79-Wiederverwendungserweiterung des bestehenden M77-Editors unter `reference-target-app` bleibt dagegen bewusst als kompilierbarer Referenzquelltext im npm-Paket, ebenso die neutrale M79-Entwurfsdokumentation.

## Bestehende Apps registrieren (M79)

Im selben Fenster steht unterhalb des M78-Bereichs die M79-Strecke bereit: Bestandsprojekt auswählen, Framework prüfen, read-only analysieren, Views/Elementbaum/Proposal-Liste filtern, jeden Vorschlag bearbeiten/bestätigen/ablehnen, Registry validieren, vollständige Datei-/Hash-/Diffvorschau bestätigen und anschließend installieren oder aktualisieren. M79-Deinstallationsvorschau, Ziel-App-/Editorstart und Rollback verwenden denselben lokalen Managerzustand.

Der belegte Erstadapter akzeptiert ausschließlich SDK-basiertes C#-/WPF mit `.csproj`, XAML und C#. XAML wird strukturiert als XML, C# mit Roslyn-Syntaxbäumen gelesen. Unbenannte, templatebasierte oder dynamische Strukturen bleiben klärungsbedürftig. Click-/Command-/ICommand-Fundstellen werden sichtbar und zwingend gegen Fachaktionsausführung gesperrt.

Analysemanifeste liegen vor Installation ausschließlich unter `data/registration-analyses`. Die Installation erzeugt eigene Dateien unter `.ui-editor-kit`, einen versionierten `ui-editor-target.json` im Modus `registered-existing-wpf` und genau einen additiven `Compile Include`-Projektdateiblock. Nach Build und Vertragscheck müssen auch Ziel-App und lokaler HostAdapter praktisch starten. Der HostAdapter ist über eine lokale Named Pipe mit dem vorhandenen nativen M77-UI-/PDF-Editor verbunden; Netzwerk, Server und ein zweiter Editor-Core bleiben ausgeschlossen. Ownership, Originalbackup, Laufzeitprüfung, Update und Deinstallation sind in [M79-Sicherheit und Rollback](docs/M79_SICHERHEIT_UND_ROLLBACK.md) beschrieben.

Der sichtbare praktische Nachweis lautet:

```powershell
windows-manager/scripts/run-existing-app-registration-diagnostic.ps1
```

Er verwendet die kontrollierte [M79-Bestandsfixture](fixtures/M79ExistingWpfApp/README.md), echte Builds und WPF-Prozesse, den an die Fixture gekoppelten vorhandenen M77-UI-/PDF-Editor, eine reale UI-Änderung samt Profil-Restore, echte PDF-Erzeugung, Hashvergleiche, Git-Dirty-Blockade, Fehlerrollbacks, Reanalyse/Update und Deinstallation. Zusätzlich bleibt die eigenständige M77-UI-/PDF-Diagnose grün. Alle Diagnosekopien werden anschließend entfernt.

Der vollständige Ablauf und seine Bereinigungsregeln stehen in [M79-Diagnose](docs/M79_DIAGNOSE.md).
