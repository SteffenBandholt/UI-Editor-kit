# UI-Editor-Kit

> **VERBINDLICHE PRODUKTGRENZE**
>
> **DAS UI-EDITOR-KIT WIRD NIEMALS IM BROWSER STATTFINDEN.**

Wiederverwendbares, fachneutrales UI-/PDF-Editor-Kit zur Einbindung in Anwendungs-Apps.

## Zweck

Das Repository ist die zentrale Quelle fuer:

- den UI-Editor-Vertrag,
- die Codex-Regeln fuer UI-/PDF-Entwurfsentscheidungen,
- die Einbauanleitung fuer neue Apps,
- die Public API,
- die Integrations- und Abnahmepruefungen.

## Aktueller Stand

Aktuelle Paketversion: `0.2.0`.

Der oeffentliche Einstieg erfolgt ueber `package.json` und `src/index.cjs`.

## Produktgrenze

Der Editor kennt keine Fachmodule, Fachdaten oder Fachlogik. Er arbeitet ausschliesslich mit registrierten und klassifizierten UI-Elementen, die von der Ziel-App bereitgestellt werden.

Nicht registrierte Elemente gelten fuer den Editor als nicht vorhanden.

Der Editor darf insbesondere nicht:

- UI-Elemente automatisch suchen oder erraten,
- Fachlogik oder Fachdaten lesen oder aendern,
- fachliche Aktionen ausfuehren,
- Ziel-App-Dateien ohne ausdruecklichen Auftrag veraendern,
- eine bestimmte Laufzeitumgebung zur Produktvoraussetzung machen.

## Kernfunktionen

Das Kit stellt fachneutrale Bausteine bereit fuer:

- Registry und Elementvertrag,
- Validierung,
- Elementbaum und Elementdetails,
- erlaubte und gesperrte Operationen,
- Aenderungsauftraege,
- HostAdapter-Vertrag,
- Session- und Layoutzustand,
- Save, Load, Reset, Discard und Rollback,
- Bedienpanel und ViewModels,
- Auswahl, Element- und Textbearbeitung,
- Packaging und lokale Moduleinbindung.

## Ziel-App-Verantwortung

Die Ziel-App liefert und besitzt:

- Registry,
- Element-Referenzen,
- HostAdapter,
- Layoutspeicher,
- Aktivierung und Deaktivierung,
- erneute Sicherheitspruefung vor jeder Aenderung.

Das Kit bleibt fachneutral und greift nicht eigenmaechtig in die Ziel-App ein.

## Installation in eine Ziel-App

```bash
node scripts/install-ui-editor-to-target.cjs "C:\01_Projekte\UI-Editor-Testziel"
```

Optional koennen verwaltete Installer-Dateien kontrolliert ueberschrieben werden:

```bash
node scripts/install-ui-editor-to-target.cjs "C:\01_Projekte\UI-Editor-Testziel" --overwrite
```

Der Ziel-App-Installationstest wird anschliessend in der Ziel-App ausgefuehrt:

```bash
node "C:\01_Projekte\UI-Editor-Testziel\uiEditor\tests\uiEditorInstallation.test.cjs"
```

## Oeffentliche API

Der bevorzugte Import fuer Ziel-Apps ist der Paket-Export beziehungsweise `src/index.cjs`.

```js
const {
  createUiEditorRuntime,
  createUiEditorPanelController,
  createUiEditorPanelViewModel,
  createUiEditorPanel,
} = require("ui-editor-kit");
```

Die Runtime verwaltet Session, neutrale Layoutwerte, Speicherung, Laden, Verwerfen, Zuruecksetzen und Rollback. Das Panel verwaltet Auswahl, Ebene, Modus, Schrittweite, Status und strukturierte Ergebnisse.

Elementwerte und Textwerte werden getrennt behandelt. Textbearbeitung ist nur aktiv, wenn die Ziel-App die dafuer vorgesehenen Operationen ausdruecklich registriert.

## Verbindliche Unterlagen

- `STATUS.md`
- `docs/EDITOR_GESAMT_LV.md`
- `docs/EDITOR_BAUPLAN.md`
- `docs/UI_ELEMENT_KATALOG.md`
- `docs/UI_BAU_UND_PRUEFREGELN.md`
- `docs/UI_EDITOR_VERTRAG.md`
- `docs/ZIEL_APP_ANBINDUNG.md`
- `docs/M72_EDITOR_PANEL_TEXT_EDITING.md`
- `codex/AGENTS_UI_EDITOR_BLOCK.md`

## Pflichtpruefungen

```bash
npm test
npm pack --dry-run
npm run release:check
git diff --check
```

## Naechster Bauabschnitt

M73 stabilisiert den Release Candidate des eigenstaendigen UI-Editor-kit. Schwerpunkte sind Public API, Packaging, Integrationsvertrag, lokale Moduleinbindung und nachvollziehbare Abnahme ohne Festlegung auf eine bestimmte Zielumgebung.
