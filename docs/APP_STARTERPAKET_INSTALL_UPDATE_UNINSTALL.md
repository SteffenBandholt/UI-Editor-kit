# App-Starterpaket - Installations-, Update- und Deinstallationsvertrag

## Vorschau

Die Vorschau zeigt neue, geaenderte und unveraenderte Dateien, Zielpfade, Ownership, alte/neue Hashes, exakte Textdiffs, Backupbedarf, Gitstatus, Paketversion und Konflikte. Ohne ausdrueckliche Bestaetigung erfolgt keine Aenderung.

## Transaktion und Rollback

Vor jeder Aenderung wird der aktuelle Hash erneut mit der Vorschau verglichen. Jede betroffene vorhandene Datei wird bytegleich gesichert. Dateien werden atomar geschrieben. Bei Schreib-, Vertrags- oder Prueffehler werden alle bereits geaenderten Dateien bytegleich wiederhergestellt; neu erzeugte Dateien werden entfernt. Fremddateien bleiben unberuehrt.

## Update

Nur unveraenderte eigene Paketdateien werden aktualisiert. Ziel-App-eigene Registry-/Ref-/HostAdapter-Gerueste mit `preserveOnUpdate` bleiben erhalten. Lokale Aenderungen an nicht geschuetzten eigenen Dateien oder betroffene Git-Dirty-Pfade blockieren das Update.

## Deinstallation

Nur exakt eigene unveraenderte Dateien werden entfernt. Ziel-App-Code, Registry-/Ref-Gerueste, Profile, Archive, Benutzerlayouts, Fremddateien und Git-Historie bleiben erhalten. Vorschau und Bestaetigung sind verpflichtend.
