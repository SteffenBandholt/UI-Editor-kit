# M82.6 – Topologieneutrales Feintuning

## Status

M82.6 ist `[A] abgenommen`. Implementierung, automatisierte Regression und sichtbare BBM-Development-/Diagnostic-Abnahme sind abgeschlossen.

## Eigentum und Datenfluss

Die Ziel-App besitzt und erzeugt ihre Registry. Der Editor liest ausschließlich die gelieferte Registry und sendet nur darin freigegebene Änderungsanforderungen an den HostAdapter. Er erzeugt weder Registryeinträge noch Ziel-App-Knoten und erkennt keine UI automatisch.

Tabellen- und Gruppenziele dürfen rein logisch sein. Header und Daten können über mehrere bereits vorhandene Ziel-App-Referenzen gekoppelt werden. Dafür ist kein zusätzlicher Wrapper, Viewport, Scrollbereich, Grid oder sonstiger Layoutcontainer zulässig. Der Tabellenvertrag führt deshalb `topologyPolicy: preserveTarget`; `requiresDedicatedWrapper: true` wird als `table_wrapper_forbidden` abgewiesen.

## Topologie-Fingerprint

Der gemeinsame Core bildet aus einer von der Ziel-App ausdrücklich gelieferten Deskriptorliste einen reproduzierbaren SHA-256-Fingerprint. Er berücksichtigt Framework-/Elementtyp, stabile Registry-ID, Parent-ID und Reihenfolge der produktiven Kinder. Text, Eingabewerte und ausdrücklich als dynamischer Fachinhalt deklarierte Datensätze bleiben unberücksichtigt.

Die API scannt kein DOM und keinen WPF-Visual-Tree. Electron und WPF liefern ihre bereits bekannten Registry-/Ref-Beziehungen explizit. Ein Vergleich meldet eine editorbedingte Strukturabweichung, ohne normale Fachdatensatzänderungen zu blockieren.

## Frameworkabbildung

Electron verwendet die browserfähige ESM-Implementierung ohne Node-Abhängigkeit im Renderer sowie die CommonJS-Implementierung im Node-Core. WPF verwendet denselben kanonischen Deskriptoraufbau und SHA-256 über `UiTopologyFingerprint`.

Der gemeinsame Vertrag enthält keine BBM-ID. Auswahl, Registryrefresh, Layoutänderung, Undo, Save und Restore bleiben Aufgaben der vorhandenen Registry-, HostAdapter- und Profilwege.

## Nachweis

- 25 gezielte Node-Tests prüfen Registry-Ownership, wrapperfreie Tabellen, gekoppelte Referenzen, Fingerprints, Style-/Scrollbesitzerschutz, Einfachmodus und Netzwerkfreiheit.
- 4 gezielte WPF-Tests prüfen Fingerprintstabilität, Erkennung unerlaubter Strukturänderungen, Ignorieren dynamischer Fachzeilen und den wrapperfreien Tabellenvertrag.
- Vollständige .NET-, npm-, Pack-Dry-Run- und Release-Prüfungen sind grün.
- Die sichtbare BBM-Diagnostic-Abnahme bestätigte topologieneutrales Öffnen und Refreshen, Direktauswahl, Feintuning, Undo, Save, Elementreset, Profil-Recovery und Neustart-Restore in Restarbeiten und Protokoll.
- BBM lieferte drei vollständige Protokoll-Scopes aus vorhandenen Refs. Der produktive TopsScreen behielt Kopf, mittleren Scrollbereich, Editbox und Quicklane in derselben Parent-Reihenfolge.
- Der vorhandene BBM-Druckweg erzeugte einen echten vierseitigen A4-Protokoll-Vorabzug.

## Produktgrenze

Das Restarbeitenmodul besitzt im aktuellen Produktstand eine HTML-Ausgabevorschau und keine PDF-Erzeugung. M82.6 verändert diesen Fachumfang nicht.

Keine neue Ziel-App-UI, keine zweite Registry, keine zweite Pipe, keine automatische Bestandserkennung, keine neue PDF-Runtime und keine Fachwertänderung wurden eingeführt. Lizenz, produktive Benutzerdateien und BBM-Fachlogik blieben außerhalb des Pakets.
