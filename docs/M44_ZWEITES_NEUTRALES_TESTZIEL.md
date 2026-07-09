# M44 Zweites neutrales Testziel

## 1. Zweck

M44 ergaenzt das UI-Editor-kit um ein zweites neutrales Ziel-App-Testziel. Es dient als kleines, repo-internes Referenz-Fixture fuer Ziel-Apps, die den offiziellen Kit-Vertrag sauber erfuellen wollen.

Das Testziel enthaelt keine produktiven Daten, keine Fachlogik, keine BBM-Namen und keine echte Ziel-App-Integration. Es beweist stattdessen:

- explizite Ziel-App-Info
- offizielles AdapterManifest
- Registry mit zwei UI-Scopes
- Mapping von UI-Scope zu Layout-Scope
- HostAdapter nach Vertrag
- LayoutState
- allowedOps/lockedOps
- registrierte Auswahl
- blockierte unbekannte Elemente
- blockierte falsche Scope-/Element-Kombinationen
- layout-only Save/Load/Reset oder bewusst blockierte Layout-Flows

## 2. Warum BBM allein nicht reicht

M43 bewertet BBM als Referenz-Ziel-App nur teilweise geeignet. BBM beweist viel echtes Runtime-Verhalten im App-Kontext, bleibt aber fachnah:

- BBM nutzt eigene Scope-, Katalog-, Adapter- und Statusformen.
- BBM enthaelt produktive Ziel-App-Strukturen und Fachmodule.
- BBM ist wichtig als Pilot- und Referenzumgebung, aber nicht neutral genug als alleiniger Produktbeweis.

Das zweite neutrale Testziel trennt Produktvertrag und Ziel-App-Fachkontext deutlicher. Es zeigt, dass M39 bis M42 nicht nur mit BBM funktionieren.

## 3. Ort und Aufbau

Ort:

- `scripts/fixtures/neutral-target-app/neutralTargetApp.cjs`

Test:

- `scripts/tests/neutral-target-app.test.cjs`

Exporte:

- `getNeutralTargetAppInfo()`
- `getNeutralTargetAppScopes()`
- `resolveNeutralLayoutScope(uiScope)`
- `listElementsForScope(uiScope)`
- `createNeutralTargetAppRegistry(options)`
- `createNeutralTargetAppAdapterManifest(options)`
- `createNeutralTargetAppHostAdapter(options)`
- `createNeutralTargetApp(options)`

Das Fixture ist bewusst kein Core-Modul und keine Editor-App-Shell. Es liegt unter `scripts/fixtures/`, weil es primaer fuer Tests, Vertragschecks und spaetere Installer-/Adapter-Pruefungen gedacht ist.

## 4. Scope- und Layout-Scope-Modell

Das Testziel liefert zwei neutrale UI-Scopes:

| UI-Scope | Layout-Scope | Zweck |
| --- | --- | --- |
| `scope.alpha` | `layout.alpha` | erster neutraler Referenz-Scope |
| `scope.beta` | `layout.beta` | zweiter neutraler Referenz-Scope |

Jeder Scope liefert eine eigene Registry mit fuenf neutralen Elementen:

- `root`
- `header` als `area`
- `group`
- `field`
- `actionButton` als `button`

Die Scope-Zuordnung wird nicht geraten. Sie steht explizit im AdapterManifest ueber `uiScope`, `layoutScope` und `uiToLayoutScope`.

## 5. Erfuellte Kit-Vertraege

Das neutrale Testziel erfuellt diese Kit-Bausteine:

- HostAdapter-Vertrag mit `getRegistry()`, `getCurrentLayoutState()` und `submitChangeRequest()`
- optionalem `getAdapterManifest()`
- optionalem layout-only `saveLayoutState()`, `loadLayoutState()` und `resetLayoutState()`
- AdapterManifest mit Ziel-App-ID, Adaptername, Version, UI-Scope, Layout-Scope, Profil, Elementtypen, Rollen, Operationen, Sperren, Persistence-, Execution-, Risk-, Rollback- und Testangaben
- Registry-Elemente nach UI-Element-Modell
- ChangeRequest-Pruefung ueber den generischen Validator
- Runtime-Start ueber `createEditorRuntimeLauncher()`
- RuntimeStatus ueber `createEditorRuntimeStatusViewModel()`
- Scope-Anzeige ueber `createEditorScopeViewModel()`
- Scope-Wechsel mit Selection-Reset ueber `createEditorScopeChangeViewModel()`
- Selection-Status ueber `createEditorSelectionViewModel()`
- Layout-Control-Status ueber `createEditorLayoutControlViewModel()`

## 6. Testabdeckung

Der neue Test prueft:

- HostAdapter-Vertrag
- gueltiges AdapterManifest
- Runtime-Launcher-Start
- RuntimeStatus `ok`
- Scope-ViewModel mit UI-Scope und Layout-Scope
- Selection eines registrierten Elements
- `unknown_element`
- `wrong_scope`
- `no_selection`
- Scope-Wechsel leert Selection
- allowedOps/lockedOps
- layout-only Save/Load/Reset verfuegbar
- bewusst blockierte Save/Load/Reset-Flows
- ChangeRequest-Erzeugung und Annahme im Testhost
- unbekanntes Element im ChangeRequest wird blockiert
- kein DOM-Scan
- keine automatische Registry-Befuellung
- keine Fachlogik
- keine DB-, PDF-, Druck-, Mail- oder Audio-Funktion
- keine BBM-, Restarbeiten-, Protokoll- oder TOPS-Begriffe im Fixture

## 7. Nicht enthalten

Das neutrale Testziel enthaelt bewusst nicht:

- BBM-Integration
- BBM-Scopes
- Restarbeiten-Fachlogik
- Protokoll-/TOPS-Fachlogik
- DB-Anbindung
- PDF-, Druck-, Mail- oder Audio-Funktionen
- DOM-Scan
- automatische UI-Erkennung
- automatische Registry-Befuellung
- Migration bestehender UI
- Electron-App
- grosse Editor-App-Shell

## 8. Folgepaket M45

M45 sollte als naechstes die Layout-Speicherung, Reset-Logik und Versionierung produktfaehig machen.

Durch M44 gibt es dafuer zwei Referenzachsen:

- BBM als echte, aber fachnahe Referenz-Ziel-App
- neutral-target-app als kleines, sauberes Vertrags-Fixture

M45 sollte daran festlegen:

- LayoutState-Schema und Versionierung
- Reset-Semantik pro Layout-Scope
- Speicherformat und Kompatibilitaetsregeln
- Fehlermeldungen bei inkompatiblen Layout-Versionen
- klare Trennung zwischen Layoutdaten und Ziel-App-Fachdaten
