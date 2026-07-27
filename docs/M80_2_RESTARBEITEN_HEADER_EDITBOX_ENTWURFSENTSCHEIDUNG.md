# M80.2 – Restarbeiten-Header und Editbox direkt editierbar

Status: `[A] abgenommen`; die sichtbare native Abnahme und der stabilisierte BBM-Pflichtprüfungsblock sind abgeschlossen.

## A. Art der Ausgabe

- UI: ja, bestehender Restarbeiten-Screen in BBM.
- PDF: nein; M81 bleibt offen.
- Neue Editoroberfläche: nein.

## B. Editorfähigkeit

Editorfähig sind ausschließlich explizit registrierte Layoutobjekte. Der sichtbare Filter-Header und `restarbeiten.edit.root` werden direkt und unabhängig bearbeitet. Die Hauptliste bleibt ein flexibler Scrollbereich. Der alte Verhältnis-/Splitpfad ist kein Editorziel mehr.

## C. Editorfähige Elemente

### Header-Scope `restarbeiten.header.root`

Der Scope enthält 31 explizite Elemente:

- `restarbeiten.header.root`
- `restarbeiten.filterbar`
- `restarbeiten.filterbar.group.location`
- je L1 bis L4: `restarbeiten.filterbar.location.levelN`, `.label`, `.field`
- `restarbeiten.filterbar.group.class`
- `restarbeiten.filterbar.class.all`, `.rest`, `.defect`
- `restarbeiten.filterbar.group.meta`
- je Status, Fertig bis und Verantwortlich: `restarbeiten.filterbar.meta.<key>`, `.label`, `.field`
- `restarbeiten.filterbar.actions`
- `restarbeiten.filterbar.action.close`

Eine eigene Restarbeiten-Überschrift oder Status-/Hinweiszeile existiert im sichtbaren Header nicht und wird nicht erfunden. Die separat fixierte Quicklane bleibt gesperrt und gehört nicht zum Header-Scope.

### Listen-Scope `restarbeiten.list.root`

Die sieben bestehenden Elemente und die drei fachlich bestätigten Spaltengruppen bleiben unverändert. Bearbeitbar sind nur neutrale Layoutwerte; Datensatzanzahl, Inhaltslänge und Gesamthöhe der langen Liste sind keine Editorziele.

### Editbox-Scope `restarbeiten.edit.root`

Alle 49 bestehenden Elemente und IDs bleiben erhalten. Neu ist, dass der Root selbst Breite, Höhe und Sichtbarkeit unterstützt. Mindestwerte sind 320 px Breite und 160 px Höhe, die maximale Root-Höhe ist 520 px.

Jedes registrierte Ziel erhält von BBM:

- `data-ui-inspector-id`
- `data-ui-editor-kind`
- `data-ui-editor-label`
- `data-ui-editor-parent`
- `data-ui-editor-editable`
- `data-ui-editor-ops`

Die Registry führt je Element außerdem `id`, `name`, `type`, `role`, `parentId`, `order`, `visible`, `editable`, `allowedOps`, `lockedOps`, `semanticKey`, `registrationStatus`, `refKey`, Baseline und typabhängige Klassifikation.

## D. Operationen und Sperren

- Header-Root: `resizeWidth`, `resizeHeight`, `setVisibility`; `move` nicht freigegeben.
- Editbox-Root: `resizeWidth`, `resizeHeight`, `setVisibility`; `move` nicht freigegeben.
- Header-Unterelemente und bestehende Editbox-Kinder: nur ihre expliziten allgemeinen Layout-Capabilities.
- Hauptliste: bestehende Breiten-, Spalten-, Text-/Abstands- und Sichtbarkeitsoperationen; keine Inhaltslänge oder Datensatzanzahl.
- Fachbuttons: nur Layoutobjekte; `executeTargetAction`, `modifyDomainData`, `createRecord` und `deleteRecord` gesperrt.

`move` ist für die beiden festen Root-Bereiche nicht freigegeben, weil eine Translation sie aus dem kontrollierten Grid-/Flexfluss lösen und wieder Überlagerungen erzeugen könnte. Der generische native Registryvertrag erlaubt einem explizit editierbaren Scope-Root ausschließlich Breite, Höhe und Sichtbarkeit; Positions- und Textoperationen bleiben dort unzulässig.

## E. Verhältnis-/Splitpfad und Profile

`restarbeiten.layout.root` wird als gesperrter Alt-/Technikscope mit `M80_2_split_removed` geführt. `restarbeiten.layout.split` sowie die alten Pane-Spiegelelemente sind aus der produktiven Registry entfernt.

Der vorhandene M80.1-Profilabgleich behandelt diese IDs als entfernt: alte Werte werden archiviert/ignoriert und nicht angewendet. Unveränderte Editbox-Kind-IDs behalten kompatible Profilwerte; neue Header-IDs starten mit Baseline. Registryversion 3 und der daraus neu berechnete Fingerprint lösen den kontrollierten Refresh aus.

## F. Layoutvertrag

- Seite: Headerzeile `auto`, Inhaltszeile `minmax(0, 1fr)`.
- Inhaltsbereich: vertikaler Flex-Parent ohne editorgetriebenen Splitwert.
- Hauptliste: `flex: 1 1 0`, Mindesthöhe 180 px; der vorhandene Main-Container scrollt vertikal.
- Editbox: fester, begrenzter Bereich im normalen Fluss; Größenänderungen verkleinern den verfügbaren Listenraum, überdecken ihn aber nicht.
- Keine absolute Positionierung und keine feste Gesamthöhe für die lange Liste.

## G. Nicht editorfähige Ziele

Fachwerte, Datensätze, Filterwerte, Status-, Termin-, Verantwortlichen-, Ampel- und Fotologik, fachliches Speichern/Anlegen/Löschen, Upload, Import, Export, Autosave, Datenbank-/IPC-Aktionen, Buttonausführung, PDF und Druck bleiben ausgeschlossen.

## H. Prüfung

- generischer M80.1-Registrierungs-/Profiltest: capability-freier Technikcontainer, entfernte Split-ID, stabile Editbox-ID, Fingerprint und valide Header-/Editbox-Registry
- BBM-M80-/M80.1-Regressionen und neuer `m80-2HeaderEditboxLayout.test.cjs`
- BBM-Vertragscheck über die sechs Pflichtattribute
- vollständige .NET-, npm-, Pack-, Release-, Lint-, Diff- und Statusprüfungen laut Auftrag
- sichtbare native BBM-/Editor-Abnahme mit langer Diagnoseliste, Auswahl, Größenänderung, Save/Restore/Reset/Discard/Rollback und Fachaktionssperre
