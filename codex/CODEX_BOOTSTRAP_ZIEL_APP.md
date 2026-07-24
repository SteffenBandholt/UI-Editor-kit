# Codex-Bootstrap-Auftrag fuer Ziel-App

Dieser Auftrag ist fuer ein anderes App-Repository gedacht und wird dort vor dem ersten UI-/PDF-Bau ausgefuehrt.

## Kontext

- Ziel-Repository: `C:\01_Projekte\<ZIEL_APP>`
- Quelle: UI-Editor-kit
- GitHub: `SteffenBandholt/UI-Editor-kit`
- Lokaler Beispielpfad: `C:\01_Projekte\UI-Editor-kit`

## Auftrag

Uebernimm den UI-Editor-Vertrag fachneutral und kontrolliert in das Ziel-Repository. Ziel ist nicht, sofort eine UI oder Editor-Runtime zu bauen, sondern die gemeinsame Vertragssprache vorzubereiten.

## Pruefen

1. sauberen Repo-Zustand pruefen
2. vorhandene `AGENTS.md`, `docs/` und `scripts/` beachten
3. bestehende Regeln nicht ueberschreiben
4. bei Regelwiderspruch STOPP melden

## Uebernehmen

Mindestens:

- `docs/EDITOR_BAUPLAN.md`
- `docs/UI_ELEMENT_KATALOG.md`
- `docs/UI_BAU_UND_PRUEFREGELN.md`
- `docs/ZIEL_APP_ANBINDUNG.md`
- `docs/UI_EDITOR_VERTRAG.md`
- `docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md`
- `codex/AGENTS_UI_EDITOR_BLOCK.md`
- `codex/CODEX_STARTREGEL_UI_PDF.md`
- `scripts/ui-editor-contract-check.cjs`

Nicht uebernehmen:

- alte Demo- oder Beispielspuren
- alte Mini-Inspector-Demos
- alte Host-App-Demos
- veraltete Layoutdiagnose-Demos

## AGENTS.md

- fehlende Datei anlegen
- vorhandene Datei nicht ueberschreiben
- UI-Editor-Regelblock kontrolliert einfuegen
- bestehende App-Regeln erhalten
- Widersprueche nicht eigenmaechtig aufloesen

## Waehrend des Bootstrap nicht bauen

- keine Fach-UI
- keine PDF-Struktur
- keine Fachlogik
- keine Editor-Runtime
- keine Demo
- keine Nebenarchitektur
- keine Ziel-App-Funktion aendern

## Ziel-App-Regeln aktivieren

- vor jeder editorrelevanten UI-/PDF-Umsetzung liegt eine Entwurfsentscheidung vor
- editorrelevante Elemente werden beim Bau klassifiziert
- Typen, Rollen und Operationen folgen dem Elementkatalog
- Fachaktionen sind keine Editoroperationen
- nach dem UI-Bau laeuft der Vertragscheck
- Fehler werden repariert und erneut geprueft

## Pruefung

```bash
node scripts/ui-editor-contract-check.cjs --self-test
```

Ohne Ziel-UI ist nur der Self-Test moeglich. Ein vorhandenes `package.json` darf um einen passenden Check erweitert werden; fehlt es, wird kein neues Buildsystem nur fuer den Bootstrap angelegt.

## Abschlussbericht

Berichte:

- uebernommene Dateien
- Behandlung von `AGENTS.md`
- erhaltene bestehende Regeln
- moegliche Konflikte
- Ergebnis des Vertragschecks
- aktivierte Entwurfsentscheidungspflicht
- Bestaetigung, dass keine UI, Fachlogik oder Runtime gebaut wurde

## Grenzen

- keine Ziel-App erstellen
- keine Dateien ausserhalb des Ziel-Repos aendern
- keine externen Abhaengigkeiten einfuehren
- kein neues Buildsystem nur fuer den Bootstrap
- kein Editor-Panel und keine Editor-Runtime bauen
- keine Demo- oder Nebenstrecke einfuehren
- keine Fachlogik oder Fachdatenstruktur aendern
