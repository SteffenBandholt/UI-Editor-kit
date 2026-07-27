# Registry-Refreshvertrag

Vor jedem Oeffnen oder Fokussieren des Editors fordert der Host Ziel-App-Vertrag, Registryversion, Fingerprint, UI-/PDF-Status und Ref-Aufloesung neu an. Er bestimmt Aenderungen zum letzten gueltigen Stand und aktualisiert erst danach den Editorbaum.

`registryChanged`, `registryStatusChanged`, `scopeAdded`, `scopeChanged` und `scopeRemoved` verwenden denselben Weg. Fehler, Dirty-Konflikte oder notwendige Migration ersetzen niemals den letzten gueltigen Stand. Unvollstaendige Scopes bleiben blockiert.
