# Lokaler Editor-Prozess – M73.4 bis M75

`editor-process-entry.cjs` ist der produktive lokale JSONL-Einstiegspunkt für native Ziel-Apps. Er liest genau eine JSON-Nachricht pro `stdin`-Zeile und schreibt genau eine Antwort pro `stdout`-Zeile. Diagnoseausgaben gehören ausschließlich auf `stderr`.

Das Protokoll ist fest auf Version `1.0` gesetzt. `editor-process-protocol.cjs` implementiert Handshake, Aktivierung, genau eine Session, gestufte Registry-/LayoutState-Übernahme, Node-seitige ChangeRequest-Prüfung, ChangeResult-Rücknahme, Deaktivierung und Shutdown. Es verwendet die vorhandene Registry, den vorhandenen Editor-Core, ChangeRequest- und LayoutState-Vertrag sowie den vorhandenen SessionState.

Der Einstiegspunkt bietet keine sichtbare Oberfläche, keine Persistenz und keinen Netzwerktransport. Er führt selbst keine Ziel-App-Änderung aus; ein validierter Auftrag wird als `submitChangeRequest` an den nativen Host zurückgegeben. Der native Host entscheidet abschließend über Anwendung und Rollback.

M74 ergänzt die interne `editor-ui-session.cjs`. Sie baut den sichtbaren neutralen Zustand aus den vorhandenen Baum-/Detail-ViewModels und dem vorhandenen Panelcontroller auf. Die additiven Nachrichten `getEditorUiState`, `selectEditorElement`, `setEditorLayer`, `setEditorMode`, `setEditorStep` und `activateEditorDirection` ändern keine M73-Nachricht. Ein Richtungsintent wird capability-gesteuert im vorhandenen Panelcontroller in genau einen ChangeRequest übersetzt; parallele Requests bleiben durch `pendingChange` gesperrt. Save, Load, Reset und Discard werden über diesen M74-Weg nicht angeboten.

M75 erweitert denselben Prozess additiv um mehrere Scopes. Der Registry-Payload gruppiert die registrierten Elemente über `layoutArea`; `scopeStates` liefert die getrennten neutralen Layoutzustände. `selectEditorScope` wechselt Baum, Auswahl und Details innerhalb derselben Prozess- und Protokollsession. `refreshEditorLayoutStates` übernimmt die nach Save, Load, Discard, Reset oder Rollback erneut vom HostAdapter erfassten Zustände. Es wird weder eine zweite Runtime noch eine zweite Node-Session gestartet.

Save, Load, Profilpersistenz und atomare Mehr-Scope-Anwendung bleiben Eigentum der nativen Ziel-App und laufen nicht im Node-Prozess. Die bisherigen Ein-Scope-Payloads, Nachrichten und Operationen bleiben gültig; keine bestehende Nachricht wurde umbenannt oder entfernt. Der Prozess verwendet weiterhin ausschließlich lokales JSONL über Standardstreams und keine Browser-, HTTP-, WebSocket- oder Netzwerkkomponente.

Direkter Start für Protokollintegrationstests:

```powershell
node src/process/editor-process-entry.cjs
```

Ein normaler interaktiver Start ist nicht vorgesehen; ohne JSONL-Host wartet der Prozess auf `stdin`.
