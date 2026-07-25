# Layoutpersistenz M73.5

Die Ziel-App speichert genau ein Layoutprofil für `ui.order-header` unter
`%LOCALAPPDATA%\UI-Editor-kit\ReferenceTargetApp\layouts\order-header-default.layout.json`.
Der Pfad wird ausschließlich durch `LayoutStoragePathResolver` gebildet und kann für Tests und den Diagnosemodus auf einen isolierten Ordner gesetzt werden.

Das JSON-Dokument verwendet `schemaVersion: 1` und enthält nur `applicationId`, `profileId`, `scopeId`, `savedAt`, `registryFingerprint` und `layoutState.elements`. Pro Element werden neben ID und Scope ausschließlich die durch dessen Registry-Capabilities freigegebenen Werte für Position, Größe, Textposition und Schriftgröße geschrieben. Feldtexte, Statuswerte, Commands, Fachobjekte und native WPF-Referenzen sind nicht Teil des Modells.

`RegistryFingerprint` bildet einen SHA-256-Wert aus stabil nach Element-ID sortierten Registrydaten: Element-ID, Scope, Parent-ID, Elementart und sortierte Capability-Namen. Anzeigenamen und native Referenzen bleiben ausgeschlossen. Eine abweichende Registry wird nicht migriert und nicht angewandt.

`AtomicJsonLayoutStore` validiert das vollständige Dokument vor dem Schreiben, schreibt eine eindeutige temporäre Datei im Zielordner, schließt und flusht deren Stream auf den Datenträger und ersetzt erst danach die Zieldatei. Fehler lassen die vorherige Zieldatei unverändert; temporäre Dateien werden bestmöglich entfernt.

Beim Lesen werden JSON-Struktur, erlaubte Felder, Schema, App, Profil, Scope, Fingerprint, vollständige Elementmenge, Element-IDs, Capabilities sowie endliche und zulässige Zahlen geprüft. Eine fehlende Datei ist ein normaler Erststart. Beschädigte oder inkompatible Dateien liefern strukturierte Ergebnisse und werden weder verändert noch teilweise angewandt.

`LayoutRestoreCoordinator` sichert vor dem Reapply den vollständigen aktuellen `LayoutState`. Alle Änderungen und ein nötiger Gesamtrollback laufen ausschließlich als neutrale `ChangeRequest`-Objekte über den bestehenden `IHostAdapter.SubmitChangeRequest`. Erst ein vollständig erfolgreicher Batch gilt als wiederhergestellt. Ein Rollbackfehler wird mit `rollback_failed` und allen Einzelfehlern gemeldet.

Der Normalstart stellt ein gültiges Layout nach `Loaded`, Registryaufbau und HostAdapter-Erzeugung wieder her. Er startet keinen Node-Prozess und keine Editor-Session. `--layout-persistence-diagnostic` startet programmgesteuert zwei echte WPF-Kindprozesse: Speichern im ersten Prozess und automatischer Startup-Restore mit Geometrie-, Fachwert- und Button-/Statusprüfung im zweiten. Das isolierte Diagnoseprofil wird anschließend entfernt.

Nicht enthalten sind sichtbare Editorbedienung, Reset/Discard, mehrere Profile oder Scopes, Migration, PDF, Browser, Netzwerk oder Fachdatenspeicherung.
