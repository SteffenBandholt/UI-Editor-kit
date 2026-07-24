# M70: Generisches Bedienpanel

## Verantwortung

M70 stellt ein fachneutrales Bedienpanel fuer die M69-Runtime bereit. Das Panel liest Runtime- und Registry-Status, zeigt Auswahl, Modus, Steuerkreuz, Dialog, Persistenz und Status an und uebersetzt Benutzeraktionen in neutrale Intents.

## Abgrenzung zur Runtime

Die Runtime bleibt fuer Session, Layoutentries, Save, Load, Discard, Reset, Rollback und HostAdapter-Aufrufe verantwortlich.

Der Panel-Controller ruft nur oeffentliche Runtime-Methoden auf. Relative Aenderungen nutzen `runtime.inspectElement(elementId)` als reine Lese-API.

## Abgrenzung zur Ziel-App

Das Panel kennt keine konkreten Ziel-App-Elemente, sucht keine Elemente und veraendert keine Ziel-App-Fachlogik. Die Ziel-App liefert Registry, Auswahlereignisse, Auswahlsteuerung und Darstellung der Auswahl.

## Controller-API

Oeffentlich exportiert ist:

```js
createUiEditorPanelController({
  runtime,
  registry,
  messages?,
  initialMode?,
  stepSize?
})
```

Der Controller bietet unter anderem:

- `selectElement`
- `clearSelection`
- `setMode`
- `setStepSize`
- `activateDirection`
- `activateCenter`
- `save`
- `load`
- `discardAll`
- Reset-Dialogmethoden
- `refresh`
- `getState`
- `subscribe`
- `destroy`

## ViewModel

`createUiEditorPanelViewModel(...)` erzeugt reine Datenstrukturen fuer Auswahl, Modi, Steuerung, Aktionen, Session, Persistenz, Dialog, Status und Busy-Zustand.

Jede Schaltflaeche besitzt `enabled`, `visible`, `label`, `intent` und optional `reasonCode`.

## Modi

Die Logik verwendet `move`, `width` und `height`.

- `move` ist nur bei effektiver Operation `move` verfuegbar.
- `width` und `height` sind nur bei effektiver Operation `resize` verfuegbar.
- Capabilities werden nicht als Ersatz fuer Registry-Operationen ausgewertet.

## Steuerkreuz

Die Richtungen sind `up`, `down`, `left`, `right` und `center`.

Die Standardschrittweite betraegt `5` und ist konfigurierbar. Mindestwerte aus der Registry werden respektiert. Fehlen notwendige aktuelle Werte, wird keine Aenderung ausgefuehrt und ein strukturierter Fehler gemeldet.

Der Mittelpunkt bedeutet ausschliesslich: Sitzungsanderungen dieses Elements verwerfen. Er speichert nicht und loescht keinen persistenten Eintrag.

## Verwerfen und Reset

1. Mittelpunkt: ausgewaehltes Element auf Sessionbaseline.
2. Alle Aenderungen verwerfen: gesamter Scope auf Sessionbaseline.
3. Element auf Standard: nur das ausgewaehlte Element dauerhaft zuruecksetzen.
4. Standardlayout wiederherstellen: gesamten Scope dauerhaft zuruecksetzen.

## Dialoge

Dialogtypen sind `reset-element` und `reset-layout`.

Dialoge sind neutrale ViewModels. Oeffnen veraendert Runtime und Auswahl nicht. Bestaetigen ruft genau eine Runtimeoperation auf. Abbrechen veraendert nichts.

## Persistenzstatus

Das Panel liest strukturierten Persistenzstatus.

- Speichern ist bei fehlender oder nicht dauerhafter Persistenz deaktiviert.
- Laden ist bei fehlender Persistenz deaktiviert.
- Dauerhafte Resetaktionen benoetigen dauerhafte Persistenz.
- Session-Verwerfen bleibt moeglich.

## Meldungen

`createPanelMessageCatalog(overrides?)` liefert austauschbare Standardtexte. Controller und ViewModel nutzen Codes und MessageKeys, keine sichtbaren Texte als Logikschluessel.

## Beispielintegration

```js
const {
  createUiEditorPanelController,
  createUiEditorPanel,
} = require("ui-editor-kit");

const controller = createUiEditorPanelController({ runtime, registry });
createUiEditorPanel({ controller, mountTarget, environmentAdapter });
controller.selectElement("neutral.element.id");
```

## Nicht-Ziele

M70 baut keine automatische Elementerkennung, keine Mehrfachauswahl, kein Drag-and-drop fuer Ziel-App-Elemente, kein Autosave und keine Fachlogik.

## Uebergang zu M71

M71 bindet konkrete Element-Referenzen, Auswahlereignisse, Auswahlsteuerung und Darstellung der Auswahl ueber plattformneutrale Schnittstellen an. M70 bleibt die neutrale Panel- und ViewModel-Schicht.
