# M82.7.4 – Capability-gesteuerte Bediengruppen

Status: `[A]`

Der gemeinsame Einfachmodus zeigt Bediengruppen ausschließlich nach den vom Ziel-Host gelieferten Operationen:

- Verschieben nur mit `move`
- Größe nur mit mindestens einer Größenoperation
- Breite nur mit `resizeWidth` oder dem gemeinsamen `resize`
- Höhe nur mit `resizeHeight` oder dem gemeinsamen `resize`
- Sichtbarkeit nur mit `setVisibility`

Die Steuerung ist ziel-app-neutral. Sie prüft weder BBM-IDs noch Module, CSS-Klassen oder Elementnamen. Dirty, Undo und Save verwenden unverändert den bestehenden Session- und Host-Readback-Weg.

Für das BBM-Ziel `restarbeiten.edit.meta.ampel` wurden im isolierten nativen Zwei-Start-Lauf die direkte Zielwahl, die vollständig ausgeblendete Verschiebegruppe, Breite und Höhe mit jeweils +5 DIP, Sichtbarkeit, Undo, Original, Speichern und Neustart-Restore sichtbar geprüft. Die benachbarten Felder, das Grid/Flex-Layout und der vorhandene Scrollbesitz blieben unverändert.

Automatisiert grün:

- Capability-gesteuerter Einfachmodus: 31/31, davon neun neue M82.7.4-Fälle
- M82.7.2: 8/8
- M82.7.3: 10/10
- `npm test`: vollständig grün
- `dotnet test reference-target-app`: 106/106

Der gemeinsame Core enthält keine Ampel- oder BBM-Sonderlogik. Der bekannte False-Dirty-Startzustand und der bestehende Dirty-/Save-Vertrag wurden nicht geändert.
