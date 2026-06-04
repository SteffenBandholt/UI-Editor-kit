# UI-Editor-Kit

Wiederverwendbares, fachneutrales UI-/PDF-Editor-Kit.

Dieses Repository ist die zentrale Quelle fuer:

- den UI-Editor-Vertrag,
- die Codex-Regeln fuer UI-/PDF-Entwurfsentscheidungen,
- die Einbauanleitung fuer neue Apps,
- generische Vertragspruefungen.

Diese Struktur ist die Quelle der Wahrheit fuer den fachneutralen UI-/PDF-Editor.

## Aktueller Stand

`0.1.1`

`v0.1.0` bleibt der historische Erststand.

`v0.1.1` ist der empfohlene Referenzstand fuer neue Apps, weil er den Bootstrap-Auftrag enthaelt.

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

## Offizielle Ziel-App-Installation

Der bevorzugte Installationsweg fuer Ziel-Apps ist die CLI.

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

Der CLI-Installer prueft den Zielpfad per Preflight, schreibt nur das vorbereitende Regel- und Pruefpaket und gibt einen strukturierten Installations-/Sicherheitsreport aus.

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

- keine Ziel-UI lesen
- kein UI-Scan
- keine automatische Elementerkennung
- keine automatische Registrierung
- keine Ziel-App-UI aendern
- keine Fachlogik aendern
- keine Fachdaten aendern

Die Ziel-App ist nach der Installation noch nicht automatisch editorfaehig. Sie besitzt nur das Regelpaket, die Registry-Hilfsstruktur, den Vertragscheck, den Installationstest und die Statusdatei.

Neue editorrelevante UI-/PDF-Strukturen duerfen erst nach einer UI-/PDF-Entwurfsentscheidung gebaut werden. Bestehende Legacy-UIs werden nicht automatisch analysiert, registriert oder migriert.

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
