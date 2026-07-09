# Minimal Target App Example

Dieses Beispiel zeigt eine fachneutrale Minimal-Anbindung an das UI-Editor-kit.

Es verwendet das neutrale Testziel aus `scripts/fixtures/neutral-target-app/neutralTargetApp.cjs` und startet die Runtime ausschliesslich ueber den offiziellen Adapter-Pfad aus `src/core/target-app-adapter-path.cjs`.

Ausfuehren:

```bash
node scripts/fixtures/minimal-target-app/minimal-target-app.cjs
```

Das Beispiel baut keine Oberflaeche, keinen Server und keine fachliche Anwendung. Es zeigt nur AdapterManifest, HostAdapter, Registry, Runtime, ViewModels und MemoryLayoutStateStore.
