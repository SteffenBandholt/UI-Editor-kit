# Preview-Runtime-API

## Zweck

Diese Datei legt den Zielvertrag fuer eine spaetere generische Preview-Runtime im UI-Editor-kit fest.

Die Preview-Runtime ist eine fachneutrale Laufzeitschicht fuer temporaere Editor-Vorschauen. Sie darf nur mit bereits klassifizierten Registry-Elementen, erlaubten Operationen und neutralen ChangeRequests arbeiten.

Dieses Paket bereitet nur Zielstruktur, API-Vertrag, Test-Guardrails und Migrationsnotiz vor. Es uebernimmt noch keine produktive Runtime-Logik und bindet keine Host-App an.

## Gewaehlter Zielpfad

Der Zielpfad ist:

```text
src/runtime/preview/
```

Begruendung:

- `src/core/` enthaelt bereits die bestehenden Kernmodelle fuer Registry, Editor-Core, Host-Adapter, Layout-State und ChangeRequests.
- Preview ist eine spaetere Laufzeit-API und soll nicht als weiteres Core-Modell versteckt werden.
- Der Pfad bleibt fachneutral und getrennt von Installer, Ziel-App-Bootstrap und konkreten Host-Adaptern.

Aktuell existiert nur ein kleiner vorbereitender Einstieg:

```text
src/runtime/preview/index.cjs
```

Dieser Einstieg exportiert nur Status- und Planinformationen. Die spaeteren Runtime-Funktionen sind noch nicht implementiert.

## Geplante Exporte

Spaeter soll die Preview-Runtime diese fachneutralen Funktionen bereitstellen:

- `getElementAllowedOps`
- `getElementLockedOps`
- `getChangeRequestOperation`
- `isPreviewOperationAllowed`
- `getNodeUiEditorId`
- `getPreviewTargetMode`
- `resolvePreviewTargetElement`
- `getPreviewTargetElement`
- `getPreviewTargetElementId`
- `upsertPreviewChangeRequest`
- `removePendingChangeRequestsForTarget`
- `getPendingChangeRequestSummary`

Die Funktionen duerfen nur vorhandene Registry- und HostContext-Daten auswerten. Sie duerfen keine Fachdaten lesen, keine Fachaktion ausfuehren und keine dauerhafte Aenderung speichern.

## Erwartete Datenstrukturen

### RegistryElement

Ein `RegistryElement` ist ein vorhandenes, klassifiziertes UI-Element aus der Ziel-App-Registry.

Mindestfelder bleiben:

- `id`
- `name`
- `type`
- `role`
- `parentId`
- `order`
- `visible`
- `editable`
- `allowedOps`
- `lockedOps`

Optionale Felder bleiben am bestehenden UI-Elementvertrag ausgerichtet, zum Beispiel:

- `columnRole`
- `fieldKind`
- `actionKind`
- `componentKind`
- `width`
- `minWidth`
- `maxWidth`
- `layoutArea`

### allowedOps

`allowedOps` ist die Liste ausdruecklich erlaubter Editoroperationen fuer ein Registry-Element.

Eine Preview-Operation ist nur moeglich, wenn sie in `allowedOps` enthalten ist und nicht in `lockedOps` steht.

### lockedOps

`lockedOps` ist die Liste ausdruecklich gesperrter Operationen.

`lockedOps` ueberstimmt `allowedOps`. Eine Operation darf nie gleichzeitig erlaubt und wirksam gesperrt ausgefuehrt werden.

### previewTargetMode

`previewTargetMode` beschreibt, welche Art Ziel fuer eine Vorschau verwendet wird.

Vorgesehene neutrale Werte:

- `element`
- `container`
- `self`
- `none`

Die konkrete Ermittlung darf keine automatische UI-Erkennung oder Elementerfindung sein. Sie muss aus Registry, HostContext oder einem bereits bekannten Zielknoten kommen.

### previewTarget

`previewTarget` beschreibt das aufgeloeste Vorschauziel.

Erwartete neutrale Felder:

- `targetElement`
- `targetElementId`
- `targetMode`
- `sourceElementId`
- `reason`

Wenn kein gueltiges Ziel aufgeloest werden kann, muss das Ergebnis kontrolliert leer oder fehlerhaft sein. Es darf kein Ziel geraten werden.

### editGranularity

`editGranularity` beschreibt die beabsichtigte Granularitaet der Vorschauaenderung.

Vorgesehene neutrale Werte:

- `element`
- `container`
- `column`
- `field`
- `component`

Die Granularitaet dient der Preview-Logik und ist keine Fachaktion.

### affectsContainer

`affectsContainer` ist ein boolean und beschreibt, ob eine Operation den Container statt nur das einzelne Element betrifft.

Die Preview-Runtime darf daraus keine automatische Parent-Aenderung ableiten. Parent-/Child-Struktur bleibt durch Registry und Vertrag bestimmt.

### HostContext

`HostContext` ist ein neutrales Kontextobjekt, das die Ziel-App bereitstellt oder das aus einem neutralen Bootstrap abgeleitet wird.

Erwartete Felder:

- `targetAppId`
- `moduleId`
- `scopeId`
- `registry`
- `editorCore`
- `layoutState`
- `pendingChangeRequests`

Nicht jedes Feld muss fuer jede Funktion erforderlich sein. Fehlende Pflichtdaten muessen zu kontrollierten Fehlern oder neutralen Fallbacks fuehren.

### targetAppId

`targetAppId` ist die technische Kennung der Ziel-App.

Die Preview-Runtime darf keinen produktspezifischen Standardwert hart verdrahten. Wenn kein Host bekannt ist, muss ein neutraler unbekannter Hostkontext verwendet oder ein Fehler gemeldet werden.

### moduleId

`moduleId` ist eine optionale technische Modulkennung der Ziel-App.

Sie darf nur zur technischen Einordnung von ChangeRequests verwendet werden und darf keine Fachlogik aktivieren.

### scopeId

`scopeId` benennt den aktiven UI-Scope.

Die Runtime darf nur in diesem Scope arbeiten und keine anderen Scopes automatisch durchsuchen.

### pendingChangeRequests

`pendingChangeRequests` ist eine temporaere, speicherlose Sammlung geplanter oder angewendeter Preview-Aenderungen.

Erwartetes Verhalten:

- im Speicher
- kopiergeschuetzte Rueckgaben
- deduplizierbar je Ziel und Operation, wenn die konkrete Runtime dies vorsieht
- entfernbar je Ziel
- zusammenfassbar fuer UI-Anzeige oder Tests

Diese Sammlung ist keine Speicherung.

### ChangeRequest

Ein `ChangeRequest` folgt dem bestehenden fachneutralen Modell:

- `changeId`
- `elementId`
- `operation`
- `payload`
- `createdAt`
- `source`

Optionale Felder:

- `note`
- `reason`
- `scope`
- `requestedBy`

Der Auftrag darf keine Fachdaten, keine Datenbankfelder und keine fachlichen Ausfuehrungsinformationen enthalten.

## Nicht Teil der Preview-Runtime-API

Ausdruecklich nicht Teil dieser API sind:

- DOM-Panel
- Drag-Panel
- konkrete Host-App
- konkrete Ziel-App-CoreShell
- konkrete Ziel-App-Registry
- Fachlogik
- Speicherung
- Datenbank
- IPC
- PDF
- Druck
- alte Editorpfade
- automatische UI-Erkennung
- automatische Bestandsanalyse
- automatische Migration

## Guardrail

Der Pfad `src/runtime/preview/` muss fachneutral bleiben.

Der Guardrail-Test `scripts/tests/preview-runtime-guardrail.test.cjs` prueft:

- Zielpfad und vorbereitender Index existieren.
- Der Index exportiert nur Plan- und Statusinformationen.
- Der Preview-Runtime-Pfad enthaelt keine host- oder fachbezogenen Sperrbegriffe.
- Keine Speicher-, Datei-, IPC-, Datenbank- oder Host-App-Integration ist enthalten.
