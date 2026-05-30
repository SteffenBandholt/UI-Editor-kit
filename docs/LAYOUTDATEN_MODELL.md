# Layoutdaten-Modell

K1.2 beschreibt nur das Modell fuer Layoutdaten. Es wird nichts implementiert.

## A) Zweck

- Layoutdaten beschreiben ausschliesslich Darstellung/Layout.
- Layoutdaten sind strikt von Fachdaten getrennt.
- Layoutdaten beziehen sich immer auf eine `data-ui-inspector-id`.

## B) Grundstruktur

Moegliches JSON-Modell:

```json
{
  "version": 1,
  "scope": "app-or-screen-scope",
  "items": {
    "demo.header": {
      "visible": true,
      "x": 0,
      "y": 0,
      "width": 800,
      "height": 80,
      "order": 1
    }
  }
}
```

## C) Erlaubte Felder pro Element

- `visible`
- `x`
- `y`
- `width`
- `height`
- `order`
- `layoutHint`
- optional: `updatedAt`

## D) Nicht erlaubte Inhalte

Layoutdaten duerfen niemals enthalten:

- Fachdaten
- Namen echter Kunden/Nutzer/Projekte
- fachliche Statuswerte
- Datenbank-IDs von Fachobjekten
- Speicheraktionen
- Loeschaktionen
- Upload-/Importinformationen
- fachliche API-/IPC-Aktionen

## E) Zuordnung

- Jeder Layoutdatensatz gehoert zu genau einer `data-ui-inspector-id`.
- Wenn die passende UI-ID fehlt:
- keine Fachlogik ableiten
- Layoutdatensatz ignorieren oder als Konflikt melden
- Keine Zuordnung ueber Label, Textinhalt oder Fachnamen erraten.

## F) Scope

Layoutdaten koennen spaeter einen Scope brauchen, zum Beispiel:

- App
- Bildschirm/Maske
- Modul
- Benutzer
- Projekt

Scope ist technische Layout-Zuordnung, keine Fachlogikentscheidung.

## G) Validierung

- `visible` nur boolean
- `x`, `y`, `width`, `height`, `order` nur Zahlen
- negative Breiten/Hoehen verboten
- unbekannte Element-IDs melden oder ignorieren
- keine unbekannten Fachaktionen ausfuehren

## H) Anwendung

- App laedt Layoutdaten.
- App findet Elemente ueber `data-ui-inspector-id`.
- App wendet nur Darstellungseigenschaften an.
- App veraendert keine Fachdaten.

## I) Offene spaetere Bausteine

- Layoutdaten-Validator
- Speicheradapter
- Layout-Anwendung im Browser
- Import/Export
- Konfliktbericht bei fehlenden Elementen
