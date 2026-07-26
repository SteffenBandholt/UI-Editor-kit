# M78-Ziel-App- und Paketvertrag

Eine App ist nur anbindbar, wenn im ausgewählten Root `ui-editor-target.json` mit `schemaVersion: 1`, Vertrag `1.0`, Projekttyp `wpf-net10` und Modus `prepared-native-editor` liegt. Relative Projekt-, Integrations- und Startpfade werden normalisiert, gegen Traversal geprüft und müssen im Root bleiben. `expectedFiles` ist die abschließende Positivliste; `.ui-editor-kit/installation.json` ist verpflichtend.

Das Manifest deklariert `applicationId`, Anzeigename, Projektdatei/Framework, vorhandenes EditorIntegration-/Hostprojekt, Fähigkeiten, Ownership-Marke und zwei sichere Startkonfigurationen. Es enthält keine Fachwerte, Tokens oder absoluten Zielpfade. Ohne Manifest oder bei heuristischem/anderem Modus verweist der Manager auf M79 und schreibt nichts.

`package/current/package.json` ist die lokale Paketquelle. Version, Vertragsversion, Quell- und Zielpfad sowie SHA-256 jeder Datei werden vor der Planung geprüft. Eine vorhandene Datei ist nur dann Manager-Eigentum, wenn sie im Installationsstatus steht und ihr aktueller Hash dem zuletzt installierten Hash entspricht. Fremde oder lokal geänderte Dateien blockieren Schreiben beziehungsweise Löschen.
