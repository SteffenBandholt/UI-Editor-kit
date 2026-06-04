# AGENTS-Block UI-Editor

Diesen Block unveraendert in die `AGENTS.md` einer Ziel-App uebernehmen.

## Fuehrende Unterlagen

Vor jeder UI- oder PDF-Umsetzung muessen diese Unterlagen beachtet werden:

- `docs/EDITOR_BAUPLAN.md`
- `docs/UI_ELEMENT_KATALOG.md`
- `docs/UI_BAU_UND_PRUEFREGELN.md`
- `docs/ZIEL_APP_ANBINDUNG.md`
- `docs/UI_EDITOR_VERTRAG.md`
- `docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md`

Wenn eine dieser Grundlagen fehlt oder unklar ist: STOPP.

## Verbindliche Regel fuer UI/PDF-Aufgaben

Vor jeder UI- oder PDF-Umsetzung muss zuerst eine UI-/PDF-Entwurfsentscheidung vorliegen.

Die Entwurfsentscheidung muss enthalten:

- Art der Ausgabe: UI, PDF, beides oder nicht editorrelevant
- Editorfaehig: ja oder nein
- Editorfaehige Bereiche
- Editorfaehige Gruppen
- Editorfaehige Untergruppen
- Editorfaehige Komponenten
- Editorfaehige Tabellen
- Editorfaehige Spalten einschliesslich Metaspalten
- Editorfaehige Buttons
- Editorfaehige Felder
- Parent-Struktur
- Erlaubte Operationen je Element
- Gesperrte Operationen je Element
- Nicht editorfaehige fachliche Aktionen
- Pruefung mit `scripts/ui-editor-contract-check.cjs` oder klarer Hinweis, falls die Pruefung noch fehlt

## Pflichtangaben je editorrelevantem Element

Jedes editorrelevante Element muss nach dem UI-Elementkatalog klassifiziert werden.

Pflichtangaben:

- `id`
- `name`
- `type`
- `role`
- `parentId`
- `order`
- `visible`
- `editable`
- `allowedOps`
- `lockedOps`

Je nach Elementtyp sind weitere Angaben erforderlich, zum Beispiel:

- `columnRole`
- `fieldKind`
- `actionKind`
- `componentKind`

## Harte Editor-Regeln

- Kein relevantes UI-Element ohne Klassifizierung.
- Keine Tabelle ohne klassifizierte editorrelevante Spalten.
- Keine Metaspalte ohne Rolle.
- Kein Button ohne klare Trennung zwischen UI-Element und fachlicher Aktion.
- Keine Parent-Struktur raten.
- Keine bestehende UI analysieren.
- Keine bestehende UI scannen.
- Keine automatische Bestandserkennung.
- Keine automatische UI-Elementliste erzeugen.
- Keine bestehende Legacy-UI automatisch migrieren.
- Keine Elemente erfinden.
- Keine Fachdaten in IDs oder Metadaten schreiben.

## Ausschluss fachlicher Aktionen als Editor-Ziele

Nicht editorfaehig sind insbesondere:

- Fachaktionen
- fachliches Speichern
- fachliches Anlegen
- fachliches Loeschen
- Upload
- Import
- Export
- Autosave
- fachliche IPC-/Datenaktionen
- Datenbankaktionen
- fachliches Ausfuehren eines Buttons

## Pruefung nach UI-Bau

Nach dem Bau oder Umbau einer editorfaehigen UI muss ein Vertragscheck laufen.

Wenn der Check Fehler meldet:

1. Fehler nennen
2. Ursache reparieren
3. Check erneut ausfuehren
4. Ergebnis melden

Eine editorfaehige UI ist erst fertig, wenn der Vertragscheck gruen ist.

## Stop-Regel

Wenn die Entwurfsentscheidung fehlt oder unvollstaendig ist: STOPP.

Wenn Pflichtangaben fuer editorrelevante Elemente fehlen: STOPP.

Wenn der Auftrag auf UI-Analyse, Bestandsanalyse, UI-Erkennung, UI-Scan oder automatische Migration bestehender UI hinauslaeuft: STOPP.

Wenn Tabellen, Metaspalten, Buttons oder Fachaktionen nicht sauber klassifiziert sind: STOPP.

In diesem Fall darf keine UI- oder PDF-Struktur als fertig gemeldet werden.
