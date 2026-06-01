# Ziel-App-Adapter-Regeln

## 1. Zweck

K18.4 legt das dokumentarische Regelwerk fuer spaetere echte Ziel-App-Adapter fest.

Dieses Dokument beschreibt, welche Regeln vor einer echten Ziel-App-Anbindung gelten, damit spaetere Adapter kontrolliert, pruefbar und ohne Vermischung mit Fachlogik entwickelt werden koennen.

K18.4 baut keinen echten Adapter, fuehrt kein Manifest technisch aus und bindet keine produktive Ziel-App an.

## 2. Grundsatz

- Das UI-Editor-kit bleibt fachneutral.
- Die Ziel-App bleibt Eigentuemerin der Fachlogik.
- Die Ziel-App bleibt Eigentuemerin der Fachdaten.
- Das UI-Editor-kit darf nur editorrelevante Struktur-, Layout- und Aenderungsinformationen verarbeiten.
- Eine direkte Produktivaenderung ist ohne eigenen spaeteren Auftrag gesperrt.
- Ein Adapter darf die Grenze zwischen Editorvertrag und Ziel-App-Verantwortung nicht aufweichen.

## 3. Adapter-Grenze

Die Grenze zwischen UI-Editor-kit, Ziel-App-Adapter und Ziel-App ist verbindlich:

| Bereich | Verantwortung | Darf nicht |
|---|---|---|
| UI-Editor-kit | Fachneutrale Validierung, Elementstruktur, Layoutsicht, Aenderungsauftrag und Submit-Faehigkeit pruefen | Fachlogik ausfuehren, Fachdaten speichern, produktive Ziel-App direkt aendern |
| Ziel-App-Adapter | Kontrollierte Uebersetzung zwischen freigegebenen Ziel-App-UI-Elementen und dem fachneutralen Editorvertrag | Elemente blind scannen, Fachlogik ins Kit verschieben, gesperrte Operationen ausfuehren |
| Ziel-App | Fachlogik, Fachdaten, produktive Ausfuehrung und fachliche Sicherheitsregeln besitzen | Verantwortung fuer Fachlogik oder Fachdaten an das Kit abgeben |
| Fachlogik | Bleibt vollstaendig in der Ziel-App | Darf nicht im UI-Editor-kit implementiert werden |
| Fachdaten | Bleiben vollstaendig in der Ziel-App oder deren freigegebenen Fachdaten-Systemen | Duerfen nicht im Kit abgelegt, gespiegelt oder als Payload transportiert werden |
| Layoutdaten | Duerfen als fachneutrale Struktur-, Darstellungs- und Aenderungsinformationen verarbeitet werden | Duerfen keine Fachwerte, Kundenwerte oder produktiven Dokumentdaten enthalten |

## 4. Pflichtvertrag eines spaeteren Ziel-App-Adapters

Ein spaeterer Ziel-App-Adapter muss mindestens diesen Vertrag bereitstellen:

- `getRegistry()`
- `getCurrentLayoutState()`
- `submitChangeRequest(changeRequest)`

Pflichtregeln:

- `getRegistry()` liefert ausschliesslich explizit freigegebene, editorfaehige UI-Elemente.
- `getRegistry()` liefert keine Fachobjekte, keine Datenbankzeilen und keine produktiven Dokumentdaten.
- `getCurrentLayoutState()` liefert nur Layout- und Darstellungszustand.
- `getCurrentLayoutState()` darf keine Fachlogik auswerten und keine Fachdaten offenlegen.
- `submitChangeRequest(changeRequest)` darf nur validierte Aenderungsauftraege annehmen.
- `submitChangeRequest(changeRequest)` darf keine Fachlogik ins Kit zuruecktragen.
- `submitChangeRequest(changeRequest)` darf fachliche Entscheidungsergebnisse nicht als Editor-Payload zurueckspiegeln.
- Echte Ausfuehrung darf erst in einem spaeteren ausdruecklich freigegebenen Paket erlaubt werden.
- Bis zu einer solchen Freigabe bedeutet Submit-Faehigkeit nur kontrollierte Uebergabe an den Adapter, nicht produktive Ausfuehrung.

## 5. Adapter-Manifest

Ein spaeterer echter Ziel-App-Adapter braucht ein Adapter-Manifest als Pflichtgrundlage. Das Manifest beschreibt vorab, welcher Ziel-App-Bereich, welche Elemente, welche Rollen, welche Operationen und welches Risiko freigegeben sind.

Mindestfelder eines spaeteren Manifests:

- `targetAppId`
- `adapterName`
- `adapterVersion`
- `uiScope`
- `layoutProfileId`
- `supportedElementTypes`
- `supportedRoles`
- `supportedOperations`
- `lockedOperations`
- `persistenceMode`
- `executionMode`
- `riskClass`
- `rollbackStrategy`
- `testStrategy`

Regeln fuer K18.4:

- Das Manifest wird in K18.4 nur dokumentiert.
- K18.4 fuehrt kein Manifest technisch aus.
- K18.4 baut keinen echten Adapter.
- Ein spaeteres Manifest muss vor jeder echten Adapter-Ausfuehrung gegen Ziel-App-Regeln, UI-Editor-Vertrag und Sicherheitsregeln geprueft werden.

## 6. Elementfreigabe-Regeln

Fuer editorfaehige Elemente gelten mindestens diese Regeln:

- Kein Blindscan.
- Keine automatische Elementerfindung.
- Jedes editorfaehige Element muss explizit freigegeben sein.
- Jedes Element braucht eine stabile technische ID.
- Jedes Element braucht `type` und `role`.
- `parentId` und `order` muessen nachvollziehbar sein.
- `visible` und `editable` muessen eindeutig sein, wenn sie geliefert werden.
- Erlaubte Operationen muessen explizit sein.
- Gesperrte Operationen muessen explizit sein.
- Die Ziel-App muss erklaeren koennen, warum ein Element editorfaehig ist.
- Der Adapter darf keine Elemente aus DOM, HTML, Namen, Beschriftungen oder Fachwerten erraten.
- Unklare, instabile oder nicht klassifizierte Elemente sind nicht editorfaehig.

## 7. Operationsregeln

Operationen werden kontrolliert und nicht frei ausgefuehrt:

- Es gilt Allowlist statt freier Operationen.
- `lockedOps` sind harte Sperren.
- Unbekannte Operationen sind verboten.
- Eine Aenderungsausfuehrung ist nicht automatisch erlaubt.
- `canSubmit` ist nicht gleich `execute`.
- Submit-faehig bedeutet nur: Der Aenderungsauftrag darf kontrolliert an den Adapter uebergeben werden.
- Echte Ausfuehrung braucht spaeter eine eigene ausdrueckliche Freigabe.
- Eine Operation ist nur zulaessig, wenn Element, Rolle, Typ, UI-Scope, Layoutprofil und Manifest-Regeln zusammenpassen.
- Eine gesperrte Operation bleibt auch dann verboten, wenn sie in einer allgemeinen Allowlist vorkommt.
- Der Adapter darf aus einer Editoroperation keine fachliche Aktion ableiten, die nicht separat freigegeben wurde.

## 8. Datenregeln

Im UI-Editor-kit sind nur fachneutrale editorrelevante Daten erlaubt.

Erlaubt:

- Layoutdaten
- technische Element-IDs
- Operationen
- UI-Scope
- Layoutprofil
- Validierungsergebnisse
- neutrale Payloads fuer Layout- und Darstellungsaenderungen

Verboten:

- Fachdaten
- Kundendaten
- Projektdaten
- Datenbanktabellen
- SQL
- `businessData`
- `recordId`
- Fachstatus
- Preise
- Mengen
- personenbezogene Daten
- produktive Dokumentdaten

Wenn unklar ist, ob ein Wert Fachbezug hat, gilt er bis zur Klaerung als verboten.

## 9. Sicherheitsregeln

Vor einer echten Ziel-App-Anbindung gelten mindestens diese Sicherheitsregeln:

- Echte Adapter erst nach eigenem Auftrag.
- Produktive Aenderungsausfuehrung erst nach eigenem Auftrag.
- BBM erst nach eigenem Auftrag.
- Rueckfall- und Abbruchkriterien muessen definiert sein.
- Tests muessen vor Merge gruen sein.
- Keine Fachlogik im UI-Editor-kit.
- Keine Fachdaten im UI-Editor-kit.
- Keine Ziel-App-Aenderung ohne Validierung.
- Keine Speicherung ohne freigegebenes Speicherkonzept.
- Kein Adapter darf produktive Ziel-App-Zustaende veraendern, solange `executionMode` nicht ausdruecklich freigegeben ist.
- Jede echte Adapterfreigabe braucht einen isolierbaren Testweg, der produktive Ausfuehrung sicher trennt.

## 10. Abbruchkriterien

Eine echte Adapter-Anbindung ist abzubrechen oder darf nicht gestartet werden, wenn mindestens eines dieser Kriterien zutrifft:

- Die Ziel-App liefert unstabile IDs.
- Die Ziel-App kann editorfaehige Elemente nicht eindeutig klassifizieren.
- Fachlogik muesste ins Kit verschoben werden.
- Fachdaten muessten im Kit gespeichert werden.
- Operationen sind nicht eindeutig erlaubbar oder sperrbar.
- Eine Rueckfallstrategie fehlt.
- Tests koennen echte Aenderungsausfuehrung nicht isolieren.
- Das Adapter-Manifest ist unvollstaendig oder widerspricht dem UI-Editor-Vertrag.
- Die Ziel-App kann erlaubte Layoutdaten nicht von verbotenen Fachdaten trennen.
- Ein produktiver Schreibweg waere ohne eigene Freigabe erreichbar.

## 11. BBM-Regel

- BBM bleibt ein spaeterer Kandidat.
- BBM ist nicht der erste unkontrollierte Direktanschluss.
- Ein BBM-Adapter darf nur mit eigenem LV-/Status-Auftrag gebaut werden.
- Ein BBM-Adapter darf nur nach stabilem Minimal-Host und nach dokumentiertem Adapter-Regelwerk geplant werden.
- In Core-Dateien des UI-Editor-kits duerfen keine BBM-Begriffe eingefuehrt werden.
- K18.4 baut keine BBM-Integration und keinen BBM-Adapter.

## 12. Abnahmekriterien fuer K18.4

K18.4 ist abnahmefaehig, wenn mindestens diese Kriterien erfuellt sind:

- `docs/ZIEL_APP_ADAPTER_REGELN.md` ist vorhanden.
- Adapter-Grenzen sind dokumentiert.
- Manifest-Anforderungen sind dokumentiert.
- Elementfreigabe-Regeln sind dokumentiert.
- Operationsregeln sind dokumentiert.
- Datenregeln sind dokumentiert.
- Sicherheits- und Abbruchregeln sind dokumentiert.
- Keine echte Ziel-App wurde angebunden.
- Keine BBM-Integration wurde gebaut.
- Keine Runtime-Implementierung fuer echte Adapter wurde gebaut.
- Keine Fachlogik und keine Fachdaten wurden eingefuehrt.
- `npm test` ist gruen.

## 13. Naechster Bauabschnitt

Naechster Bauabschnitt:

```text
K18.5 - Ziel-App-Adapter-Manifest technisch vorbereiten
```

Fuer K18.5 gilt bereits jetzt:

- Ausdruecklich keine BBM-Anbindung in K18.5.
- Ausdruecklich keine echte Produktiv-App-Anbindung in K18.5.
- Ausdruecklich keine produktive Aenderungsausfuehrung in K18.5.
