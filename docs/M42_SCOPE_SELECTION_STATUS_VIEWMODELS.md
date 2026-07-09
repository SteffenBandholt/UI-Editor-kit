# M42 - Scope-/Selection-/Status-ViewModels

## Zweck

M42 ergaenzt den generischen Runtime-Launcher um kleine, fachneutrale ViewModels. Sie bereiten Runtime-, Scope-, Selection- und Layout-Control-Zustaende so auf, dass eine spaetere UI sie anzeigen kann, ohne Ziel-App-Fachlogik zu kennen oder auszufuehren.

## Zusammenhang mit M41 Runtime-Launcher

M41 liefert einen neutralen `RuntimeStatus` aus HostAdapter, optionalem AdapterManifest, Registry und LayoutState. `createEditorRuntimeStatusViewModel()` bildet diesen Status in ein UI-nahes Modell mit `ok`, `blocked`, `blockCode`, Scope-Werten, Registry-Zaehler, Selection-Hinweisen, Operationen und Fehlerliste ab.

## Scope-Modell

`createEditorScopeViewModel()` zeigt nur Scope-Informationen an, die ueber Aufrufwerte oder Manifest vorhanden sind. Es werden keine Beziehungen erraten. Fehlt `uiScope` oder `layoutScope`, oder passt der aktive Scope nicht zu explizit gelieferten `knownScopes`, blockiert das Modell mit `unknown_scope`.

`createEditorScopeChangeViewModel()` modelliert einen neutralen Scope-Wechsel und leert dabei die Selection im ViewModel.

## Selection-Modell

`createEditorSelectionViewModel()` unterscheidet diese neutralen Zustaende:

- `no_selection`: Es wurde kein Element ausgewaehlt.
- `unknown_element`: Die ID ist nicht in der Registry vorhanden.
- `wrong_scope`: Das Element enthaelt explizite Scope-Informationen, die nicht zum aktiven Scope passen.
- `selected`: Das Element ist vorhanden und auswaehlbar.
- `operation_not_allowed`: Eine angefragte Operation ist nicht erlaubt.
- `operation_locked`: Eine angefragte Operation ist gesperrt.

Allowed, locked und available Operations werden ausschliesslich aus dem Editor-Core gelesen.

## Status- und Blockadecodes

Die neutralen Meldungen liegen in `editor-status-messages.cjs` und enthalten keine Referenz-App-Begriffe. Vorhandene Codes:

- `no_selection`
- `unknown_scope`
- `unknown_element`
- `wrong_scope`
- `operation_not_allowed`
- `operation_locked`
- `invalid_payload`
- `forbidden_field`
- `layout_state_unavailable`
- `target_rejected_change`

## Layout-Control-Statusmodell

`createEditorLayoutControlViewModel()` beschreibt Save, Load und Reset als Layout-only Statusmodell. Ein Flow ist nur verfuegbar, wenn Manifest und HostAdapter ihn explizit anbieten. Das Modell fuehrt keine Speicherung aus.

Statuswerte:

- `save_available` / `save_blocked`
- `load_available` / `load_blocked`
- `reset_available` / `reset_blocked`
- `layout_state_unavailable`
- `target_rejected_change`

## Nicht-Ziele

M42 baut keine grosse Editor-App-Shell, keine Electron-App, keine Ziel-App-Integration, keine automatische UI-Erkennung, keinen DOM-Scan und keine automatische Registry-Befuellung. M42 fuehrt keine Fachaktionen aus und speichert keine Fachdaten.

## Folgepaket M43

M43 soll BBM als Referenz-Ziel-App gegen den offiziellen Kit-Vertrag pruefen. Die M42-ViewModels bleiben dabei Produktlogik des UI-Editor-kits und enthalten keine Referenz-App-spezifische Logik.
