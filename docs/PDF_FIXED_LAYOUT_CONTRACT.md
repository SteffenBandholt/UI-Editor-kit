# Fachneutraler PDF-Vertrag: fixed-layout

Stand: 2026-09-07. Eigenes Vertragspaket zu K16/M81, vor jeder Providerintegration.

## Entwurfsentscheidung und Umfang

Art: PDF-Vertragsmetadaten, keine neue sichtbare UI oder PDF-Ausgabe.
Editorfähig sind nur explizit vom jeweiligen Host registrierte Layoutziele.
Dieses Paket registriert keinen produktiven neuen Dokumenttyp. Technische Fixtures
bestehen aus Dokument, genau einer Seitenvorlage und Text-/Wert-/Bild-Overlays.
Bereiche, Kopf/Fuß, Gruppen/Untergruppen, Tabellen/Spalten/Wiederholbereiche sind
nur bei tatsächlichem Vorhandensein zu deklarieren; Buttons und Fachaktionen
werden hier nicht ergänzt. Jede Fixture nennt stabile IDs, Scope, Parent,
Ref-/Renderer-Key, Kind/Rolle, Reihenfolge, Sichtbarkeit, Baseline/Grenzen und
Allowed-/Locked-Operationen. Dokument ist Root, Seite Kind des Dokuments,
Overlay Kind der Seite oder einer expliziten vorhandenen Gruppe.

Neue Registrierungen deklarieren `layoutModel: "fixed-layout"`. Fehlendes
`layoutModel` oder `"tabular"` behält die bisherigen A4-/Pflichtartenregeln und
die bisherigen Fingerprints. Unbekannte Werte werden abgewiesen.
Fixed-layout verlangt genau ein Dokument und eine Seitenvorlage. Tabellen sind
nicht erforderlich; vorhandene Tabellen benötigen weiterhin klassifizierte
Spalten (mindestens zwei pro Tabelle). Verwaiste Spalten werden abgewiesen.
IDs, Scope, Parents, Zyklusfreiheit, Layoutmetadaten, Operationssperren und das
Verbot von Fachdaten bleiben verbindlich. Keine Phantom-Refs.

Fixed-layout unterstützt A0 bis A6 sowie `custom` mit expliziten endlichen,
positiven Millimetermaßen, passender Orientierung und nichtnegativen Rändern,
die eine positive Nutzfläche lassen. ISO-A-Formate müssen zu ihren Maßen passen.
A2 quer = 594 × 420 mm. Das ist kein Renderer-/Druckformat-Fallback.

Der bestehende native PDF-Vertrag und Electron-Pipe-Adapter übernehmen dieselbe
Deklaration. Keine zweite Registry, kein zweiter Editor oder Renderer.
Layoutbewegung/-größe/-text sind nur je Element explizit erlaubt; Seitenzuweisung,
Paginierung, Datensatzteilung, Kopf-/Fußreserve, `setPageBreakRule`, fachliches
Speichern/Anlegen/Löschen, IPC-/DB-Aktionen bleiben gesperrt und Eigentum des Hosts.

## Profile und Bestand

Legacy-Kanonisierung und native Legacy-Profilhashes bleiben bytegleich.
Fixed-layout wird im Registry-Fingerprint berücksichtigt. Der native kompatible
Profilhash präfigiert den bisherigen Strukturtext mit
`fixed-layout|FORMAT|orientation|width|height\n` (Format A0..A6 oder `custom`).
Modell- oder Seitenwechsel darf eine akzeptierte Registrierung nicht stillschweigend
migrieren. Bestehende Tabellenregistrierungen, Profile und Renderer bleiben erhalten.

## Abnahmekriterien

- Minimaldokument und A2-Querformat ohne Tabellen validieren in JS und nativ.
- Falsches Modell, Format/Maß, Parent, Zyklus, ID, Spaltenrolle und gesperrte
  Operationen werden abgewiesen; echte unvollständige Tabellen bleiben ungültig.
- BBM prüft Adapteranlage, Kandidat, aktive Projektion, additive Synchronisation
  sowie Save/Load/Restore über bestehende Adapter-/Profilgrenzen.
- Legacy-Fingerprints und registrierte tabellarische Dokumente bleiben unverändert.
- Kit-/BBM-Regression gegen unveränderte Ausgangsbasis, Fehler namentlich abgrenzen.

Prüfungen: `node scripts/tests/m81-pdf-target-contract.test.cjs`, neue
`node scripts/tests/pdf-fixed-layout-contract.test.cjs`, native Vertragsprüfungen,
`npm test`, `npm pack --dry-run`, `npm run release:check`, `git diff --check`.
Native Windows-Bedienung und reale neue PDF-Ausgabe werden durch dieses reine
Vertragspaket nicht als abgenommen behauptet.

## Tatsächlich ausgeführte Nachweise

JS fixed-layout: 8/8 grün; bestehende M81-Vertragsprüfung und Vertrags-Selbsttest
grün. npm-Teilbefehle gegen unveränderte Basis einzeln ausgeführt: Basis 64 grün /
5 rot, Kandidat 65 grün / dieselben 5 rot. Fehlende lokale Pipe-Berechtigung sowie
vier unveränderte Quelltext-/Snapshotprüfungen sind Baseline; keine neuen roten
Befehle. Package-Dry-Run, Release-Check und Diff-Check grün. Ein zunächst durch
den vorangestellten Statuseintrag ausgelöster Dokumentationsguard wurde repariert
und erneut grün geprüft.

In BBM: 7/7 neue Fälle, Volltest 1499/99 -> 1506/99 mit identischen Fehlernamen und
vollständigem Fallinventar. Alle drei Legacy-PDF-Descriptoren sowie Registry-/
native Profilhashes sind bytegleich.

Eine vorbestehende fehlerhafte JS-Zyklusprüfung (`!Set.add(...)`) konnte nicht
terminieren. Dieselbe Parentprüfung verwendet jetzt `has` vor `add`; Selbst- und
Mehrknotenzyklen werden geprüft (ohne Änderung gültiger Bestandsregistrierungen).

Native Tests wurden lokal mangels .NET zunächst nur vorbereitet. Nach
ausdrücklicher Veröffentlichungsfreigabe lief der getrennte Windows-Basis-/
Kandidatenvergleich aus `.github/workflows/pdf-contract.yml`; Ergebnis siehe unten.

## CI-Abschluss nach Veröffentlichungsfreigabe

Die Veröffentlichung wurde ausdrücklich freigegeben. Über die GitHub-Anbindung
wurden die lokal geprüften Trees bytegleich übertragen; der direkte Git-CLI-Push
hatte keine Anmeldung. Prüf-PRs: UI-Editor-kit #93 / BBM-Produktiv #321.

Nativer Nachweis: https://github.com/SteffenBandholt/UI-Editor-kit/actions/runs/34160014785
- Basis 0240ef8: 34 bestanden / 1 fehlgeschlagen / 0 übersprungen.
- Kit-Codehead 689ab1f0ba0be94094edeeccba8dc1cb8522c9ae:
  42 bestanden / 1 fehlgeschlagen / 0 übersprungen, acht neue Tests bestanden.
- Identischer Fehlername: VisibleUiPdfEndToEndUsesTwoRealProcessesAndCleansArtifacts.
  In beiden Jobs derselbe Prozess-Exitcode -1073741811; kein neuer Vertragsfehler.
- Der zunächst gefundene neue Analyzerfehler MSTEST0037 wurde ausschließlich
  durch Assert.HasCount im Test korrigiert. Der Folgelauf kompiliert erfolgreich.
- Der vollständige native Prüflauf ist wegen der genannten Baseline weiterhin rot.
  Sichtbare Windows-Editorbedienung wird nicht als abgenommen behauptet.

Kit-Standard-CI bleibt bei der schon lokal auf Basis reproduzierten M82.3-
Quelltextassertion rot (erwartetes altes 860/1260-Dreispaltenlayout).
BBM-Standard-CI #1041 bleibt bei den acht bekannten Popup-/Lizenzfehlern und
fehlendem ui-editor-kit im vorhandenen CI-Aufbau rot. Maßgeblicher vollständiger
BBM-Paketvergleich mit echtem Kit bleibt 1499/99 -> 1506/99 ohne neue Fehler und
mit vollständigem bisherigen Fallinventar.

Das fachneutrale Vertragspaket ist technisch geprüft. PR-/Mergezuordnung wird
in BBM #274 dokumentiert. Danach kann S1.4a als eigenes Paket fortgesetzt werden.
S1.4a ist durch dieses Vertragspaket noch nicht implementiert oder abgenommen;
S1.5 nicht begonnen, Rechnung #275 bleibt eingefroren.
