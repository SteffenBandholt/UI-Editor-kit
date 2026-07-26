# Arbeitsanweisung für ChatGPT und Codex

## 1. Zweck

Diese Arbeitsanweisung regelt die Zusammenarbeit zwischen ChatGPT und Codex innerhalb dieses Repositories.

Ziele sind:

- Aufgaben eindeutig vorzubereiten,
- doppelte Arbeit zu vermeiden,
- Änderungen nachvollziehbar umzusetzen,
- Kosten und Tokenverbrauch zu begrenzen,
- Fehler frühzeitig zu erkennen,
- bestehende Funktionen zu schützen,
- vollständige und getestete Ergebnisse zu erhalten.

Diese Datei gilt als verbindlicher Grundsatz für alle Arbeiten im Repository, sofern ein konkreter Auftrag nicht ausdrücklich etwas anderes festlegt.

---

## 2. Rollenverteilung

### 2.1 ChatGPT

ChatGPT übernimmt vorrangig:

- Klärung der fachlichen Anforderungen,
- Strukturierung unklarer Aufgaben,
- Bewertung von Lösungsvarianten,
- Erstellung eindeutiger Codex-Aufträge,
- Definition von Abnahmekriterien,
- Prüfung von Codex-Ergebnissen,
- Unterstützung bei fachlichen oder grundsätzlichen Entscheidungen.

ChatGPT soll nicht ohne Not dieselbe technische Analyse vollständig wiederholen, die Codex bereits durchgeführt hat.

### 2.2 Codex

Codex übernimmt vorrangig:

- Analyse des vorhandenen Repositorys,
- Lesen der relevanten Dateien,
- Änderung bestehender Dateien,
- Erstellung neuer Dateien,
- Ausführung von Tests, Builds und Prüfungen,
- Fehlerbehebung,
- technische Dokumentation der ausgeführten Änderungen.

Codex soll nicht erneut die fachlichen Anforderungen grundsätzlich infrage stellen, wenn diese im Auftrag eindeutig beschrieben sind.

---

## 3. Grundsatz der Zusammenarbeit

Für jede Aufgabe gilt:

1. Fachliche Anforderungen werden zuerst geklärt.
2. Die Aufgabe wird eindeutig abgegrenzt.
3. Codex erhält einen vollständigen Arbeitsauftrag.
4. Codex liest zuerst die relevanten Dateien.
5. Codex setzt die Änderungen zusammenhängend um.
6. Codex prüft das Ergebnis technisch.
7. Das Ergebnis wird anhand der Abnahmekriterien bewertet.

ChatGPT plant und entscheidet.

Codex setzt um und testet.

Beide Systeme sollen nicht parallel unabhängig voneinander dieselbe Aufgabe vollständig analysieren.

---

## 4. Anforderungen an einen Codex-Auftrag

Ein Codex-Auftrag soll möglichst folgende Angaben enthalten:

### Ziel

Was soll nach Abschluss der Aufgabe funktionieren?

### Ausgangslage

Welche bestehende Funktion, Datei oder Fehlermeldung ist betroffen?

### Umfang

Welche Dateien oder Bereiche dürfen geändert werden?

### Ausschlüsse

Welche Dateien, Funktionen oder Verhaltensweisen dürfen nicht verändert werden?

### Anforderungen

Welche fachlichen und technischen Regeln sind einzuhalten?

### Prüfung

Welche Tests, Builds oder Probeläufe sind auszuführen?

### Abnahme

Woran ist eindeutig zu erkennen, dass die Aufgabe abgeschlossen ist?

---

## 5. Standardvorlage für Codex-Aufträge

```text
Aufgabe:
[Kurze und eindeutige Bezeichnung]

Ziel:
[Gewünschtes Ergebnis]

Ausgangslage:
[Relevanter aktueller Zustand oder Fehler]

Zu bearbeiten:
- [Datei oder Bereich]
- [Datei oder Bereich]

Nicht verändern:
- [Datei, Funktion oder Verhalten]
- [Datei, Funktion oder Verhalten]

Anforderungen:
- [Anforderung]
- [Anforderung]
- [Anforderung]

Vorgehen:
1. Lies zuerst alle für die Aufgabe relevanten Dateien.
2. Prüfe die bestehende Logik und Abhängigkeiten.
3. Führe die Änderungen zusammenhängend aus.
4. Vermeide unnötige Umbauten außerhalb des Auftrags.
5. Führe passende Tests, Builds oder Probeläufe aus.
6. Behebe festgestellte Fehler, soweit sie unmittelbar zur Aufgabe gehören.

Abnahmekriterien:
- [Messbares Kriterium]
- [Messbares Kriterium]
- [Messbares Kriterium]

Abschlussbericht:
- geänderte Dateien,
- wesentliche Änderungen,
- ausgeführte Prüfungen,
- Prüfergebnisse,
- verbleibende Probleme oder Risiken.
```

---

## 6. Regeln für die Aufgabenabgrenzung

### 6.1 Aufgaben müssen zusammenhängend sein

Eine Aufgabe soll einen klar abgegrenzten Funktionsbereich betreffen.

Geeignet:

- Fehler im PDF-Import beheben,
- eine bestimmte Eingabemaske ergänzen,
- einen vorhandenen Test reparieren,
- eine definierte Schnittstelle erweitern.

Ungeeignet:

- das gesamte Projekt verbessern,
- alle Fehler beheben,
- die Anwendung vollständig modernisieren,
- gleichzeitig Backend, Benutzeroberfläche und Dokumentation grundlegend umbauen.

### 6.2 Keine unnötigen Mikroschritte

Zusammengehörige Änderungen sollen in einem Auftrag gebündelt werden.

Nicht jede einzelne Dateiänderung soll als eigener Codex-Auftrag ausgeführt werden.

### 6.3 Keine ungeplante Erweiterung

Codex darf den Auftrag nicht eigenständig auf andere Funktionsbereiche ausweiten.

Zusätzliche Probleme dürfen dokumentiert werden. Sie sollen jedoch nur behoben werden, wenn:

- sie die beauftragte Änderung unmittelbar blockieren,
- sie durch die Änderung verursacht wurden,
- ihre Behebung ohne relevante Erweiterung des Auftrags möglich ist.

---

## 7. Regeln für das Lesen und Ändern von Dateien

Codex soll:

1. zuerst die relevanten Dateien vollständig erfassen,
2. Abhängigkeiten und vorhandene Regeln prüfen,
3. Änderungen anschließend gesammelt durchführen,
4. bestehende Strukturen soweit sinnvoll erhalten,
5. unnötige Umbenennungen vermeiden,
6. keine Dateien vorsorglich neu schreiben, wenn eine gezielte Änderung ausreicht,
7. keine fremden oder nicht zum Auftrag gehörenden Änderungen überschreiben.

Codex soll wiederholtes Öffnen, Ändern und erneutes Zurückändern derselben Dateien vermeiden.

---

## 8. Schutz bestehender Funktionen

Vorhandene Funktionen gelten grundsätzlich als zu erhalten.

Änderungen dürfen nur dann bestehendes Verhalten verändern, wenn dies:

- ausdrücklich Bestandteil des Auftrags ist,
- technisch zwingend notwendig ist,
- im Abschlussbericht klar benannt wird.

Bei Unsicherheit gilt:

- keine unnötige Änderung,
- keine spekulative Bereinigung,
- kein vollständiger Umbau nur aus Stilgründen.

---

## 9. Test- und Prüfpflicht

Codex muss nach Änderungen geeignete Prüfungen durchführen.

Je nach Projekt können dies sein:

- vorhandene automatisierte Tests,
- neue oder ergänzte Tests,
- Syntaxprüfung,
- Typprüfung,
- Linter,
- Build,
- Programmstart,
- Importtest,
- Exporttest,
- realitätsnaher Probelauf.

Die Aussage „sollte funktionieren“ reicht nicht aus, wenn eine technische Prüfung möglich ist.

Kann eine Prüfung nicht ausgeführt werden, muss Codex angeben:

- welche Prüfung nicht möglich war,
- warum sie nicht möglich war,
- welches Risiko dadurch verbleibt.

---

## 10. Abnahmekriterien

Jede Aufgabe soll messbare Abnahmekriterien enthalten.

Beispiele:

- das Programm startet ohne Fehlermeldung,
- der betroffene Test läuft erfolgreich,
- ein bestimmter Import erzeugt das erwartete Ergebnis,
- bestehende Datensätze bleiben unverändert,
- eine Schaltfläche führt die definierte Aktion aus,
- der Build wird erfolgreich abgeschlossen,
- keine neuen Warnungen oder Fehler entstehen.

Codex beendet die Aufgabe, sobald alle Abnahmekriterien erfüllt oder verbleibende Hindernisse eindeutig dokumentiert sind.

---

## 11. Kosten- und Tokenregeln

### 11.1 Keine doppelte Analyse

ChatGPT und Codex sollen nicht unabhängig voneinander dieselben Dateien und dasselbe Problem vollständig analysieren.

Fachliche Klärung erfolgt vorrangig in ChatGPT.

Technische Umsetzung und Repository-Analyse erfolgen vorrangig in Codex.

### 11.2 Kontext begrenzen

Es sollen nur Informationen übergeben werden, die für die konkrete Aufgabe erforderlich sind.

Nicht ständig erneut übergeben werden sollen:

- vollständige Projekthistorien,
- alte Diskussionen,
- erledigte Fehler,
- nicht betroffene Dateien,
- lange allgemeine Erklärungen.

### 11.3 Ausgaben begrenzen

Codex soll im Abschlussbericht keine vollständigen unveränderten Dateien ausgeben.

Der Abschlussbericht soll sich beschränken auf:

- geänderte Dateien,
- wesentliche Änderungen,
- Tests und Ergebnisse,
- verbleibende Probleme,
- wichtige Hinweise.

### 11.4 Kleinstes ausreichendes Modell

Für jede Aufgabe soll das kleinste Modell beziehungsweise die niedrigste ausreichende Denkstufe verwendet werden, die die Aufgabe zuverlässig lösen kann.

Stärkere Modelle oder höhere Denkstufen sind insbesondere geeignet für:

- komplexe Fehlerbilder,
- schwer überschaubare Abhängigkeiten,
- Architekturentscheidungen,
- umfangreiche Migrationen,
- wiederholt fehlgeschlagene Lösungsversuche.

### 11.5 Schneller Modus

Ein schneller oder kostenintensiverer Modus soll nur verwendet werden, wenn die Zeitersparnis tatsächlich erforderlich ist.

Für normale Entwicklungsarbeiten gilt der Standardmodus.

### 11.6 Parallele Codex-Aufgaben

Parallele Codex-Aufgaben sind nur zulässig, wenn sie:

- eindeutig voneinander getrennt sind,
- nicht dieselben Dateien verändern,
- keine gegenseitigen Abhängigkeiten besitzen,
- nicht dieselbe Analyse doppelt durchführen.

Mehrere Agenten dürfen nicht gleichzeitig dieselben Dateien oder denselben Fehler bearbeiten.

---

## 12. Umgang mit Korrekturen

Technische Nachkorrekturen sollen im bestehenden Codex-Vorgang erfolgen, solange:

- dieselbe Aufgabe betroffen ist,
- der bestehende Kontext noch zutreffend ist,
- keine grundlegende Richtungsänderung erfolgt.

Ein neuer Auftrag ist sinnvoll, wenn:

- die ursprüngliche Aufgabe abgeschlossen ist,
- ein anderer Funktionsbereich betroffen ist,
- der vorhandene Verlauf widersprüchlich geworden ist,
- die Anforderungen grundlegend geändert wurden,
- Codex wiederholt ohne Fortschritt dieselben Schritte ausführt.

---

## 13. Umgang mit Fehlern und Blockaden

Wenn Codex die Aufgabe nicht vollständig abschließen kann, muss der Abschlussbericht enthalten:

- den aktuellen Stand,
- die genaue Blockade,
- die betroffenen Dateien,
- bereits ausgeführte Prüfungen,
- relevante Fehlermeldungen,
- die technisch sinnvollste nächste Maßnahme.

Codex soll keine erfolgreiche Fertigstellung behaupten, wenn Abnahmekriterien nicht erfüllt sind.

---

## 14. Dokumentation von Änderungen

Wesentliche Änderungen müssen nachvollziehbar dokumentiert werden.

Der Abschlussbericht soll mindestens enthalten:

```text
Geänderte Dateien:
- [Datei]
- [Datei]

Wesentliche Änderungen:
- [Änderung]
- [Änderung]

Ausgeführte Prüfungen:
- [Prüfung]: [Ergebnis]
- [Prüfung]: [Ergebnis]

Offene Punkte:
- [Punkt oder „Keine“]

Risiken:
- [Risiko oder „Keine bekannt“]
```

Bei größeren Änderungen soll zusätzlich die projektspezifische Dokumentation angepasst werden.

---

## 15. Repository-Regeln

Vor Beginn einer Aufgabe sind zusätzlich zu dieser Datei alle vorhandenen projektspezifischen Regeldateien zu beachten.

Dazu können insbesondere gehören:

- `AGENTS.md`
- `README.md`
- `CONTRIBUTING.md`
- projektspezifische Dokumentationen,
- Testanweisungen,
- Architekturvorgaben,
- Formatierungs- und Namensregeln.

Bei einem Widerspruch gilt folgende Reihenfolge:

1. ausdrücklicher aktueller Arbeitsauftrag,
2. projektspezifische Regeldatei,
3. diese `Arbeitsanweisung.md`,
4. allgemeine technische Konventionen.

Sicherheits-, Datenschutz- und Zugriffsregeln dürfen durch einen Arbeitsauftrag nicht aufgehoben werden.

---

## 16. Verbotene Arbeitsweisen

Folgende Arbeitsweisen sind zu vermeiden:

- unklare Großaufträge ohne Abnahmekriterien,
- parallele Bearbeitung derselben Dateien,
- vollständige Neuschreibung ohne Notwendigkeit,
- ungefragte Architekturänderungen,
- Änderung nicht betroffener Funktionen,
- unbegründete neue Abhängigkeiten,
- unnötig lange Abschlussberichte,
- Ausgabe kompletter unveränderter Dateien,
- Behauptung erfolgreicher Tests ohne Testausführung,
- wiederholte Analyse ohne erkennbaren Fortschritt,
- Nutzung eines stärkeren oder schnelleren Modells ohne sachlichen Grund.

---

## 17. Standardablauf

### Schritt 1 – Fachliche Klärung

Die Aufgabe wird mit ChatGPT soweit geklärt, dass Ziel, Umfang und Abnahmekriterien eindeutig sind.

### Schritt 2 – Auftragserstellung

ChatGPT erstellt einen vollständigen und abgegrenzten Codex-Auftrag.

### Schritt 3 – Repository-Analyse

Codex liest diese Arbeitsanweisung, weitere Regeldateien und alle relevanten Projektdateien.

### Schritt 4 – Umsetzung

Codex führt die notwendigen Änderungen zusammenhängend und ohne unnötige Erweiterungen aus.

### Schritt 5 – Prüfung

Codex führt passende Tests, Builds und Probeläufe aus.

### Schritt 6 – Abschlussbericht

Codex berichtet knapp und vollständig über Änderungen, Prüfungen und offene Punkte.

### Schritt 7 – Abnahme

Das Ergebnis wird anhand der zuvor festgelegten Kriterien bewertet.

---

## 18. Kurzfassung

Für alle Arbeiten gelten folgende Kernregeln:

1. ChatGPT klärt und plant.
2. Codex analysiert das Repository, ändert Dateien und testet.
3. Jede Aufgabe erhält ein klares Ziel und messbare Abnahmekriterien.
4. Nur relevante Dateien und Informationen werden einbezogen.
5. Zusammengehörige Änderungen werden gebündelt.
6. Bestehende Funktionen bleiben erhalten, sofern nichts anderes beauftragt ist.
7. Tests sind Pflicht, soweit technisch möglich.
8. Keine doppelte Arbeit durch ChatGPT und Codex.
9. Das kleinste ausreichende Modell wird verwendet.
10. Abschlussberichte bleiben knapp, ehrlich und nachvollziehbar.
11. Keine eigenmächtige Erweiterung des Auftrags.
12. Diese Datei gilt als Grundsatz für das gesamte Repository.
