# M80.1 – Bestands-App-Registrierung und Registry-Refresh

## UI-/PDF-Entwurfsentscheidung

### A. Art der Ausgabe

- UI: ja. Der bestehende native UI-Editor zeigt ausschließlich von der Ziel-App bestätigte, vollständige Scopes.
- PDF: nein. M81 bleibt die BBM-PDF-Anbindung.
- Neue Editoroberfläche: nein.

### B. Editorfähigkeit

- Editorfähig: ja, aber nur für Scopes mit `status = complete`, vollständigem Inventar, auflösbaren Refs und grünem Vertragscheck.
- Unvollständige, inkompatible und gesperrte Scopes bleiben sichtbar klassifiziert, werden jedoch nicht zur Layoutbearbeitung freigegeben.

### C. Editorfähige Elemente

Die Ziel-App liefert pro Element mindestens:

- `id`, `name`, `type`, `role`, `semanticKey`
- `parentId`, `scopeId`, `order`
- `visible`, `editable`, `registrationStatus`
- `allowedOps` beziehungsweise `capabilities`, `lockedOps`
- `baseline`, `refKey`, `referenceResolved`

Die DOM-Attribute `data-ui-inspector-id`, `data-ui-editor-kind`, `data-ui-editor-label`, `data-ui-editor-parent`, `data-ui-editor-editable` und `data-ui-editor-ops` bleiben Ziel-App-Aufgabe. Tabellen, Spalten und Metaspalten sowie Label und Feld werden als getrennte Registryelemente modelliert.

### D. Nicht editorfähige Ziele

Fachliches Speichern, Anlegen, Löschen, Upload, Import, Export, Autosave, Datenbank-/IPC-Aktionen, fachliche Buttonausführung sowie Fachdaten, Fachwerte, dynamische Tabellenzeilen, Kunden- und Projektwerte sind ausgeschlossen. Fachbuttons dürfen nur als Layoutobjekte erscheinen und müssen mindestens `executeTargetAction` und `modifyDomainData` sperren.

### E. Parent-/Strukturregel

Jedes Element außer dem Scope-Root besitzt einen im selben Scope vorhandenen Parent. Jeder vollständige Scope besitzt genau einen Root mit `id = scopeId`. Doppelte IDs, fehlende Parents und Zyklen blockieren den Scope.

### F. Prüfung

- `scripts/tests/m80-1-target-registration.test.cjs` prüft Fingerprint, Version, Vollständigkeit, Refresh, Ereignisse, Profile und Konfliktschutz.
- Die bestehenden M73–M80-.NET- und npm-Suiten bleiben Regressionstor für WPF, Electron, Prozess, Pipe und Editor.
- Ziel-App-spezifische Registry-/Ref-Vollständigkeit wird zusätzlich in der Ziel-App geprüft.

## Bestands-App-Statusmodell

Der frameworkneutrale Ablauf unterscheidet `notInstalled`, `registrationRequired`, `registrationInProgress`, `incomplete`, `complete`, `changed`, `incompatible` und `blocked`. Geprüft werden Ziel-App-Vertrag, Adapter, Registry, erwartetes Inventar, Refs, Baselines, Fachaktionsschutz und Capabilities. Eine App oder ein Scope wird nie allein aufgrund einer Versionsnummer freigegeben.

## Registryversion und Fingerprint

Die Ziel-App ist Quelle von Registry und Version. Der Editor berechnet und prüft zusätzlich einen deterministischen SHA-256-Fingerprint über die sortierte Struktur aus Element-ID, Parent, Scope, Typ, Rolle, semantischem Schlüssel, Capabilities, `lockedOps`, Baseline-Struktur und Ref-Schlüssel. Fachwerte, aktuelle Eingaben, Kundendaten, dynamische Zeilen und aktuelle Fachstatuswerte sind ausgeschlossen.

Version und Fingerprint werden gemeinsam ausgewertet. Gleiche Struktur ergibt unabhängig von der Lieferreihenfolge denselben Fingerprint; eine strukturelle Änderung erzeugt einen anderen Fingerprint.

## Refresh und Laufzeitereignisse

Vor jedem Öffnen und Fokussieren wird die aktuelle Ziel-App-Registry angefordert, validiert und mit dem Editorstand verglichen. Dasselbe gilt für `registryChanged`, `registryStatusChanged`, `scopeAdded`, `scopeChanged` und `scopeRemoved`.

- Aktuell: vorhandene Sitzung bleibt aktiv und wird fokussiert.
- Geändert und kompatibel: stabile IDs und Profilwerte bleiben erhalten; neue IDs beginnen mit der Ziel-App-Baseline; entfernte IDs werden nicht mehr angewendet.
- Parent-, Scope-, Typ-, Rollen-, Bedeutungs- oder Ref-Vertragsänderung einer stabilen ID: Profilmigration erforderlich, kein blindes Laden.
- Unvollständig/gesperrt: nur vollständige Scopes bleiben aktiv.
- Refreshfehler: der letzte gültige Stand bleibt erhalten.
- Dirty-Konflikt: ungespeicherte Änderungen werden nicht verworfen; der Refresh wird blockiert.

Die Ziel-App bleibt jederzeit Registry-Wahrheit. Der Editor führt keine dauerhafte Schattenregistry als Ersatzquelle.

## Profilabgleich

Der vorhandene Profilweg wird erweitert, nicht dupliziert. Unveränderte IDs behalten nur noch erlaubte Layoutwerte. Neue IDs erhalten ihre Baseline. Entfernte IDs werden kontrolliert ignoriert beziehungsweise archiviert. Entfallene Capabilities entfernen nicht mehr erlaubte Profilwerte. Bedeutungs- oder Parentänderungen verlangen eine ausdrückliche Migration.

Dirty-Zustände vergleichen ausschließlich die je Element registrierten `UiCapability`-Werte. Laufzeitmaße, die für ein Element nicht freigegeben und nicht persistierbar sind, lösen nach Restore oder Registry-Refresh keinen falschen Konflikt aus.

## Abnahmenachweis

M80.1 ist praktisch mit dem gepackten BBM und dem vorhandenen nativen Editor abgenommen. Belegt wurden ein vollständiger Restore ohne falsches Dirty, kontrollierte kompatible Registrywechsel auf genau eine neue Editorinstanz, sichtbarer Schutz ungespeicherter Änderungen, vollständige Restarbeiten-Bäume, unabhängige Label-/Feldbearbeitung und Sichtbarkeit, Fachaktionssperre, Save/Load/Discard/Reset sowie provozierter Applyfehler mit erfolgreichem Rollback. Die Pflichtsuiten liefen mit 88 Manager- und 51 Referenz-App-Tests sowie vollständigen npm-, Paket- und Release-Prüfungen grün.

## Produktgrenzen

- Kein automatischer UI-/DOM-Scan und keine automatische Registrierung.
- Kein Browser-, HTTP-, WebSocket-, Netzwerk- oder Cloudpfad.
- Keine zweite Editoroberfläche, kein zweiter Core und kein zweiter Profilweg.
- WPF bleibt unterstützt; Electron ist nur für den belegten lokalen Adapter behauptet.
- React/Vite werden nicht als unterstützt behauptet.
- M81 PDF und M82 App-Starterpaket bleiben offen.
