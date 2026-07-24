# M38 BBM-Pilotstand-Abgleich

## Grundsatz

Das `UI-Editor-kit` ist das Produkt. `BBM-Produktiv` ist nur Ziel-App, Pilot und Referenzumgebung. Ziel-App-spezifische IDs, Fachlogik, Speicherwege und Bedienbegriffe duerfen nicht in den generischen Kern uebernommen werden.

## Verbindliche Produktgrenze

Die Ziel-App liefert:

- eine explizite Registry je editorfaehigem Scope
- stabile IDs und Parent-Beziehungen
- erlaubte und gesperrte Operationen
- einen HostAdapter
- eine getrennte Layoutspeicherung
- die fachliche Entscheidung, welche UI-Elemente editorfaehig sind

Das Kit liefert:

- Registry- und Vertragspruefung
- Editor-Core und ChangeRequest-Pruefung
- Runtime, Session- und Layoutsteuerung
- neutrale ViewModels und Bedienlogik
- strukturierte Fehler- und Statuscodes

## Nicht erlaubt

- automatische UI-Erkennung
- automatische Registry-Befuellung
- Uebernahme von BBM-Fachlogik
- direkte Datenbank-, Import-, Export-, Upload-, Mail- oder Druckaktionen
- Ziel-App-spezifische Sonderfaelle im Kit
- Vermischung von Layoutdaten und Fachdaten

## Nachweis aus dem Pilot

Der Pilot hat gezeigt, dass registrierte Elemente scopebezogen ausgewaehlt, veraendert, gespeichert, geladen und zurueckgesetzt werden koennen. Unbekannte Elemente, falsche Scopes, gesperrte Operationen und nicht layoutneutrale Aenderungen werden blockiert.

## Rueckfuehrung ins Produkt

Aus dem Pilot gehoeren nur fachneutrale Vertraege und Verhaltensregeln in das Kit:

- Scope- und LayoutScope-Semantik
- Registry- und HostAdapter-Vertrag
- Save-, Load-, Reset- und Rollback-Semantik
- strukturierte Status- und Blockadecodes
- Auswahl- und Overlay-Steuerung ueber explizite Referenzen
- klare Trennung zwischen Sessionzustand und dauerhafter Speicherung

## Abnahme

- keine Ziel-App-Fachlogik im Kit
- keine automatische Erkennung oder Registrierung
- alle Aenderungen laufen ueber Registry, Runtime und HostAdapter
- `npm test` gruen
