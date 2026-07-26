# UI-Editor Manager (M78)

Der UI-Editor Manager ist eine eigenständige native WPF-Anwendung für ausdrücklich vorbereitete neue Ziel-Apps. Er verwendet den in M73–M77 fertiggestellten UI-/PDF-Editor; er analysiert keinen fremden Quellcode und implementiert keine M79-Registrierung.

## Aufbau und Pfade

- `Domain`: neutrale Zustände, Manifest-, Plan-, Status- und Protokollmodelle; keine WPF-, Datei- oder Prozessabhängigkeit.
- `Core`: Vertragsprüfung, Pfadregeln und deterministische Installationsplanung.
- `Infrastructure`: lokale JSON-Speicher, SHA-256, atomare Dateien, Backup/Rollback, Prozessstart und `.lnk`.
- `Wpf`: natives Hauptfenster, Windows-Ordner-/Dateidialoge, Vorschau, Bestätigung und Statusanzeige.

Die Veröffentlichung liegt unter `%LOCALAPPDATA%\UI-Editor-kit\Manager\app`. Daten, Logs, Backups, Pakete und Diagnosen haben eigene Unterordner. Bekannte Apps stehen versioniert in `data\known-target-apps.json`; das strukturierte Protokoll steht in `logs\manager.jsonl`. Der reguläre Betrieb benötigt weder Administratorrechte noch Netzwerk.

## Bereitstellung und Diagnose

`windows-manager/scripts/run-manager-installer-diagnostic.ps1` veröffentlicht die Manager-EXE nach LocalAppData und startet dort `UiEditorManager.exe --manager-installer-diagnostic`. Der sichtbare Nachweis erzeugt und prüft eine benutzerspezifische Verknüpfung `UI-Editor Manager.lnk`, verwendet einen sauberen neuen Ziel-App-Klon plus explizites Opt-in-Manifest und entfernt Verknüpfung, Fixture, Staging und Backups wieder.

Die Diagnose deckt Auswahl per Ordner und Projektdatei, Ablehnung ohne Opt-in, Schreibprobe, Vorschau/Bestätigung, Installation, provozierten Installations- und Updatefehler, Rollback, Update, Ziel-App-/Editorstart, UI-/PDF-Restore und Deinstallation ab. Layoutprofile und fremde Schutzdateien werden per SHA-256 als bytegleich bestätigt.

Das native Produkt ist bewusst nicht im npm-Paket enthalten (`.npmignore`); seine lokale Paketquelle wird beim `dotnet publish` als `packages/current` mitgeführt.
