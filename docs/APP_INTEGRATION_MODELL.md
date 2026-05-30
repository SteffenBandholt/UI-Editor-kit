# App-Integration-Modell

Dieses Dokument beschreibt fachneutral, wie der UI-Editor spaeter mit einer echten App-UI zusammenspielt.

Ergaenzend dazu beschreibt `docs/LAYOUTDATEN_MODELL.md` das Layoutdaten-Modell.

K1.2 beschreibt nur das Modell und implementiert noch kein Speichern.

## A) Grundidee

- Die App baut ihre normale UI.
- Die UI enthaelt `data-ui-*` Metadaten an editorfaehigen Elementen.
- Der Editor wird erst spaeter im Editor-Modus aktiviert.
- Der Editor liest die vorhandenen Metadaten.
- Der Editor veraendert keine Fachlogik und keine Fachdaten.

## B) Rollen

- Fach-App: enthaelt Fachregeln, Fachaktionen und Fachdaten.
- App-UI: sichtbare Oberflaeche der Fach-App mit `data-ui-*` an editorfaehigen Elementen.
- Editor-Core: liest Metadaten, waehlt Elemente und bearbeitet spaeter nur Layout-/Darstellungsdaten.
- Editor-Panel/Inspector: zeigt Elementliste und Metadaten zur aktuellen Auswahl.
- Vertragscheck: prueft vorab, ob die UI den Metadaten-Vertrag einhaelt.
- Layoutdaten: getrennte Daten fuer Position, Groesse, Sichtbarkeit und Layout-Hinweise.

## C) Normalbetrieb

- Die App laeuft ohne Editor.
- Fachfunktionen arbeiten normal.
- Buttons, Speichern, Anlegen, Loeschen, Upload und Import bleiben Fachlogik.
- Der Editor ist inaktiv.

## D) Editor-Modus

- Benutzer oder App schaltet den Editor-Modus ein.
- Der Editor sucht in der sichtbaren UI nach `data-ui-inspector-id`.
- Auswahlregel: `closest("[data-ui-inspector-id]")`.
- Der Editor zeigt Elemente und Metadaten.
- Der Editor beachtet nur erlaubte `ops`.
- Es wird keine Fachaktion ausgefuehrt.

## E) Layoutdaten

- Layoutdaten sind getrennt von Fachdaten.
- Layoutdaten koennen spaeter z. B. enthalten:
- Element-ID
- Position
- Groesse
- Sichtbarkeit
- Reihenfolge/Layout-Hinweis
- Layoutdaten duerfen keine Fachdaten enthalten.

## F) Anwendung der Layoutdaten

- Die App laedt spaeter Layoutdaten.
- Die App wendet sie auf Elemente mit passender `data-ui-inspector-id` an.
- Wenn ein Element fehlt: keine Fachlogik ableiten, sondern melden oder ignorieren.
- Keine Fachentscheidung aus Layoutdaten ableiten.

## G) Grenzen

- Der Editor speichert keine Fachdaten.
- Der Editor legt keine Fachdatensaetze an.
- Der Editor loescht keine Fachdatensaetze.
- Der Editor startet keinen Upload oder Import.
- Der Editor fuehrt keine fachlichen IPC-/API-Aktionen aus.

## H) Ablaufdiagramm als Text

1. UI-Auftrag
2. Entwurfsentscheidung
3. UI-Bau mit `data-ui-*`
4. Vertragscheck
5. App startet
6. Layoutdaten anwenden
7. Editor-Modus oeffnen
8. Editor liest Metadaten
9. Layout aendern
10. Layoutdaten speichern

Hinweis fuer K1.1: Das ist nur ein dokumentierter Ablauf, keine Implementierung.

## I) Offene spaetere Bausteine

- Layout-State-Modell
- Layout-Anwendung
- Editor-Modus-Schalter
- Speicheradapter
- Import/Export von Layoutdaten
- Konfliktverhalten bei fehlenden Elementen
