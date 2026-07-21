# M70 Generic Panel

## Verantwortung der Panel-Schicht

M70 stellt ein fachneutrales Bedienpanel fuer die M69-Runtime bereit. Das Panel liest Runtime- und Registry-Status, zeigt Selection-, Mode-, D-Pad-, Dialog-, Persistenz- und Status-ViewModels an und uebersetzt Benutzeraktionen in neutrale Intents.

## Abgrenzung zur Runtime

Die Runtime bleibt fuer Session, Layoutentries, Save, Load, Discard, Reset, Rollback und HostAdapter-Aufrufe verantwortlich. Der Panel-Controller ruft nur oeffentliche Runtime-Methoden auf. Fuer relative D-Pad-Aenderungen nutzt M70 `runtime.inspectElement(elementId)` als reine Lese-API mit `currentEntry`, `effectiveLayout`, `baselineEntry`, `changed`, `allowedOps` und `effectiveOps`. `effectiveLayout` ist der nutzbare aktuelle Host-/Layoutwert fuer relative Groessenaenderungen; fehlende Breiten oder Hoehen werden nicht als `0` interpretiert.

## Abgrenzung zum Ziel-App-Host

Das Panel kennt keine HTMLElement-Refs der Ziel-App, sucht keine Ziel-App-Elemente und veraendert keine Ziel-App-Styles. Die Ziel-App liefert Registry und spaeter ab M71 Auswahlereignisse, SelectionHost und Overlay.

## Controller-API

Oeffentlich exportiert ist `createUiEditorPanelController({ runtime, registry, messages?, initialMode?, stepSize? })`. Der Controller bietet `selectElement`, `clearSelection`, `setMode`, `setStepSize`, `activateDirection`, `activateCenter`, `save`, `load`, `discardAll`, Reset-Dialogmethoden, `refresh`, `getState`, `subscribe` und `destroy`.

## ViewModel

`createUiEditorPanelViewModel(...)` erzeugt reine Datenstrukturen fuer Auswahl, Modi, D-Pad, Aktionen, Session, Persistenz, Dialog, Status und Busy. Jede Schaltflaeche besitzt `enabled`, `visible`, `label`, `intent` und optional `reasonCode`.

## Modi

Die Logik verwendet ausschliesslich `move`, `width` und `height`. `move` ist nur bei effektiver Operation `move` verfuegbar. `width` und `height` sind nur bei effektiver Operation `resize` verfuegbar. `capabilities` werden nicht ausgewertet.

## D-Pad

Die Richtungen sind `up`, `down`, `left`, `right` und `center`. Die Standardschrittweite betraegt `5` und ist konfigurierbar. Move veraendert x/y; fehlende x/y duerfen als neutrale Abweichung `0` behandelt werden. Width und Height arbeiten dagegen nur mit endlichen aktuellen Werten aus `effectiveLayout`; fehlt dieser Wert, wird `CURRENT_VALUE_UNAVAILABLE` gemeldet und keine Runtimeaenderung ausgefuehrt. Mindestwerte aus `minWidth` oder `minHeight` werden respektiert; ohne Registry-Grenze gilt eine technische Untergrenze von `1`.

Der Mittelpunkt `↶` bedeutet ausschliesslich: Sitzungsänderungen dieses Elements verwerfen. Er ruft `runtime.discardElementChanges(elementId)` auf, speichert nicht und loescht keinen persistenten Eintrag.

## Vier Verwerfen-/Resetaktionen

1. Mittelpunkt im D-Pad: ausgewaehltes Element auf Sessionbaseline, nicht persistent.
2. Alle Änderungen verwerfen: gesamter Scope auf Sessionbaseline, nicht persistent.
3. Element auf Standard zurücksetzen: nur das ausgewaehlte Element dauerhaft, persistenter Eintrag wird entfernt.
4. Standardlayout wiederherstellen: gesamter Scope dauerhaft, gespeicherter Scope-/Profilzustand wird geloescht.

## Dialoge

Dialogtypen sind `reset-element` und `reset-layout`. Dialoge sind neutrale ViewModels. Oeffnen veraendert Runtime und Auswahl nicht. Bestaetigen ruft genau eine Runtimeoperation auf, Abbrechen veraendert nichts. Nach dem Oeffnen setzt der Renderer den Fokus bewusst auf den sicheren Abbrechen-Button. Beim Schliessen merkt der Renderer ein stabiles `data-focus-key` und fokussiert nach dem Re-Render den neu erzeugten Ausloeser innerhalb des Panelroots.

## Persistenzstatus

Das Panel liest strukturierten Persistenzstatus. Speichern ist bei fehlender oder nicht dauerhafter Persistenz deaktiviert. Laden ist bei fehlender Persistenz deaktiviert. Dauerhafte Resetaktionen benoetigen dauerhafte Persistenz. Session-Verwerfen bleibt moeglich.

## Messages

`createPanelMessageCatalog(overrides?)` liefert deutsche Standardtexte mit austauschbaren MessageKeys. Controller- und ViewModel-Logik nutzen Codes und MessageKeys, keine sichtbaren Texte.

## Accessibility

Der Renderer erzeugt Buttons mit `type="button"`, zugänglichen Namen, korrektem disabled-Status, Statuszeile mit `role="status"` und Dialoge mit `role="dialog"`. Pfeiltasten wirken nur innerhalb des D-Pads, Escape schliesst offene Dialoge.

## Beispielintegration

```js
const { createUiEditorPanelController, createUiEditorPanel } = require("ui-editor-kit");

const controller = createUiEditorPanelController({ runtime, registry });
createUiEditorPanel({ controller, mountTarget });
controller.selectElement("neutral.element.id");
```

## Nicht-Ziele

M70 baut keinen echten Browser-SelectionHost, keinen Auswahlrahmen auf Ziel-App-Elementen, keinen Ref-Resolver, keinen produktiven Browser-Storage-Adapter, keine automatische DOM-Erkennung, keine Mehrfachauswahl, kein Drag-and-drop, kein Autosave und keine Fachlogik.

## Übergang zu M71

M71 bindet echte Browser-Refs, Auswahlereignisse, SelectionHost und Overlay an. M70 bleibt die neutrale Panel- und ViewModel-Schicht zwischen Ziel-App-Auswahlereignissen und M69-Runtime.
