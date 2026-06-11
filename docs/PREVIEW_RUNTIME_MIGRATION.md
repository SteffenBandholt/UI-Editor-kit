# Preview-Runtime-Migrationsnotiz

## Zweck

Diese Notiz beschreibt, welche bereits vorbereiteten Preview-Runtime-Bausteine aus BBM als Referenz-App fachneutral mit dem UI-Editor-kit abgeglichen werden sollen.

Die generische Runtime-Logik wurde kontrolliert in das UI-Editor-kit uebernommen. Produktive Host-App-Anbindung, Panel-/Drag-Orchestrierung, Speicherung und Fachlogik bleiben ausgeschlossen.

## Spaetere Uebernahme- oder Abgleichkandidaten

Fachneutral abgeglichene BBM-Referenzdateien:

- `src/renderer/editorRuntime/preview/editorPreviewOperations.js`
- `src/renderer/editorRuntime/preview/editorPreviewTargetModel.js`
- `src/renderer/editorRuntime/preview/editorPendingChangeRequests.js`
- `src/renderer/editorRuntime/preview/index.js`

Die Referenzdateien wurden nicht blind kopiert, sondern auf CommonJS, Kit-Pfade und neutrale Tests uebertragen.

Fuer spaeteren ESM-Verbrauch existiert zusaetzlich ein ESM-kompatibler Preview-Runtime-Einstieg:

```text
src/runtime/preview/index.mjs
```

Dieser Einstieg re-exportiert den bestehenden CommonJS-Vertrag. Dadurch bleibt die bestehende Kit-Struktur stabil, waehrend ESM-Hosts wie BBM spaeter gegen einen klaren Runtime-Einstieg migrieren koennen.

## Anpassungen vor einer Uebernahme

Bei der Uebernahme wurden diese Anpassungen vorgenommen:

- Pfade auf `src/runtime/preview/` umstellen.
- Modulformat an die bestehende Kit-Struktur angleichen.
- ESM-kompatiblen Einstieg fuer spaetere ESM-Hosts bereitstellen.
- Exporte gegen `docs/PREVIEW_RUNTIME_API.md` abgleichen.
- Keine Host-App-spezifischen Defaults uebernehmen.
- Keine produktiven Integrationsaufrufe uebernehmen.
- Keine Speicher-, Datei-, IPC- oder Datenbankzugriffe uebernehmen.
- Keine fachlichen Begriffe, Feldnamen oder Sonderfaelle uebernehmen.
- Kopierverhalten fuer Rueckgaben pruefen.
- Fehler- und Leerergebnisverhalten fachneutral dokumentieren.
- Bestehende Kit-Modelle fuer Registry, Editor-Core, Host-Adapter und ChangeRequest bevorzugen.

## Sinnvoll zu uebertragende Tests

Sinngemaess ins Kit uebertragene Tests:

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

## Abnahmekriterien fuer spaetere Erweiterungen

Eine spaetere Erweiterung ist erst abnahmefaehig, wenn:

- eine passende LV-Position ergaenzt ist,
- der API-Vertrag weiterhin gilt,
- alle neuen Runtime-Funktionen fachneutral getestet sind,
- `npm test` gruen ist,
- `git diff --check` gruen ist,
- keine produktive Host-App-Integration entstanden ist,
- keine Speicherung, DB, IPC oder PDF-/Drucklogik eingefuehrt wurde.

## Vor spaeterer BBM-Umstellung noch offen

Vor einer echten BBM-Import-Umstellung muss entschieden werden:

- ob `package.json` einen offiziellen Package-Export fuer die Preview-Runtime erhaelt,
- ob der spaetere Verbrauch ueber `src/runtime/preview/index.mjs` oder einen gebauten Dist-Pfad laeuft,
- wie die Versionierung und Freigabe des privaten Kits erfolgt,
- welche BBM-Tests nach der Umstellung direkt gegen den Kit-Einstieg laufen.

Weiterhin nicht Teil dieses Schritts sind Host-App-Integration, Panel/Drag, Speicherung, Datenbank, IPC, localStorage, Fachlogik sowie PDF/Druck.
