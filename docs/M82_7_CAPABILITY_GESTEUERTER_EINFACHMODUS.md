# M82.7 – Capability-gesteuerter Einfachmodus

## Status

M82.7 ist `[A] abgenommen`. Der vorhandene Einfachmodus zeigt für kompakte Text-/Statusziele nur Operationen, die der Ziel-App-Vertrag tatsächlich freigibt.

## Bedienung

Ein Ziel mit `move`, `textResize` und `setVisibility`, aber ohne Breiten- oder Höhenoperation, wird als kompakter Textinhalt behandelt. Der vorhandene Textbereich bietet dann:

- Steuerkreuz für die Position der Anzeige,
- kleinere und größere Schrift,
- direkte Position und Schriftgröße,
- Sichtbarkeit,
- Originalzustand,
- Session-Undo und Speichern.

Breite, Höhe, Tabelleneinstellungen, Gruppengröße und nicht freigegebene Ausrichtungen werden nicht angeboten. Die Entscheidung entsteht ausschließlich aus den neutralen Capabilities; der Core enthält keine BBM- oder Restarbeiten-IDs.

## Zustandsweg

Alle Aktionen verwenden unverändert den bestehenden Change-Request-, HostAdapter-, Dirty-, Undo-, Save-, Restore- und Reset-Weg. Eine blockierte oder nicht vorhandene Operation erzeugt keine Dirty-Änderung.

## Nachweis

Der M82.7-Einzeltest prüft die genaue Capability-Menge, das Ausblenden von Breite/Höhe, wirksame Bewegung, Schriftgröße und Sichtbarkeit sowie Dirty/Undo/Save. M82.5 und M82.6 bleiben grün.

In der paketierten BBM-Diagnostic-Ausgabe wurden Kurztext- und Langtext-Restzeichenanzeige in den sichtbaren nativen Fenstern ausgewählt. Steuerkreuz, direkte Werte, Schrift, Sichtbarkeit, Undo, Save, Neustart-Restore und Originalzustand wirkten unmittelbar. Es wurde keine neue Editorfunktion oder Ziel-App-UI eingeführt.

## M82.7.1 – Verschiebung und Aktionsrückmeldung

Die M82.7.1-Reparatur verwendet unverändert denselben Einfachmodus. Wiederholte Pfeilaktionen und direkte X-/Y-Werte werden kumulativ an die Ziel-App übergeben; eine visuelle Fenster- oder Elementkante erzeugt keine zusätzliche willkürliche Editorgrenze. Eine ausdrücklich im Ziel-App-Vertrag hinterlegte technische Grenze bleibt dagegen verbindlich.

Eine erfolgreiche Aktion meldet Anzeigename, Operation sowie alten und neuen Wert. Liefert der HostAdapter einen technischen Fehler, erscheint dessen verständliche Meldung im Hauptstatus. Liefert er einen unveränderten Zustand, entstehen weder Dirty-Zustand noch Undo-Schritt; der Hauptstatus weist ausdrücklich darauf hin, dass keine Änderung erforderlich war.

Die Regression prüft kleine und große Schrittweiten, freie Direktwerte, wiederholtes Links-/Rechtsverschieben, Gesamtwerte, Hostfehler, unveränderte Zustände, Undo und Speichern. Der gemeinsame Core kennt weiterhin keine BBM-IDs und erzeugt weder Registryeinträge noch Ziel-App-Struktur.
