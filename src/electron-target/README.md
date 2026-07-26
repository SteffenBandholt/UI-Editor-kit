# Electron-Ziel-App-Adapter

Dieser Adapter verbindet eine lokale Electron-Ziel-App mit dem vorhandenen nativen Editor. Führend bleiben `getRegistry()`, `getCurrentLayoutState()` und `submitChangeRequest(changeRequest)`; Selection, Highlight und Sichtbarkeit sind additive neutrale Fähigkeiten.

## Bestandteile

- `electron-target-contract.cjs`: frameworkneutraler, fachfreier Ziel-App-Vertrag.
- `local-target-protocol.cjs`: versionierte Envelope-/Frame-Regeln und Größenlimit.
- `named-pipe-client.cjs`: lokale, korrelierte und zeitbegrenzte Named-Pipe-Verbindung.
- `electron-error-codes.cjs`: strukturierte Electron-Fehlercodes.
- `ReferenceTargetApp.EditorIntegration/Electron`: C#-Gegenseite mit Current-User-only-Pipe, genau einer Verbindung und asynchronem HostAdapter.

Der Adapter kennt keine DOM-Knoten und keine BBM-Fachdaten. Eine Ziel-App liefert ausschließlich explizite Registryeinträge, neutrale Layoutzustände und validierte ChangeResults. Fachaktionen bleiben gesperrt; ein Fehler stellt den vollständigen Ausgangszustand wieder her.

Der Adapter enthält keinen Browser-, HTTP-, WebSocket-, Webserver-, Netzwerk- oder Cloudpfad. Der native Editor und sein Node-Core bleiben das einzige Editorprodukt.
