# M82.1 – Direktauswahl und Layoutstabilisierung

Status: `[A] abgenommen`; Pflichtprüfungen und vollständige sichtbare 56-Schritt-BBM-Abnahme sind abgeschlossen.

## Ziel

M82.1 macht den bestehenden nativen Editor zum sicheren Feintuning-Werkzeug. Registry, HostAdapter, Managerprozess, Named Pipe, atomarer Profilstore, PDF-Core und M81.1-Recovery bleiben die einzigen führenden Wege.

## Ziel-App-Start-Restore

`loadTargetStartupLayout` liest das aktive Schema-2-UI-Profil direkt beim Start der Ziel-App. Vor einer Anwendung werden App-ID, Profil-ID, aktive Scopes, vollständiges Elementinventar, pro Scope berechneter Fingerprint, Capabilities und alle gespeicherten Layoutwerte geprüft. Der Dienst liefert nur einen validierten Anwendungsplan; die Ziel-App wendet ihn über ihren bestehenden HostAdapter an und bestätigt anschließend Hash und Erfolg.

Fehlt das Profil, startet die Baseline. Beschädigte oder inkompatible Profile werden nicht teilweise angewandt. Ein atomarer `startup-profile-recovery.json`-Marker stellt den Befund für den vorhandenen M81.1-Dialog bereit. Der normale App-Start erzeugt keinen Editorprozess.

Wenn der Editor anschließend geöffnet wird, enthält der Zielvertrag eine Startquittung. Ein bereits aktives kompatibles Profil wird nicht erneut angewandt. Die Sitzung übernimmt den aktuellen Zustand als gespeichert und behält die deklarierte Ziel-App-Baseline für Element-, Gruppen- und Gesamtreset.

## Direktauswahlvertrag

Praktisch auswählbare Registryelemente können ergänzend liefern:

- `selectionKind`: `element`, `group`, `layoutZone`, `label`, `field`, `button`, `icon`, `statusText`, `table` oder `column`;
- `selectionLevels`: ausdrücklich zulässige Auswahlarten;
- `operationEffects`: Wirkungsmenge je erlaubter Operation;
- `operationAffectedIds`: ausdrücklich abhängige Ziele je Operation;
- `geometry.maximumOffset`: sichere maximale Verschiebung.

Die Direktauswahl erhält ausschließlich bereits registrierte Elemente. Sie erzeugt keine Elementliste und errät weder Parent noch Gruppe. Der gemeinsame Vertrag bildet aus der expliziten Parentkette höchstens das konkrete Element, die nächste Gruppe und den nächsten Layoutbereich.

## Hover- und Auswahlhierarchie

- Element: enger, durchgezogener Rahmen mit Elementbadge.
- Gruppe: stärkerer, gestrichelter Rahmen mit Gruppenbadge und Kinderzahl.
- Bereich: versetzter, doppelter Rahmen mit Bereichsbadge.
- `Tab` und `Shift+Tab`: Ebene vorwärts beziehungsweise rückwärts wechseln.
- `Enter` oder Klick: exakt den sichtbaren Kandidaten wählen.
- `Esc`: Auswahlmodus ohne Zieländerung beenden.

Die Ziel-App meldet ID, verständlichen Namen, Typ, Parent, Auswahlart, Auswahlstufe, Kinderzahl und Bounding Rectangle über die vorhandene lokale Sitzung. Der Manager synchronisiert Auswahl, Baum und Details. Die technische ID bleibt nur in den Details sichtbar.

## Wirkungsmenge

Jede freigegebene Operation besitzt genau eine deklarierte Wirkung:

- `elementOnly`: nur das gewählte Ziel;
- `groupWithChildren`: Gruppe und Kinder, ohne Skalierung der Kinder bei einer Verschiebung;
- `layoutZone`: gewählter Bereich und seine registrierten Kinder;
- `parentReflowRequired`: nur Ziel plus ausdrücklich deklarierte abhängige Ziele;
- `forbidden`: keine Anwendung.

Der Manager zeigt die Wirkung des aktiven Modus vor der Bedienung. Der Ziel-HostAdapter vergleicht Geometrie vor und nach der Änderung. Nicht deklarierte Änderungen, Größenänderungen von Buttons/Icons durch fremde Operationen und Kindskalierung bei Gruppenverschiebung werden abgewiesen und vollständig zurückgerollt.

## Sicherheitsgrenzen

- nur endliche Zahlen und positive Größen;
- Ziel bleibt sichtbar im Parent;
- Baseline-Minima und -Maxima gelten;
- maximale Verschiebung ist registriert;
- neue Überlappung bei Einzelverschiebung wird blockiert;
- keine Operation ohne Registryfreigabe und Wirkungsmenge;
- keine Fachaktion, kein Fachwert und keine scopeübergreifende Globaländerung;
- UI- und PDF-Profile bleiben getrennt.

## Prüfungen

Der neue Node-Einzeltest deckt 36 benannte Startprofil-, Auswahl- und Wirkungsfälle ab. Fünf native M82.1-Tests sichern zusätzlich explizite Profiloperationen, gezielten Restore ohne Überschreiben responsiver Nachbarn, die saubere Sessiongrenze nach Refresh, Subpixel-Toleranz und Escape-Abbruch. Der native Ziel-App-Test belegt, dass ein bereits angewandtes Profil beim Editoröffnen nicht erneut angewandt wird, sauber startet und beim Elementreset zur deklarierten App-Baseline zurückkehrt. Die vollständigen Kit-, .NET-, Pack- und Release-Prüfungen sowie die sichtbare BBM-Abnahme sind abgeschlossen.
