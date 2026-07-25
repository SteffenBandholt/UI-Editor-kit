# Verbindlicher Fertigstellungsfahrplan

## 1. Zweck

Dieser Fahrplan ist die verbindliche Reihenfolge bis zum praktisch nutzbaren UI-/PDF-Editor.

Er verhindert, dass neue Ideen, Nebenbaustellen oder technische Experimente den laufenden Bauabschnitt erweitern oder die Reihenfolge veraendern.

## 2. Unveraenderliche Zielreihenfolge

1. Eine neue Ziel-App vollstaendig anbinden.
2. Den UI-Editor in dieser Ziel-App Ende-zu-Ende fertigstellen.
3. Den PDF-Editor in derselben Ziel-App Ende-zu-Ende fertigstellen.
4. Den zentralen Windows-Manager mit Ziel-App-Auswahl und Installation fertigstellen.
5. Erst danach bestehende alte Apps durch einen Registrationslauf nachruesten.

Eine alte oder bereits gebaute App ist bis zur Abnahme von M77 ausdruecklich kein Entwicklungsziel.

## 3. Steuerungsregeln

### 3.1 Meilenstein-Sperre

Es wird immer nur an einem Meilenstein gearbeitet.

Der naechste Meilenstein darf erst beginnen, wenn:

- alle Pflichtfunktionen des laufenden Meilensteins umgesetzt sind,
- alle Abnahmekriterien erfuellt sind,
- alle zugehoerigen Tests gruen sind,
- der Meilenstein in `STATUS.md` als `[A]` abgenommen markiert ist.

### 3.2 Keine stillschweigende Erweiterung

Neue Ideen werden nicht in den laufenden Meilenstein aufgenommen.

Sie werden unter `Spaetere Anforderungen` dokumentiert und einem spaeteren Meilenstein zugeordnet. Eine Aenderung des laufenden Umfangs ist nur nach ausdruecklicher Entscheidung des Projekteigentuemers erlaubt.

### 3.3 Kein Abhaken ohne praktischen Nachweis

Dokumentation, Modelle oder Unit-Tests allein reichen nicht aus, wenn der Meilenstein eine sichtbare oder integrierte Funktion verspricht.

Jede End-to-End-Funktion muss an der neuen Ziel-App praktisch vorgefuehrt und getestet werden.

### 3.4 Produktgrenze

Der Editor bleibt lokal, fachneutral und browserfrei.

Er darf:

- Layout und Darstellung registrierter Elemente bearbeiten,
- UI- und PDF-Layoutzustaende speichern, laden, verwerfen und zuruecksetzen.

Er darf nicht:

- Fachlogik ausfuehren,
- Fachdaten veraendern,
- nicht registrierte Elemente bearbeiten,
- alte Apps vor M78 automatisch analysieren oder migrieren.

## 4. Referenz-Ziel-App

Alle Meilensteine M73 bis M77 werden an genau einer neuen Referenz-Ziel-App entwickelt und abgenommen.

Die Referenz-Ziel-App enthaelt mindestens:

- Auftrags- oder Rechnungskopf,
- Kundendaten,
- mehrere Eingabefelder,
- Gruppen und Untergruppen,
- Positionstabelle,
- Summenbereich,
- Buttons und Statusanzeige,
- PDF-Vorschau,
- mehrseitige PDF-Ausgabe mit Kopf, Tabelle, Summen und Fussbereich.

Sie wird von Anfang an vollstaendig nach dem UI-Editor-Vertrag gebaut. Alle editorrelevanten UI- und PDF-Elemente werden beim Bau registriert.

## 5. Meilensteine

## M73 - Neue Ziel-App technisch anbinden

### Ziel

Die neue Referenz-Ziel-App kann den vorhandenen Editor-Kern laden und kontrolliert aktivieren.

### Pflichtumfang

- neue Referenz-Ziel-App anlegen,
- Editor-Paket lokal einbinden,
- vollstaendige UI-Registry fuer einen ersten UI-Bereich,
- echter HostAdapter fuer diesen Bereich,
- dauerhafter lokaler Layoutspeicher,
- Aktivieren und Deaktivieren des Editors,
- Session starten und beenden,
- ein registriertes Element programmgesteuert veraendern,
- Speichern und erneutes Laden nach App-Neustart.

### Nicht Bestandteil

- noch keine vollstaendige sichtbare Editoroberflaeche,
- noch kein PDF-Editor,
- keine alte App,
- kein Registrationslauf.

### Abnahmekriterien

- Ziel-App startet ohne Editorfehler.
- Editor-Kern kann aktiviert und deaktiviert werden.
- Registry und HostAdapter bestehen den Vertragscheck.
- Ein Element wird ueber einen neutralen Aenderungsauftrag sichtbar veraendert.
- Gespeichertes Layout wird nach Neustart wiederhergestellt.
- Verbotene Operationen werden abgewiesen.
- Gesamttests sind gruen.

## M74 - Native sichtbare UI-Editoroberflaeche

### Ziel

Der Benutzer kann die registrierte UI der Referenz-Ziel-App ueber ein natives Windows-Fenster bearbeiten.

### Pflichtumfang

- native Windows-Editoroberflaeche,
- Elementbaum,
- Elementdetails,
- Auswahl eines registrierten Elements,
- Umschaltung Element/Text,
- Modi Position, Breite, Hoehe, Textposition und Schriftgroesse,
- Schrittweite,
- Richtungstasten,
- sichtbare Status- und Fehlermeldungen,
- Editor aus der Ziel-App oeffnen und schliessen.

### Abnahmekriterien

- Elementbaum zeigt nur registrierte Elemente.
- Auswahl im Baum aktualisiert Details und erlaubte Operationen.
- Positions-, Groessen- und Textaenderungen sind sofort in der Ziel-App sichtbar.
- Nicht erlaubte Modi sind deaktiviert oder werden abgewiesen.
- Fachaktionen werden nie ausgefuehrt.
- Der Editor kann mehrfach geoeffnet und geschlossen werden.

## M75 - UI-Betrieb vollstaendig

### Ziel

Der UI-Editor ist fuer eine neue Ziel-App praktisch fertig.

### Pflichtumfang

- Speichern,
- Laden,
- Einzelverwerfen,
- Gesamtverwerfen,
- Einzelreset,
- Gesamtreset,
- Rollback bei Fehlern,
- mehrere UI-Bereiche und Scopes,
- mehrere Layoutprofile,
- dauerhafte Speicherung,
- Auswahl sowohl ueber Elementbaum als auch ueber eine plattformeigene Ziel-App-Auswahl,
- vollstaendiger End-to-End-Test.

### Abnahmekriterien

- alle UI-Bearbeitungsfunktionen funktionieren praktisch,
- gespeicherte Layouts bleiben nach Neustart erhalten,
- Verwerfen und Reset sind eindeutig getrennt,
- ein provozierter Adapterfehler stellt den Ausgangszustand vollstaendig wieder her,
- zwei unterschiedliche Scopes ueberschreiben sich nicht,
- der UI-Teil wird als `[A]` abgenommen.

## M76 - PDF-Grundmodell und PDF-HostAdapter

### Ziel

PDF-Layouts werden als registrierte, pruefbare und speicherbare Editorziele behandelt.

### Pflichtumfang

- Dokument-, Seiten- und Bereichsmodell,
- registrierte PDF-Texte, Bilder, Gruppen, Tabellen, Spalten, Kopf- und Fussbereiche,
- eindeutige PDF-Element-IDs und Parent-Struktur,
- Seitenkoordinaten und verbindliche Masseinheit,
- PDF-HostAdapter,
- getrennte UI- und PDF-Layoutprofile,
- Anwendung von Position, Breite, Hoehe, Textposition und Schriftgroesse,
- PDF-Erzeugung aus dem geaenderten Layoutmodell,
- Speicherung, Laden, Verwerfen, Reset und Rollback,
- Mehrseitigkeit und definierter Seitenumbruch.

### Abnahmekriterien

- eine reale mehrseitige PDF-Datei wird erzeugt,
- mindestens ein Text, eine Tabelle und ein Kopf-/Fussbereich sind registriert,
- Aenderungen werden korrekt in der erzeugten PDF sichtbar,
- UI- und PDF-Layoutdaten bleiben getrennt,
- Seitenumbrueche bleiben reproduzierbar,
- fehlerhafte PDF-Aenderungen fuehren zum Rollback.

## M77 - Sichtbarer PDF-Editor und gemeinsamer End-to-End-Betrieb

### Ziel

UI und PDF koennen in derselben Referenz-Ziel-App vollstaendig bearbeitet werden.

### Pflichtumfang

- Arbeitsbereiche `Programmoberflaeche` und `PDF-Ausgabe`,
- PDF-Seitenuebersicht,
- PDF-Elementbaum,
- native PDF-Vorschau,
- Auswahl in Baum und Vorschau,
- Position, Groesse, Textposition und Schriftgroesse,
- Tabellen- und Spaltenbearbeitung,
- Kopf- und Fussbereich,
- PDF neu erzeugen und Vorschau aktualisieren,
- Save, Load, Discard und Reset fuer PDF,
- gemeinsamer End-to-End-Test von App-Auswahl bis Wiederherstellung nach Neustart.

### Abnahmekriterien

- Referenz-Ziel-App kann UI und PDF bearbeiten,
- beide Layoutarten bleiben nach Neustart erhalten,
- PDF-Vorschau und erzeugte PDF stimmen ueberein,
- Tabellen und Mehrseitigkeit funktionieren,
- alle Fehlerwege sind abgesichert,
- das Gesamtprodukt ist fuer neue Ziel-Apps praktisch nutzbar.

## M78 - Zentraler Windows-Manager und Installer

### Ziel

Der Editor wird ueber ein Desktop-Icon gestartet und bindet eine neue Ziel-App kontrolliert an.

### Pflichtumfang

- native Windows-Anwendung mit Desktop-Start,
- Button `Ziel-App auswaehlen`,
- Windows-Ordner- und Dateiauswahl,
- Auswahl eines Repository-Ordners oder einer eindeutigen Projektdatei,
- Sicherheits- und Schreibpruefung,
- Vorschau der Installation,
- Installieren, Aktualisieren und Deinstallieren,
- Liste bekannter Ziel-Apps,
- Anbindungs- und Vertragsstatus,
- Ziel-App und Editor starten,
- Protokoll und Fehleranzeige.

### Abnahmekriterien

- eine neue Ziel-App kann ohne Kommandozeile ausgewaehlt und angebunden werden,
- Installation veraendert nur bestaetigte Dateien,
- bestehende fremde Dateien bleiben unangetastet,
- Installation kann rueckgaengig gemacht werden,
- Ziel-App kann anschliessend aus dem Manager gestartet und bearbeitet werden.

## M79 - Bestehende Apps registrieren

### Ziel

Erst nach Fertigstellung des Editors fuer neue Apps wird die Nachruestung bestehender Apps entwickelt.

### Pflichtumfang

- Projekt- und Frameworkadapter,
- Quellcodebasierter Registrationslauf,
- Registrierungsvorschlaege statt blinder Entscheidungen,
- stabile IDs und Parent-Struktur,
- Erkennung und Sperrung von Fachaktionen,
- Vorschau und manuelle Bestaetigung,
- Registry- und HostAdapter-Erzeugung,
- Vertragscheck,
- Rollback.

### Abnahmekriterien

Werden erst nach Abnahme von M78 detailliert festgeschrieben. Bis dahin ist M79 gesperrt.

## 6. Feste Abnahmereihenfolge

| Reihenfolge | Meilenstein | Ergebnis |
|---:|---|---|
| 1 | M73 | Neue Ziel-App technisch angebunden |
| 2 | M74 | Native UI-Editoroberflaeche bedienbar |
| 3 | M75 | UI-Editor Ende-zu-Ende fertig |
| 4 | M76 | PDF-Grundmodell und Adapter funktionsfaehig |
| 5 | M77 | UI- und PDF-Editor Ende-zu-Ende fertig |
| 6 | M78 | Windows-Manager und Installation fertig |
| 7 | M79 | Bestehende Apps nachruesten |

## 7. Pflichtnachweise je Meilenstein

Jede Abnahme benoetigt:

- dokumentierte Soll-Funktionen,
- automatisierte Tests,
- praktischen End-to-End-Nachweis an der Referenz-Ziel-App,
- `npm test`,
- `npm pack --dry-run`,
- `npm run release:check`,
- `git diff --check`,
- aktualisierten Eintrag in `STATUS.md`,
- eindeutige Liste offener Punkte fuer den naechsten Meilenstein.

## 8. Spaetere Anforderungen

Neue Anforderungen werden hier oder in einer gesonderten Backlog-Datei gesammelt. Sie duerfen den laufenden Meilenstein nicht veraendern.

Aktuell spaeter vorgesehen:

- Registrationslauf fuer bestehende Apps: M79,
- weitere Ziel-App-Technologien und Frameworkadapter: nach M79,
- Komfortfunktionen und Designvarianten: nach funktionaler Gesamt-Abnahme,
- Cloud-, Browser- oder Webbetrieb: dauerhaft ausgeschlossen.

## 9. Naechster verbindlicher Auftrag

Der naechste Bauauftrag ist ausschliesslich:

> M75 - UI-Betrieb vollstaendig.

M73 und M74 sind abgenommen. M75 baut auf der nativen Editoroberflaeche, der bestehenden Prozess-/Sessionkette und der ziel-app-eigenen Layoutpersistenz auf. PDF bleibt bis M76 gesperrt.
