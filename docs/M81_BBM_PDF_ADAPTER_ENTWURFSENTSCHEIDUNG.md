# M81 – BBM-PDF-Adapter und Entwurfsentscheidung

Status: `[A] abgenommen`

## A. Art der Ausgabe

- UI und PDF.
- Die UI ist ausschließlich der bestehende native M77-PDF-Arbeitsbereich.
- Die PDF-Ausgabe ist ausschließlich der bestehende reale BBM-Protokoll-Druckweg. Es gibt keinen zweiten Renderer, keinen Browser und keinen Netzwerkpfad.

## B. Editorfähigkeit

- Editorfähig: ja, begrenzt auf explizit registrierte Layoutobjekte.
- Pilotdokument: reales BBM-Protokoll als A4-Hochformat-PDF im Scope `pdf.bbm.protocol`.
- Nicht editorfähig: Fachwerte, Fachaktionen, Datenbankzugriffe, Dateiaktionen und die fachliche Erzeugungslogik.

## C. Editorfähige Elemente

BBM liefert eine explizite Registry mit 28 stabilen Elementen und gültigen Parent-Beziehungen. Sie enthält Dokumentroot, Seite, Kopf- und Fußbereich, Titel, getrennte Beschriftungs-/Wertobjekte, Teilnehmerbereich, TOP-Tabelle, drei sichtbare Tabellenspalten sowie Wiederholungsbereiche.

Jedes Element besitzt eine stabile ID, Art, Rolle, Parent, Reihenfolge, Sichtbarkeit, Editierbarkeit, erlaubte Operationen und gesperrte Operationen. Die konkreten Operationen werden ausschließlich aus den Fähigkeiten der Registry abgeleitet:

- Position, Breite und Höhe,
- Textposition und Schriftgröße,
- Textausrichtung und Zeilenabstand,
- Sichtbarkeit,
- Seitenränder,
- Spaltenbreiten mit Tabellen-Summenprüfung.

## D. Nicht editorfähige Elemente und gesperrte Ziele

Ausgeschlossen sind insbesondere:

- fachliches Speichern, Anlegen und Löschen,
- Upload, Import, Export und Autosave,
- Datenbank-, IPC- und Druck-Fachaktionen,
- Projekt-, Besprechungs-, TOP-, Teilnehmer- und sonstige Fachwerte,
- Dateiname, Ausgabepfad, Druckerwahl und die Ausführung von `printToPDF`,
- automatisch erkannte oder aus Fachdaten abgeleitete Elemente.

Der lokale Pipe-Vertrag transportiert nur Registry, Layoutzustand, neutrale Layoutaufträge, kontrollierte Regeneration und fachwertfreie Vorschaumetadaten. Dokumentkennungen bleiben opak.

## E. Parent- und Strukturregel

- Jedes Element außer dem Dokumentroot besitzt einen existierenden Registry-Parent.
- Tabellenspalten gehören zur registrierten TOP-Tabelle.
- Wiederholte Kopf-/Fuß- und Tabellenbereiche bleiben explizite Layoutobjekte.
- Die Ziel-App bleibt Eigentümerin von Registry, Referenzen, aktuellem Layout und PDF-Erzeugung.

## F. Arbeitsweg, Speicherung und Prüfung

Der bestehende Electron-Ziel-App-Vertrag wurde fachneutral um einen optionalen PDF-Vertrag erweitert. Der native Editor verwendet weiterhin denselben M77-PDF-Core, dieselbe `PdfLayoutSession`, denselben atomaren Profilstore und denselben Arbeitsbereich. Die BBM-Seite führt neutrale Layoutzustände vor dem bestehenden Paginierungs- und `webContents.printToPDF`-Pfad zu. Die Vorschau liest anschließend genau die dadurch erzeugte PDF-Datei zurück.

Der Profilweg bleibt `pdf-layouts`; stabile kompatible Registry-Elemente werden beim Wiederanlauf übernommen, neue Elemente starten mit Baseline und unbekannte Alt-IDs werden nicht angewendet. Fehlerhafte Batches werden vollständig zurückgerollt. `Reset`, `Discard`, `Save`, Neustart-Restore und kontrollierte Regeneration verwenden den bestehenden Zustandsweg.

Nachweise:

- Vertrags- und Registrytests im UI-Editor-kit,
- BBM-Adapter-, Readback-, Rollback-, Reset-/Restore- und Regenerationstests,
- vollständige .NET-/npm-/Pack-/Release-Prüfungen,
- sichtbare Abnahme mit realem BBM-Protokoll, 28 Registry-Elementen und realer dreiseitiger PDF,
- Änderung von Titel, Tabelle, Spalten, Kopf und Fuß, danach Regeneration und Neustart-Restore,
- provozierter ungültiger Spaltenbatch mit vollständigem Rollback,
- keine `ReferenceOrder`-PDF, kein zweiter Core, kein zweiter Profilweg und kein Netzwerkpfad.

M82 bleibt offen und wurde nicht begonnen.
