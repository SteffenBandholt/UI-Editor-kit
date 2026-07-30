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
