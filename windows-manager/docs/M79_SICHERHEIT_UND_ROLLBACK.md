# M79-Sicherheit, Ownership und Rollback

Vor jedem Write müssen Analyseinventar, Proposalvalidierung, Registryfingerprint, Preview-ID, aktuelle Dateihashes, Git-Konfliktprüfung und ausdrückliche Bestätigung grün sein. Der Manager hält pro Zielroot genau eine Schreibtransaktion. Cancellation ist während der read-only Analyse zulässig und wird nach dem sicheren Commitbeginn nicht mehr mitten in der Transaktion übernommen.

Neue Dateien gehören `ui-editor-kit-m79`. Die bestehende `.csproj` bleibt fremdes Eigentum; M79 hält ihr bytegleiches Original persistent unter dem Manager-Backuproot und speichert ausschließlich eine relative Backupreferenz im Installationsstatus. Update ist nur bei unveränderten Ownership-Hashes zulässig. Deinstallation entfernt eigene Dateien und stellt die `.csproj` aus dem Originalbackup her. Eine lokale Abweichung blockiert statt überschrieben zu werden.

Git wird nur gelesen. Fachdateien, Profile, XAML-Bindings, Eventhandler, Commands, sichtbare Texte, Datenbankzugriffe und sonstige fremde Dateien gehören nie zum M79-Writeplan. Build-, Vertrags-, Zielstart- oder lokaler HostAdapter-Startfehler markieren die Registrierung nicht als erfolgreich und rollen vollständig zurück. Rollbackfehler besitzen eigene stabile Fehlercodes und werden nie als Erfolg protokolliert.

Die Laufzeitkopplung ist auf eine zufällig benannte lokale Named Pipe und einen expliziten Hostprozess beschränkt. Sie führt nur validierte Layoutoperationen aus der bestätigten Registry aus. Click-Handler und `ICommand.Execute` werden weder aufgerufen noch als Protokolloperation angeboten; der Diagnosemarker der Fixture belegt dies praktisch.

Die Diagnosefixture und alle Staging-/Backupdaten werden im `finally` bereinigt. Für das temporäre Git-Repository normalisiert die Diagnose Windows-Dateiattribute, bevor ausschließlich ihr eigener Diagnoseordner entfernt wird.
