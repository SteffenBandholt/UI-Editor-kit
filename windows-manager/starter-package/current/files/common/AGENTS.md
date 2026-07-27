# App-Starterpaket  -  Arbeitsregeln

- App-Starterpaket vor Beginn der UI-Entwicklung installieren.
- Bei einer bestehenden App zuerst im Manager **Bestehende App nachruesten** ausfuehren.
- Keine automatische UI-, DOM-, XAML- oder CSS-Erkennung und keine erfundene Registry.
- Jede neue oder geaenderte UI ist erst fertig, wenn UI-Code, Registry, Refs, Parents, Baseline, Capabilities, `lockedOps`, Registryversion, Fingerprint sowie Vertrags- und Vollstaendigkeitstests gemeinsam aktualisiert sind.
- Jedes relevante sichtbare Element ist editorfaehig, editorfaehiger Container oder bewusst gesperrt.
- Labels und Felder sind getrennte Geschwister. Tabellen und sichtbare Spalten werden ausdruecklich registriert.
- Fachbuttons bleiben als Layoutobjekte fachlich gesperrt; Fachwerte, Speichern, Anlegen, Loeschen, Upload, Import, Autosave, IPC und Datenbankaktionen sind keine Editoroperationen.
- Nur vollstaendige Scopes duerfen aktiv sein. Vor jedem Oeffnen/Fokussieren gilt der Registry-Refreshvertrag.
