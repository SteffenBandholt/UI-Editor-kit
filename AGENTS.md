# Verbindliche Arbeitsregeln für ChatGPT und Codex

Diese Datei gilt für das gesamte Repository und alle Unterverzeichnisse.

## Vor jeder Aufgabe zwingend lesen

1. `Arbeitsanweisung.md`
2. `STATUS.md`
3. die im Abschnitt `Fuehrende Unterlagen` von `STATUS.md` genannten projektspezifischen Dateien
4. bei UI-/PDF-Aufgaben zusätzlich `codex/AGENTS_UI_EDITOR_BLOCK.md`

## Verbindliche Zusammenarbeit

- ChatGPT klärt fachliche Anforderungen, grenzt Aufgaben ab und formuliert messbare Abnahmekriterien.
- Codex analysiert die betroffenen Repositorybereiche, setzt Änderungen um und führt die technischen Prüfungen aus.
- Keine doppelte vollständige Analyse durch ChatGPT und Codex.
- Keine eigenmächtige Erweiterung des aktuellen Auftrags.
- Zusammengehörige Änderungen werden gebündelt; unnötige Mikroschritte werden vermieden.
- Bestehende Funktionen bleiben erhalten, sofern der Auftrag keine Änderung verlangt.
- Tests, Builds und realitätsnahe Nachweise sind auszuführen, soweit technisch möglich.
- Erfolgreiche Fertigstellung darf nur gemeldet werden, wenn die Abnahmekriterien erfüllt sind.
- Abschlussberichte bleiben knapp, ehrlich und auf Änderungen, Prüfungen, Risiken und offene Punkte begrenzt.
- Für jede Aufgabe ist das kleinste ausreichend zuverlässige Modell beziehungsweise die niedrigste ausreichende Denkstufe zu verwenden.

## Verbindliche Codex-Modellwahl

### Sichtbare Einstellung vor jedem Codex-Auftrag

Vor jedem Codex-Auftrag muss ChatGPT sichtbar angeben:

- Modell
- Reasoning-Stufe
- Geschwindigkeit
- Parallelisierung
- Unteragenten

Der Nutzer stellt diese Werte vor dem vollständigen Einfügen des Auftrags manuell in Codex ein. Eine automatische Modellumstellung darf nicht behauptet werden.

### Modellmatrix

1. **GPT-5.6 Sol / Sehr hoch**

   Verwenden für:

   - Architekturentscheidungen
   - unbekannte oder mehrschichtige Fehlerursachen
   - Änderungen am gemeinsamen Core
   - HostAdapter-Änderungen
   - Registry- und Vertragsänderungen
   - Save, Restore, Undo und Profile
   - Lizenzierung und Datenintegrität
   - sicherheitskritische Änderungen
   - größere repoübergreifende Änderungen
   - Änderungen mit schwer abschätzbaren Seiteneffekten

2. **GPT-5.6 Terra / Hoch**

   Verwenden für:

   - klar eingegrenzte Reparaturen
   - bekannte Fehlerursache
   - wenige betroffene Dateien
   - korrekte Anwendung bestehender Architektur
   - CSS-, WPF- oder Electron-Feintuning ohne Strukturumbau
   - gezielte Regressionstests
   - kleine produktive Codeänderungen mit eindeutigem Sollzustand

3. **GPT-5.6 Terra / Mittel**

   Verwenden für:

   - Dokumentation
   - Statuspflege
   - Ergänzung vorhandener Tests
   - Dateiinventare und Prüfberichte
   - Git-Abschluss
   - Commit- und Pushkontrolle
   - mechanische Änderungen mit vollständig festgelegtem Sollzustand

4. **GPT-5.6 Luna / Mittel**

   Nur verwenden für:

   - reine ungefährliche Textkorrekturen
   - einfache Inventare
   - mechanische, vollständig vorgegebene Arbeiten ohne produktive Auswirkungen

   Luna nicht verwenden für:

   - produktiven BBM-Code
   - Registry
   - HostAdapter
   - Profile
   - Lizenzierung
   - Datenbank
   - UI-Verhalten
   - Architektur
   - Save, Restore oder Undo

### Eskalation

Bei Unsicherheit, unerwarteter Reichweite, fehlender eindeutiger Ursache oder größerem Dateiumfang ist eine Modell- oder Reasoning-Stufe höher zu wählen. Nicht aus Kostengründen unterhalb der für die sichere Bearbeitung notwendigen Stufe arbeiten.

Wenn während der Arbeit erkennbar wird, dass die eingestellte Stufe nicht ausreicht:

- Arbeit stoppen
- Grund nennen
- benötigte höhere Einstellung angeben
- keine riskante Improvisation

### Effizienz

- Dauerregeln nicht vollständig in jedem Auftrag wiederholen; auf die Repositoryregeln verweisen.
- Aufträge auf konkreten Fehler, erlaubte Bereiche, Verbote, Abnahme und Git-Status begrenzen.
- Keine vorsorglichen Großaufträge oder unnötigen Wiederholungen bereits dokumentierter Architektur.
- Funktionsarbeit und Git-Abschluss getrennt halten.
- Das kleinste ausreichend zuverlässige Modell und die niedrigste ausreichend sichere Reasoning-Stufe verwenden.

### Ausgabe vor jedem Codex-Auftrag

Die sichtbare Vorlage lautet:

```text
CODEX-EINSTELLUNG

Modell: GPT-5.6 ...
Reasoning: ...
Geschwindigkeit: Standard
Parallelisierung: Keine
Unteragenten: Keine

Bitte Codex entsprechend einstellen.
Danach den folgenden Auftrag vollständig einfügen:
```

## Rangfolge bei Widersprüchen

1. ausdrücklicher aktueller Arbeitsauftrag
2. projektspezifische Regeldateien und Sicherheitsregeln
3. `Arbeitsanweisung.md`
4. allgemeine technische Konventionen

Sicherheits-, Datenschutz- und Zugriffsregeln können nicht aufgehoben werden.
