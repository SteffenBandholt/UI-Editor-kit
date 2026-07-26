# M78–M80: vorbereitete, bestehende und lokale Electron-Ziel-Apps

M80 ergänzt additiv einen frameworkneutralen Electron-Ziel-App-Vertrag. Eine Electron-App verbindet sich ausschließlich lokal über die gehärtete gemeinsame Named-Pipe-Semantik mit dem vorhandenen nativen Editor. Sie liefert eine explizite Registry, explizite Elementreferenzen und neutrale Layoutzustände; der Editor scannt kein DOM und führt keine Fachaktion aus. Electron ist für BBM praktisch belegt, React/Vite oder weitere Frameworks sind nicht behauptet. Details: [M80-Entwurfsentscheidung](M80_ELECTRON_ZIEL_APP_ENTWURFSENTSCHEIDUNG.md) und [Electron-Adapter](../src/electron-target/README.md).

Der native Windows-Manager ergänzt den bisherigen Bootstrap additiv. Er akzeptiert ausschließlich Apps mit einem expliziten, versionierten `ui-editor-target.json` und dem Modus `prepared-native-editor`. Auswahl per Root oder deklarierter `.slnx`-, `.sln`- beziehungsweise `.csproj`-Datei löst nur Prüfung und Schreibprobe aus; Installation erfolgt erst nach vollständiger Vorschau und ausdrücklicher Bestätigung.

Die lokale Paketquelle, Ownership-Hashes, transaktionale Installation/Update/Deinstallation und bekannten Apps sind unter [`windows-manager/`](../windows-manager/README.md) dokumentiert. Fehlt der Opt-in-Vertrag, kann der Nutzer nun ausdrücklich den getrennten M79-Ablauf starten. Dieser führt zuerst eine bytegleich geprüfte read-only Roslyn-/XAML-Analyse aus und erzeugt nur Vorschläge. Erst einzeln geprüfte Entscheidungen dürfen Registry, kontrollierten HostAdapter und additive Projektintegration erzeugen.

M79 unterstützt belegt nur SDK-basiertes C#-/WPF. Die Analyse führt weder Zielcode noch Fachaktionen aus, erfindet keine Parents/IDs/Operationen und bestätigt nichts automatisch. Erst nach bestätigter Installation startet die Ziel-App für Build-/Vertrags-/Laufzeitprüfung und für den Editorbetrieb; der generierte Adapter führt dabei ausschließlich bestätigte Layoutoperationen über eine lokale Named Pipe aus. Die Ziel-App bleibt Eigentümerin ihrer fachlichen Logik; M79 besitzt ausschließlich seine generierten Dateien und den markierten Projektdateiblock. [Entwurfsentscheidung](M79_BESTANDSAPP_REGISTRIERUNG_ENTWURFSENTSCHEIDUNG.md), [Frameworkadapter](../windows-manager/docs/M79_WPF_FRAMEWORKADAPTER.md) und [Analyse-/Vorschlagsvertrag](../windows-manager/docs/M79_ANALYSE_UND_VORSCHLAEGE.md) sind verbindlich.

# Ziel-App-Anbindung

## 1. Zweck

Diese Datei beschreibt, was eine Ziel-App bereitstellen muss, damit der UI-Editor dort als Modul arbeiten kann.

Eine Ziel-App kann eine bestehende Anwendung oder eine neue Anwendung sein.

Der UI-Editor bleibt eine eigenstaendige Editor-App. Er kann in die Ziel-App als Modul eingebunden werden, arbeitet aber nur ueber definierte Schnittstellen und Regeln.

## 2. Grundsatz

Die Ziel-App bleibt fachlich verantwortlich.

Der UI-Editor darf keine Fachlogik uebernehmen, keine Fachdaten veraendern und keine fachlichen Aktionen ausloesen.

Der UI-Editor arbeitet nur mit einer von der Ziel-App gelieferten, klassifizierten UI-Elementliste.

Nicht registrierte Elemente sind fuer den Editor nicht vorhanden.

Die M78-Regelpaket-Installation ist weiterhin nur ein Ziel-App-Regelpaket-Bootstrap. Sie analysiert, scannt, erkennt, registriert oder migriert keine bestehende UI. Ausschließlich der ausdrücklich gestartete, getrennte M79-Ablauf darf unterstützte Bestandsquellen read-only analysieren und daraus ungeprüfte Vorschläge erzeugen.

Eine Ziel-App darf bestehende bekannte UI-Elemente nachtraeglich bewusst registrieren. Dazu muss ein konkretes bestehendes Element als M79-Vorschlag einzeln geprüft oder manuell erfasst werden, eine bestätigte stabile ID bekommen, einen validen Registry-Eintrag erhalten, über einen kontrollierten Namen oder Marker auflösbar sein, erlaubte und gesperrte Operationen bekommen und durch Tests abgesichert werden.

Die Nutzerentscheidung ist keine automatische Bestandserkennung oder Migration. Der vorgelagerte M79-Syntaxlauf bleibt read-only, führt Zielcode nicht aus und darf selbst weder bestätigen noch installieren.

## 3. Voraussetzungen in der Ziel-App

Eine Ziel-App muss mindestens bereitstellen:

- UI-Editor-Vertrag im Repository
- UI-/PDF-Entwurfsentscheidung vor UI-Bau
- UI-Elementkatalog als gemeinsame Sprache
- klassifizierte UI-Elementliste je editorfaehiger UI
- Host-Adapter als Anschluss zwischen Ziel-App und UI-Editor
- Vertragscheck nach UI-Bau oder UI-Umbau
- klare Trennung von Layoutdaten und Fachdaten
- Regelblock fuer Codex in `AGENTS.md` oder gleichwertiger Regeldatei

## 4. Uebernahme des UI-Editor-Vertrags

Die Ziel-App muss die fuehrenden Regeln aus dem UI-Editor-kit uebernehmen oder eindeutig darauf verweisen.

Fuehrende Unterlagen sind:

- `docs/EDITOR_BAUPLAN.md`
- `docs/UI_ELEMENT_KATALOG.md`
- `docs/UI_BAU_UND_PRUEFREGELN.md`
- `docs/UI_EDITOR_VERTRAG.md`
- `docs/UI_PDF_ENTWURFSENTSCHEIDUNG.md`
- `codex/AGENTS_UI_EDITOR_BLOCK.md`

Die Ziel-App darf diese Regeln nicht stillschweigend abschwaechen.

Bei Widerspruch zwischen Ziel-App-Regeln und UI-Editor-Vertrag gilt: STOPP und klaeren.

## 5. UI-Elementliste der Ziel-App

Die Ziel-App muss fuer jede editorfaehige UI eine klassifizierte UI-Elementliste liefern.

Diese Liste ist die einzige Datenquelle des Editors.

Sie muss alle editorrelevanten Elemente enthalten, insbesondere:

- Bereiche
- Gruppen
- Untergruppen
- Komponenten
- Tabellen
- Tabellenspalten
- Metaspalten
- Buttons
- Felder
- Listen
- Karten
- Dialoge
- Toolbars
- Filterleisten
- headerartige Editierbereiche
- Statusanzeigen

Jedes Element muss nach dem UI-Elementkatalog klassifiziert werden.

Filterleisten, Toolbars und headerartige Editierbereiche duerfen direkte Felder, direkte Selects, direkte Checkboxen, direkte Radio-Buttons, direkte einzelne Buttons, Gruppen, Untergruppen, Button-Gruppen, Radio-Gruppen und Checkbox-Gruppen enthalten. Gruppen sind optional und nur dann zu verwenden, wenn die echte UI eine Gruppe bildet. Die Parent-Struktur muss die reale deklarierte UI-Struktur abbilden.

## 6. Host-Adapter

Zwischen Ziel-App und UI-Editor steht ein Host-Adapter.

Der Host-Adapter hat folgende Aufgaben:

- UI-Elementliste der Ziel-App bereitstellen
- aktuellen Layoutzustand bereitstellen
- erlaubte und gesperrte Operationen je Element bereitstellen
- Aenderungsauftraege des Editors entgegennehmen
- Aenderungsauftraege gegen Ziel-App-Regeln pruefen
- nur erlaubte Layoutaenderungen an die Ziel-App uebergeben
- Rueckmeldungen an den Editor liefern

Der Host-Adapter darf keine Fachlogik fuer den Editor freigeben.

## 7. Aenderungen durch den Editor

Der Editor erstellt Aenderungsauftraege.

Eine Aenderung darf nur ausgefuehrt werden, wenn:

- das Element registriert ist
- die Operation erlaubt ist
- die Operation nicht gesperrt ist
- die Parent-Struktur gueltig bleibt
- keine Fachlogik betroffen ist
- keine Fachdaten betroffen sind
- die Ziel-App die Aenderung annimmt

Die Ziel-App wendet Aenderungen kontrolliert an.

Der Editor darf nicht heimlich direkt in die Ziel-App eingreifen.

## 8. Speicherung

Layoutdaten und Fachdaten muessen getrennt bleiben.

Die Ziel-App muss festlegen:

- wo Layoutaenderungen gespeichert werden
- wie Layoutaenderungen versioniert werden
- wie ein Standardzustand wiederhergestellt wird
- wie Aenderungen rueckgaengig gemacht werden koennen

Der Editor darf keine Fachdaten speichern.

## 9. Vertragscheck in der Ziel-App

Nach jedem Bau oder Umbau einer editorfaehigen UI muss ein Vertragscheck laufen.

Der Check muss mindestens pruefen:

- alle Pflichtfelder vorhanden
- alle IDs eindeutig
- alle Parent-Bezuege gueltig
- alle Typen erlaubt
- alle Rollen erlaubt
- alle Spaltenrollen erlaubt
- alle Operationen erlaubt
- Tabellen und Spalten vollstaendig klassifiziert
- Metaspalten klassifiziert
- keine Fachaktion als Editoroperation markiert
- keine Fachdaten in IDs oder Metadaten

Wenn der Check fehlschlaegt, ist die UI nicht fertig.

Codex muss reparieren und erneut pruefen.

## 10. Codex-Regel in der Ziel-App

In der Ziel-App muss Codex vor jeder UI- oder PDF-Umsetzung pruefen:

- ist die Ausgabe editorrelevant?
- liegt eine UI-/PDF-Entwurfsentscheidung vor?
- sind editorfaehige Elemente benannt?
- sind Parent-Struktur und Operationen festgelegt?
- sind Fachaktionen ausgeschlossen?
- ist ein Vertragscheck vorhanden?

Wenn diese Angaben fehlen, darf Codex keine editorfaehige UI bauen.

## 11. Nicht erlaubt

Die Ziel-App darf dem laufenden Editor nicht erlauben (der ausdrücklich gestartete M79-Manager darf ausschließlich die oben definierte read-only Syntaxanalyse ausführen):

- Fachlogik auszufuehren
- Fachdaten zu aendern
- bestehende UI zur Laufzeit oder durch Ausführung zu analysieren
- Visual Tree, Screenshots oder Fachzustände automatisch zu scannen
- eine automatische Bestandserkennung oder UI-Elementliste zu erzeugen
- bestehende Legacy-UIs automatisch zu migrieren
- M79-Vorschläge automatisch zu bestätigen oder ungeprüft zu installieren

## Electron-Ziel-App-Vertrag M80

Der Electron-Vertrag enthält mindestens `applicationId`, `displayName`, `framework = electron`, Vertrags- und Registryversion, aktive Scopes, Profilwurzel, unterstützte Operationen, Auswahl-/Sichtbarkeitsfähigkeit, Label-/Feldtrennung, Transportversion und Prozess-/Sitzungskennung. `pdfCapability` ist für BBM in M80 `unavailable`.

Die Verbindung verwendet ausschließlich einen zufälligen lokalen Pipe-Namen und eine kryptografische Sitzungs-Nonce. Handshake, Current-User-only, eine Verbindung, Korrelations-IDs, Nachrichtenlimit, Timeout, strukturierter Disconnect und feste vertrauenswürdige Executable sind Pflicht. Renderer dürfen weder freie Pfade noch Shell-Strings liefern.

Für asynchrone lokale Ziel-App-Transporte darf der kleine HostAdapter-Vertrag additiv als `IAsyncHostAdapter` umgesetzt werden. Registry, Validierung, neutrale Semantik und ChangeResult bleiben identisch; eine zweite Layoutlogik ist nicht zulässig.
- Datenbankaktionen auszufuehren
- fachliche Buttons auszufuehren
- Speicher-, Loesch-, Upload-, Import- oder Exportaktionen als Editoroperation zu behandeln
- nicht registrierte Elemente zu veraendern
- UI-Strukturen ohne Vertragscheck freizugeben

## 12. Mindestablauf fuer eine neue Ziel-App

1. UI-Editor-Vertrag uebernehmen.
2. Codex-Regelblock in der Ziel-App aktivieren.
3. Vertragscheck verfuegbar machen.
4. Vor UI-Bau Entwurfsentscheidung erstellen.
5. UI mit klassifizierter Elementliste bauen.
6. Vertragscheck ausfuehren.
7. Fehler reparieren.
8. Erst nach gruenem Check gilt die UI als editorfaehig.

## 13. Kernaussage

Eine Ziel-App kann nur dann mit dem UI-Editor arbeiten, wenn sie dieselbe Sprache spricht.

Diese Sprache besteht aus:

- UI-Editor-Bauplan
- UI-Elementkatalog
- Bau- und Pruefregeln
- klassifizierter UI-Elementliste
- Host-Adapter
- Vertragscheck

Ohne diese Voraussetzungen darf der Editor in der Ziel-App nicht produktiv arbeiten.

## M39: generischer Ziel-App-Vertrag v1.0

M39 macht aus dem Pilotabgleich den generischen Ziel-App-Vertrag v1.0. Eine Ziel-App muss Registry, HostAdapter, LayoutState, UI-Scope, Layout-Scope, erlaubte Operationen, gesperrte Operationen und Layout-only Save/Load/Reset-Verhalten explizit bereitstellen.

Der UI-Scope beschreibt die sichtbare Oberflaeche der Ziel-App. Der Layout-Scope beschreibt den Speicher-/Profilbereich fuer Layoutzustaende. Eine Abbildung von UI-Scope auf Layout-Scope ist erlaubt, muss aber von der Ziel-App explizit geliefert werden; der Editor darf sie nicht erraten.

Der HostAdapter muss mindestens `getRegistry()`, `getCurrentLayoutState()` und `submitChangeRequest()` anbieten. `saveLayoutState()`, `loadLayoutState()`, `resetLayoutState()` und `getAdapterManifest()` sind optionale generische Erweiterungen fuer Ziel-Apps, die Layout-Persistenz oder Manifestpruefungen anbieten.
