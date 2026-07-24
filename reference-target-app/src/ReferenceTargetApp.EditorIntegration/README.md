# EditorIntegration – Grenze in M73.1

Dieser Projektbereich reserviert ausschließlich die spätere technische Grenze zwischen der nativen WPF-Ziel-App und dem vorhandenen Node.js-Editor-Kern.

Für einen späteren Meilenstein vorgesehen:

- lokaler, explizit gestarteter Node.js-Unterprozess;
- versionierte Nachrichten als JSON-Zeilen über `stdin`/`stdout`;
- Prozesslebenszyklus, Fehlerkanal und kontrolliertes Beenden;
- Übersetzung zwischen plattformneutralen Nachrichten und nativen Ziel-App-Schnittstellen.

In M73.1 enthält dieses Projekt absichtlich keinen ausführbaren Integrationscode. Insbesondere gibt es keine Registry, keinen HostAdapter, keinen Layoutspeicher, keine Editor-Session, keine Layoutänderung und keinen Prozessstart. Die WPF-App referenziert dieses Projekt noch nicht.
