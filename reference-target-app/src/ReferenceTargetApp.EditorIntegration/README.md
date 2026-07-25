# EditorIntegration – Grenze in M73.3

Dieser Projektbereich besitzt die explizite WPF-UI-Registry aus M73.2 und den nativen HostAdapter für genau deren Bereich `ui.order-header`.

## Vertrag

`IHostAdapter` entspricht fachlich dem Node-Vertrag:

- `GetRegistry()` – Registry bereitstellen;
- `GetCurrentLayoutState()` – aktuellen neutralen Layoutzustand lesen;
- `SubmitChangeRequest()` – neutralen Änderungsauftrag kontrolliert ausführen.

Unterstützt werden die aktuellen Node-Operationsnamen:

- `move` mit `x` und/oder `y`;
- `resize` mit `width` und/oder `height`;
- `resizeWidth` mit `width`;
- `resizeHeight` mit `height`;
- `textMove` mit `text.offsetX` und/oder `text.offsetY`;
- `textResize` mit `text.fontSize`.

Alle Werte verwenden WPF Device Independent Pixels. Position wird über `TranslateTransform`, Größe über `Width`/`Height`, Textposition über `Padding` und Schriftgröße über die native beziehungsweise vererbbare WPF-Textgröße abgebildet.

Der Adapter prüft Registry, Scope, Operation, Fähigkeit, Payload, endliche und zulässige Werte, native Referenz und Dispatcher. Er liest keine Feldtexte und führt keine Commands aus. Ein interner nativer Snapshot stellt bei einem Fehler innerhalb eines einzelnen Auftrags den vollständigen Ausgangszustand wieder her.

Aufrufe außerhalb des UI-Threads werden auf den Dispatcher des registrierten Controls geleitet. Die Diagnoseoption `--host-adapter-diagnostic` führt nach `Loaded` einen einzelnen, nicht persistenten Schriftgrößenauftrag aus und erzeugt keine sichtbare Editorsteuerung.

Nicht enthalten sind Node-Prozess, JSON-/stdin-/stdout-Kommunikation, Layoutspeicher, Editoraktivierung, Session, Selektion, Editorfenster, automatische Registrierung oder Fachaktionen.
