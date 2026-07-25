# M77 – Entwurfsentscheidung für den sichtbaren PDF-Editor

## 1. Ist-Bericht

M75 betreibt genau ein natives `EditorWindow`. Dessen Coordinator hält eine einzige Node-Session für die beiden UI-Scopes offen; alle UI-Schreibzugriffe laufen weiterhin ausschließlich über den `WpfHostAdapter`. Profil-, Saved-, Baseline- und Working-Zustand sowie Dirty-, Discard-, Reset- und Rollbacksemantik liegen in `LayoutProfileSession`.

M76 stellt davon getrennt ein neutrales A4-PDF-Modell in Millimetern, eine validierte Registry mit 26 `pdf.`-Elementen, den einzigen `PdfHostAdapter`, `PdfLayoutSession`, den atomaren Speicher für `pdf-standard` und die einzige PDF-Erzeugung in `ReferenceTargetApp.PdfRendering` bereit. Die erzeugte PDF besitzt reproduzierbaren Umbruch und neutrale Rendertraces, aber noch keine Vorschau- oder Fensterintegration.

## 2. Wiederverwendungsplan

- Das bestehende Editorfenster, seine UI-ViewModels und die aktive Node-Session bleiben erhalten.
- UI-Operationen, Profile und Persistenz werden nicht dupliziert oder umbenannt.
- Der PDF-Baum wird ausschließlich aus `PdfElementRegistry` aufgebaut.
- PDF-Änderungen werden ausschließlich als bestehende `PdfChangeRequest`s an den `PdfHostAdapter` gesendet.
- Save, Load, Discard, Reset, Baseline/Saved/Working und Batchrollback erweitern die vorhandene `PdfLayoutSession` nur um elementbezogene Varianten.
- Die PDF-Ausgabe wird ausschließlich durch `PdfOrderDocumentRenderer` und PDFsharp erzeugt.

## 3. Fenster- und Arbeitsbereichsarchitektur

`EditorWindow` bleibt die einzige Fensterinstanz und bietet die Arbeitsbereiche „Programmoberfläche“ und „PDF-Ausgabe“. Der bestehende UI-Bereich bleibt als eigener ViewModel-Zustand aktiv. Ein separates `PdfEditorWorkspaceViewModel` kapselt PDF-Baum, Seiten, Auswahl, Details, Modi, Befehle und Vorschauzustand. Ein Arbeitsbereichswechsel speichert nichts, verwirft nichts und startet keinen Prozess. Der Coordinator beendet beim Schließen Node-Session, Render-/Previewarbeiten und beide ViewModels kontrolliert.

## 4. Vorschauarchitektur

Die Vorschau liest nach erfolgreicher technischer Prüfung exakt die atomar erzeugte Ausgabedatei. Sie verwendet die in Windows enthaltene API `Windows.Data.Pdf` in einer eigenen Vorschaugrenze und rendert Seiten lokal asynchron in PNG-Bytes. Dafür wird keine zusätzliche Bibliothek und keine zusätzliche Lizenz benötigt. Die API ist nur ein Leser/Seitenrenderer; PDFsharp bleibt die einzige Erzeugungsengine. Bytes werden in speicherresidenten, geschlossenen Streams in gefrorene WPF-Bitmaps überführt. Es entstehen keine Preview-Dateien und keine dauerhafte Dateisperre.

## 5. Auswahlmechanismus

Der PDF-Renderer liefert zusätzlich zu Datei und technischen Traces für jede Seite neutrale `elementId`-/`pageNumber`-/`PdfBox`-/`stableOrder`-Zuordnungen. Diese Bounds stammen aus demselben aufgelösten Layout, das die PDF-Zeichenoperationen steuert. Die Vorschau rechnet über das A4-Seitenverhältnis und den tatsächlichen „Uniform“-Bildbereich zwischen View- und PDF-Koordinaten um. Unter allen Treffern gewinnt das kleinste editierbare Element; bei Gleichstand die höhere stabile Reihenfolge. Nicht editierbare Strukturknoten werden nur verwendet, wenn kein editierbarer Treffer existiert. Außerhalb der Seite oder aller Bounds entsteht keine Auswahl. Ein WPF-Overlay zeigt den zurückgerechneten Bound, ohne PDF oder Layout zu verändern.

## 6. PDF-Dirty- und Profilzustandsfluss

`PdfLayoutSession` bleibt Eigentümer von Baseline, Saved und Working. PDF-Dirty wird gegen Saved berechnet und bleibt vom UI-Dirty getrennt. Ein zusätzlicher Preview-Zustand speichert die Layoutversion des letzten erfolgreichen Renderlaufs. Jede erfolgreiche PDF-Layoutänderung, Load-, Discard- oder Reset-Aktion erhöht die Working-Version und markiert die Vorschau veraltet. Save ändert nur Saved/Dirty, nicht die Preview-Version. Startup-Restore lädt ausschließlich `pdf-standard`; UI- und PDF-Profildokumente sowie Dateipfade bleiben getrennt.

## 7. Aktualisierungs- und Renderingfluss

„PDF neu erzeugen“ erfasst den aktuellen validierten Working-State, rendert asynchron atomar in den kontrollierten Ausgabepfad, prüft die Datei, liest sie über die Vorschaugrenze und veröffentlicht Seiten, Bounds und Version erst nach Gesamterfolg. „Vorschau aktualisieren“ liest nur die letzte gültige Ausgabedatei neu. Ein Semaphore verhindert parallele Render- beziehungsweise Previewläufe. Generationen und Cancellation verhindern, dass ein älteres Ergebnis ein neueres überschreibt. Fehler bewahren die letzte gültige Datei und die letzte gültige Vorschau.

## 8. Test- und Diagnosestrategie

Automatisierte Tests prüfen Arbeitsbereiche, 26 Registryeinträge, Baum/Details, capability-gesteuerte Operationen, elementbezogene Zustandsaktionen, getrennte Dirty-Zustände, RenderBounds, Koordinatenabbildung, Trefferregeln, echte Seitenbitmaps, Datei-Freigabe, Versionierung, Fehlererhalt, gemeinsamen Schließfluss und alle M75-/M76-Regressionen. Der Modus `--ui-pdf-end-to-end-diagnostic` verwendet echte WPF-Fenster, den echten Node-Prozess, echte atomare Profile und echte mehrseitige PDFs in einem isolierten Diagnoseverzeichnis, prüft Neustart-Restore und räumt Prozesse sowie Artefakte abschließend auf. Erst nach diesem Nachweis werden Statusdokumente auf M77 `[A]` gesetzt.

## Grenze zu M78

M77 ergänzt weder Ziel-App-Auswahl, Registrierung, automatische PDF-Erkennung, Import/OCR noch einen Windows-Manager. Browser-, Web-, Cloud- und Servertechnik bleiben ausgeschlossen.
