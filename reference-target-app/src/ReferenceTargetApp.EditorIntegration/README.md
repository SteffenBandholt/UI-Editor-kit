# EditorIntegration – Grenze in M73.2

Dieser Projektbereich enthält ausschließlich die explizite WPF-UI-Registry für den freigegebenen Bereich „Auftragskopf“:

- unveränderliche Registry-Einträge und Fähigkeiten;
- explizite Zuordnung benannter nativer WPF-Controls;
- Validierung von IDs, Hierarchie, Scope, Referenzen und Fähigkeiten;
- lesende Abfragen und sichere Diagnostik.

Die Registry wird von der WPF-App nach `Loaded` aufgebaut. Sie durchsucht keinen Visual Tree und verändert weder Layout noch Fachdaten. Das Projekt referenziert weder das Fachmodell noch den Node.js-Editor-Kern.

Nicht enthalten sind HostAdapter, Editoroperationen, Prozessstart, JSON-Zeilen-Kommunikation, Layoutspeicher, Editor-Session, Selektion oder sichtbare Editoroberfläche.
