# M45 Layout-State, Storage und Versionierung

## Zweck

M45 beschreibt eine generische, fachneutrale Layout-State- und Layout-Store-Schicht fuer das UI-Editor-kit. Die Schicht modelliert Save, Load, Reset und Schema-Versionierung ohne Ziel-App-Fachdaten, ohne Ziel-App-Fachlogik und ohne dauerhafte Infrastruktur.

## LayoutState-Schema

Ein LayoutState ist ein neutrales Objekt mit folgenden Kernfeldern:

- `schemaVersion`: aktuell genau `1`
- `targetAppId`: technische Ziel-App-ID
- `uiScope`: aktiver UI-Scope
- `layoutScope`: zugehoeriger Layout-Scope
- `layoutProfileId`: Layout-Profil innerhalb dieses Scopes
- `elements`, `changes`, `layoutValues`: optionale neutrale Layoutwerte
- `createdAt`, `updatedAt`: optionale Metadaten, nicht als Test-Taktgeber gedacht
- `source`: optional `default`, `saved` oder `reset`
- `version` oder `revision`: positive Layout-Revision

Erlaubte Layoutwerte bleiben auf neutrale Darstellungsfelder begrenzt: `x`, `y`, `width`, `height`, `spacing`, `order` sowie nur bei ausdruecklicher Freigabe `visible`, `visibility` und `label`.

## LayoutStore-Vertrag

`createMemoryLayoutStateStore()` stellt eine reine Memory-/Test-Implementierung bereit:

- `saveLayoutState(layoutState)`: validiert und speichert den LayoutState.
- `loadLayoutState({ targetAppId, uiScope, layoutScope, layoutProfileId })`: laedt exakt dieses Profil.
- `resetLayoutState({ targetAppId, uiScope, layoutScope, layoutProfileId })`: entfernt exakt diesen gespeicherten Zustand.
- `listLayoutProfiles(selector)`: listet gespeicherte Profile optional nach neutralen Selector-Feldern.

Der Store schreibt keine Ziel-App-Dateien, nutzt keine dauerhafte Datenhaltung und ruft keine Ziel-App-Fachlogik auf.

## Save/Load/Reset-Semantik

Save ersetzt den gespeicherten Memory-Zustand fuer den Schluessel `targetAppId + uiScope + layoutScope + layoutProfileId`. Load liefert eine geklonte Kopie oder `layout_profile_not_found`. Reset bedeutet in M45 bewusst: Der gespeicherte Memory-Zustand fuer genau diesen Schluessel wird entfernt. Ein spaeteres Baseline-/Default-Konzept bleibt ein separates Folgepaket.

## Versionierung und Kompatibilitaet

Unterstuetzt wird ausschliesslich `schemaVersion: 1`. Fehlende, unbekannte oder zukuenftige Schema-Versionen werden blockiert. Es gibt keine automatische Migration. Eine spaetere Migration muss als expliziter Vertrag aktiviert werden und darf nicht stillschweigend laufen.

Relevante Fehlercodes:

- `invalid_layout_state`
- `unsupported_layout_schema_version`
- `incompatible_layout_profile`
- `layout_profile_not_found`
- `layout_state_unavailable`
- `layout_reset_unavailable`
- `target_rejected_change`

## Scope-Isolation

Profile sind strikt nach `targetAppId`, `uiScope`, `layoutScope` und `layoutProfileId` isoliert. Ein Save in `scope.alpha / layout.alpha` ist fuer `scope.beta / layout.beta` nicht sichtbar. Reset wirkt nur auf den exakt passenden Profil-Schluessel.

## Verbotene Inhalte

LayoutState und Store duerfen keine Fachdaten, Datensatz-IDs, Kundendaten, Projektdaten, fachliche Statuswerte, beliebige Aktionspayloads oder Infrastrukturaktionen speichern. Ebenso ausgeschlossen sind Scans bestehender Oberflaechen, automatische Registry-Befuellung, Druck-/Dokumenten-/Nachrichten-/Audio-Funktionen sowie dauerhafte Speicheranbindungen.

## Zusammenhang mit M44

Das neutrale Testziel aus `scripts/fixtures/neutral-target-app/neutralTargetApp.cjs` liefert die Referenz-Scopes `scope.alpha / layout.alpha` und `scope.beta / layout.beta`. Die M45-Tests verwenden diese Scopes, um die Store-Isolation und Layout-Control-Verfuegbarkeit fachneutral abzusichern.

## Folgepaket M46

M46 sollte den Installer-/Adapter-Pfad finalisieren oder die offizielle Ziel-App-Anbindung gegen das neutrale Testziel weiter absichern. M45 liefert dafuer nur den neutralen Layout-State-/Store-Vertrag, keine produktive Persistenz und keine Ziel-App-spezifische Integration.
