# M81.1 – Sicherer Profil-Restore bei inkompatiblen Benutzerprofilen

## A. Art der Ausgabe

- UI: ja, ausschließlich ein nativer Wiederherstellungsdialog vor dem bestehenden Editorfenster.
- PDF: keine neue PDF-Ausgabe; der vorhandene PDF-Arbeitsbereich wird nur unabhängig klassifiziert und wiederhergestellt.
- UI und PDF bleiben getrennte Profil- und Fehlerbereiche.

## B. Editorfähigkeit

- Wiederherstellungsdialog: editorfähig **nein**.
- Begründung: Der Dialog ist eine technische Sicherheits- und Startentscheidung. Er ist kein Layoutziel der Ziel-App und darf sich weder selbst registrieren noch Fachaktionen ausführen.
- Die vorhandenen UI- und PDF-Registryelemente, Parent-Beziehungen und Operationen bleiben unverändert.

## C. Editorfähige Elemente

M81.1 führt keine neuen editorfähigen Elemente ein. Deshalb entstehen keine neuen Werte für `data-ui-inspector-id`, `data-ui-editor-kind`, `data-ui-editor-label`, `data-ui-editor-parent`, `data-ui-editor-editable` oder `data-ui-editor-ops`.

Der Dialog enthält ausschließlich nicht registrierte Bedienelemente:

- `Details anzeigen` / `Details ausblenden`,
- `Mit Standardlayout öffnen`,
- optional `Profil migrieren und öffnen`,
- `Abbrechen`.

## D. Nicht editorfähige Elemente und verbotene Ziele

Nicht editorfähig bleiben Fachaktionen, Speichern/Anlegen/Löschen, Upload/Import/Export, Autosave, Datenbank- und fachliche IPC-Aktionen sowie die technische Profilarchivierung selbst. Fachwerte werden weder gelesen noch in Archivmetadaten geschrieben.

## E. Parent- und Strukturregel

Es werden keine Registryelemente und damit keine neuen Parent-Beziehungen angelegt. Die bestehenden UI- und PDF-Registries werden vor jedem Restore vollständig validiert. Ein sicherer Migrationsweg darf ausschließlich unveränderte bekannte Scopes übernehmen und neue vollständige Scopes aus ihrer Ziel-App-Baseline ergänzen.

## F. Prüfung

- `M811ProfileRecoveryTests` prüft kompatibel, fehlend, inkompatibel, beschädigt, blockierte Archivierung, Abbruch, sichere Migration, getrennte PDF-Klassifikation, byte-identisches Archiv und sauberen Start ohne Autosave.
- Der Dialogtest sichert Titel, Aktionen und das Fehlen von Editorregistrierung ab.
- Die reale BBM-Abnahme verwendet den normalen Benutzerprofilpfad, archiviert das Altprofil byte-identisch und prüft UI/PDF, Save, Neustart-Restore, Reset und Discard.
- Die bestehenden Vertrags- und Release-Prüfungen bleiben unverändert verpflichtend.

## Zustands- und Sicherheitsvertrag

Profile werden als `compatible`, `migrationAvailable`, `incompatible`, `corrupt`, `missing`, `blocked` oder `archived` klassifiziert. Ein inkompatibles oder beschädigtes Profil wird nie teilweise angewandt. Vor Baseline oder Migration wird es innerhalb der bestehenden Profilwurzel unter `archive/<applicationId>/` kollisionssicher verschoben. Archiv und Metadaten enthalten Zeitstempel, Grund, Klassifikation, Schema-/Vertrags-/Registryversion, Fingerprints und SHA-256; das Profilarchiv bleibt byte-identisch.

Eine Migration ist nur zulässig, wenn alle vorhandenen Scopes mit identischem Fingerprint vollständig validieren und ausschließlich neue Scopes ergänzt werden. Parent-, Capability-, Rollen-, Struktur- oder unbekannte Schemaänderungen sperren die Migration. Nach erfolgreichem Restore gilt der tatsächlich angewandte Zielzustand als sauberer Sitzungsstand; eine zulässige Zielnormalisierung löst deshalb kein falsches Dirty aus und schreibt die Profildatei nicht automatisch neu.

