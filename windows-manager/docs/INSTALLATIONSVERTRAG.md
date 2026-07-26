# M78-Ziel-App- und Paketvertrag

Eine App ist nur anbindbar, wenn im ausgewählten Root `ui-editor-target.json` mit `schemaVersion: 1`, Vertrag `1.0`, Projekttyp `wpf-net10` und Modus `prepared-native-editor` liegt. Relative Projekt-, Integrations- und Startpfade werden normalisiert, gegen Traversal geprüft und müssen im Root bleiben. `expectedFiles` ist die abschließende Positivliste; `.ui-editor-kit/installation.json` ist verpflichtend.

Das Manifest deklariert `applicationId`, Anzeigename, Projektdatei/Framework, vorhandenes EditorIntegration-/Hostprojekt, Fähigkeiten, Ownership-Marke und zwei sichere Startkonfigurationen. Es enthält keine Fachwerte, Tokens oder absoluten Zielpfade. Ohne Manifest oder bei heuristischem/anderem Modus verweist der Manager auf M79 und schreibt nichts.

`package/current/package.json` ist die lokale Paketquelle. Version, Vertragsversion, Quell- und Zielpfad sowie SHA-256 jeder Datei werden vor der Planung geprüft. Eine vorhandene Datei ist nur dann Manager-Eigentum, wenn sie im Installationsstatus steht und ihr aktueller Hash dem zuletzt installierten Hash entspricht. Fremde oder lokal geänderte Dateien blockieren Schreiben beziehungsweise Löschen.

## M79-Vertrag für registrierte Bestands-Apps

Nach vollständig bestätigter M79-Registrierung darf derselbe Manifestvertrag zusätzlich `projectType: wpf-sdk-existing` und `integrationMode: registered-existing-wpf` tragen. Dieser Modus entsteht niemals bei der read-only Analyse, sondern erst in der bestätigten Transaktion. Sein Pflichtstatus ist `.ui-editor-kit/registration-installation.json`; Registry, Analysemanifest und generierter Adapter stehen ebenfalls in der positiven `expectedFiles`-Liste.

Die M79-Dateiquelle ist kein freies Paket: Inhalte werden deterministisch aus den bestätigten Proposals und festen Templates erzeugt. Die vorhandene `.csproj` darf ausschließlich den markierten additiven `Compile Include`-Block für `.ui-editor-kit/generated/UiEditorKitRegistration.g.cs` erhalten; ein `Update` wäre wegen des SDK-Ausschlusses von Punktverzeichnissen technisch wirkungslos. Ihr Original bleibt fremdes Eigentum und wird für Deinstallation bytegleich im Managerbereich gesichert.

Nach Build und statischem Vertragscheck startet die Transaktion die Ziel-App einmal normal und einmal explizit im lokalen Hostmodus. Der Hostmodus muss über eine Named Pipe eine nichtleere Registry mit korrekter Korrelations-ID liefern. Beide Prozesse werden wieder beendet; ein Fehler löst denselben vollständigen Rollback wie Build- oder Vertragsfehler aus.
