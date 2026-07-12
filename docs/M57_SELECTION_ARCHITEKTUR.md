# M57 Selection-Architektur

M57 fuegt keine vollstaendige Runtime hinzu. Das Paket definiert einen stabilen, neutralen Vertrag fuer spaetere visuelle Auswahl.

## Architekturentscheidung

Die Registry enthaelt nur Metadaten. Der `ElementRefResolver` liefert echte `HTMLElement`-Referenzen zur Laufzeit. Dadurch bleiben serialisierbare App-Vertraege, IPC-Grenzen und Browser-Referenzen getrennt.

## Oeffentliche Bausteine

- `SELECTION_CONTRACT_VERSION`.
- `SelectionContractErrorCodes`.
- `validateSelectionTargetContract`.
- `validateElementRefResolver`.
- `validateSelectionHost`.
- `validateSelectionControllerContract`.
- `createSelectionStateSnapshot`.

## Runtime-Grenze

Noch nicht enthalten sind Event-Listener-Runtime, Overlay-Mounting, Drag, Resize, Apply, Undo, Speicherung oder LayoutStore-Aenderungen.

## M58 kleinster naechster Schritt

Als naechster kleiner Schritt kann eine pure Zielaufloesungsfunktion ergaenzt werden, die eine explizite Target-Liste, Resolver-Ergebnisse und ein Ereignisziel entgegennimmt und deterministisch die konkrete `elementId` zurueckgibt. Diese Funktion bleibt ohne Listener und ohne Overlay.
