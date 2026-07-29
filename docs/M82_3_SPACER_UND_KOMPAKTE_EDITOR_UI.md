# M82.3 - Spacer und kompakte Editoroberflaeche

Status: `[A] abgenommen`

## Ziel und Grenze

M82.3 trennt eine lokale Elementbreite von den moeglichen Folgen im Layoutfluss. Der gemeinsame Core beschreibt die Absicht; WPF- und Electron-HostAdapter bilden sie mit ihren vorhandenen Layoutmitteln ab. Es gibt keinen BBM-Sonderpfad im Core, keinen zweiten Editor und keinen zweiten Profilstore.

## Appuebergreifender Spacingvertrag

`spacingTarget` kennt `beforeElement`, `afterElement`, `groupPaddingLeft`, `groupPaddingRight`, `groupPaddingTop`, `groupPaddingBottom`, `childGapHorizontal`, `childGapVertical`, `reservedWidth` und `reservedHeight`. Die getrennten Operationen sind `spacingIncrease`, `spacingDecrease`, `spacingSet` und `spacingReset`.

Eine Breitenverkleinerung bietet drei fachlich getrennte Entscheidungen:

- **Freien Platz stehen lassen** veraendert die Elementbreite und erhoeht den reservierten Platz. Ziel, Gruppe und nicht abhaengige Nachbarn bleiben geometrisch stabil.
- **Nachbarelemente nachruecken lassen** gibt den natuerlichen Layoutfluss ausdruecklich frei. Vorschau und Readback nennen die tatsaechlich betroffenen Nachbarn mit Anzeigenamen.
- **Gruppe entsprechend verkleinern** veraendert Element- und editierbare Gruppenbreite um denselben bestaetigten Betrag. Kinder werden nicht skaliert.

Gruppenbreite, Gruppenhoehe, Innenabstaende, Kindabstaende und Spacer vor/nach einem Element bleiben eigenstaendige Operationen. Registry-Parents werden dabei nicht veraendert. Unerwartete Nachbar-, Gruppen- oder Fremdwirkungen fuehren zum vollstaendigen Rollback.

## Frameworkabbildung

Der WPF-Adapter fuehrt `WpfSpacingState` zusammen mit den vorhandenen Layoutzustaenden und prueft Ziel-, Gruppen- und Nachbarrechtecke nach dem Apply. Der Electron-Vertrag transportiert denselben neutralen Spacingzustand und ueberlaesst die konkrete Abbildung dem Ziel-App-Adapter, zum Beispiel ueber Padding, Gap oder reservierte Trackbreite.

Responsive Electron-Ziele duerfen fuer nicht statisch deklarierbare Breite oder Hoehe eine einmalig vor dem Start-Restore erfasste `capturedBaseline` liefern. Diese Laufzeitbaseline ist Resetquelle, aber kein Bestandteil des deterministischen Registry-Fingerprints. Profile speichern weiterhin nur neutrale Layoutabsichten; Save, Start-Restore, Discard, Element-/Gruppen-/Gesamtreset und Recovery verwenden denselben atomaren Profilweg.

## Kompakte gemeinsame Oberflaeche

Der vorhandene native WPF-Editor verwendet einen responsiven Workspace:

- kleine Inhaltsbreite: eine Spalte,
- normale Inhaltsbreite: zwei Spalten,
- grosse Inhaltsbreite: drei Spalten.

Auswahl/Baum, Geometrie/Text und Gruppe/Aktionen werden nur umgeordnet, nicht dupliziert. Die Aktionsleiste mit Speichern, Verwerfen, Reset, naechster Auswahl, Direktauswahl, Dirty-Status und Bearbeitungsmodus bleibt ausserhalb des scrollenden Inhalts sichtbar. Der Baum besitzt einen eigenen Scrollbereich; technische Details bleiben einklappbar. UI- und PDF-Arbeitsbereich verwenden dieselben Breitenstufen, behalten aber getrennte fachliche Kontrollen.

## Nachweis

Automatisiert werden Spacingvertrag, WPF-/Electron-Abbildung, Persistenz, Restore, Reset, Rollback, Parentstabilitaet, 1/2/3-Spaltenmodus, feste Aktionen, interner Baumscrollbereich, UI-/PDF-Workspace und das Verbot von BBM-IDs sowie Browser-/Netzwerkpfaden geprueft.

Sichtbar geprueft wurden an der gepackten BBM-Development-App unter anderem Kurztext/Gegenstand, reservierter Platz, bewusstes Nachruecken, Gruppenbreite, Padding/Gap, Save/Restart, Element-/Gruppen-/Gesamtreset, Discard, Direktauswahl mit Escape sowie die responsive Editoroberflaeche. Der reale PDF-Arbeitsbereich zeigte 28 Registryelemente und eine aktuelle zweitseitige A4-Vorschau.
