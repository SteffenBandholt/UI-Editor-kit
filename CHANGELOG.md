# Changelog

## Unreleased

- M58: generische Selection-Runtime mit expliziten Element-Refs, deterministischem TargetResolver, Hover-/SelectedOverlays und additiven Public-Core-Exports ergaenzt.
- M58: Runtime-Lifecycle, Fehlerverhalten, InteractionRoot-Erweiterung und BBM-Migrationsplan dokumentiert; Paketversion bleibt 0.2.0.
- M57: neutraler Selection-Target-Vertrag `selection-target-contract-v1.0` dokumentiert und ueber Public-Core-API validierbar gemacht.
- M57: Registry-Metadaten, ElementRefResolver, SelectionHost, Controller-Form, Overlay-Rollen und Sicherheitsgrenzen ohne vollstaendige Runtime festgelegt.

## 0.2.0

M49 Release-Fixstand fuer den oeffentlichen Core des UI-Editor-kit.

- Aktueller Release-Stand: stabile interne Release-Basis nach M39 bis M48; keine npm-Veroeffentlichung und kein Git-Tag.
- M39: Ziel-App-Vertrag v1.0 als fachneutrale Grundlage abgeschlossen.
- M41: generischer RuntimeLauncher vorhanden.
- M42: Scope-, Selection-, Runtime-Status- und Layout-Control-ViewModels vorhanden.
- M44: neutrales Testziel fuer fachneutrale Regressionen vorhanden.
- M45: LayoutState-Vertrag und MemoryLayoutStateStore vorhanden.
- M46: offizieller Adapter-/Installer-Pfad dokumentiert und getestet.
- M47: oeffentliche Minimal-Anleitung und ausfuehrbares Minimalbeispiel fuer neue fachneutrale Ziel-Apps vorhanden.
- M48: oeffentliche CommonJS-Core-API ueber `src/index.cjs`, `main` und `exports` vorhanden.
- Oeffentliche API: Runtime-Start, Adapter-Pfad, ViewModels, LayoutState-Vertrag und MemoryLayoutStateStore werden ueber den Paket-Einstieg gebuendelt.
- Minimalintegration: neue Ziel-Apps liefern explizit AdapterManifest, HostAdapter und Registry; das Kit startet daraus Runtime und ViewModels.
- Adapter-Pfad: Target-App -> AdapterManifest -> HostAdapter -> Registry -> RuntimeLauncher -> ViewModels -> LayoutStateStore.
- LayoutState / LayoutStore: Save, Load und Reset bleiben an den fachneutralen LayoutState-Vertrag und kompatible Stores gebunden.
- Neutrale Tests: vorhandene Tests unter `scripts/tests/` sichern Core, Runtime, ViewModels, LayoutState, Adapter-Pfad, Minimalbeispiel und Public API ab.
- Klare Nicht-Ziele: keine Fachlogik, keine konkrete Ziel-App-Abhaengigkeit, keine automatische UI-Erkennung, kein DOM-Scan, keine automatische Registry-Befuellung, keine echte Persistenz, keine npm-Veroeffentlichung.

## 0.1.1

- Bootstrap-Auftrag fuer Ziel-Apps enthalten.
- Neue Apps koennen das Kit kontrolliert vor dem ersten UI-/PDF-Bau uebernehmen.
- `v0.1.1` ist der erste Referenzstand inklusive Bootstrap-Auftrag.
- K1.0: Mini-Inspector als erste sichtbare Demo ergaenzt.
- K1.1: App-Integration-Modell dokumentiert.
- K1.2: Layoutdaten-Modell dokumentiert.
- K1.3: Layoutdaten-Validator vorbereitet.
- K1.3-Pruefung standardisiert ueber `npm test`.
- K1.4: Fachneutraler Layoutdaten-Extractor aus `data-ui-*` vorbereitet.
- K1.5: Fachneutraler Layoutdaten-Diagnosebericht (Extractor + Validator) vorbereitet.
- K1.6: CLI-Pruefbefehl fuer Layoutdaten-Diagnose vorbereitet.
- K1.7: JSON-Datei-Eingabe fuer Layoutdaten-Diagnose per CLI abgesichert.
- K1.8: Zentrale Layoutdaten-API zur Buendelung vorhandener Bausteine ergaenzt.
- K1.9: Layoutdaten-API dokumentiert und Stabilitaetsvertrag festgelegt.
- K1.10: Layoutdaten-Kern als Referenzstand dokumentiert und abgesichert.
- K2.0: Mini-Inspector nutzt Layoutdaten-API erstmals lesend.
- K2.1: Mini-Inspector-Statusausgabe als neutraler Lesestatus abgesichert.
- K2.2: Mini-Inspector-Status als lesender Stand dokumentiert.
- K2.3: Mini-Inspector-Statusanzeige als neutrales View-Modell vorbereitet.
- K2.4: Oeffentlicher Mini-Inspector-Einstieg als lesende API abgesichert.
- K2.5: Mini-Inspector-Einstieg als Referenzstand dokumentiert.
- K3.0: Mini-Inspector-Status als renderbares Anzeige-Modell integriert.
- K3.1: Sichtbarer/renderbarer Mini-Inspector-Status dokumentiert.
- K3.2: Mini-Inspector DOM-/Markup-Adapter fuer neutrale Statusanzeige vorbereitet.
- K3.3: Mini-Inspector DOM-/Markup-Adapter dokumentiert und per Smoke-Test abgesichert.
- K3.4: Lesender Mini-Inspector-Einstieg zum Rendern in Inspector-Container vorbereitet.
- K3.5: Vorhandene Mini-Inspector-Demo und vorbereiteter Integrationspunkt fachneutral als Bestandsaufnahme dokumentiert.
- K3.6: K3-Mini-Inspector-Referenzstand als rein lesender Status-/Render-Stand dokumentiert.
- K4.0: Fachneutrale Mini-Inspector Demo-/Host-Schale fuer lesenden Status und Inspector-Container-Rendering vorbereitet.
- K4.1: Demo-/Host-Schale ueber `npm run mini-inspector:demo` neutral ausfuehrbar gemacht.
- K4.2: Demo-/Host-Befehl um kontrollierten ungueltigen Demo-Fall per `--invalid` erweitert.
- K4.3: Demo-/Host-Befehl um optionale fachneutrale JSON-Ausgabe per `--json` erweitert.
- K4.4: Demo-/Host-CLI um `--help` und kontrollierte Pruefung unbekannter Argumente erweitert.
- K5.0: Fachneutrale Mini-Inspector Browser-/HTML-Demo mit getrenntem Inspector-Bereich vorbereitet.
- K5.1: Browser-Demo gegen Node-Referenzstatus mit gemeinsamem Scope, Referenztests und Doku-Abgleich abgesichert.
- K5.2: Bestandener manueller Sichttest der Browser-Demo fachneutral als K5-Referenzstand dokumentiert.
- K6.0: Neutrale Design-/Theme-Tokens aus der Browser-Demo als visuelle Referenz dokumentiert.
- K6.1: Neutrale Theme-Tokens als technische CSS-Referenzdatei bereitgestellt und in die Browser-Demo eingebunden.
- K7.0: Fachneutralen Integrationsvertrag fuer spaetere Host-Apps dokumentiert.
- K7.1: Host-App-Integrationsvertrag mit eigenem Smoke-Test technisch abgesichert.
- K8.0: Wiederverwendbaren Browser-Host-Adapter fuer Ziel-Root und getrennten Inspector-Container vorbereitet.
- K8.1: Browser-Host-Adapter als Referenzstand dokumentiert und bestaetigten Sichttest festgehalten.
- K9.0: Neutrales Host-App-Beispiel fuer den Browser-Host-Adapter vorbereitet.
- K9.1: Sichttest und Referenzstand des neutralen Host-App-Beispiels dokumentiert.
- K10.0: Neutralen Host-App-Adoptionsleitfaden fuer den Browser-Host-Adapter vorbereitet.
- K10.1: Neutralen Gesamt-Referenzstand nach K10.0 dokumentiert.
- K11.0: Repo auf echten UI-Editor-Kernvertrag bereinigt; Browser-/Host-Demo-Spur entfernt; Farb-/Theme-Referenz behalten.

## 0.1.0

- Erste nutzbare fachneutrale Kit-Version.
- UI-Editor-Vertrag enthalten.
- Codex-Uebernahmeblock enthalten.
- Einbauanleitung enthalten.
- Uebernahme-Checkliste enthalten.
- Vertragscheck enthalten.
- Beispiel-HTML enthalten.
- Uebernahme-Trockenlauf enthalten.
- K0.6: Bootstrap-Auftrag fuer Ziel-App ergaenzt.

## 0.1.0-draft

- Startstruktur fuer ein fachneutrales UI-/PDF-Editor-Kit angelegt.
- UI-Editor-Vertrag aufgenommen.
- Codex-Regelblock fuer UI-/PDF-Entwurfsentscheidungen aufgenommen.
- Einbauanleitung fuer neue Apps aufgenommen.
- Platzhalter fuer Editor-Core und Beispiele angelegt.
- Klarstellungen zu Quelle-der-Wahrheit, Nicht-Raten und Kein-Fachlogik-Scan ergaenzt.
- KIT-Uebernahme-Checkliste fuer neue Apps ergaenzt.
- K0.2: Vertragscheck technisch als erster fachneutraler Kit-Baustein vorbereitet.
- K0.3: Uebernahmeblock und Einbauanleitung praxisfest gemacht.
- K0.4: Uebernahme-Trockenlauf dokumentiert.
