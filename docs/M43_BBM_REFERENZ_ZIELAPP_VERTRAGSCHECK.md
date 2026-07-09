# M43 BBM Referenz-Ziel-App Vertragscheck

## 1. Ergebnisuebersicht

**Bewertung:** BBM-Produktiv ist als Referenz-Ziel-App **teilweise geeignet**.

Begruendung:

- Die BBM-Runtime beweist die zentralen Ziel-App-Vertragsregeln praktisch: explizite Registry, HostAdapter, UI-Scope, Layout-Scope, LayoutState, Scope-Wechsel, Selection-Reset, layout-only Save/Load/Reset und sichtbare Blockaden.
- BBM arbeitet nur mit registrierten Elementen und blockiert unbekannte Elemente, falsche Scope-/Element-Kombinationen, nicht erlaubte Operationen und Fach-/DOM-/DB-Payloads.
- BBM nutzt aber noch eine eigene Runtime-/Inspector-/Katalogform und nicht durchgaengig die offiziellen Kit-M41/M42-ViewModels und das offizielle AdapterManifest.
- BBM ist deshalb als Referenz fuer Verhalten und Abnahmegrenzen geeignet, aber noch nicht als sauberer Adapter-Referenzfall ohne Namens-/Adapterbereinigung.

Gepruefte Scopes:

| Sichtbarer UI-Scope | Layout-Scope | Bewertung |
| --- | --- | --- |
| `restarbeiten.screen` | `restarbeiten.ui.main` | geeignet als Referenz-Scope, BBM-spezifische Namen bleiben in BBM |
| `protokoll.topsScreen` | `protokoll.topsScreen` | geeignet als Referenz-Scope, TOPS-Fachbedeutung bleibt in BBM |

Gepruefte UI-Editor-kit-Dateien:

- `docs/UI_EDITOR_VERTRAG.md`
- `docs/ZIEL_APP_ANBINDUNG.md`
- `docs/M40_BBM_RUNTIME_RUECKFUEHRUNG_PLAN.md`
- `docs/M41_GENERIC_RUNTIME_LAUNCHER.md`
- `docs/M42_SCOPE_SELECTION_STATUS_VIEWMODELS.md`
- `src/core/editor-runtime-launcher.cjs`
- `src/core/editor-runtime-status-view-model.cjs`
- `src/core/editor-selection-view-model.cjs`
- `src/core/editor-scope-view-model.cjs`
- `src/core/editor-layout-control-view-model.cjs`
- `src/core/change-request-validator.cjs`
- `src/core/target-app-adapter-manifest.cjs`
- `src/core/host-adapter-contract.cjs`

Gepruefte BBM-Dateien nur lesend:

- `docs/M33_UI_EDITOR_PROTOKOLL_SCOPE_ANBINDUNG.md`
- `docs/M34_UI_EDITOR_SCOPE_WECHSEL_BEDIENFUEHRUNG.md`
- `docs/M35_UI_EDITOR_BEDIENHINWEISE_ABNAHMEGRENZEN.md`
- `docs/M36_UI_EDITOR_FIXSTAND_ABNAHME.md`
- `docs/M37_UI_EDITOR_KLICK_ABNAHME.md`
- `src/renderer/uiEditor/bbmUiEditorRegistry.js`
- `src/renderer/uiEditor/BbmUiEditorRuntimeLauncher.js`
- `src/renderer/editorRuntime/catalog/bbmEditorCatalog.js`
- `src/renderer/editorRuntime/host/bbmEditorHostAdapterFactory.js`
- `src/renderer/editorRuntime/host/bbmEditorHostAdapterContract.js`
- `src/renderer/editorRuntime/inspector/editorScopeInspector.js`
- `src/renderer/editorRuntime/layout/editorLayoutPersistence.js`
- `src/renderer/editorRuntime/changeRequests/editorChangeRequestValidator.js`
- `src/renderer/modules/restarbeiten/editor/restarbeitenMainUiHostAdapter.js`
- `src/renderer/modules/protokoll/editor/protokollTopsUiHostAdapter.js`
- `uiEditor/targetAppRegistry.js`
- `uiEditor/targetSelection.js`
- `uiEditor/uiEditorLauncherButton.js`

An BBM wurde nichts geaendert.

## 2. Vertragscheck gegen UI-Editor-kit

| Pruefpunkt | Ergebnis | Bewertung |
| --- | --- | --- |
| Ziel-App liefert Registry | Ja | `bbmUiEditorRegistry.js`, BBM-Katalog und die Scope-Registries liefern explizite Elementlisten. |
| Ziel-App liefert HostAdapter | Ja | `createBbmEditorHostAdapter()` liefert Adapter fuer `restarbeiten.ui.main` und `protokoll.topsScreen`. |
| Ziel-App liefert UI-Scope | Ja | BBM kennt `restarbeiten.screen`, `protokoll.topsScreen` und weitere Scope-Metadaten. |
| Ziel-App liefert Layout-Scope | Ja | Mapping `restarbeiten.screen` -> `restarbeiten.ui.main`; TOPS nutzt `protokoll.topsScreen`. |
| Ziel-App liefert LayoutState | Ja | HostAdapter liefern `getCurrentLayoutState()`. |
| allowedOps/lockedOps vorhanden oder ableitbar | Ja | Registry-Eintraege enthalten `allowedOps` und `lockedOps`; Inspector leitet effektive Operationen ab. |
| Scope-Wechsel leert Selection | Ja | M34 und Runtime-Code loeschen Auswahl/Markierung beim Scope-Wechsel. |
| Falscher Scope wird blockiert | Ja | BBM blockiert falsche Scope-/Element-Kombinationen und unbekannte Scopes sichtbar. |
| Unbekanntes Element wird blockiert | Ja | Runtime und Inspector melden unbekannte Elemente als blockiert. |
| no-selection wird blockiert | Ja | M35 dokumentiert sichtbare Blockade bei keiner Auswahl. |
| Save/Load/Reset layout-only | Ja | HostAdapter speichern nur normalisierte Layoutwerte und resetten LayoutState. |
| Keine Fachdatenaenderung durch Editor | Ja | ChangeRequest- und Layout-Persistence-Guards blockieren Fach-, DOM-, DB- und Datensatzpayloads. |
| Kein DOM-Scan | Ja | BBM-Runtime nutzt vorhandene `data-ui-editor-id` Ziele und Tests sichern gegen Scan-Begriffe. |
| Keine automatische UI-Erkennung | Ja | Dokus und Tests schliessen automatische Erkennung aus. |
| Keine automatische Registry-Befuellung | Ja | Registries sind explizit; automatische Befuellung ist ausgeschlossen. |

Einschraenkungen:

- BBM nutzt eigene Statuscodes wie `ELEMENT_ID_UNKNOWN`, `SCOPE_UNKNOWN`, `OPERATION_NOT_LAYOUT_CONTROL_SAFE` und eigene Texte. Das passt fachlich, ist aber noch nicht deckungsgleich mit den M42-Codes `unknown_element`, `unknown_scope`, `wrong_scope`, `no_selection`, `operation_not_allowed` und `operation_locked`.
- BBM-HostAdapter verlangen intern `resetLayoutState()` als Pflichtmethode. Im offiziellen Kit-Vertrag ist `resetLayoutState()` optional, sofern Ziel-Apps Layout-Persistenz anbieten.
- BBM liefert aktuell keinen offiziellen Kit-`getAdapterManifest()`-Pfad fuer diese Referenzadapter. UI-Scope/Layout-Scope sind vorhanden, aber nicht durchgaengig als offizielles `target-app-adapter-manifest.cjs` beschrieben.
- `uiEditor/targetAppRegistry.js` ist ein installiertes generisches Artefakt mit leerem Default. Die echte BBM-Registry liegt separat unter `src/renderer/uiEditor/bbmUiEditorRegistry.js`.

## 3. BBM-spezifisch vs. generisch

| Kategorie | Einordnung |
| --- | --- |
| A) Passt bereits zum Kit-Vertrag | Explizite Registry, HostAdapter, UI-Scope, Layout-Scope, LayoutState, allowedOps/lockedOps, Scope-Wechsel mit Selection-Reset, Blockaden fuer unbekannte Elemente, layout-only Save/Load/Reset, keine Fachpayloads, kein Scan, keine Auto-Registry. |
| B) Passt fachlich, braucht aber Adapter-/Namensbereinigung | BBM-Katalog mit `scopeId`, eigener HostAdapter-Contract, eigene Statuscodes, eigener Inspector, fehlender offizieller AdapterManifest-Pfad, Mapping `restarbeiten.screen` -> `restarbeiten.ui.main` ausserhalb des Kit-Manifests. |
| C) Bleibt BBM-spezifisch | Scope-Namen, Modulnamen, Restarbeiten-Registry, Protokoll/TOPS-Registry, TOPS-Quicklane, BBM-DEV-Kontext, BBM-Launcher-Position, BBM-Paneltexte, BBM-spezifische Tests. |
| D) Darf nicht ins Kit uebernommen werden | Restarbeiten-Fachlogik, Protokoll-Fachlogik, PDF/Druck/Mail/Audio/DB-Pfade, IPC-/Datenbankwege, fachliche Button-Ausfuehrung, BBM-Projektdaten, BBM-Modulsemantik. |
| E) Risiko/offener Punkt | BBM ist eine echte Ziel-App mit vielen Fachpfaden; als einzige Referenz koennte sie Produktlogik und Ziel-App-Logik vermischen. Ein zweites neutrales Testziel wuerde die Produktgrenzen besser beweisen. |

## 4. Referenz-Scopes

### Restarbeiten als Referenz-Scope

Bewertung: geeignet als Referenz fuer UI-Scope-zu-Layout-Scope-Mapping.

Staerken:

- Sichtbarer UI-Scope `restarbeiten.screen`.
- Layout-Scope `restarbeiten.ui.main`.
- Explizite Registry.
- HostAdapter mit `getRegistry()`, `getCurrentLayoutState()`, `submitChangeRequest()` und `resetLayoutState()`.
- Layout-only Save/Load/Reset technisch bewiesen.
- Fach-, DOM-, DB- und Datensatzpayloads werden blockiert.

Einschraenkung:

- Restarbeiten ist ein BBM-Fachmodul. Seine Registry-Inhalte, IDs und Modulsemantik duerfen nicht ins Kit uebernommen werden.

### Protokoll/TOPS als Referenz-Scope

Bewertung: geeignet als zweiter Referenz-Scope fuer parallele Scope-Bedienung.

Staerken:

- Sichtbarer UI-Scope und Layout-Scope sind beide `protokoll.topsScreen`.
- TOPS-Quicklane-Elemente sind registriert.
- HostAdapter speichert, laedt und resetet nur neutrale Layoutwerte.
- Restarbeiten-IDs werden im Protokoll-Scope blockiert.

Einschraenkung:

- TOPS-Quicklane, Ausgabe-, Druck-, Mail- und Filterbedeutungen sind BBM-Fachkontext. Sie bleiben Ziel-App-Verantwortung.

### Scope-Wechsel zwischen beiden

Bewertung: geeignet als Referenz fuer M42-Selection-Reset-Verhalten.

M34 dokumentiert:

- alter Selection-State wird beim Wechsel geloescht
- falsche Scope-/Element-Kombinationen wirken nicht weiter
- Layoutaktionen bleiben an den aufgeloesten Layout-Scope gebunden
- unbekannte Scopes blockieren sichtbar

### Layout-Scope-Zuordnung

Bewertung: fachlich passend, technisch noch adapterbereinigungsbeduerftig.

BBM beweist zwei Faelle:

- UI-Scope != Layout-Scope bei Restarbeiten
- UI-Scope == Layout-Scope bei Protokoll/TOPS

Fuer einen offiziellen Referenzadapter sollte diese Zuordnung kuenftig in einem Kit-konformen AdapterManifest oder einem expliziten Scope-ViewModel beschrieben werden.

### Auswahlverhalten

Bewertung: geeignet.

BBM beweist:

- Auswahl nur registrierter Elemente
- sichtbare Markierung
- unbekannte `data-ui-editor-id` wird blockiert
- falscher Scope blockiert
- keine Auswahl blockiert Layoutbedienung
- Parent-/Gruppenauswahl bleibt eine explizite Bedienhandlung

### Status-/Blockademeldungen

Bewertung: fachlich passend, formal nicht voll harmonisiert.

BBM zeigt sinnvolle Status- und Blockademeldungen. Fuer die offizielle Produktlinie sollten diese Meldungen auf die M42-Statuscodes abgebildet werden:

- `SCOPE_UNKNOWN` -> `unknown_scope`
- `ELEMENT_ID_UNKNOWN` -> `unknown_element`
- falsche Scope-/Element-Kombination -> `wrong_scope`
- keine Auswahl -> `no_selection`
- nicht erlaubte Operation -> `operation_not_allowed`
- gesperrte Operation -> `operation_locked`
- Fach-/DOM-/DB-Payload -> `invalid_payload` oder `forbidden_field`

## 5. Empfehlung

Empfehlung: **M44 als naechstes Paket ist sinnvoller als M45.**

Begruendung:

- BBM ist als Referenz-Ziel-App teilweise geeignet, aber noch zu fachnah und adaptereigen.
- M41/M42 haben die generischen Runtime- und ViewModel-Bausteine im Kit vorbereitet.
- Bevor Layout-Speicherung/Reset/Versionierung produktfaehig gemacht wird, sollte ein zweites neutrales Testziel zeigen, dass der Vertrag nicht nur mit BBM funktioniert.
- M44 kann ein kleines, fachneutrales Ziel bauen, das offizielles AdapterManifest, UI-Scope/Layout-Scope, HostAdapter, Registry, Scope-Wechsel, Selection und Statuscodes ohne BBM-Fachkontext beweist.
- M45 sollte danach folgen, wenn der Vertrag mit mindestens zwei Ziel-App-Formen stabil ist.

Empfohlener Schnitt:

1. **M44: zweites neutrales Testziel bauen.**
2. Danach **M45: Layout-Speicherung/Reset/Versionierung produktfaehig machen.**

## 6. Nicht-Ziele

- Keine BBM-Dateien aendern.
- Keine BBM-Migration.
- Keine automatische Registry-Befuellung.
- Keine Fachlogik uebernehmen.
- Keine PDF-, Druck-, Mail-, Audio- oder DB-Funktion bauen.
- Keine grosse Editor-App-Shell bauen.
- Kein Commit automatisch erstellen.

## 7. Fazit

BBM ist als Referenz-Ziel-App **teilweise geeignet**.

Geeignet ist BBM fuer:

- Verhalten im echten App-Kontext
- zwei echte Referenz-Scopes
- Scope-Wechsel
- Selection-Reset
- layout-only Save/Load/Reset
- sichtbare Blockaden
- Guardrails gegen Fachlogik, DOM-Scan und automatische Registry-Befuellung

Nicht ausreichend sauber ist BBM als alleiniger offizieller Produktreferenzadapter, weil:

- BBM eigene Adapter-, Katalog- und Statusformen nutzt
- BBM keinen vollstaendig offiziellen Kit-AdapterManifest-Pfad fuer diese Referenzadapter zeigt
- BBM eine fachreiche Ziel-App ist und damit als einzige Referenz Produkt- und Ziel-App-Verantwortung zu leicht vermischen kann

M44 sollte deshalb ein zweites neutrales Testziel schaffen.
