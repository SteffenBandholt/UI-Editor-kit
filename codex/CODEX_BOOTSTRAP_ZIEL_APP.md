# Codex-Bootstrap-Auftrag fuer Ziel-App

Dieser Auftrag ist fuer ein anderes App-Repository gedacht.

Er wird dort vor dem ersten UI-/PDF-Bau ausgefuehrt.

## Kontext

- Ziel-Repository: `C:\01_Projekte\<ZIEL_APP>`
- Quelle: UI-Editor-kit
- GitHub: `SteffenBandholt/UI-Editor-kit`
- Lokaler Beispielpfad der Quelle: `C:\01_Projekte\UI-Editor-kit`

## Auftrag an Codex in der Ziel-App

Uebernimm den UI-Editor-Vertrag fachneutral und kontrolliert in dieses Ziel-Repository.

Ziel ist nicht, sofort eine UI oder Editor-Runtime zu bauen.

Ziel ist, dass die Ziel-App dieselbe Sprache wie das UI-Editor-kit spricht, bevor eine editorfaehige UI gebaut wird.

## A) Pruefen

1. Pruefe, ob das Ziel-Repo in einem sauberen Zustand ist.
2. Pruefe, ob `AGENTS.md` bereits existiert.
3. Pruefe, ob `docs/` bereits existiert.
4. Pruefe, ob `scripts/` bereits existiert.
5. Pruefe, ob bestehende Regeln vorhanden sind, die nicht ueberschrieben werden duerfen.
6. Bei Widerspruch zwischen bestehenden Ziel-App-Regeln und UI-Editor-Vertrag: STOPP melden.

## B) Uebernehmen

Uebernimm aus dem UI-Editor-kit mindestens diese Dateien:

- `docs/EDITOR_BAUPLAN.md`
- `docs/UI_ELEMENT_KATALOG.md`
- `docs/UI_BAU_UND_PRUEFREGELN.md`
- `docs/ZIEL_APP_ANBINDUNG.md`
- `docs/UI_EDITOR_VERTRAG.md`
- `docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md`
- `codex/AGENTS_UI_EDITOR_BLOCK.md`
- `codex/CODEX_STARTREGEL_UI_PDF.md`
- `scripts/ui-editor-contract-check.cjs`

Falls vorhanden und weiterhin passend, uebernimm ausserdem:

- `docs/EINBAU_IN_NEUE_APP.md`
- `docs/KIT_UEBERNAHME_CHECKLISTE.md`

Nicht uebernehmen:

- alte Browser-/HTML-/Demo-Spuren
- alte Mini-Inspector-Demos
- alte Host-App-Demos
- veraltete Layoutdiagnose-Demos

## C) AGENTS.md behandeln

1. Falls `AGENTS.md` fehlt: neue `AGENTS.md` anlegen.
2. Falls `AGENTS.md` existiert: nicht ueberschreiben.
3. Inhalt aus `codex/AGENTS_UI_EDITOR_BLOCK.md` kontrolliert einfuegen oder als klaren Abschnitt ergaenzen.
4. Bestehende App-Regeln unveraendert erhalten.
5. Bei Widerspruch zwischen Regeln: STOPP melden, nicht eigenmaechtig aufloesen.

## D) Waehrend Bootstrap keine UI bauen

- Keine Fach-UI bauen.
- Keine PDF-Struktur bauen.
- Keine Fachlogik bauen.
- Keine Editor-Runtime bauen.
- Keine Demo bauen.
- Keine Browser-/HTML-Nebenarchitektur bauen.
- Keine Ziel-App-Funktion aendern.

## E) Ziel-App-Regeln aktivieren

Nach dem Bootstrap muss in der Ziel-App gelten:

- Vor jeder editorrelevanten UI-/PDF-Umsetzung muss eine Entwurfsentscheidung vorliegen.
- Jede editorrelevante UI muss beim Bau ihre Elemente klassifizieren.
- Relevante Elemente muessen nach `docs/UI_ELEMENT_KATALOG.md` typisiert werden.
- Tabellen muessen editorrelevante Spalten und Metaspalten klassifizieren.
- Buttons duerfen nicht als fachliche Editoroperationen behandelt werden.
- Nach dem UI-Bau muss ein Vertragscheck laufen.
- Bei Fehlern muss repariert und erneut geprueft werden.

## F) Pruefung

1. Vertragscheck in der Ziel-App verfuegbar machen.
2. Wenn ein Self-Test vorhanden ist, ausfuehren:

```bash
node scripts/ui-editor-contract-check.cjs --self-test
```

3. Wenn noch keine Ziel-UI existiert, ausdruecklich melden:

`Noch keine Ziel-UI vorhanden, daher nur Self-Test moeglich.`

4. Wenn `package.json` vorhanden ist, darf ein passender Test-/Check-Befehl ergaenzt werden.
5. Wenn `package.json` fehlt, kein neues Buildsystem und kein neues `package.json` nur fuer den Bootstrap anlegen.

## G) Abschlussbericht

Berichte am Ende klar:

- Welche Dateien uebernommen wurden.
- Ob `AGENTS.md` neu angelegt oder ergaenzt wurde.
- Ob bestehende Regeln unveraendert blieben.
- Ob es Regelkonflikte gab.
- Ob der Vertragscheck lauffaehig ist.
- Ergebnis des Self-Tests.
- Ob UI-/PDF-Entwurfsentscheidungspflicht aktiv ist.
- Dass keine UI gebaut wurde.
- Dass keine Fachlogik gebaut wurde.
- Dass keine Editor-Runtime gebaut wurde.

## Grenzen

- Keine Ziel-App erstellen.
- Keine Dateien ausserhalb des Ziel-Repos aendern.
- Keine externen Abhaengigkeiten einfuehren.
- Kein `package.json` anlegen, wenn noch keines existiert.
- Kein Buildsystem einfuehren.
- Kein Editor-Panel und keine Editor-Runtime bauen.
- Keine Browser-/HTML-/Demo-Schiene einfuehren.
- Keine Fachlogik aendern.
- Keine Fachdatenstruktur aendern.
