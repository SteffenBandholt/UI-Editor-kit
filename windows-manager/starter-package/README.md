# App-Starterpaket

Das versionierte App-Starterpaket ist der zentrale erste technische Schritt fuer neue und bestehende WPF-/Electron-Ziel-Apps.

- Neue App: im nativen Manager **Neue App vorbereiten**. Das Ergebnis beginnt ehrlich mit `integrationMode = new-app` und `registryStatus = development`.
- Bestehende App: zuerst **Bestehende App nachruesten**. Das Ergebnis beginnt mit `integrationMode = existing-app` und `registryStatus = registrationRequired`, sofern keine vorhandene gueltige Integration uebernommen wird.

Das Paket installiert Regeln, Manifest und Frameworkgerueste. Es erkennt keine UI und erzeugt keine fertige Registry. Die Ziel-App bleibt Eigentuemerin von Registry, Refs, HostAdapter, Baselines, Capabilities und Fachaktionssperren.
