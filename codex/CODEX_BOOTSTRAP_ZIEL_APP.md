# Codex-Bootstrap-Auftrag fuer Ziel-App

Dieser Auftrag ist fuer ein anderes App-Repository gedacht.

Er wird dort vor dem ersten UI-/PDF-Bau ausgefuehrt.

## Kontext

- Ziel-Repository: `C:\01_Projekte\<ZIEL_APP>`
- Quelle: UI-Editor-kit `v0.1.0`
- GitHub: `SteffenBandholt/UI-Editor-kit`
- Lokaler Beispielpfad der Quelle: `C:\01_Projekte\UI-Editor-kit`

## Auftrag an Codex in der Ziel-App

Uebernimm das UI-Editor-kit `v0.1.0` fachneutral und kontrolliert in dieses Ziel-Repository.

### A) Pruefen

1. Pruefe, ob das Ziel-Repo in einem sauberen Zustand ist.
2. Pruefe, ob `AGENTS.md` bereits existiert.
3. Pruefe, ob `docs/` bereits existiert.
4. Pruefe, ob `scripts/` bereits existiert.
5. Pruefe, ob bestehende Regeln vorhanden sind, die nicht ueberschrieben werden duerfen.

### B) Uebernehmen

Uebernimm aus UI-Editor-kit `v0.1.0` mindestens diese Dateien:

- `docs/UI_EDITOR_VERTRAG.md`
- `docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md`
- `docs/EINBAU_IN_NEUE_APP.md`
- `docs/KIT_UEBERNAHME_CHECKLISTE.md`
- `codex/AGENTS_UI_EDITOR_BLOCK.md`
- `codex/CODEX_STARTREGEL_UI_PDF.md`
- `scripts/ui-editor-contract-check.cjs`

### C) AGENTS.md behandeln

1. Falls `AGENTS.md` fehlt: neue `AGENTS.md` anlegen.
2. Falls `AGENTS.md` existiert: nicht ueberschreiben.
3. Inhalt aus `codex/AGENTS_UI_EDITOR_BLOCK.md` kontrolliert einfuegen oder als klaren Abschnitt ergaenzen.
4. Bestehende App-Regeln unveraendert erhalten.
5. Bei Widerspruch zwischen Regeln: STOPP melden, nicht eigenmaechtig aufloesen.

### D) Waehren Bootstrap keine UI bauen

- Keine Fach-UI bauen.
- Keine PDF-Struktur bauen.
- Keine Fachlogik bauen.
- Keine Editor-Runtime bauen.

### E) Pruefung

1. Vertragscheck in der Ziel-App verfuegbar machen.
2. Wenn ein Beispiel vorhanden ist, Self-Test ausfuehren:

```bash
node scripts/ui-editor-contract-check.cjs --self-test
```

3. Wenn noch keine Ziel-UI existiert, ausdruecklich melden:

`Noch keine Ziel-UI vorhanden, daher nur Self-Test moeglich.`

### F) Abschlussbericht

Berichte am Ende klar:

- Welche Dateien uebernommen wurden.
- Ob `AGENTS.md` neu angelegt oder ergaenzt wurde.
- Ob bestehende Regeln unveraendert blieben.
- Ob der Vertragscheck lauffaehig ist.
- Ob UI-/PDF-Entwurfsentscheidungspflicht aktiv ist.
- Dass keine UI gebaut wurde.
- Dass keine Fachlogik gebaut wurde.

## Grenzen

- Keine Ziel-App erstellen.
- Keine Dateien ausserhalb des Ziel-Repos aendern.
- Keine externen Abhaengigkeiten einfuehren.
- Kein `package.json` anlegen.
- Kein Buildsystem einfuehren.
- Kein Editor-Panel und keine Editor-Runtime bauen.
