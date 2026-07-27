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

## Additive PDF-Capability M81

Der Ziel-App-Vertrag kann additiv einen validierten PDF-Vertrag liefern. `pdfCapability` bleibt für nicht angebundene Apps `unavailable`; eine angebundene Ziel-App liefert `available` zusammen mit Anwendungs-/Dokumenttyp, Vertrags- und Registryversion, deterministischem Fingerprint, Profil-Scope, aktiver opaker Dokumentkennung, unterstützten Operationen sowie Seiten-, Vorschau- und Regenerationsfähigkeiten.

`pdf-target-contract.cjs` validiert die explizite Registry, Parentstruktur, Baselines, Fähigkeiten und Locks. Fachwerte, Datensätze und freie Datei-/Ausgabepfade sind im Vertrag verboten und beeinflussen den Fingerprint nicht. Die lokale Pipe transportiert ausschließlich neutrale Registry-, Layout-, ChangeRequest-, Regenerations- und Vorschaumetadaten. BBM ist der erste praktisch belegte Electron-PDF-Adapter; der vorhandene native M77-PDF-Arbeitsbereich bleibt die einzige Editoroberfläche.
