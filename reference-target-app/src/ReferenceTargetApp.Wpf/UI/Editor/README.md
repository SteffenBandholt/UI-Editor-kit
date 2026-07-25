# Native Editor-UI – M77

Das WPF-Editorfenster bleibt ein einzelnes, von der Ziel-App besessenes Fenster mit genau einem lokalen Node-Prozess und einer Session. Es zeigt die festen Profile `Standard` und `Kompakt`, die Scopes `Auftragskopf` und `Kundendaten`, den Registry-Baum, neutrale Details und die vorhandene Live-Bearbeitung aus M74.

Die Layoutaktionen sind `Speichern`, `Laden`, `Änderung verwerfen`, `Alle Änderungen verwerfen`, `Element zurücksetzen` und `Gesamtes Layout zurücksetzen`. CanExecute wird aus Auswahl, Capabilities, Dirty-State und laufender Operation abgeleitet. Gesamtverwerfen und Gesamtreset besitzen native Bestätigungen. Verwerfen kehrt zur letzten gespeicherten Profilversion zurück; Reset zur ursprünglichen App-Baseline und bleibt bis zum Speichern dirty.

Dirty-State wird profilbezogen über beide Scopes angezeigt. Profilwechsel und Schließen mit ungespeicherten Änderungen fragen kontrolliert nach. Der native Schließen-Dialog bietet `Speichern und schließen`, `Ohne Speichern schließen` und `Abbrechen`; es gibt keine automatische Speicherung.

`TargetAppSelectionService` hängt Ereignisse ausschließlich an explizit registrierte beziehungsweise ausdrücklich geschützte Controlreferenzen. Ein Auswahlklick liefert nur Scope- und Element-ID, aktiviert den passenden Baumknoten und unterdrückt den Fachbutton. Unregistrierte geschützte Controls werden verständlich abgewiesen. Abbruch, Scopewechsel und Schließen lösen den Auswahlmodus und seine Events kontrolliert auf; es gibt keine Visual-Tree-Suche oder automatische Registrierung.

Das ViewModel manipuliert keine WPF-Layoutproperty. Jede Änderung, jedes Verwerfen und jeder Reset läuft als neutraler ChangeRequest über den vorhandenen HostAdapter. Datei- und Prozessarbeit ist asynchron; Batchoperationen sind exklusiv, Dispatcheränderungen bleiben auf dem UI-Thread und Ergebnisse werden nach dem Schließen nicht mehr übernommen.

`--ui-full-operation-diagnostic` bedient echte WPF-Fenster und native Dialoge programmgesteuert. PDF, Vorschau, Windows-Manager, freie Profilverwaltung, Undo/Redo, Browser und Netzwerk gehören nicht zu M75; PDF beginnt mit M76.

## Gemeinsamer Arbeitsbereich M77

Dasselbe Editorfenster enthält jetzt die Tabs `Programmoberfläche` und `PDF-Ausgabe`. Ein Wechsel beendet weder die UI-Node-Session noch verwirft oder speichert er Working-State. Das PDF-ViewModel besitzt Seitenliste, Registrybaum, Details, Modi, mm-Schrittweite, Render-/Reloadbefehle, Profilaktionen und einen eigenen Dirty-/Previewzustand. WPF aktualisiert Bitmap, Auswahl und Overlay ausschließlich auf dem Dispatcher; Cancellation und eine Render-Sperre verhindern parallele oder veraltete Veröffentlichungen.

Der gemeinsame Schließdialog nennt Programmoberfläche, PDF-Ausgabe oder beide. „Speichern und schließen“ speichert jeden tatsächlich schmutzigen Bereich kontrolliert; ein Fehler lässt das Fenster offen. `--ui-pdf-end-to-end-diagnostic` öffnet echte Fenster in zwei Prozessen, prüft UI-/PDF-Restore, Vorschau, Auswahl, Bearbeitung, Persistenz, Fehlererhalt und vollständiges Ressourcenende.
