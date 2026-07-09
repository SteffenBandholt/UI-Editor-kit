# M46: Offizieller Adapter-/Installer-Pfad

M46 sichert den fachneutralen Weg ab, mit dem eine fremde Ziel-App das UI-Editor-kit anbinden kann. Der Pfad ist kein Spezialfall einer Referenz-App und keine Editor-Shell, sondern ein kleiner Core-Vertrag.

## Offizieller Anbindungsweg

1. Die Ziel-App stellt ein `AdapterManifest` bereit.
2. Die Ziel-App stellt einen `HostAdapter` bereit.
3. Der `HostAdapter` liefert eine manuell gepflegte Element-`Registry`.
4. Der Core validiert Manifest, Adapter, Scope, Layout-Scope und Layout-Profil.
5. Der `RuntimeLauncher` startet gegen diesen geprüften Adapter.
6. Aus dem Runtime-Status entstehen Status-, Scope-, Selection- und Layout-Control-ViewModels.
7. Ein `LayoutStateStore` speichert, lädt und setzt Layoutzustände profilbezogen zurück.

Die Core-API dafür liegt in `src/core/target-app-adapter-path.cjs`:

- `validateTargetAppAdapterPath(input)` prüft den Vertrag und liefert ein neutrales Ergebnis.
- `createTargetAppAdapterRuntime(input)` prüft den Vertrag und liefert bei Erfolg Runtime-Objekte sowie ViewModels.
- `getTargetAppAdapterPathSummary(input)` liefert dieselbe neutrale Zusammenfassung wie die Validierung.

## Pflichtteile der Ziel-App

Eine Ziel-App muss folgende Teile selbst bereitstellen:

- `targetAppId`, `adapterName`, `uiScope`, `layoutScope` und `layoutProfileId` im Manifest.
- Einen `HostAdapter` mit den vertraglichen Methoden.
- Eine bereits vorhandene, bewusst kuratierte Registry.
- Ein stabiles Mapping von UI-Scope zu Layout-Scope.
- Ein Layout-Profil, das im `LayoutStateStore` isoliert adressierbar ist.

## Ergebnisformat

Der Adapter-Pfad liefert neutral auswertbare Felder:

- `ok`
- `status`
- `blockCode`
- `message`
- `targetAppId`
- `adapterName`
- `uiScope`
- `layoutScope`
- `layoutProfileId`
- `registryElementCount`
- `capabilities`
- `errors`

Blockierte Zustände werden mit klaren Codes gemeldet, zum Beispiel `missing_host_adapter`, `invalid_adapter_manifest`, `invalid_registry`, `unknown_scope`, `layout_profile_not_found` oder `runtime_launch_failed`.

## Scope- und LayoutScope-Isolation

`uiScope` beschreibt den fachneutralen UI-Ausschnitt. `layoutScope` beschreibt den dazugehörigen Layout-Speicherraum. `layoutProfileId` trennt Profile innerhalb dieses Speicherraums. Der `LayoutStateStore` adressiert jedes Profil über `targetAppId`, `uiScope`, `layoutScope` und `layoutProfileId`; dadurch bleiben `scope.alpha`/`layout.alpha` und `scope.beta`/`layout.beta` getrennt.

## Installer-Grenzen

Der Installer-Pfad darf nur Vertragsstruktur vorbereiten. Er darf insbesondere nicht:

- Ziel-App-Oberflächen untersuchen.
- Eine Registry selbst befüllen.
- Ziel-App-UI verändern.
- Fachlogik ausführen.
- Persistenz- oder Ausgabekanäle außerhalb des Core-Vertrags hinzufügen.

Das neutrale Testziel zeigt deshalb eine korrekte manuelle Anbindung statt einer generierten Integration.

## Zusammenhang mit M44 und M45

Das neutrale Testziel aus M44 unter `scripts/fixtures/neutral-target-app/neutralTargetApp.cjs` liefert zwei Scope-Paare: `scope.alpha`/`layout.alpha` und `scope.beta`/`layout.beta`. M46 nutzt dieses Ziel, um den offiziellen Adapter-Pfad ohne Produkt- oder Referenz-App-Spezifika zu prüfen.

Der LayoutStore aus M45 wird verwendet, um Save/Load/Reset profilbezogen zu prüfen. Damit ist abgesichert, dass der Adapter-Pfad nicht nur starten kann, sondern auch LayoutState-Isolation respektiert.

## Folgepaket M47

M47 sollte eine öffentliche Minimal-Anleitung mit einer kleinen Beispielintegration für eine neue Ziel-App bereitstellen. Diese Anleitung sollte sich auf die hier abgesicherte Core-API stützen und keine zusätzlichen Automatisierungen voraussetzen.
