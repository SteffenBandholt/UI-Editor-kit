# M80 – Electron-Ziel-App und BBM-UI-Pilot

Status: `[A] abgenommen`

## Entwurfsentscheidung

- Art der Ausgabe: UI. Der vorhandene PDF-Arbeitsbereich bleibt für BBM in M80 nicht angebunden und zeigt ausschließlich `BBM-PDF noch nicht angebunden – folgt in M81.`
- Editorfähigkeit: ja, ausschließlich für ausdrücklich registrierte Layoutobjekte.
- Editorfähige Struktur: Scope-Root, Bereich, Gruppe, `fieldGroup`, getrennte Geschwister `label` und `field`, Inhaltstabelle, bestätigte Tabellenspalten sowie ein fachlicher Button als reines Layoutobjekt.
- Pflichtmetadaten: `id`, `name`, `type`, `role`, `parentId`, `order`, `visible`, `editable`, `allowedOps`, `lockedOps` sowie typabhängige Rollen. In BBM werden zusätzlich alle sechs Inspector-/Editorattribute gesetzt.
- Erlaubte neutrale Operationen: `move`, `resizeWidth`, `resizeHeight`, `textMove`, `textResize` und `setVisibility`, jeweils nur bei expliziter Capability.
- Gesperrt: Fachwerte, Speichern, Anlegen, Löschen, Upload, Import, Export, Autosave, Datenbank-/IPC-Fachaktionen, Status-, Termin-, Verantwortlichen-, Ampel- und Fotoaktionen sowie `executeTargetAction`, `modifyDomainData`, `createRecord` und `deleteRecord`.
- Parent-Regel: jedes Element außer dem Scope-Root besitzt einen registrierten Parent; Label und Feld sind Geschwister unter einer `fieldGroup`.

## Zielarchitektur

BBM-Sidebar → enger Preload-Vertrag → BBM-Mainprozess → gehärtete lokale Named Pipe → vorhandener nativer WPF-Editor → vorhandener Node-Core → vorhandene Profil-/Rollbacklogik.

Electron ist damit der zweite praktisch belegte Ziel-App-Adapter neben WPF. Es wurde weder ein Editor-Core noch eine Editoroberfläche dupliziert. Transport und Betrieb bleiben lokal; HTTP, WebSocket, Browser, Webserver, Netzwerk und Cloud sind ausgeschlossen.

## Sicherheit und Lebenszyklus

Der Vertrag verwendet zufälligen Pipe-Namen, kryptografische Nonce, Protokollversion, Handshake vor Nutzdaten, Current-User-only, genau eine Zielverbindung, Korrelations-IDs, Größenlimit, Timeouts, strukturierte Fehler und kontrollierten Disconnect. Der Renderer kann weder Programm noch Pfad bestimmen. Ein zweiter Sidebar-Aufruf fokussiert dieselbe Editorinstanz.

## Prüfung

- `npm test`, `npm pack --dry-run`, `npm run release:check`
- `dotnet build UIEditorKit.slnx`, `dotnet test UIEditorKit.slnx`
- `dotnet build ReferenceTargetApp.slnx`, `dotnet test ReferenceTargetApp.slnx`
- sichtbarer Entwicklungs- und gepackter BBM-Ende-zu-Ende-Lauf mit Auswahl, Markierung, Live-Layout, Sichtbarkeit, Save/Load, Neustart-Restore, Discard, Reset, kontrolliertem Applyfehler und vollständigem Rollback
- BBM-Vertragscheck über `scripts/ui-editor-contract-check.cjs`

## Abgrenzung

M81 ist der nächste offene Meilenstein: **BBM-PDF-Anbindung an den bestehenden PDF-Arbeitsbereich**. M80 verändert keinen BBM-Druck-/PDF-Fachweg.
