# M72 Reference App Checkliste

1. Referenzanwendung mit `npm run reference:browser` starten. Erwartung: lokale URL und Stopphinweis erscheinen.
2. Karte auswählen. Erwartung: Panel zeigt Demo-Karte.
3. Overlayrahmen prüfen. Erwartung: Rahmen liegt sichtbar auf der Karte.
4. Element verschieben. Erwartung: D-Pad bewegt in 5px-Schritten.
5. Breite ändern. Erwartung: Breite ändert sich sichtbar.
6. Höhe ändern. Erwartung: Höhe ändert sich sichtbar.
7. Mindestgröße prüfen. Erwartung: Unterschreiten wird blockiert.
8. Mittelpunkt prüfen. Erwartung: nur ausgewähltes Element wird auf Sitzungsbaseline verworfen.
9. Alle Änderungen verwerfen. Erwartung: alle Sessionänderungen verschwinden.
10. Speichern. Erwartung: Status meldet Speicherergebnis.
11. Browser neu laden. Erwartung: Anwendung startet erneut.
12. Autoload prüfen. Erwartung: gespeichertes Layout ist wieder sichtbar.
13. Einzelreset ausführen. Erwartung: nur ausgewähltes Element wird dauerhaft auf Standard gesetzt.
14. Gesamtreset ausführen. Erwartung: gesamtes Layout wird dauerhaft auf Standard gesetzt.
15. Ursprüngliche Styles prüfen. Erwartung: fremder Transform und Inline-Größen werden nach Reset wiederhergestellt.
16. Storagefehler simulieren. Erwartung: sichtbare Meldung, Speichern blockiert, Sessionänderungen möglich.
17. Auswahl löschen. Erwartung: Hintergrundklick entfernt Auswahl und Overlay.
18. Anwendung neu initialisieren. Erwartung: keine doppelten Listener, Panel/Overlay werden neu aufgebaut.
