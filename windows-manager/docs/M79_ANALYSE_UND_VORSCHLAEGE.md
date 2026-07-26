# M79-Analyse, Vorschläge und manuelle Entscheidung

## Zustandsfolge

1. **Read-only Analyse:** Hashinventar, Projekt-/XAML-/C#-Syntax und lokale Analyseablage im Managerbereich; keine Zieldatei.
2. **Vorschlag:** fachneutraler, noch nicht freigegebener Registrykandidat mit Quelle, Vertrauen, Begründung und Warnungen.
3. **Nutzerentscheidung:** genau ein Vorschlag wird geändert, bestätigt oder abgelehnt; Actionlocks werden erneut validiert.
4. **Installationsvorschau:** alle neuen/geänderten/entfernten Dateien, Hashes, Ownership, Backup und exakte bestehende Dateidiffs.
5. **Installation/Update/Deinstallation:** ausschließlich nach ausdrücklicher Bestätigung und erneuter Freshness-/Git-Prüfung.
6. **Rollback:** stellt jeden begonnenen Write in umgekehrter Reihenfolge wieder her.

## Vorschlagsfelder

Gespeichert werden Proposal-ID, relative Quelle, Zeile/Spalte, Framework, Controltyp, deklarierter Name, struktureller Pfad, stabile ID, Anzeigename, Typ, Rolle, Parent, Reihenfolge, `allowedOps`, `lockedOps`, Editorfähigkeit, Actionrisiko, Vertrauen, Begründung, Warnungen, Status und optionale Feld-/Spalten-/Action-/Componentmetadaten. Absolute Pfade, Dateiinhalte und Fachwerte gehören nicht in das Analysemanifest.

## Reanalyse

Jede Quellinventaränderung macht Analyse und Preview veraltet. Neue Proposal-IDs bleiben ungeprüft. Eine frühere bestätigte Entscheidung wird nur übernommen, wenn relative Quelldatei, deklarierter Name und Controltyp eindeutig wiedererkannt werden; bei unbenannten Elementen müssen zusätzlich Proposal-ID und Fundstelle identisch sein. Zuvor bestätigte, jetzt verschwundene Elemente bleiben als `ClarificationRequired` mit Waisenwarnung sichtbar. Sie werden nicht automatisch gelöscht; der Nutzer muss ihr Entfernen ausdrücklich durch Ablehnung entscheiden.
