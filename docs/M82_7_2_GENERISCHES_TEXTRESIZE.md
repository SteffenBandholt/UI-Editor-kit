# M82.7.2 – Generischer `textResize`-Vertrag

Status: `[A]`

## Ziel und Grenze

`textResize` bleibt eine capability-gesteuerte Layoutoperation. Die Ziel-App besitzt Registry und reale Zielreferenz; der Editor liest die Registry, sendet eine Änderungsanforderung und übernimmt ausschließlich den vom Host zurückgemeldeten Istwert. Der gemeinsame Core enthält keine BBM-IDs, keine DOM-Erkennung und keine plattformspezifische CSS- oder WPF-Regel.

## Änderungsvertrag

Eine Anforderung enthält:

- `elementId`
- `operation: "textResize"`
- `payload.text.fontSize` als endlichen positiven DIP-Wert
- `payload.text.unit: "dip"`
- optional `payload.text.expectedCurrentFontSize` zur Konfliktprüfung

Die Hostantwort enthält zusätzlich `textResize` mit:

- `unit`
- `requestedFontSize`
- `expectedCurrentFontSize`
- `previousFontSize`
- `appliedFontSize`
- `tolerance`
- `changed`
- `matchesRequested`

Die gemeinsame Rundungstoleranz beträgt 0,02 DIP. Ein gewünschter Wert allein ist kein Erfolgsnachweis.

## Erfolgs- und Fehlerentscheidung

Erfolg ist nur zulässig, wenn der Host den realen Ausgangswert gelesen, den Wert am registrierten Ziel angewandt und nach Layout-/Style-Aktualisierung den tatsächlichen Wert zurückgelesen hat. Der Istwert muss innerhalb der Toleranz dem Ziel entsprechen und sich zugleich vom Ausgangswert unterscheiden.

Definierte Ablehnungen sind insbesondere:

- `text_resize_expected_value_conflict`: erwarteter und aktueller Ausgangswert widersprechen sich
- `text_resize_readback_missing`: Ausgangs- oder angewandter Wert fehlt
- `text_resize_readback_mismatch`: Host-Istwert entspricht nicht dem Zielwert
- `text_resize_no_effect`: Host-Istwert blieb unverändert

Bei Ablehnung entstehen kein Dirty-Zustand und kein Undo-Frame. Das Ziel wird auf den vor der Operation gelesenen Zustand zurückgerollt.

## Electron-Abbildung

Electron normalisiert den DIP-Wert im gemeinsamen Vertrag. Die Ziel-App entscheidet über die DOM-Abbildung, setzt den Wert nur am explizit registrierten Ref und liest anschließend `getComputedStyle(element).fontSize`. CSS-Pixel werden in diesem Desktopvertrag als DIP-Istwert behandelt. Es werden keine CSS-Klassen, Wrapper, globalen Variablen oder Nachbarziele automatisch gesucht oder erzeugt.

## WPF-Abbildung

WPF liest und setzt die reale `FontSize`-Dependency-Property des registrierten `Control`- oder `TextBlock`-Ziels. `SetCurrentValue` erhält vorhandene Bindings; Snapshot und Rollback bewahren die Binding-Quelle. Nach `UpdateLayout` wird der tatsächliche Wert erneut gelesen. Fehlender Ref, fehlende Capability, Konflikt, Mismatch und No-op werden strukturiert abgewiesen.

## Einfachmodus, Session und Persistenz

Schriftsteuerung, Schritt kleiner/größer und direkte DIP-Eingabe erscheinen ausschließlich bei `textResize`. Der Panelcontroller sendet den zuletzt vom Host gelesenen Istwert als `expectedCurrentFontSize`. Erst eine erfolgreiche Hostantwort aktualisiert Anzeige, Dirty, Undo und Save.

Undo, Discard, Reset und Restore verwenden denselben Hostweg. Bereits erfüllte `textResize`-Ziele werden nur innerhalb interner atomarer Restore-Batches übersprungen; ein interaktiver No-op bleibt eine Ablehnung. Dadurch blockiert ein unverändertes gespeichertes Ziel nicht den Rollback eines tatsächlich geänderten zweiten Ziels.

## Nachweise

- JavaScript-Vertrag: gewünschter Wert, Konfliktprüfung, Readback, No-op, Mismatch und Toleranz
- capability-gesteuerter Panelpayload mit Host-Istwert
- generischer WPF-Apply für `TextBox` und `TextBlock`
- Binding-Erhalt am WPF-Ziel
- atomarer Undo-Fall mit bereits erfülltem gespeichertem `textResize`
- kein BBM-Bezeichner im gemeinsamen Core
- vollständige M82.5–M82.7.2-Regression, Topologieschutz, Save/Restore und Reset

Es wurde keine neue UI, Registry, Profilablage oder Funktionsebene ergänzt.
