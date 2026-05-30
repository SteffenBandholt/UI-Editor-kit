# Editor-Core

Hier wird der wiederverwendbare Editor-Core aufgebaut.

Der Editor-Core bleibt fachneutral.

Er liest nur die im UI-Editor-Vertrag beschriebenen Metadaten.

K1.0 ist nur ein Mini-Inspector als sichtbare Demo.

K1.0 enthaelt kein Speichern, keine Layoutbearbeitung und keine Fachlogik.

Der Editor-Core wird spaeter gegen die bestehende App-UI laufen.

Der Editor-Core liest `data-ui-*` aus der App-UI.

Layoutdaten bleiben getrennt von Fachdaten.

Das Layoutdaten-Modell ist in `docs/LAYOUTDATEN_MODELL.md` dokumentiert.

Es gibt noch keine Layout-Anwendung und kein Speichern.

## Spaetere Bausteine

- Metadaten-Leser
- Auswahl-Engine
- Overlay
- Editor-Panel
- Layout-Werkzeuge
- optionaler UI/PDF-Scope
