# M82 - App-Starterpaket - Entwurfsentscheidung

Status: `[A]` umgesetzt, technisch und sichtbar praktisch abgenommen.

## A. Art der Ausgabe

- UI: Erweiterung des bestehenden nativen WPF-Managers.
- PDF: keine neue oder geaenderte PDF-/Druckausgabe.

## B. Editorfaehigkeit

Der Manager ist nicht editorfaehig. Er ist ein technisches Installations-, Status- und Startwerkzeug. Neue Ziel-Apps beginnen ohne aktive Scopes; bestehende Apps werden nicht als vollstaendig registriert behauptet.

## C. Editorfaehige Elemente

Keine Managerbedienelemente sind Editorziele. Es werden daher keine `data-ui-inspector-id`, `data-ui-editor-kind`, `data-ui-editor-label`, `data-ui-editor-parent`, `data-ui-editor-editable` oder `data-ui-editor-ops` vergeben.

## D. Gesperrte Ziele

Alle vier Hauptaktionen, Eingaben, Vorschau, Bestaetigung, Installation, Update, Deinstallation, Statuspruefung und Editorstart sind technische Aktionen. Fachaktionen, Speichern, Anlegen, Loeschen, Upload, Import, Autosave, IPC-/Datenbankaktionen und Fachdaten bleiben ausserhalb des Editors.

## E. Parent-/Strukturregel

M82 erzeugt keine Editorziele. Starterregeln verlangen fuer spaetere Ziel-App-Elemente einen vorhandenen Registry-Parent; nur ein Scope-Root hat keinen Parent. Labels und Felder sind getrennte Geschwister. Tabellen und Spalten werden ausdruecklich registriert.

## F. Pruefung

`StarterPackageTests` prueft Paket, Manifest, Gerueste, getrennte Ablaeufe, Sperren, Vorschau, Ownership, Rollback, Update, Deinstallation, Status und die vier Manageraktionen. M73-M81.1-Vertragschecks bleiben fuehrend. Eine UI ist erst mit ihrem Ziel-App-eigenen Vertrags- und Vollstaendigkeitscheck fertig.
