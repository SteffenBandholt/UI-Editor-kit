# M82 - sichtbare App-Starterpaket-Diagnose

Der vollstaendige lokale Aufruf lautet:

```powershell
windows-manager/scripts/run-app-starter-package-diagnostic.ps1
```

Das Skript publiziert den vorhandenen nativen Manager nach `%LOCALAPPDATA%\UI-Editor-kit\Manager\app` und startet ihn mit `--app-starter-package-diagnostic`. Unter einem isolierten `m82-*`-Diagnoseordner werden eine neue WPF-App, eine neue Electron-App und eine Fehlerfixture vorbereitet. BBM wird ausschliesslich lesend als bestehende Electron-Referenz verwendet.

Der sichtbare Lauf prueft Vorschau und Bestaetigung, `development` ohne erfundene Scopes, WPF-Build, Electron-Vertragscheck, native WPF-/Electron-Fenster, die ersten explizit benannten und registrierten WPF-/Electron-Test-UIs, den vorhandenen M79-Editor, BBM-Bestandserkennung und lokalen Electron-Editorstart, Installations-/Updatefehler mit Rollback, Update, Deinstallation sowie Profilerhalt. `ELECTRON_RUN_AS_NODE` wird nur aus den beiden gestarteten Electron-Kindumgebungen entfernt; die aufrufende Umgebung wird nicht veraendert.

Im `finally` werden alle gestarteten Prozesse beendet und nur der eigene Diagnoseordner entfernt. Erfolg bedeutet Exitcode 0, kein `m82-diagnostic-error.txt`, keine `m82-*`-Reste und keine temporaeren Transaktionsdateien.
