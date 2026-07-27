# App-Starterpaket - Definition of Done fuer UI

Eine neue oder geaenderte UI ist erst fertig, wenn gleichzeitig aktualisiert wurden:

1. UI-Code
2. Registry
3. Ref-Aufloesung
4. Parentstruktur
5. Baseline
6. Capabilities
7. `lockedOps`
8. Registryversion
9. Registry-Fingerprint
10. Vertrags- und Vollstaendigkeitstests

Jedes relevante sichtbare Element ist editorfaehig, editorfaehiger Container oder bewusst gesperrt. Labels/Felder sowie Tabellen/Spalten sind getrennt und ausdruecklich registriert. Fachbuttons bleiben fachlich gesperrt. Build/CI muss bei einer Abweichung von UI-Code und Registryvertrag fehlschlagen.
