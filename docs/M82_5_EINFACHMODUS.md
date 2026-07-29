# M82.5 – Einfachmodus

Status: `[A]` – Implementierung, vollständige Pflichtprüfungen und sichtbare native Endabnahme sind abgeschlossen.

## Ziel und Abgrenzung

Der native UI-Editor startet mit einem radikal vereinfachten Arbeitsweg: Ziel auswählen, Text oder Element wählen, mit Steuerkreuz beziehungsweise Größensteuerung ändern, Schrittweite wählen, rückgängig machen oder speichern. Die vorhandenen technischen Funktionen bleiben im aufklappbaren Bereich **Erweitert** erhalten. Es gibt keinen zweiten Editor, keinen zweiten Profilstore und keinen zielappspezifischen Code im gemeinsamen Core.

M82.5 verändert ausschließlich UI-Layoutwerte. Fachwerte, fachliche Aktionen, PDF-Erzeugung, Browser-, Netzwerk- und Cloudfunktionen sind ausgeschlossen.

## Bedienmodell

- **Auswahl:** Haupttext zeigt Anzeigename und die verständlichen Arten Bezeichnung, Feld / Inhalt, Gruppe, Tabelle, Spalte oder Spaltenüberschrift. Registry-ID, Typ, Rolle, Parent und Scope stehen nur unter **Details anzeigen** in **Erweitert**.
- **Text:** Textposition und Schriftgröße werden nur angeboten, wenn das gewählte Ziel die Operationen `textMove` beziehungsweise `textResize` freigibt. Pfeile, kleiner/größer, direkte Schriftgröße und Originalzustand verwenden denselben HostAdapter.
- **Element und Gruppe:** Position, Breite, Höhe und Sichtbarkeit erscheinen capability-gesteuert. Gruppen verwenden dieselben Bedienelemente; es gibt keine zweite Gruppenmaske.
- **Steuerkreuz und Schrittweite:** 1, 5 und 10 DIP sind direkt wählbar, zusätzlich ist eine freie endliche Zahl möglich. Die Schrittweite gilt einheitlich für Position, Größe, Textposition und Schriftgröße.
- **Direkte Werte:** X, Y, Breite, Höhe, Text-X, Text-Y und Schriftgröße werden als DIP eingegeben. Nicht endliche oder nicht freigegebene Werte werden verständlich abgewiesen.

## Gruppen- und Risikoverhalten

Normale Änderungen laufen ohne modalen Risikodialog über den vorhandenen freien Geometrieweg. Bestätigbare Grenz- oder Überlappungsrisiken werden intern operationsgebunden bestätigt; beim Verkleinern bleibt frei werdender Platz erhalten, damit Nachbarn nicht ungefragt nachrücken. Der native Host darf eine sichtbare Gruppe nach seinen vorhandenen Layoutregeln mitwachsen lassen. Mathematisch ungültige Werte, fehlende Capabilities und unerwartete Nachbaränderungen bleiben blockiert und rollen über denselben HostAdapter zurück. Die vollständigen Risikoangaben bleiben unter **Erweitert** einsehbar.

## Tabellen und Spalten

Für eine registrierte Inhaltstabellenspalte zeigt der Einfachmodus aktuelle Breite, `-10`, `-1`, `+1`, `+10`, direkte Eingabe, Umbruch, Ellipsis, Originalzustand und **An sichtbaren Bereich anpassen**. Die vorhandene M82.4-Spalte bleibt die einzige Breitenquelle für Header, Daten, Footer und Profil. Andere Spalten werden nicht stillschweigend verändert; Überlauf erscheint kompakt im Status und kann ausdrücklich eingepasst werden.

## Speichern und Rückgängig

Jede erfolgreiche Aktion legt vor der Änderung einen Session-Undo-Frame mit Layoutzustand und expliziten Operationen an. **Rückgängig** stellt genau den letzten Frame über denselben transaktionalen Adapterweg wieder her; bis zu 100 Schritte bleiben in der laufenden Sitzung verfügbar. Nach einer echten Änderung werden Dirty, Speichern und Rückgängig sofort aktualisiert. Speichern verwendet unverändert den atomaren Layoutprofilstore. Load, Discard und Reset bleiben sekundär unter **Erweitert**.

## WPF- und Electron-Abbildung

Das appneutrale Node-ViewModel liefert den Einfachmodus als Standard, den geschlossenen Erweitert-Zustand, DIP, Schrittweiten und capability-gesteuerte Aktionen. Der native WPF-Workspace bildet dieses Modell sichtbar ab. Electron-Ziel-Apps liefern weiterhin ausschließlich Registry, Layoutzustand und HostAdapter-Operationen über den bestehenden lokalen Vertrag; sie erhalten keine eigene Editoroberfläche. Damit verwenden WPF und Electron denselben Core, dieselben Operationsnamen und denselben Profil-/Rollbackweg.

## Prüfung

- Node-Vertragstest: `scripts/tests/m82-5-simple-editor-mode.test.cjs`
- WPF-/Undo-Test: `reference-target-app/tests/ReferenceTargetApp.Tests/M825SimpleModeTests.cs`
- Gesamtprüfungen: .NET-Build/-Tests, `npm test`, Pack-Dry-Run und `release:check`
- Sichtbare Abnahme: native Referenz-Ziel-App und paketierte BBM-Referenzapp

Die sichtbare Abnahme im normalen Benutzerprofil belegte den standardmäßig geöffneten Einfachmodus, geschlossene technische Details, verständliche Namen, Direktauswahl per Maus und Tab, Text- und Elementmodus, direkte Werte, 1-DIP-Schritte, gruppierte Verschiebung und Größenänderung, Tabellen-Fit sowie einen mehrstufigen exakten Undo. Änderungen aktivierten unmittelbar Undo und Save; nach Speichern und vollständigem Neustart wurden Spaltenbreite und Schriftgröße ohne Doppelanwendung wiederhergestellt. Der Workspace blieb bei 760, 1180 und 1550 Pixel Fensterbreite bedienbar.

Die paketierte Development-BBM zeigte die vorhandene Testlizenzkennzeichnung und erzeugte über den unveränderten PDF-Fachweg eine echte zweiseitige Protokoll-PDF mit 28 Registryelementen und aktueller Seitenvorschau. Die vollständigen .NET-, Node-, Pack- und Release-Prüfungen sind grün; Fachwerte, Datenbank und PDF-Fachlogik blieben unverändert.
