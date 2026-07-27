# App-Starterpaket

Das App-Starterpaket ist der zentrale erste technische Schritt fuer neue und bestehende WPF-/Electron-Ziel-Apps. Es wird versioniert unter `windows-manager/starter-package/current` gefuehrt und vom vorhandenen nativen Manager installiert.

## Zwei getrennte Einstiege

1. **Neue App vorbereiten** installiert Regeln, Schema-2-Zielmanifest und das belegte WPF- oder Electron-Entwicklungsgeruest. Der Status lautet `new-app` / `development`; aktive Scopes bleiben leer.
2. **Bestehende App nachruesten** prueft Quellcode, Framework, vorhandene Integration, Git-/Schreibzustand und Ownership. WPF fuehrt danach in den vorhandenen M79-Registrierungsweg. Eine bereits angebundene Electron-App wie BBM erhaelt nur fehlende Metadaten und keine zweite Bridge oder Registry.

Der Editor erkennt keine UI. Registry, Refs, HostAdapter, Baselines, Capabilities, Sperren, Version und Fingerprint gehoeren der Ziel-App.

## Sicherheit

Vor jeder Aenderung werden Paket-SHA-256, Zielhashes, Git-Konflikte, Ownership, exakte Textdiffs und Backupbedarf ermittelt. Erst eine bestaetigte, unveraenderte Vorschau darf ausgefuehrt werden. Atomare Dateischreibvorgaenge und Byte-Backups stellen bei Fehlern den Ausgangszustand her. Profile und zielapp-eigene Gerueste bleiben bei Update/Deinstallation erhalten.

Nach Installation und Update prueft der Manager das Schema-2-Manifest sowie den echten WPF-Projektbuild oder den lokalen Electron-Vertragscheck. Ein Fehler in diesem Nachcheck gehoert zur Transaktion und fuehrt zum Rollback. Bei WPF uebergibt das Starterpaket sein Manifest kontrolliert an den vorhandenen M79-Registrierungsweg; dessen Zielvertrag wird im optionalen Feld `managerTarget` eingebettet. Damit bleiben Starterstatus und bestehender nativer Editorstart gleichzeitig gueltig, ohne ein zweites Manifest oder einen zweiten Adapterweg.

HTTP, WebSocket, Webserver, Browser, Netzwerk, Cloud und automatische UI-Erkennung sind ausgeschlossen.
