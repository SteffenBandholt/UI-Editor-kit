# M47 Neue Ziel-App: Minimal-Anbindung

## Zweck

Diese Anleitung beschreibt den kleinsten oeffentlichen Weg, wie eine neue Ziel-App das UI-Editor-kit fachneutral anbindet:

```text
Target-App -> AdapterManifest -> HostAdapter -> Registry -> RuntimeLauncher -> ViewModels -> LayoutStateStore
```

## Voraussetzungen

- Ziel-App-Vertrag v1.0
- stabiler `uiScope` und `layoutScope`
- explizite Registry
- HostAdapter
- kompatibler LayoutStateStore

## Ziel-App liefert

1. stabile Ziel-App-ID und Anzeigename
2. AdapterManifest
3. HostAdapter
4. Registry mit bekannten editorfaehigen Elementen
5. optional gespeicherte Layoutdaten

Die Ziel-App stellt ihre Registry ausschliesslich bewusst und explizit bereit.

## Kit liefert

- Manifest- und HostAdapter-Pruefung
- Registry-Auswertung
- RuntimeLauncher
- Runtime-, Scope-, Selection- und Layout-Control-ViewModels
- MemoryLayoutStateStore fuer Tests und Minimalintegration

## Minimaler Ablauf

1. Ziel-App waehlt `uiScope` und `layoutScope`.
2. Ziel-App erzeugt AdapterManifest, HostAdapter und Registry.
3. Das Kit startet ueber `createTargetAppAdapterRuntime`.
4. Save, Load und Reset laufen ausschliesslich ueber den LayoutState-Vertrag.

## HostAdapter

Minimal erforderlich:

- `getAdapterManifest()`
- `getRegistry()`
- `getCurrentLayoutState()`
- `submitChangeRequest(changeRequest)`

Bei aktivierten LayoutControls zusaetzlich:

- `saveLayoutState(layoutState)`
- `loadLayoutState(selector)`
- `resetLayoutState(selector)`

## Registry

Die Registry enthaelt nur bewusst freigegebene Elemente und stellt mindestens bereit:

- eine Funktion zum Auflisten aller Elemente
- eine eindeutige Suche nach Element-ID
- optional eine Groessenangabe

## Layoutprofil

Der LayoutStateStore verwendet:

- `targetAppId`
- `uiScope`
- `layoutScope`
- `layoutProfileId`

## Minimalbeispiel

```bash
node scripts/fixtures/minimal-target-app/minimal-target-app.cjs
```

## Nicht-Ziele

- keine Fachlogik
- keine Datenbank-Anbindung
- keine selbsttaetige UI-Erkennung
- keine selbsttaetige Erzeugung von Registry-Eintraegen
- keine selbsttaetige Migration bestehender Oberflaechen
- keine fachliche Beispiel-App
- keine vorgeschriebene Laufzeitumgebung

## Abnahme

Eine Ziel-App gilt minimal angebunden, wenn Runtime, Scope-, Selection- und Layout-Control-ViewModels korrekt starten und Save, Load sowie Reset ueber einen kompatiblen Store vertragstreu funktionieren.
