# M82.4 – Tabellen- und Spaltenbearbeitung

## Ziel und Abgrenzung

M82.4 ergänzt den bestehenden UI-Editor um einen appübergreifenden Tabellenvertrag. Der gemeinsame Core enthält keine BBM-IDs, Fachdaten, automatische UI-Erkennung oder Browser-/Netzwerklogik. WPF und Electron verwenden weiterhin ihre vorhandenen HostAdapter, Profile, Transaktionen, Reset-, Discard- und Rollbackwege.

## Frameworkneutraler Vertrag

Der Vertrag unterscheidet `table`, `tableHeader`, `tableBody`, `tableRow`, `tableColumn`, `tableHeaderCell`, `tableDataCell`, `tableFooter`, `tableViewport` und `horizontalScrollArea`. Eine Tabelle deklariert Geometrie, Viewport, Inhalt, Parent, Spaltenreihenfolge, Überlaufregeln, Breitenpolitik und begrenzte Zeilenhöhe. Jede Spalte deklariert Anzeigename, Header- und Datenreferenz, aktuelle/minimale/maximale Breite, Breiten-, Umbruch- und Überlaufmodus, Ausrichtung, Sichtbarkeit und Sperren.

Fachwerte, dynamische Zeilen, Kunden-/Projekt- und Datenbankdaten werden durch die Vertragsvalidierung abgewiesen. Header- und Datenzellen dürfen keine unabhängige Breitenoperation anbieten.

## Eine Breitenquelle

`widthSourceId` muss mit `columnId` identisch sein. Header, sichtbare Datenzellen, leere Zustände, Auswahl und persistierter Zustand verweisen dadurch auf dieselbe Spalte. Der Registryvalidator prüft Parentstruktur, Header-/Datenbindung und genau eine Breitenquelle. Eine isolierte Headerbreite ist ungültig.

## Viewport, Überlauf und Anpassung

Die Messung trennt Viewportbreite, Spaltensumme, reservierte Breite, Scrollbarbreite, tatsächliche Tabellenbreite und Überlauf. Überlaufursachen werden als Spalten-IDs ermittelt und in der Oberfläche mit Anzeigenamen ausgegeben.

`fitTableToViewport` und `resizeColumnsProportionally` verlangen eine bestätigte Vorschau. Mindestbreiten bleiben erhalten. Ausreichend flexible Spalten werden vor festen Spalten verkleinert; feste Spalten bleiben stabil, solange die flexible Kapazität genügt. Eine gezielt gewählte Spalte kann separat bis zu ihrer Mindestbreite verkleinert werden. Reicht dies nicht, bleibt der Restüberlauf ausdrücklich sichtbar.

## Breite, Umbruch und Ellipsis

Unterstützte Breitenmodi sind `fixed`, `auto` und `proportional`. Umbruch wird als `noWrap`, `wordWrap`, `characterWrap` oder `ellipsis`, Zellüberlauf als `clip`, `ellipsis`, `visible` oder `scroll` geführt. Zeilenhöhen sind `fixed`, `auto`, `bounded` oder `ellipsis` und bleiben durch Ziel-App-Grenzen beschränkt. Eine Verbreiterung zeigt vorab den möglichen Viewportüberlauf an.

## Auswahl und kompakte Oberfläche

Direktauswahl und Baum unterscheiden Tabelle, Kopf, Datenbereich, Zeile, Spalte, Headerzelle, Datenzellenbereich, Viewport und horizontalen Scrollbereich. Header- und Datenziel bieten „Ganze Spalte auswählen“. Der bestehende responsive M82.3-Workspace zeigt kompakt Messwerte, Breitenaktionen, Modus, Umbruch, Überlauf, Viewport-Fit sowie Reset, Speichern und Verwerfen.

## Speichern, Reset und Discard

Spaltenbreiten sowie Breiten-, Umbruch-, Überlauf-, horizontaler Scroll- und Zeilenhöhenmodus laufen durch den bestehenden atomaren Layoutprofilweg. Start-Restore prüft Registryversion, Fingerprint, Capabilities und Tabellenzustand. Ein Spaltenreset stellt Header und Daten gemeinsam wieder her; der Tabellenreset verwendet die deklarierte aktuelle Ziel-App-Baseline. Discard und Fehlerrollback bleiben transaktional und verändern keine Fachwerte.

## WPF- und Electron-Abbildung

WPF bindet eine `DataGridColumn` als einzige Header-/Datenbreitenquelle. `DataGridLength`, `MinWidth`, `MaxWidth`, TextWrapping/Trimming, DataGrid-ScrollViewer und begrenzte DataGridRow-Styles bilden den neutralen Vertrag ab. Der WPF-Adapter liest anschließend den tatsächlichen Zustand zurück.

Electron transportiert Tabellenmetadaten im bestehenden lokalen Vertrag. Die Ziel-App bindet Spalten beispielsweise an einen gemeinsamen CSS-Grid-Track; der Adapter validiert Struktur und Breitenquelle, führt Änderungen transaktional aus und liest die sichtbare Geometrie zurück. Remote Reset verwendet die deklarierte Registry-Baseline und nicht einen bereits restaurierten Laufzeitzustand.

## Technische Nachweise

Die M82.4-Einzeltests prüfen Vertragstypen, Bindungen, Messung, Überlauf, Fit, Mindest-/Maximalbreiten, feste/flexible Spalten, ausgewählte Spalte, Umbruch, Ellipsis, Persistenz, Start-Restore, Reset, WPF-/Electron-Abbildung, Direktauswahl und den Ausschluss von BBM-IDs sowie Browser-/Netzwerkpfaden.

Die praktische Abnahme mit der gepackten BBM-Development-Version bestätigte drei zusammengefasste Spalten mit gemeinsamer Header-/Datenbreite, sichtbaren Text-Ellipsis, begrenzten inneren Überlauf bei schmaler, mittlerer und maximierter Fensterbreite sowie Speichern, Neustart-Restore, Spaltenreset und Discard. Der Electron-Prozessvertrag erhält dabei Tabellenmetriken und betroffene Spaltenzustände; JavaScript und WPF erzeugen für denselben Tabellenscope denselben Fingerprint.
