# M83.0 – Appneutraler Komponentenvertrag

## Ziel

Eine Ziel-App liefert editorfähige Komponenten als vollständige, explizite Bündel. Der gemeinsame Editor validiert und liest diese Bündel; er erzeugt weder Registryziele noch IDs aus DOM, sichtbaren Werten oder Laufzeitdaten.

## Vertragsmodell

Ein Komponentenvertrag enthält:

- eine stabile `componentId` und `scopeId`,
- die ausdrücklich verpflichtenden `requiredSlots`,
- pro Slot `slotId`, `required`, `referenceKind` (`single` oder `multi`) und `presence`,
- pro Element die bestehenden Registryfelder einschließlich stabiler `id`, `parentId`, `refKey`, Typ, Rolle, Auswahlart, Baseline, Grenzen, Operationen und Wirkung.

`stableIdSource: "declaration"` belegt, dass die ID aus der Quelldeklaration stammt. Der Core kennt keine App- oder BBM-IDs.

## Einzel- und Multi-Refs

Ein Single-Ref muss im gemounteten Ziel genau einmal auflösen. Ein Multi-Ref repräsentiert ein logisches Templateziel und darf viele sichtbare Instanzen binden, ohne eine ID pro Datensatz zu erzeugen. Sind keine Instanzen sichtbar, ist ein Multi-Ref mit `mountedInstanceCount: 0` gültig; bei sichtbaren Instanzen ist mindestens ein Ziel verpflichtend.

Die Ziel-App bleibt Eigentümerin der tatsächlichen Ref-Auflösung. Der Core verarbeitet ausschließlich den gemeldeten Binding-Status.

## Guardrails

`validateUiComponentContracts` und `validateUiComponentReferenceBindings` benennen fehlende Pflichtslots und Registryziele, fehlende oder nicht aufgelöste Refs, doppelte Single-Refs, fehlende Parents, nicht unterstützte Capabilities, verlangtes `textResize` oder `move`, fehlende Größenlimits, vom Parent verschluckte direkte Kindauswahl sowie zentrale Registryziele außerhalb eines Komponentenvertrags.

Die Kindauswahl wird mit `orderUiComponentSelectionTargetIds` nach Parenttiefe geordnet. Ein vorhandenes Kind steht vor seinem Parent.

## Verantwortungsgrenzen

- Die Ziel-App erzeugt Komponentenverträge, Registry, Refs und HostAdapter.
- Der Editor liest und validiert den Ziel-App-Vertrag.
- Es gibt keine DOM-Erkennung, automatische Zielerzeugung, zweite Registry oder zweite Profilablage.
- Fachaktionen und Fachdaten bleiben außerhalb des Layoutvertrags.

## Arbeitsregel für neue Komponenten

Eine neue oder strukturell geänderte editorfähige Komponente ist erst fertig, wenn produktiver Code, vollständige Slots, explizite Refs, Capabilities, Grenzen und Vollständigkeitstests gemeinsam vorliegen. Eine spätere manuelle Einzelregistrierung ist kein normaler Entwicklungsschritt.

## Späteres PDF-Prinzip

PDF-Komponenten sollen denselben Grundsatz verwenden: Renderer und expliziter Layoutvertrag gehören zusammen; stabile Komponenten-/Element-IDs, vollständige Slots und generische Operationen laufen über einen PDF-HostAdapter. M83.0 ergänzt keine PDF-Funktion.

## Sichtbare Abnahme

Die isolierte BBM-Acceptance mit `npm run start:ui-editor:acceptance` ist erfolgreich nachgetragen: Meta-Spalte, Nr., Datum und Klasse sind getrennt auswählbar; eine Kindänderung verändert nicht den Container. Die Listenampel wirkt als Multi-Ref auf alle sichtbaren Zeilen, neu gerenderte Zeilen übernehmen den Layoutwert, Speichern und automatischer zweiter Start stellen ihn wieder her. Scroll- und Topologiestruktur blieben unverändert.
