# Layoutpersistenz M73.5, M75 und getrennte PDF-Persistenz M76

Der weiterhin getestete M73.5-Kompatibilitätsweg speichert genau ein Layoutprofil für `ui.order-header` unter
`%LOCALAPPDATA%\UI-Editor-kit\ReferenceTargetApp\layouts\order-header-default.layout.json`.
Der Pfad wird ausschließlich durch `LayoutStoragePathResolver` gebildet und kann für Tests und den Diagnosemodus auf einen isolierten Ordner gesetzt werden.

Das M73.5-Ein-Scope-Dokument verwendet `schemaVersion: 1` und enthält nur `applicationId`, `profileId`, `scopeId`, `savedAt`, `registryFingerprint` und `layoutState.elements`. Dieser Vertrag und seine Tests bleiben erhalten. M75 verwendet für neue Profildateien additiv `schemaVersion: 2`: `applicationId`, `profileId`, `savedAt` und `scopes`, je Scope mit `scopeId`, `registryFingerprint` und neutralem `layoutState`. Eine vorhandene Schema-1-Datei wird beim normalen M75-Start kontrolliert erkannt und mit `legacy_schema_requires_resave` nicht still migriert.

Pro Element werden neben ID und Scope ausschließlich die durch dessen Registry-Capabilities freigegebenen Werte für Position, Größe, Textposition und Schriftgröße geschrieben. Feldtexte, Statuswerte, Commands, Fachobjekte und native WPF-Referenzen sind in keinem Schema Teil des Modells.

`RegistryFingerprint` bildet einen SHA-256-Wert aus stabil nach Element-ID sortierten Registrydaten: Element-ID, Scope, Parent-ID, Elementart und sortierte Capability-Namen. Anzeigenamen und native Referenzen bleiben ausgeschlossen. Eine abweichende Registry wird nicht migriert und nicht angewandt.

`AtomicJsonLayoutStore` validiert das vollständige Dokument vor dem Schreiben, schreibt eine eindeutige temporäre Datei im Zielordner, schließt und flusht deren Stream auf den Datenträger und ersetzt erst danach die Zieldatei. Fehler lassen die vorherige Zieldatei unverändert; temporäre Dateien werden bestmöglich entfernt.

Beim Lesen werden JSON-Struktur, erlaubte Felder, Schema, App, Profil, Scope, Fingerprint, vollständige Elementmenge, Element-IDs, Capabilities sowie endliche und zulässige Zahlen geprüft. Eine fehlende Datei ist ein normaler Erststart. Beschädigte oder inkompatible Dateien liefern strukturierte Ergebnisse und werden weder verändert noch teilweise angewandt.

`LayoutRestoreCoordinator` sichert vor dem Reapply den vollständigen aktuellen `LayoutState`. Alle Änderungen und ein nötiger Gesamtrollback laufen ausschließlich als neutrale `ChangeRequest`-Objekte über den bestehenden `IHostAdapter.SubmitChangeRequest`. Erst ein vollständig erfolgreicher Batch gilt als wiederhergestellt. Ein Rollbackfehler wird mit `rollback_failed` und allen Einzelfehlern gemeldet.

Der Normalstart stellt ein gültiges Layout nach `Loaded`, Registryaufbau und HostAdapter-Erzeugung wieder her. Er startet keinen Node-Prozess und keine Editor-Session. `--layout-persistence-diagnostic` startet programmgesteuert zwei echte WPF-Kindprozesse: Speichern im ersten Prozess und automatischer Startup-Restore mit Geometrie-, Fachwert- und Button-/Statusprüfung im zweiten. Das isolierte Diagnoseprofil wird anschließend entfernt.

## M75-Profile und atomare Mehr-Scope-Operationen

M75 schreibt `standard.layout-profile.json` und `compact.layout-profile.json` als voneinander unabhängige vollständige Profildokumente sowie `active-layout-profile.json` für die benutzerspezifische aktive Wahl. Vor dem Ersetzen einer Profildatei werden alle registrierten Scopes, Fingerprints und Elemente validiert. Geschrieben wird in eine eindeutige temporäre Datei mit Write-through/Flush und anschließendem atomarem Replace beziehungsweise Move; bei Fehler bleiben Zieldatei, Working-State und Saved-State unverändert.

Load liest die aktive Datei jedes Mal neu vom Datenträger und unterscheidet fehlende, beschädigte und inkompatible Dokumente. Erst nach vollständiger Schema-, App-, Profil-, Scope-, Fingerprint- und Elementprüfung wird angewandt. Load, Gesamtverwerfen und Gesamtreset sichern alle Scopezustände und rollen bei einem Fehler vollständig zurück. Verwerfen verwendet Saved, Reset die unveränderliche App-Baseline; Reset schreibt oder löscht keine Profildatei.

`--ui-full-operation-diagnostic` weist Speichern, echten Prozessneustart, Startup-Restore beider Scopes, getrennte Profile sowie einen provozierten Batchfehler mit vollständigem Rollback nach und entfernt anschließend alle Diagnoseprofile und temporären Dateien.

## Getrenntes PDF-Profil M76

Die PDF-Persistenz liegt bewusst unter `EditorIntegration/Pdf` und nicht in den UI-Profilklassen. Sie schreibt ausschließlich `%LOCALAPPDATA%\UI-Editor-kit\ReferenceTargetApp\pdf-layouts\pdf-standard.pdf-layout.json` mit `documentKind: pdf-layout-profile`, Schema 1, `profileId: pdf-standard`, Scope `pdf.order-document` und PDF-Registry-Fingerprint. Die vorhandenen UI-Dateien `standard.layout-profile.json`, `compact.layout-profile.json` und `active-layout-profile.json` bleiben unverändert. Beide Dokumentformen weisen einander beim Laden ab.

PDF-Save und -Load validieren die vollständige Elementmenge und alle capability-gedeckten Werte. Discard stellt den letzten Saved-/Loaded-Zustand wieder her, Reset die registrierte Baseline, ohne die Datei zu überschreiben. Batchfehler rollen den vollständigen PDF-Working-State zurück. Atomisches Schreiben und Fehlererhalt folgen denselben Sicherheitsprinzipien wie die UI-Persistenz, verwenden aber eigene Typen und Pfade.

Nicht enthalten sind eine stille Migration des Altformats, Browser, Netzwerk oder Fachdatenspeicherung. Sichtbare PDF-Bedienung beginnt erst mit M77.

## M81.1 – Profilklassifikation, Archiv und sicherer Neustart

Vor dem Electron-Editorstart klassifizieren getrennte UI- und PDF-Prüfer den aktiven Profilstand als `compatible`, `migrationAvailable`, `incompatible`, `corrupt`, `missing` oder `blocked`. Ein nicht sicher anwendbarer Stand wird nicht mehr als Verbindungsfehler behandelt. Der native Dialog erlaubt Abbruch, einen sauberen Baselinestart oder – nur nach strengem Positivnachweis – die Migration.

Baseline und Migration archivieren die Originaldatei zuvor byte-identisch unterhalb der vorhandenen Profilwurzel in `archive/<applicationId>/`. Eine atomar geschriebene Metadaten-Sidecar-Datei dokumentiert Originalname/-zeit, Archivzeit, Grund, Klassifikation, Schema-, Vertrags- und Registryversion, alte und aktuelle Fingerprints, Dokumenttyp sowie SHA-256. Kollisionen überschreiben keine Datei; schlägt Archivierung oder Migration fehl, bleibt beziehungsweise wird das Original wiederhergestellt.

Eine sichere UI-Migration übernimmt ausschließlich vollständig validierte Scopes mit unverändertem Registryfingerprint und ergänzt nur neue Scopes aus der aktuellen Baseline. Änderungen an Parent, Rolle, Capability, Elementmenge oder unbekannten Schemata werden nicht geraten. PDF bleibt ein eigener Profil- und Fehlerbereich. Nach erfolgreichem Remote-Restore wird eine zulässige Normalisierung des Zielsystems als sauberer Sitzungsstand übernommen, ohne die Profildatei beim Start automatisch umzuschreiben.
