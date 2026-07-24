# M69 Generic Runtime

## Verantwortung

M69 ergaenzt das UI-Editor-kit um eine fachneutrale programmatische Runtime. Sie verwaltet Sessionzustand, Baseline, neutrale Layoutentries, Validierung, strukturierte Resultate sowie Save-, Load-, Reset-, Discard- und Reapply-Ablaufsteuerung. Zielanwendungen liefern weiterhin Registry, Element-Refs, sichtbare Anwendung und persistenten Storage.

## Public API

Der oeffentliche Einstieg exportiert `createUiEditorRuntime(options)`, `validateLayoutEntryForElement(entry, registryElement)`, `resolveOperationStep(options)` sowie `RUNTIME_ERROR_CODES`.

```js
const { createUiEditorRuntime } = require("ui-editor-kit");

const runtime = createUiEditorRuntime({
  registry,
  hostAdapter,
  layoutStorage,
  targetContext: {
    targetAppId: "neutral-reference-app",
    moduleId: "main-module",
    scopeId: "main-layout",
    layoutProfileId: "default",
  },
});
```

Methoden:

- `beginSession(scopeId?)`
- `getSessionStatus(scopeId?)`
- `applyChange(changeRequest)`
- `discardElementChanges(scopeId?, elementId)`
- `discardAllChanges(scopeId?)`
- `resetSessionBaseline(scopeId?)`
- `resetSessionBaselineElement(scopeId?, elementId)`
- `saveLayout(scopeId?)`
- `loadLayout(scopeId?)`
- `resetLayoutToDefaults(scopeId?)`
- `resetElementToDefaults(scopeId?, elementId)`
- `reapplyCurrentLayoutState(scopeId?)`
- `endSession(scopeId?)`

`beginSession` ist idempotent: eine bereits aktive Session liefert ein OK-Result mit `ALREADY_ACTIVE`-Hinweis und aendert weder Persistenz noch sichtbaren Zustand.

## Sessionmodell

Die Runtime fuehrt pro `targetContext` eine aktive oder inaktive Session. `baselineEntries` sind die neutrale Rueckkehrlinie fuer Discard-Operationen. `sessionEntries` sind aktuelle Editor-Abweichungen. Fehlende Entries bedeuten Ziel-App-Standard. `changedElementIds`, `changedCount`, `changedByElementId` und `baselineVersion` werden strukturiert berechnet, ohne sichtbare Texte als Logikschluessel zu verwenden.

## Layoutentry-Modell

Ein Layoutentry enthaelt ausschliesslich bekannte neutrale Felder und wird feldweise gegen Registry-Operationen validiert: `x`/`y` erfordern `move`, `width`/`height` erfordern `resize`, `visible: true` erfordert `show` und `visible: false` erfordert `hide`; gesperrte Operationen blockieren das gesamte Entry. Ein persistenter Entry ist keine vertrauenswuerdige Eingabe.

Ein Layoutentry enthaelt ausschliesslich bekannte neutrale Felder:

```js
{
  elementId,
  x,
  y,
  width,
  height,
  visible,
}
```

Leere Entries werden normalisiert entfernt. DOM-Objekte, CSS-Selektoren, Fachdaten, Tabelleninhalte und Texteingaben gehoeren nicht in Session oder Persistenz.

## Speichervertrag

Der Storage-Adapter stellt mindestens bereit:

- `available`
- `persistent`
- `readResult(context)`
- `write(context, entries)`
- `clear(context)`

Optional kann er `deleteEntry(context, elementId)`, `readEntry(context, elementId)` oder `replaceEntries(context, entries)` anbieten. Fehlt `deleteEntry`, nutzt die Runtime Read-Modify-Write. Dauerhafte Operationen blockieren strukturiert, wenn Storage nicht verfuegbar oder nicht persistent ist. Nach Write und Clear erfolgt ein Kontrolllesen fuer denselben vollstaendigen Kontext aus `targetAppId`, `moduleId`, `scopeId` und `layoutProfileId`.

## HostAdapter-Vertrag

Die Runtime erwartet folgende fachneutrale HostAdapter-Methoden:

- `validateElementRef(elementId)`
- `captureElementLayoutState(elementId)`
- `applyLayoutEntry(elementId, entry)`
- `clearElementLayout(elementId, registryElement?)`
- `restoreElementLayoutState(elementId, snapshot)`
- `getCurrentLayoutEntry(elementId)`

Optional kann `reapplyLayoutEntries(entries)` angeboten werden. Snapshots duerfen nur layoutbezogenen sichtbaren Zustand enthalten. Konkrete DOM-Refs bleiben intern in der Zielanwendung.

## Save und Load

`saveLayout` schreibt den aktuellen Sessionzustand, kontrollliest ihn und macht erst danach den aktuellen Zustand zur neuen Baseline. Bei Verify-Fehlern wird der vorherige persistente Zustand bestmoeglich wiederhergestellt; Session und Baseline bleiben unveraendert. `loadLayout` liest nur den aktuellen Kontext, validiert alle Entries vollstaendig gegen Registry, erlaubte neutrale Layoutanwendung und HostAdapter-Refs, sichert Session, Baseline und sichtbare Snapshots, wendet erst danach sichtbar an und setzt geladenen Zustand als Session und Baseline. Das geladene Layout ist die vollstaendige Abweichungswahrheit: zuvor vorhandene, aber im geladenen Layout fehlende editierbare Entries werden sichtbar entfernt. Ungueltige oder fremde Elemente werden blockiert, damit kein Teilzustand sichtbar bleibt.

## Reset und Discard

`discardElementChanges` und `discardAllChanges` kehren zur Sessionbaseline zurueck und veraendern Persistenz nicht. `resetElementToDefaults` entfernt nur ein angegebenes Element sichtbar, in Session, Baseline und Persistenz und rollt bei Persistenz-Verify-Fehlern nur dieses Element zurueck. `resetLayoutToDefaults` entfernt alle editierbaren Abweichungen fuer den aktuellen Kontext und rollt bei Clear-, Verify- oder Hostfehlern sichtbaren Zustand, Session, Baseline und Persistenz bestmoeglich zurueck. Die Ziel-App-CSS-/Registry-Wahrheit bleibt der Standard; die Runtime erfindet keine Pixeldefaults.

## Rollback

Vor sichtbaren oder destruktiven Schritten sichert die Runtime relevante Sessionentries, Baselineentries, Host-Snapshots und bei Persistenzaenderungen den alten persistenten Zustand. Bei Fehlern erfolgt ein bestmoeglicher Rollback. Wenn ein Rollback scheitert, wird das Ergebnis mit `rollbackComplete: false`, `ROLLBACK_FAILED`-Warnung und `rollbackErrors` gemeldet; der urspruengliche Fehlercode bleibt erhalten.

## Fehlercodes

`RUNTIME_ERROR_CODES` enthaelt neutrale Codes wie `INVALID_TARGET_CONTEXT`, `INVALID_REGISTRY`, `INVALID_HOST_ADAPTER`, `UNKNOWN_SCOPE`, `UNKNOWN_ELEMENT`, `ELEMENT_NOT_EDITABLE`, `OPERATION_NOT_ALLOWED`, `SESSION_NOT_ACTIVE`, `STORAGE_UNAVAILABLE`, `STORAGE_NOT_PERSISTENT`, `STORAGE_READ_FAILED`, `STORAGE_WRITE_FAILED`, `STORAGE_CLEAR_FAILED`, `STORAGE_VERIFY_FAILED`, `ELEMENT_REF_MISSING`, `HOST_APPLY_FAILED`, `HOST_CAPTURE_FAILED`, `HOST_READ_FAILED`, `HOST_CLEAR_FAILED`, `ROLLBACK_FAILED` und `INVALID_LAYOUT_ENTRY`.

## Nicht-Ziele

M69 baut kein Bedienpanel, kein D-Pad, keine Dialog-DOM-Struktur, kein Browser-Overlay, keine Browser-Referenzanwendung, keine Ziel-App-Installation, keine DOM-Suche, kein Autosave, keine Mehrfachauswahl und keine Fachlogik.

## Uebergang zu M70

M70 kann auf dieser programmatischen Runtime ein generisches Bedienpanel und passende ViewModels aufbauen. Die M69-Runtime bleibt dabei die fachneutrale Zustands- und Ablaufquelle.
