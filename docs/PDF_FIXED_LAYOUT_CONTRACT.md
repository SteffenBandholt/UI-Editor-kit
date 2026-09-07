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

Native Tests: acht neue Prüfungen vorbereitet, lokal nicht ausgeführt (.NET
fehlt). `.github/workflows/pdf-contract.yml` prüft Basis und Kandidat separat auf
Windows/.NET 10. Veröffentlichung automatisch abgelehnt; kein CI-Lauf, PR oder
Merge. Das Gesamtpaket ist daher noch nicht abgenommen.
