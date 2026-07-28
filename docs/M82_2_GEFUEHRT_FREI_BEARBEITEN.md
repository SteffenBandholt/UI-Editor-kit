# M82.2 – Geführtes und freies Bearbeiten

## Produktgrenze

M82.2 erweitert den vorhandenen nativen UI-/PDF-Editor um einen frameworkneutralen Geometrierisikovertrag. WPF- und Electron-Ziel-Apps liefern ihre registrierten Beziehungen und Rechtecke über den bestehenden HostAdapter. Der gemeinsame Core bewertet sie ohne app-spezifische IDs. Es entstehen weder ein zweiter Editor noch ein zweiter Profil-, Registry- oder Transportweg.

## Bearbeitungsmodi

- `guided` („Geführt“) zeigt ein erkanntes Risiko vor dem endgültigen Anwenden. Je nach Grenze kann der Nutzer das Zielrechteck an Gruppe oder Bereich halten, die konkrete Operation trotzdem anwenden oder abbrechen.
- `free` („Frei“) lässt Gruppenverlassen, Parentüberschreitung und Überlappung nach einer verständlichen Bestätigung zu. Parentbeziehungen und Elementgrößen werden dadurch nicht geändert.

Der Standard ist „Geführt“. Die Auswahl wird als `editor-preferences.json` atomar neben, aber ausdrücklich nicht in UI- oder PDF-Layoutprofilen gespeichert.

## Gemeinsamer Vertrag

`src/core/geometry-risk-contract.cjs` und die ausgelieferte ESM-Fassung definieren:

- Modi `guided` und `free`,
- Risiken `leavesGroup`, `leavesParent`, `entersNeighborArea`, `overlapsNeighbor`, `leavesEditableArea`, `groupOverlap` und `unusualSpacing`,
- Ziel, Gruppe, Parent, bearbeitbaren Bereich und sinnvolle sichtbare Nachbarn mit Rechtecken,
- Aktionen `clampToGroup`, `clampToArea`, `applyAnyway`, `goBack` und `cancel`,
- eine operationsgebundene Bestätigung sowie Rollbackbezug,
- eine Vorschau mit aktuellem und neuem Rechteck sowie Gruppen-, Bereichs- und Überlappungsgeometrie.

NaN, Infinity, nicht positive wirksame Größen, fehlende stabile IDs, gesperrte Operationen, Vertragsfehler, ungesicherter Rollback und Fachwertänderungen bleiben technische Fehler.

## Nutzerhinweise und Details

Haupttext und Titel verwenden nur Anzeigenamen der Ziel-App und beschreiben die sichtbare Folge. Element-, Parent-, Gruppen- und Scope-IDs, Fingerprint, berechnete Rechtecke, Readback, Fehlercode und Rollbackstatus stehen ausschließlich im aufklappbaren Bereich „Details anzeigen“. Die Auswahl allein erzeugt keine Warnung; deklarierte Reflow-Eigenschaften erscheinen neutral.

Eine Risikobestätigung ist immer an genau eine Operation gebunden. Abbrechen oder Zurück übernimmt nichts, entfernt die Vorschau und gibt den Editor im `finally`-Pfad wieder frei. Auswahl, Baum, Modus und Schrittweite bleiben erhalten.

## Vorschaugeometrie

Die Ziel-App rendert die Vorschau nativ und ohne reine Farbcodierung:

- aktuelles Element: durchgezogener Rahmen,
- Zielrechteck: gestrichelter Rahmen,
- Gruppe: Doppelrahmen,
- Bereich: punktierter Rahmen,
- Nachbarüberlappung: Schraffur beziehungsweise Doppelrahmen.

Die Vorschau verschwindet nach Anwenden, Abbrechen, Zurück, Auswahlwechsel, Escape und beim Schließen.

## HostAdapter-Pflichten

Der vorhandene WPF- beziehungsweise Electron-HostAdapter liefert Bounding Rectangles und Registrybeziehungen, führt den vorhandenen transaktionalen Apply-/Readback-/Rollback-Weg aus und zeigt beziehungsweise entfernt die native Vorschau. Texte und Risikoentscheidung bleiben im gemeinsamen Vertrag beziehungsweise Editor. Eine räumliche Verschiebung registriert kein Element um.

## UI und PDF

Für UI-Ziele ist der vollständige Modus-, Risiko-, Dialog- und Vorschauweg aktiv. Der PDF-Arbeitsbereich nutzt dieselbe verständliche Meldungsstruktur für Seitenbereichs- und Überlappungsrisiken. Technisch bindende PDF-Regeln – insbesondere Seitengrenzen, Spaltensummen, Pagination, wiederholte Kopf-/Fußbereiche und Druckbarkeit – werden nicht gelockert.

## Prüfung

Automatisiert sichern der 42-Fälle-Coretest, .NET-Tests des Evaluators und Präferenzstores sowie die Electron-Referenztests den Vertrag. Die vollständigen Repo-, Pack-, Release- und nativen BBM-Abnahmeläufe sind Voraussetzung für `[A]`.

Der sichtbare gepackte BBM-Lauf bestätigt den vollständigen UI-Risikopfad. In der eindeutig gekennzeichneten Development-/Diagnostic-Variante wurde im normalen Benutzerprofil außerdem die echte vierseitige BBM-PDF mit 28 Registryelementen erzeugt. Geführt/Frei, verständliche Anzeigenamen, technische IDs ausschließlich unter „Details anzeigen“, zulässige Änderung mit Neuerzeugung und Speichern, Neustart-Restore ohne Doppelanwendung, Element-/Gesamtreset, Discard sowie Profil-Recovery sind nachgewiesen. Eine abgelehnte Bereichsüberschreitung wurde verständlich zurückgerollt; der Editor blieb direkt bedienbar. M82.2 ist damit `[A]` abgenommen.
