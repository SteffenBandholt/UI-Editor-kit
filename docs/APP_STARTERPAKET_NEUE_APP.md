# App-Starterpaket - neue App

1. Im nativen Manager **Neue App vorbereiten** waehlen.
2. Projektordner, Appname, `applicationId`, WPF oder Electron, UI-/PDF-Wunsch und relativen Profilpfad angeben.
3. Vollstaendige Vorschau mit Pfaden, Hashes, Ownership, Gitstatus, Backup- und Rollbackbedarf pruefen und ausdruecklich bestaetigen.
4. Paket installieren. Das Manifest beginnt mit `integrationMode = new-app`, `registryStatus = development`, Registryversion `0`, leerem Fingerprint und ohne aktive Scopes.
5. Erste UI nur gemeinsam mit Entwurfsentscheidung, Registry, Refs, Parents, Baseline, Capabilities, `lockedOps`, Version/Fingerprint und Tests entwickeln.
6. Erst vollstaendige Scopes aktivieren und danach den Editor oeffnen.

Andere Frameworks werden sichtbar als nicht unterstuetzt blockiert.
