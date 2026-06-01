# Ziel-App-Freigabe-Dossier

## 1. Zweck

K18.10 ist das Abschlussdossier fuer M8. Das Dossier fasst den neutralen Ziel-App-Vorbau des UI-Editor-kits zusammen und dient als Entscheidungsvorlage fuer eine spaetere echte Ziel-App-Planung.

Das Dossier dokumentiert den Stand des Sicherheits- und Vertragsunterbaus. Es ist keine Freigabe fuer eine echte Ziel-App-Anbindung, keine Freigabe fuer BBM, keine Freigabe fuer produktive Ausfuehrung und keine Adapter-Implementierung.

## 2. Grundsatzentscheidung

- Keine echte Ziel-App wurde angebunden.
- Keine BBM-Integration wurde gebaut.
- Keine produktive Ausfuehrung wurde freigegeben.
- Keine Adapterdateien fuer echte Ziel-Apps wurden erzeugt.
- Nach K18.10 wird der abstrakte Vorbau gestoppt.
- Der naechste Schritt ist eine bewusste Entscheidung ueber die erste echte Ziel-App-Planung.

## 3. M8-Bausteine

| Bauabschnitt | Zweck | Ergebnis | Sicherheitswirkung | Status |
|---|---|---|---|---|
| K18.0 Ziel-App-Bootstrap-Vertrag | Neutralen Bootstrap-Vertrag fuer spaetere Ziel-App-Uebergabe vorbereiten | Bootstrap verbindet Host-Adapter, Registry, Editor-Core, Layoutzustand und UI-State fachneutral | Keine echte Ziel-App-Anbindung; Host-Adapter-Vertrag wird vor Nutzung geprueft | erledigt |
| K18.1 neutraler Test-Host-Durchstich | Fachneutralen Durchstich mit Test-Host nachweisen | Test-Host-Flow verbindet Bootstrap, Editor-Core, ViewModels und Aenderungsentwurf | Submit bleibt nicht-produktiv; `executed` bleibt gesperrt | erledigt |
| K18.2 Ziel-App-Auswahl / Sicherheitsgate | Entscheidungsvoraussetzungen vor erster echter Ziel-App dokumentieren | Ziel-App-Auswahl, Mindestvoraussetzungen und Sperren sind dokumentiert | Keine komplexe Produktiv-App und kein direkter BBM-Produktiv-Anschluss freigegeben | erledigt |
| K18.3 neutraler Minimal-Host | Kontrollierte neutrale Ziel-App-Vorstufe bereitstellen | Minimal-Registry, Minimal-Host und neutraler Flow sind vorhanden | Nur neutrale Elemente; keine echte Ziel-App, keine Fachlogik, keine Fachdaten | erledigt |
| K18.4 Ziel-App-Adapter-Regeln | Regeln fuer spaetere echte Adapter festlegen | Adapter-Grenzen, Manifest-Anforderungen, Element-, Operations-, Daten- und Sicherheitsregeln sind dokumentiert | Echte Adapter, BBM und produktive Ausfuehrung bleiben gesperrt | erledigt |
| K18.5 Adapter-Manifest-Modell und Validator | Fachneutrales Manifest-Modell technisch vorbereiten | Pflichtfelder, neutrale Modi, Normalisierung und Validierung sind vorhanden | Manifest fuehrt keine Ziel-App, keinen Adapter und keine Aenderung aus | erledigt |
| K18.6 Manifest-Check gegen neutralen Minimal-Host | Manifest formal gegen den neutralen Minimal-Host pruefen | Kompatibilitaetscheck fuer Typen, Rollen, Operationen, Ausfuehrung und Speicherung ist vorhanden | Produktive Ausfuehrung und echte Speicherung bleiben gesperrt | erledigt |
| K18.7 Adapter-Manifest-Gate | Gate vor spaeterer Adapter-Planung vorbereiten | Gate bewertet Manifest und Manifest-Check als Planung erlaubt, manuelle Pruefung oder blockiert | Keine echte Ziel-App-Freigabe; kein produktiver Schreibweg | erledigt |
| K18.8 Adapter-Planungsgrundlage | Planungsgrundlage fuer spaetere echte Ziel-App vorbereiten | Adapter-Plan bewertet Manifest, Manifest-Check und Release-Gate fuer Planung | Adapterdatei-Erzeugung, echte Ziel-App-Verbindung und Ausfuehrung bleiben gesperrt | erledigt |
| K18.9 Adapter-Plan-Sicherheitspruefung | Adapter-Plaene gegen verbindliche Sicherheitsregeln pruefen | Safety-Check bewertet Sperraktionen, Bestaetigungen, Tests und Dokumente | Plan bleibt nur sicher, wenn Ausfuehrung, Adapterdateien und produktive Daten gesperrt sind | erledigt |
| K18.10 Freigabe-Dossier | M8 als Sicherheits- und Vertragsvorbau abschliessen | Dieses Dossier fasst Bausteine, Sperren, Voraussetzungen und naechste Entscheidung zusammen | Der abstrakte Vorbau endet; keine echte Ziel-App wird freigegeben | erledigt |

## 4. Vorhandene technische Bausteine

- Bootstrap: `src/core/target-app-bootstrap.cjs`
- Test-Host-Flow: `src/core/target-app-test-host-flow.cjs`
- neutraler Minimal-Host: `src/core/neutral-minimal-host.cjs`
- Adapter-Manifest: `src/core/target-app-adapter-manifest.cjs`
- Manifest-Check: `src/core/target-app-adapter-manifest-check.cjs`
- Release-Gate: `src/core/target-app-adapter-release-gate.cjs`
- Adapter-Plan: `src/core/target-app-adapter-plan.cjs`
- Plan-Safety-Check: `src/core/target-app-adapter-plan-safety-check.cjs`

## 5. Verbindliche Sperren

- Keine echte Ziel-App-Anbindung ohne eigenen Auftrag.
- Keine BBM-Integration ohne eigenen Auftrag.
- Keine produktive Ausfuehrung ohne eigenen Auftrag.
- Keine Adapterdateien fuer echte Ziel-App ohne eigenen Auftrag.
- Keine Fachdaten im UI-Editor-kit.
- Keine Fachlogik im UI-Editor-kit.
- Kein Release-Gate umgehen.
- Keine echte Speicherung ohne eigenes Speicherkonzept.
- Kein Blindscan.
- Keine automatische Elementerfindung.

## 6. Voraussetzungen vor einer spaeteren echten Ziel-App-Planung

- Ziel-App bewusst ausgewaehlt.
- `uiScope` definiert.
- Editorfaehige Elemente explizit freigegeben.
- Element-IDs stabil.
- Elementtypen und Rollen klassifiziert.
- Erlaubte Operationen festgelegt.
- Gesperrte Operationen festgelegt.
- Adapter-Manifest erstellt.
- Manifest-Check bestanden.
- Release-Gate bestanden oder manuelle Pruefung dokumentiert.
- Adapter-Plan vorhanden.
- Plan-Safety-Check bestanden.
- Tests gruen.
- Rueckfall-/Abbruchkriterien definiert.

## 7. Entscheidung nach K18.10

- Der abstrakte Vorbau endet hier.
- Der naechste Bauabschnitt darf nicht automatisch weiter abstrahieren.
- Der naechste Bauabschnitt muss eine konkrete Ziel-App-Entscheidung sein.
- Empfohlener naechster Schritt: K19.0 - Erste echte Ziel-App-Planung festlegen.
- K19.0 darf noch keine produktive Aenderung ausfuehren.
- K19.0 darf noch keine BBM-Integration bauen, falls BBM nicht ausdruecklich ausgewaehlt wird.

## 8. BBM-Hinweis

- BBM bleibt moeglicher spaeterer Kandidat.
- BBM ist nicht automatisch freigegeben.
- BBM-Adapter nur mit eigenem Auftrag.
- BBM-Adapter zuerst nur lesend, analysierend und planend.
- Keine produktive Aenderung in BBM ohne spaetere ausdrueckliche Freigabe.

## 9. Abnahmekriterien fuer K18.10

- `docs/ZIEL_APP_FREIGABE_DOSSIER.md` vorhanden.
- M8-Bausteine vollstaendig zusammengefasst.
- Verbindliche Sperren dokumentiert.
- Voraussetzungen vor echter Ziel-App-Planung dokumentiert.
- Naechster Schritt K19.0 klar definiert.
- Keine echte Ziel-App angebunden.
- Keine BBM-Integration gebaut.
- Keine produktive Ausfuehrung freigegeben.
- `npm test` gruen.

## 10. Abschlussstatus M8

- M8-Sicherheits- und Vertragsvorbau ist abgeschlossen.
- Echte Ziel-App-Anbindung bleibt offen.
- M8 ist abgeschlossen als Vorbereitungsphase, nicht als produktive Ziel-App-Anbindung.
