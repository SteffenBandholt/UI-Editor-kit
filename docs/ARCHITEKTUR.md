# Architektur

## Zielbild

Das UI-Editor-Kit ist fachneutral und wiederverwendbar.

Es besteht aus Vertrag, Regeln, Codex-Startregel, spaeterem Editor-Core, spaeteren Pruefungen und Beispielen.

## Trennung

Der Editor-Core kennt keine Fachmodule.

Fachmodule liefern nur editorfaehige Elemente mit klaren Metadaten.

Der Editor bearbeitet Darstellungseigenschaften wie Position, Groesse, Sichtbarkeit und Layout.

Fachdaten und Fachaktionen bleiben ausserhalb des Editors.

## Quelle der Wahrheit

Dieses Repository ist die Quelle der Wahrheit fuer das UI-Editor-Kit.

Andere Apps uebernehmen die jeweils freigegebene Version dieses Kits.

## App-Integration

Das fachneutrale App-Integrationsmodell steht in `docs/APP_INTEGRATION_MODELL.md`.

Die App-Integration trennt Editor/Layoutdaten klar von Fachlogik/Fachdaten.
