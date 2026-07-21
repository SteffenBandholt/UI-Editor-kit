# UI-Editor-Kit

Wiederverwendbares, fachneutrales UI-/PDF-Editor-Kit.

Dieses Repository ist die zentrale Quelle fuer:

- den UI-Editor-Vertrag,
- die Codex-Regeln fuer UI-/PDF-Entwurfsentscheidungen,
- die Einbauanleitung fuer neue Apps,
- generische Vertragspruefungen.

Diese Struktur ist die Quelle der Wahrheit fuer den fachneutralen UI-/PDF-Editor.

## Aktueller Stand

`0.2.0`

`v0.1.0` bleibt der historische Erststand.

`v0.1.1` bleibt der Referenzstand inklusive Bootstrap-Auftrag.

`v0.2.0` ist der M49 Release-Fixstand fuer den oeffentlichen Core. Der oeffentliche Einstieg laeuft ueber `package.json` `main`/`exports` nach `src/index.cjs`. Details stehen im [CHANGELOG](CHANGELOG.md), in der [Minimal-Anbindung M47](docs/M47_NEUE_ZIEL_APP_MINIMAL_ANBINDUNG.md) und in den [Public-Core-API-Exports M48](docs/M48_PUBLIC_CORE_API_EXPORTS.md).

M50 bereitet den Release-Tag fuer `v0.2.0` vor. Die fertigen Release Notes stehen in [docs/releases/v0.2.0.md](docs/releases/v0.2.0.md), die Tag- und GitHub-Release-Checkliste in [docs/M50_RELEASE_TAG_CHECKLIST.md](docs/M50_RELEASE_TAG_CHECKLIST.md). Die lokale Readiness-Pruefung laeuft mit `npm run release:check`.

## Grundsatz

Der Editor kennt keine Fachmodule.

Er kennt keine fachlichen Datensaetze, keine Speicherung und keine sonstige Fachlogik.

Er kennt nur editorfaehige Elemente mit expliziten Metadaten:

- `data-ui-inspector-id`
- `data-ui-editor-kind`
- `data-ui-editor-label`
- `data-ui-editor-parent`
- `data-ui-editor-editable`
- `data-ui-editor-ops`

Der Editor scannt keine Fachlogik und leitet keine Fachbeziehungen her.

## Ziel

Neue Apps sollen dieses Kit uebernehmen, bevor UI- oder PDF-Strukturen gebaut werden.

Der entscheidende Moment liegt vor der Umsetzung:

1. UI-/PDF-Aufgabe wird formuliert.
2. Codex muss eine UI-/PDF-Entwurfsentscheidung liefern.
3. Erst danach darf gebaut werden.
4. Die UI/PDF wird mit klaren Editor-Metadaten erstellt.
5. Der Editor liest spaeter nur diese Metadaten.

## Offizieller Ziel-App-Regelpaket-Bootstrap

Der bevorzugte Weg fuer Ziel-Apps ist die CLI-Regelpaket-Installation.

Der Browser-Installer existiert weiterhin, ist aber nicht mehr der empfohlene Standardweg fuer den praktischen Trockenlauf oder die normale Installation.

```bash
node scripts/install-ui-editor-to-target.cjs "C:\01_Projekte\UI-Editor-Testziel"
```

Optional koennen verwaltete Installer-Dateien kontrolliert ueberschrieben werden:

```bash
node scripts/install-ui-editor-to-target.cjs "C:\01_Projekte\UI-Editor-Testziel" --overwrite
```

Falls das Package-Script genutzt werden soll:

```bash
npm run install:target -- "C:\01_Projekte\UI-Editor-Testziel"
```

Nach der Installation wird der Ziel-App-Test in der Ziel-App ausgefuehrt:

```bash
node "C:\01_Projekte\UI-Editor-Testziel\uiEditor\tests\uiEditorInstallation.test.cjs"
```

Der CLI-Installer prueft den Zielpfad per Ziel-App-Vorbereitungscheck, schreibt nur das vorbereitende Regelpaket und die Pruefinfrastruktur und gibt einen strukturierten Installations-/Sicherheitsreport aus.

Installiert werden:

- `AGENTS.md` mit markiertem UI-Editor-Regelblock
- `codex/AGENTS_UI_EDITOR_BLOCK.md`
- `codex/CODEX_STARTREGEL_UI_PDF.md`
- `docs/ui-editor/*` mit UI-/PDF-Regeln und Vertrag
- `scripts/ui-editor-contract-check.cjs`
- `uiEditor/README.md`
- `uiEditor/INSTALLATION_STATUS.md`
- `uiEditor/uiEditorRegistry.js`
- `uiEditor/targetAppRegistry.js`
- `uiEditor/uiEditorLauncherButton.*`
- `uiEditor/uiEditorRules.md`
- `uiEditor/tests/uiEditorRegistry.test.cjs`
- `uiEditor/tests/uiEditorInstallation.test.cjs`

Ausdruecklich nicht ausgefuehrt wird:

- keine bestehende UI analysieren
- keine bestehende UI lesen
- keine bestehende UI scannen
- kein UI-Scan
- keine automatische Bestandserkennung
- keine automatische Elementerkennung
- keine automatische Registrierung
- keine automatische UI-Elementliste erzeugen
- keine bestehende UI migrieren
- keine automatische Migration
- keine Ziel-App-UI aendern
- keine Fachlogik aendern
- keine Fachdaten aendern

Die Ziel-App ist nach der Installation noch nicht automatisch editorfaehig. Sie besitzt nur das Regelpaket, die Registry-Hilfsstruktur, den Vertragscheck, den Installationstest und die Statusdatei.

Neue editorrelevante UI-/PDF-Strukturen duerfen erst nach einer UI-/PDF-Entwurfsentscheidung gebaut werden. Bestehende Legacy-UIs werden nicht automatisch analysiert, registriert oder migriert.

## Minimal-Anbindung neuer Ziel-Apps

Die kurze oeffentliche Anleitung fuer eine neue fachneutrale Ziel-App steht in `docs/M47_NEUE_ZIEL_APP_MINIMAL_ANBINDUNG.md`. Sie beschreibt den offiziellen Adapter-Pfad von Target-App ueber AdapterManifest, HostAdapter, Registry und RuntimeLauncher bis zu ViewModels und LayoutStateStore.

Als neutraler Fixture-Verweis dient `scripts/fixtures/neutral-target-app/neutralTargetApp.cjs`; ein kleines ausfuehrbares Minimalbeispiel liegt unter `scripts/fixtures/minimal-target-app/minimal-target-app.cjs`. Neue Integrationen sollen die Kit-Funktionen ueber den oeffentlichen Einstieg `src/index.cjs` beziehungsweise den Paket-Export laden.



## Programmatische Runtime ab M69

Ab M69 exportiert der oeffentliche Einstieg zusaetzlich `createUiEditorRuntime`. Die Runtime ist noch eine programmatische API fuer Ziel-App-Adapter und Tests: Sie verwaltet Session, Baseline, neutrale Layoutentries, Save/Load, Reset, Discard und Reapply ohne eigene DOM-Suche und ohne eigene Persistenzimplementierung. Details stehen in `docs/M69_GENERIC_RUNTIME.md`.

Das generische Bedienpanel ist nicht Teil von M69. Es bleibt der naechste Schritt fuer M70.

## Oeffentliche Core-API

Der bevorzugte Import fuer Ziel-Apps ist ab M48 der oeffentliche CommonJS-Einstieg `src/index.cjs` beziehungsweise der Paket-Export. Dort liegen Runtime-Start, Adapter-Pfad, ViewModels und MemoryLayoutStateStore gesammelt als stabile Kit-API. Details stehen in `docs/M48_PUBLIC_CORE_API_EXPORTS.md`.

Die Minimalanleitung bleibt `docs/M47_NEUE_ZIEL_APP_MINIMAL_ANBINDUNG.md`; das ausfuehrbare Minimalbeispiel liegt unter `scripts/fixtures/minimal-target-app/minimal-target-app.cjs` und nutzt fuer Kit-Funktionen den oeffentlichen Einstieg.

## Vertragscheck

Der Vertragscheck prueft fachneutral nur vorhandene `data-ui-*` Metadaten gegen den UI-Editor-Vertrag.

Beispiel in einer Ziel-App mit vorhandener UI-Datei:

```bash
node scripts/ui-editor-contract-check.cjs pfad/zur/ui-datei.html
```

## Einstieg fuer neue Apps

Siehe:

- `docs/UI_EDITOR_VERTRAG.md`
- `docs/UI_BAU_UND_PRUEFREGELN.md`
- `docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md`
- `docs/ZIEL_APP_ANBINDUNG.md`
- `codex/AGENTS_UI_EDITOR_BLOCK.md`

## Status

Startversion des fachneutralen Kits. Der Editor-Core wird schrittweise ergaenzt.

## M69/M70 programmatische Runtime und generisches Panel

Das Paket exportiert eine fachneutrale Runtime (`createUiEditorRuntime`) sowie ab M70 ein kleines generisches Bedienpanel. Die Runtime verwaltet Session, neutrale Layoutentries, Save, Load, Discard, Reset und Rollback. Das Panel besteht aus Controller, ViewModel, Message-Catalog und Renderer:

```js
const {
  createUiEditorRuntime,
  createUiEditorPanelController,
  createUiEditorPanelViewModel,
  createUiEditorPanel,
} = require("ui-editor-kit");
```

Der Panel-Controller liest Registry und Runtime-Status, verwaltet Auswahl, Modus (`move`, `width`, `height`), Schrittweite, Busy-Status, Dialoge und strukturierte Ergebnisse. Benutzeraktionen werden in neutrale Runtime-Aufrufe uebersetzt. Der Renderer erzeugt nur sein eigenes Panel-DOM im uebergebenen MountTarget.

M70 enthaelt noch keinen produktiven Browser-Host fuer echte Ziel-App-Elemente. Echte Browser-Refs, Auswahlrahmen, SelectionHost und Overlay folgen in M71.
