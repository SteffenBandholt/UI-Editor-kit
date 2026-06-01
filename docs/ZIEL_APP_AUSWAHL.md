# Ziel-App-Auswahl

## 1. Zweck

K18.2 ist das Sicherheits- und Entscheidungsgate vor der ersten echten Ziel-App-Anbindung.

Dieses Dokument legt fest, welche Ziel-App-Kandidaten grundsaetzlich moeglich sind, warum keine komplexe Produktiv-App als erster Schritt angebunden wird, welche Mindestvoraussetzungen vor einer echten Ziel-App-Anbindung gelten und welcher erste Durchstich professionell empfohlen wird.

K18.2 baut keine Ziel-App-Anbindung. Es dokumentiert ausschliesslich die Auswahl-, Risiko- und Abnahmegrundlage fuer den naechsten Bauabschnitt.

## 2. Grundsatzentscheidung

- Die erste echte Ziel-App-Anbindung darf nicht direkt eine komplexe Produktiv-App sein.
- Eine direkte Produktiv-App-Anbindung ist als erster Schritt nicht freigegeben.
- Eine direkte BBM-Produktiv-Anbindung ist als erster Schritt nicht freigegeben.
- Vor jeder produktiven Fach-App braucht es zuerst einen kontrollierten minimalen Ziel-App-Durchstich.
- Der erste Durchstich muss fachneutral bleiben und darf keine Fachlogik, keine Fachdaten und keine produktiven Aenderungen einfuehren.

## 3. Ziel-App-Kandidaten

| Kandidat | Zweck | Risiko | Eignung als erster Durchstich | Entscheidung |
|---|---|---|---|---|
| Neutraler Minimal-Host | Kleiner, kontrollierter, fachneutraler Ziel-App-Durchstich zur Pruefung des Ziel-App-Vertrags. | Gering, weil keine Produktivdaten, keine Fachlogik und keine echte Fach-App betroffen sind. | Hoch: pruefbar, isolierbar und kontrollierbar. | Empfohlen als erster Durchstich. |
| BBM-Produktiv | Spaetere produktive Fach-App-Anbindung nach stabilem Vertrag und eigener Freigabe. | Hoch, weil fachlich und produktiv relevant; Fehler waeren schwerer zu isolieren. | Niedrig fuer den ersten Durchstich. | Spaeterer Kandidat, aber nicht erster Direktanschluss. |
| Andere spaetere Fach-App | Moegliche spaetere produktive oder fachliche Ziel-App nach erfolgreichem Minimal-Host. | Mittel bis hoch, abhaengig von Fachlogik, Datenrisiko und Integrationsumfang. | Nicht als erster unkontrollierter Durchstich geeignet. | Erst nach neutralem Minimal-Host und eigenem Auftrag bewerten. |

## 4. Empfohlene erste Ziel-App

Empfohlen wird ein neutraler Minimal-Host als erster kontrollierter Ziel-App-Durchstich.

Begruendung:

- fachneutral
- geringes Risiko
- pruefbar
- kein Produktivdatenrisiko
- trennt Kit-Logik von Fach-App-Logik
- Fehler koennen isoliert dem Ziel-App-Vertrag, dem Adapter-Verhalten oder der Teststruktur zugeordnet werden
- der Durchstich kann Abbruch- und Rueckfallkriterien pruefen, bevor eine produktive App betroffen ist

## 5. Warum nicht sofort BBM-Produktiv?

BBM ist fachlich und produktiv relevant.

Eine direkte Anbindung an BBM-Produktiv wuerde das Risiko erhoehen, Fachlogik versehentlich mit Editor-Logik zu vermischen. Fehler waeren schwerer zu isolieren, weil gleichzeitig Ziel-App-Vertrag, Adapter-Verhalten, fachliche UI-Struktur, produktive Datenabgrenzung und Integrationsregeln betroffen waeren.

Vor BBM-Produktiv muss der Ziel-App-Vertrag im kleinen Durchstich stabil sein. Erst danach kann BBM als spaeterer Kandidat mit eigenem Auftrag, eigener Abnahme und klarer Begrenzung bewertet werden.

## 6. Mindestvoraussetzungen vor echter Ziel-App-Anbindung

Vor einer echten Ziel-App-Anbindung muessen mindestens diese Voraussetzungen erfuellt sein:

- Ziel-App-Adapter-Vertrag bestaetigt
- editorfaehige Elemente vollstaendig klassifiziert
- erlaubte Operationen festgelegt
- gesperrte Operationen festgelegt
- keine Fachlogik im UI-Editor-kit
- keine Fachdaten im UI-Editor-kit
- Tests fuer Ziel-App-Adapter vorhanden
- Rueckfall-/Abbruchkriterien definiert
- Ziel-App-Regeln und UI-Editor-Vertrag widerspruchsfrei abgeglichen
- klare Grenze zwischen Layoutdaten, Fachdaten und Aenderungsausfuehrung dokumentiert

## 7. Gesperrte Aktionen

Diese Aktionen bleiben ohne eigenen ausdruecklichen Auftrag gesperrt:

- kein Blindscan
- keine automatische Elementerfindung
- keine direkte Produktivdatenaenderung
- keine BBM-Integration ohne eigenen Auftrag
- keine echte Speicherung ohne eigenen Auftrag
- keine UI-Neuerfindung
- keine Ziel-App-Dateien ohne eigenen Ziel-App-Auftrag erzeugen
- keine Fachlogik in das UI-Editor-kit verschieben
- keine Aenderungsausfuehrung gegen eine echte Ziel-App aktivieren

## 8. Abnahmekriterien fuer K18.2

K18.2 ist abnahmefaehig, wenn mindestens diese Kriterien erfuellt sind:

- Dokument vorhanden
- Entscheidung nachvollziehbar
- BBM nicht als erster Direktanschluss freigegeben
- naechster Schritt klar definiert
- `npm test` gruen
- keine echte Ziel-App angebunden
- keine BBM-Integration gebaut
- keine Runtime-Architektur erweitert
- keine UI, keine Fachlogik und keine Fachdaten eingefuehrt

## 9. Naechster Bauabschnitt

Naechster Bauabschnitt:

```text
K18.3 - Neutraler Minimal-Host als erste kontrollierte Ziel-App vorbereiten
```

K18.3 bereitet ausschliesslich den neutralen Minimal-Host als erste kontrollierte Ziel-App vor.

In K18.3 erfolgt ausdruecklich keine BBM-Anbindung.
