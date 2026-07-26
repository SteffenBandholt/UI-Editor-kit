# M78 – Entwurfsentscheidung für Windows-Manager und kontrollierten Installer

## 1. Ist-Bericht

M73 bis M77 liefern den vollständigen nativen UI-/PDF-Editor in einer vorbereiteten WPF-Ziel-App. Das npm-Paket besitzt seit M46 neutrale Bootstrap-, Manifest-, Plan-, Ausführungs- und Deinstallationsbausteine. Diese schreiben ausschließlich eine bekannte Regel-/Registry-Grundstruktur nach Bestätigung und verbieten UI-Scan, automatische Registrierung und Fachänderungen. Sie sind jedoch synchron, CLI-orientiert und besitzen weder den strengeren M78-Opt-in-Vertrag noch Hash-Eigentum, transaktionales Update, bekannte Apps, Desktop-Start oder eine native Vorschau.

## 2. Wiederverwendungsplan

- Die bestehenden M73–M77-Editor-, Registry-, HostAdapter-, Profil-, Prozess- und PDF-Verträge bleiben unverändert.
- Die vorhandenen Installer-Sicherheitsgrundsätze – feste relative Pfade, ausdrückliche Bestätigung, keine Analyse und keine Fachänderung – werden übernommen.
- Das npm-Paket bleibt lokale, versionierte Produktquelle; M78 ergänzt darin keine heuristische Installation.
- Der Manager startet ausschließlich den bereits in einer vorbereiteten Ziel-App enthaltenen Editoraktivierungsweg. Er implementiert keinen zweiten Editor und keine Node-Sessionlogik.

## 3. Managerarchitektur

Unter `windows-manager/` entstehen vier Grenzen: `Domain` für neutrale Records und Zustände, `Core` für reine Manifest-/Plan-/Sicherheitsregeln, `Infrastructure` für Datei-, Hash-, Transaktions-, Prozess-, Shortcut-, Speicher- und Logzugriff sowie `Wpf` für das native Einzelfenster. Tests greifen auf Domain/Core/Infrastructure zu; Domain referenziert weder WPF noch IO oder Prozesse.

## 4. Ziel-App-Vertragsmodell

Nur `ui-editor-target.json` mit Schema 1 und Vertragsversion `1.0` erlaubt M78. Es deklariert Application-ID, Anzeige, Projekttyp/-datei, Framework, Integrationswurzel, vorbereiteten Editorvertrag, erlaubte Installationspfade sowie eng begrenzte Startarten. Alle Pfade sind relativ, normalisiert und unterhalb des Zielroots. Fehlt oder scheitert dieser Opt-in-Vertrag, lautet der Status `target_not_m78_compatible`; es findet keine Suche, Heuristik oder Migration statt.

## 5. Installationsmanifest und Paket

Die lokale Paketquelle liegt versioniert neben der veröffentlichten Manageranwendung. `package.json` enthält Paket-/Vertragsversion und eine feste Dateiliste mit SHA-256, Zielpfad und Aktion. Paketdateien aktivieren ausschließlich den ausdrücklich vorgesehenen Integrationsordner einer bereits vorbereiteten neuen Ziel-App. Zufällige Buildausgaben und Netzwerkquellen sind ausgeschlossen.

## 6. Installationsplan

Ein deterministischer Plan klassifiziert jede deklarierte Datei als Erstellen, Aktualisieren, Unverändert, Entfernen oder Konflikt. Er enthält alte/neue Hashes, Eigentumsstatus, Backupbedarf, Blockierungen und eine aus Manifest-, Paket- und Zielzustand gebildete Vorschau-ID. Eine Ausführung akzeptiert nur diese aktuelle ID und eine ausdrückliche Bestätigung.

## 7. Transaktion und Rollback

Vor dem ersten Zielschreibzugriff wird im Managerbereich eine Transaktion mit Staging, Journal und Sicherungen erzeugt. Jede Zieldatei wird über eine temporäre Datei und atomaren Move/Replace geschrieben. Nur fehlende oder durch das M78-Installationsmanifest nachweislich eigene, unveränderte Dateien sind schreibbar. Bei Fehler werden Ersetzungen, Neuanlagen und Status in umgekehrter Reihenfolge zurückgerollt; fremde Dateien werden nie gesichert oder verändert. Ein unvollständiger Rollback bleibt als reparaturbedürftiges Journal sichtbar.

## 8. Updatekonzept

Update verwendet denselben Planer und dieselbe Transaktion. Es ist nur zulässig, wenn Application-ID, Manager-Installations-ID und aktuelle Dateihashes dem Eigentumsmanifest entsprechen. Lokale Änderungen erzeugen `update_conflict`; es gibt kein stilles Überschreiben. Entfallene eigene, unveränderte Dateien werden nach Vorschau transaktional entfernt.

## 9. Deinstallationskonzept

Deinstallation validiert das Installationsmanifest und entfernt ausschließlich eigene Dateien mit unverändertem installiertem Hash. Fremde oder lokal veränderte Dateien blockieren. Leere eigene Verzeichnisse und das eigene Statusmanifest werden kontrolliert entfernt; UI-/PDF-Profile und sonstige Benutzerdaten liegen außerhalb des Ziel-Integrationsroots und bleiben erhalten.

## 10. Desktop-Start

Die benutzerspezifische Bereitstellung liegt unter `%LOCALAPPDATA%\UI-Editor-kit\Manager\app`. Die Desktop-Verknüpfung `UI-Editor Manager.lnk` wird über Windows Script Host ausschließlich für die eigene veröffentlichte EXE erzeugt. Eine fremde Verknüpfung wird nicht überschrieben; eine eigene wird anhand Ziel und Beschreibung aktualisiert beziehungsweise entfernt. Keine Administratorrechte und keine systemweite Installation sind erforderlich.

## 11. Sicherheitsmodell

Root-, Windows-, Program-Files-, Manager- und nicht normalisierte Pfade werden abgewiesen. Projekt-, Manifest-, Paket- und Installationspfade müssen innerhalb ihres jeweiligen Roots bleiben. `..`, absolute Manifestpfade, Reparse-Point-Fluchten, unbekannte Dateinamen, fremde Konflikte, fehlende Schreibbarkeit, manipulierte Pakete und parallele Zieltransaktionen blockieren. Prozesse verwenden ausschließlich deklarierte `dotnetProject`- oder `executable`-Startarten mit `ProcessStartInfo.ArgumentList`; Shellstrings, Downloads, Telemetrie, Scans und Fachzugriffe existieren nicht.

## 12. Test- und Diagnosestrategie

Automatisierte Tests prüfen Manifest, Pfadsicherheit, Traversal/Reparse Points, Known-Apps-Speicher, Paketintegrität, deterministische Vorschau, Bestätigung, Eigentum, Install-/Update-/Uninstalltransaktion, Rollback, Startargumente, Shortcut und Architekturgrenzen. `--manager-installer-diagnostic` veröffentlicht den Manager in einen isolierten LocalApplicationData-Ordner, erzeugt und startet seine echte Desktop-Verknüpfung, kopiert eine kontrolliert vorbereitete neue WPF-Ziel-App-Fixture, bedient das sichtbare Managerfenster, installiert/aktualisiert/deinstalliert, startet Ziel-App und vorhandenen M77-Editor, prüft UI-/PDF-Restore sowie Hashinventare und entfernt anschließend Shortcut, Manager, Fixture, Logs, Staging und Prozesse.

## Grenze zu M79

M78 akzeptiert ausschließlich vorbereitete Opt-in-Ziele. Es analysiert keine bestehende App, durchsucht keinen fremden Quellcode, erzeugt weder Registry noch HostAdapter und macht keine Registrierungsvorschläge. Diese Aufgaben bleiben vollständig M79 vorbehalten.
