# Preview-Runtime-Migrationsnotiz

## Zweck

Diese Notiz beschreibt, welche bereits vorbereiteten Preview-Runtime-Bausteine aus BBM als Referenz-App fachneutral mit dem UI-Editor-kit abgeglichen werden sollen.

Dieses Paket uebernimmt noch keinen produktiven Code. Es legt nur fest, welche Dateien spaeter Kandidaten sind, welche Anpassungen vorher noetig sind und welche Teile ausgeschlossen bleiben.

## Spaetere Uebernahme- oder Abgleichkandidaten

Spaeter fachneutral zu pruefende BBM-Referenzdateien:

- `src/renderer/editorRuntime/preview/editorPreviewOperations.js`
- `src/renderer/editorRuntime/preview/editorPreviewTargetModel.js`
- `src/renderer/editorRuntime/preview/editorPendingChangeRequests.js`
- `src/renderer/editorRuntime/preview/index.js`

Diese Dateien sind nur Kandidaten. Vor einer Uebernahme muss jede Datei gegen den Kit-Vertrag, den Zielpfad `src/runtime/preview/`, die CommonJS-Struktur und die Guardrail-Tests geprueft werden.

## Anpassungen vor einer Uebernahme

Vor einer spaeteren Uebernahme sind mindestens diese Anpassungen noetig:

- Pfade auf `src/runtime/preview/` umstellen.
- Modulformat an die bestehende Kit-Struktur angleichen.
- Exporte gegen `docs/PREVIEW_RUNTIME_API.md` abgleichen.
- Keine Host-App-spezifischen Defaults uebernehmen.
- Keine produktiven Integrationsaufrufe uebernehmen.
- Keine Speicher-, Datei-, IPC- oder Datenbankzugriffe uebernehmen.
- Keine fachlichen Begriffe, Feldnamen oder Sonderfaelle uebernehmen.
- Kopierverhalten fuer Rueckgaben pruefen.
- Fehler- und Leerergebnisverhalten fachneutral dokumentieren.
- Bestehende Kit-Modelle fuer Registry, Editor-Core, Host-Adapter und ChangeRequest bevorzugen.

## Sinnvoll zu uebertragende Tests

Spaeter sinngemaess ins Kit zu uebertragen:

- Operation nur erlaubt, wenn sie in `allowedOps` steht.
- Operation gesperrt, wenn sie in `lockedOps` steht.
- `lockedOps` ueberstimmt erlaubte Operationen.
- Unbekannte Elemente werden abgelehnt oder neutral leer beantwortet.
- Ziel-Element-ID wird nur aus bekanntem Knoten, Registry-Element oder HostContext abgeleitet.
- Preview-Target wird nicht geraten.
- Pending-ChangeRequests bleiben temporaer und speicherlos.
- Pending-ChangeRequests koennen je Ziel entfernt werden.
- Pending-ChangeRequests liefern kopierte Summary-Daten.
- ChangeRequests enthalten keine verbotenen Fach- oder Speicherfelder.
- Preview-Runtime-Pfad bleibt frei von host- und fachbezogenen Sperrbegriffen.

## Ausdruecklich nicht uebernehmen

Nicht uebernehmen:

- konkrete Host-App-Orchestrierung
- konkrete Ziel-App-CoreShell
- konkrete Ziel-App-Registry
- DOM-Panel
- Drag-Panel
- Fachlogik
- Speicherung
- Datenbanklogik
- IPC
- localStorage oder andere Browser-Speicher
- PDF-/Drucklogik
- ziel-app-spezifische Feldnamen oder Sonderfaelle
- alte Editorpfade
- automatische UI-Analyse, Scans oder Migration

## Abnahmekriterien fuer eine spaetere echte Uebernahme

Eine spaetere Codeuebernahme ist erst abnahmefaehig, wenn:

- die LV-Position fuer die technische Runtime-Implementierung ergaenzt ist,
- der API-Vertrag weiterhin gilt,
- alle neuen Runtime-Funktionen fachneutral getestet sind,
- `npm test` gruen ist,
- `git diff --check` gruen ist,
- keine produktive Host-App-Integration entstanden ist,
- keine Speicherung, DB, IPC oder PDF-/Drucklogik eingefuehrt wurde.
