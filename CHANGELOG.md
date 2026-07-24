# Changelog

## Unreleased

- M73: Dokumentation auf das eigenstaendige, fachneutrale UI-Editor-kit ausgerichtet.
- Plattform- und laufzeitgebundene Produktbeschreibungen aus den verbindlichen Unterlagen entfernt.
- M72 als Abschluss von Panel-, Element- und Textbearbeitung dokumentiert.
- M58: generische Selection-Runtime mit expliziten Element-Refs, deterministischem TargetResolver, Overlays und additiven Public-Core-Exports ergaenzt.
- M57: neutraler Selection-Target-Vertrag dokumentiert und ueber die Public-Core-API validierbar gemacht.

## 0.2.0

M49 Release-Fixstand fuer den oeffentlichen Core des UI-Editor-kit.

- Stabile interne Release-Basis nach M39 bis M48.
- Generischer RuntimeLauncher.
- Scope-, Selection-, Runtime-Status- und Layout-Control-ViewModels.
- Neutrales Testziel fuer fachneutrale Regressionen.
- LayoutState-Vertrag und MemoryLayoutStateStore.
- Offizieller Adapter-/Installer-Pfad.
- Oeffentliche Minimal-Anleitung und ausfuehrbares Minimalbeispiel fuer neue Ziel-Apps.
- Oeffentliche CommonJS-Core-API ueber `src/index.cjs`, `main` und `exports`.
- Ziel-Apps liefern explizit AdapterManifest, HostAdapter und Registry.
- Save, Load und Reset bleiben an den fachneutralen LayoutState-Vertrag gebunden.
- Keine Fachlogik, keine konkrete Ziel-App-Abhaengigkeit, keine automatische UI-Erkennung und keine automatische Registry-Befuellung.

## 0.1.1

- Bootstrap-Auftrag fuer Ziel-Apps aufgenommen.
- Vertrags-, Layout- und Integrationsgrundlagen schrittweise aufgebaut.
- Repo spaeter auf den echten UI-Editor-Kernvertrag bereinigt.

## 0.1.0

- Erste nutzbare fachneutrale Kit-Version.
- UI-Editor-Vertrag aufgenommen.
- Codex-Uebernahmeblock aufgenommen.
- Einbauanleitung und Vertragscheck aufgenommen.

## 0.1.0-draft

- Startstruktur fuer ein fachneutrales UI-/PDF-Editor-Kit angelegt.
- UI-Editor-Vertrag und Codex-Regelblock aufgenommen.
- Einbauanleitung und Uebernahme-Checkliste vorbereitet.
