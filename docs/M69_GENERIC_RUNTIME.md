# M69: Generische Runtime

## Verantwortung

M69 ergaenzt das UI-Editor-kit um eine fachneutrale programmatische Runtime. Sie verwaltet Sessionzustand, Baseline, neutrale Layoutentries, Validierung, strukturierte Resultate sowie Save-, Load-, Reset-, Discard- und Reapply-Ablaeufe.

Zielanwendungen liefern Registry, Element-Referenzen, HostAdapter und persistenten Storage.

## Public API

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

`beginSession` ist idempotent. Eine bereits aktive Session aendert weder Persistenz noch Zielzustand.

## Sessionmodell

Die Runtime fuehrt pro `targetContext` eine aktive oder inaktive Session.

- `baselineEntries` sind die Rueckkehrlinie fuer Verwerfen.
- `sessionEntries` sind aktuelle Editor-Abweichungen.
- Fehlende Entries bedeuten Ziel-App-Standard.
- Aenderungsstatus wird strukturiert und ohne sichtbare Texte als Logikschluessel berechnet.

## Layoutentry-Modell

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

Die Felder werden gegen Registry-Operationen und Grenzen validiert. Persistente Entries gelten niemals ungeprueft als vertrauenswuerdig.

Fachdaten, Tabelleninhalte, Texteingaben und zielsystemspezifische Objekte gehoeren nicht in Session oder Persistenz.

## Speichervertrag

Der Storage-Adapter stellt mindestens bereit:

- `available`
- `persistent`
- `readResult(context)`
- `write(context, entries)`
- `clear(context)`

Optional:

- `deleteEntry(context, elementId)`
- `readEntry(context, elementId)`
- `replaceEntries(context, entries)`

Dauerhafte Operationen werden blockiert, wenn Storage nicht verfuegbar oder nicht persistent ist. Nach Schreiben und Loeschen erfolgt ein Kontrolllesen fuer denselben vollstaendigen Kontext.

## HostAdapter-Vertrag

Die Runtime erwartet:

- `validateElementRef(elementId)`
- `captureElementLayoutState(elementId)`
- `applyLayoutEntry(elementId, entry)`
- `clearElementLayout(elementId, registryElement?)`
- `restoreElementLayoutState(elementId, snapshot)`
- `getCurrentLayoutEntry(elementId)`
- optional `reapplyLayoutEntries(entries)`

Snapshots duerfen nur layoutbezogenen Zielzustand enthalten. Konkrete Referenzen bleiben intern in der Zielanwendung.

## Save und Load

`saveLayout` schreibt den aktuellen Sessionzustand, kontrollliest ihn und setzt erst danach die neue Baseline.

`loadLayout` liest nur den aktuellen Kontext, validiert alle Entries vollstaendig, sichert Session, Baseline und Zielzustand und wendet erst danach an.

Ungueltige oder fremde Elemente blockieren den gesamten Vorgang, damit kein Teilzustand entsteht.

## Reset und Discard

- `discardElementChanges` und `discardAllChanges` kehren zur Sessionbaseline zurueck und veraendern Persistenz nicht.
- `resetElementToDefaults` entfernt nur ein Element aus Zielzustand, Session, Baseline und Persistenz.
- `resetLayoutToDefaults` entfernt alle editierbaren Abweichungen fuer den aktuellen Kontext.

Die Ziel-App-Wahrheit bleibt der Standard. Die Runtime erfindet keine Zielwerte.

## Rollback

Vor sichtbaren oder destruktiven Schritten sichert die Runtime relevante Sessionentries, Baselineentries, Host-Snapshots und bei Persistenzaenderungen den vorherigen persistenten Zustand.

Bei Fehlern erfolgt ein bestmoeglicher Rollback. Rollbackfehler werden strukturiert gemeldet, ohne den urspruenglichen Fehlercode zu verlieren.

## Nicht-Ziele

M69 baut kein Bedienpanel, keine Ziel-App-Installation, keine automatische Elementerkennung, kein Autosave, keine Mehrfachauswahl und keine Fachlogik.

## Uebergang zu M70

M70 baut auf dieser Runtime ein generisches Bedienpanel und passende ViewModels auf. Die Runtime bleibt die fachneutrale Zustands- und Ablaufquelle.
