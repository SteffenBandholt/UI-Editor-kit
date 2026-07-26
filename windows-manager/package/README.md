# Lokales M78-Integrationspaket

`current/package.json` ist die offline verfügbare, versionierte Paketquelle des Windows-Managers. Jede Nutzdatei besitzt einen SHA-256-Hash und einen relativ aufgelösten Zielpfad. Der WPF-Publish übernimmt diesen Ordner nach `packages/current`; es werden keine zufälligen `bin`-/`obj`-Artefakte und keine Downloads verwendet.

Das Paket aktiviert ausschließlich den vom Ziel-App-Manifest vorbereiteten Integrationspunkt. Registry, HostAdapter, UI-/PDF-Profile und Fachlogik bleiben Eigentum der Ziel-App. Die bestehende historische Node-Bootstrap-/Deinstallations-API bleibt unverändert; M78 ergänzt daneben den kontrollierten nativen Managervertrag.
