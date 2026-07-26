# Sicherheit, Transaktion, Update und Deinstallation

Abgewiesen werden Rootlaufwerke, Windows-/Program-Files-/Managerpfade, Pfadfluchten, ungültige Verträge und Reparse-Point-Ketten. Die Schreibprobe erzeugt ausschließlich im deklarierten Integrationsordner eine eindeutige `.tmp`-Datei und entfernt sie im `finally`. Prozesse werden mit `ProcessStartInfo.ArgumentList` statt Shell-Text gestartet.

Jede Vorschau hat einen SHA-256-basierten `previewId` aus Ziel, Paketversion und vollständigem Dateizustand. Vor der Ausführung wird neu geprüft und neu geplant; ohne ausdrückliche Bestätigung oder bei Abweichung wird abgebrochen. Die Transaktion arbeitet unter dem Manager-Backupordner, schreibt über Flush-to-disk plus atomaren Replace/Move und hält eine pro Instanz exklusive Sperre. Ein Fehler rollt Änderungen in umgekehrter Reihenfolge zurück; ein Rollbackfehler erhält einen eigenen Fehlercode und wird nie als Erfolg gemeldet.

Updates ersetzen nur unveränderte Managerdateien und ergänzen neue Positivlisten-Dateien. Lokale Abweichungen sind Konflikte. Deinstallation prüft erneut alle Ownership-Hashes, verschiebt nur eigene Dateien transaktional ins Backup und entfernt leere eigene Ordner. Projektdateien, Fachdaten sowie UI-/PDF-Profile sind keine installierten Dateien und bleiben erhalten.

Die Desktop-Verknüpfung trägt die Ownership-Beschreibung `UI-Editor-kit M78 Manager`. Eine gleichnamige fremde Verknüpfung wird weder überschrieben noch entfernt. Fehlercodes sind in `ManagerErrorCodes` stabil zentralisiert; Logs enthalten technische Aktion, Ergebnis, App-ID, Pfad, Transaktions-/Paketkennung und Dateianzahl, aber keine Fachwerte.

## M79-Erweiterung

Vor einer M79-Transaktion kommen Proposal-/Registryvalidierung, Source-Inventory-Freshness und eine ausschließlich lesende Git-Konfliktprüfung hinzu. Analyse und Preview schreiben nichts ins Ziel. Nach Commitbeginn wird nicht zwischen Einzelwrites abgebrochen. Build und Vertrag müssen vor Erfolg grün sein; andernfalls werden neue Dateien entfernt und die Projektdatei aus dem Transaktionsbackup bytegleich zurückkopiert.

Das persistente Originalbackup der einzigen bestehenden Projektdateiänderung liegt unter dem Manager-Backuproot und wird erst nach erfolgreicher Deinstallation entfernt. Lokale Änderungen an eigenen Dateien oder der betroffenen `.csproj` blockieren Update/Deinstallation. XAML, C#-Fachlogik, Profile, Fachwerte und fremde Dateien gehören nicht zum Writeplan. Details stehen in `M79_SICHERHEIT_UND_ROLLBACK.md`.
