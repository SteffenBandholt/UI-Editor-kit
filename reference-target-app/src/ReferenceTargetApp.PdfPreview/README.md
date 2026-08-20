# Native PDF-Vorschau M77

Dieses Projekt liest ausschließlich die durch `ReferenceTargetApp.PdfRendering` atomar erzeugte Ausgabedatei. Es verwendet die in Windows enthaltene API `Windows.Data.Pdf` (`PdfDocument`/`PdfPage.RenderToStreamAsync`) und benötigt kein zusätzliches NuGet-Paket, keine Fremdbibliothekslizenz, keinen Browser und keinen externen Prozess. PDFsharp bleibt die einzige PDF-Erzeugungsengine und wird hier nicht referenziert.

Jede registrierte PDF-Seite wird asynchron in einen speicherresidenten PNG-Stream gerendert. Die WPF-Schicht übernimmt die Bytes mit `BitmapCacheOption.OnLoad`, friert das Bild ein und schließt alle Streams. Deshalb entstehen keine Preview-Dateien und die PDF bleibt nach dem Lesen exklusiv zugreifbar.

`PdfPreviewCoordinateMapper` verwendet für Fit, PDF→Viewport und Viewport→PDF ausschließlich Breite und Höhe der aktiven `PdfPageDefinition`. Damit bleiben Hochformat, Querformat und weitere vom Vertrag zugelassene Seitengrößen unabhängig von Bildschirm-DPI mathematisch konsistent. Treffer werden nur gegen neutrale `PdfRenderBound`s geprüft: editierbar vor geschützt, dann kleinste Fläche, dann höhere stabile Registryreihenfolge. Die Vorschau erkennt oder analysiert keine unbekannten PDF-Objekte.

Fehler werden als `pdf_preview_load_failed`, `pdf_preview_render_failed` oder `pdf_preview_selection_failed` strukturiert gemeldet. Ein fehlerhafter Reload ersetzt weder die letzte gültige Seitenliste noch deren Bitmaps.
