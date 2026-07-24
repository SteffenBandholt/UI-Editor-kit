# M57 Selection-Architektur

M57 definiert einen stabilen, neutralen Vertrag fuer visuelle Auswahl.

## Architekturentscheidung

Die Registry enthaelt nur serialisierbare Metadaten. Ein `ElementRefResolver` liefert die aktuellen Laufzeitreferenzen zu einer `elementId`. Dadurch bleiben App-Vertraege, Prozessgrenzen und konkrete UI-Objekte sauber getrennt.

## Oeffentliche Bausteine

- `SELECTION_CONTRACT_VERSION`
- `SelectionContractErrorCodes`
- `validateSelectionTargetContract`
- `validateElementRefResolver`
- `validateSelectionHost`
- `validateSelectionControllerContract`
- `createSelectionStateSnapshot`

## Runtime-Grenze

Nicht Teil dieses Vertrags sind konkrete Listener, Mounting, Drag, Resize, Apply, Undo, Speicherung oder LayoutStore-Aenderungen.

## Naechster Schritt

Eine pure Zielaufloesungsfunktion kann explizite Targets, Resolver-Ergebnisse und ein Ereignisziel entgegennehmen und deterministisch die konkrete `elementId` liefern. Sie bleibt ohne eigene Listener und ohne eigene Auswahlhaltung.
