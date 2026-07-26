# M79 – Entwurfsentscheidung zur kontrollierten Bestands-App-Registrierung

## 1. Entscheidung

M79 erweitert den vorhandenen M78-Windows-Manager um genau einen belegten Frameworkadapter: lokale SDK-basierte C#-/WPF-Projekte mit `.csproj` und XAML/C#. Der Erstlauf ist strikt read-only. WinForms, Avalonia, MAUI, Electron, Web und unbekannte Projekttypen werden mit `registration_framework_unsupported` abgewiesen und niemals teilweise verändert.

## 2. Wiederverwendung

Die neutralen Typen, Rollen und Operationsnamen des vorhandenen UI-Elementvertrags bleiben maßgeblich. Der M79-Registrygenerator erzeugt `id`, `name`, `type`, `role`, `parentId`, `order`, `visible`, `editable`, `allowedOps`, `lockedOps` und die vorhandenen Zusatzmetadaten. Der generierte WPF-Adapter verwendet die bestehenden Methoden `GetRegistry`, `GetCurrentLayoutState` und `SubmitChangeRequest` sowie die bekannten Layoutoperationen. Er ruft weder Click-Handler noch `ICommand.Execute`, Fachobjekte, Dateien, Datenbanken oder Netzwerkcode auf.

## 3. Schichtengrenzen

- `Domain` enthält nur neutrale Analyse-, Fundstellen-, Vorschlags-, Registry-, Preview- und Ownershiprecords.
- `Core` enthält Adapterverträge, stabile IDs, Proposal-Mapping, Vokabular und Registry-/Parent-/Actionvalidierung; keine WPF-Abhängigkeit.
- `Infrastructure` enthält Roslyn, XDocument, Hashinventar, Git-Leseprüfung, Generator, atomare Transaktion, Build und Vertragscheck.
- `Wpf` erweitert ausschließlich das vorhandene Managerfenster um den sichtbaren M79-Ablauf.

## 4. Read-only Analyse

Vor dem ersten Parserzugriff und nach dem letzten Parserzugriff wird das vollständige Zielinventar außerhalb von `.git`, `.vs`, `bin`, `obj`, `node_modules` und dem eigenen `.ui-editor-kit` gebildet. Relative Pfade, Länge und SHA-256 müssen identisch sein. Die Analyse erzeugt im Ziel weder Datei noch Verzeichnis und startet keinen Build. Das versionierte Manifest liegt bis zur bestätigten Installation ausschließlich unter dem Manager-Datenroot.

## 5. Strukturierte Parser

XAML wird mit `XDocument`, `PreserveWhitespace` und `SetLineInfo` gelesen. Erfasst werden deklarierte Namen, Typ, Containment, Bindings, Events, Attribute, View, Zeile, Spalte und Template-/Dynamikunsicherheit. MarkupExtensions, Ressourcen und DataContext werden nicht geladen oder ausgeführt. C# wird mit `Microsoft.CodeAnalysis.CSharp` 5.0.0 als Syntaxbaum gelesen. Methoden, Invocation-Syntax und `ICommand`-Deklarationen liefern nur Risikoindizien; Zielassemblies werden nicht geladen.

## 6. Vorschlag und Nutzerentscheidung

Jede Fundstelle bleibt zunächst `Unreviewed` oder `ClarificationRequired`. Der Manager zeigt Filter, Viewliste, Elementbaum, Quelle, Vertrauen, Warnungen, ID, Parent, Rolle, Typ, Zusatzmetadaten und Actionrisiken. Der Nutzer kann jeden Vorschlag einzeln ändern, bestätigen oder ablehnen. Es gibt keine Sammel- oder Autobestätigung. Ungeprüfte, klärungsbedürftige oder blockierte Vorschläge verhindern die Installation.

## 7. Stabile IDs und Parentstruktur

Benannte Elemente erhalten reproduzierbare IDs aus App-ID, relativer View und deklariertem Namen. Unbenannte Elemente verlangen eine manuelle ID oder Ablehnung. Parentkandidaten folgen ausschließlich dem statischen XAML-Containment. Viewübergreifende Zuordnungen, Templates und dynamische Inhalte verlangen eine Nutzerentscheidung. Fehlende Parents, Zyklen, Kollisionen und ungültige Tabellenspaltenparents blockieren.

## 8. Fachaktionssperren

Click-, Command- und `ICommand`-Fundstellen sowie actiontypische Symbole werden sichtbar als Risiko ausgewiesen. `executeTargetAction` und `modifyDomainData` bleiben für solche Elemente zwingend in `lockedOps`; die Operationen sind nie in `allowedOps`. Ein Button darf ausschließlich als Layoutobjekt bestätigt werden. Analyse, Adapter und Diagnose führen keine Fachaktion aus.

## 9. Generierung und Vorschau

Bestätigte Vorschläge erzeugen deterministisch:

- `ui-editor-target.json`,
- `.ui-editor-kit/registration-analysis.json`,
- `.ui-editor-kit/registration-registry.json`,
- `.ui-editor-kit/generated/UiEditorKitRegistration.g.cs`,
- `.ui-editor-kit/registration-installation.json`.

Die einzige bestehende Dateiänderung ist ein mit `UI-Editor-kit M79` markierter, additiver `Compile Include`-Eintrag in der `.csproj`. `Include` ist erforderlich, weil das .NET SDK Quelltexte unter dem Punktverzeichnis `.ui-editor-kit` nicht über die Standard-Compile-Globs aufnimmt. Der Einfügepunkt wird nach erfolgreichem XML-Parse am `Project`-Endelement gewählt; alle vorhandenen Bytes außerhalb des neuen Blocks bleiben erhalten. Die Vorschau zeigt Aktion, Ownership, alten/neuen Hash, Backupbedarf, Konflikt und exakten Diff bestehender Dateien.

## 10. Installation, Update und Deinstallation

Die M78-Prinzipien werden wiederverwendet: aktuelle Preview-ID, ausdrückliche Bestätigung, eine Transaktion je Zielroot, Staging/Backups im Managerbereich, Flush-to-disk und atomarer Replace/Move. Nach den Writes müssen Zielprojektbuild, Registry-/Adaptervertrag, normaler Ziel-App-Start sowie der lokale HostAdapter-Start mit echtem Registryabruf grün sein; erst danach gilt die Installation als erfolgreich. Reanalyse vergleicht Inventare, übernimmt nur eindeutig wiedererkennbare frühere Entscheidungen und lässt neue Elemente ungeprüft. Deinstallation entfernt eigene Dateien und stellt die ursprüngliche Projektdatei aus dem persistenten Originalbackup bytegleich wieder her. Profile, Fachwerte und fremde Dateien liegen außerhalb des Ownershipumfangs.

## 11. Git-Sicherheit

Git wird ausschließlich mit `rev-parse` und `status --porcelain` gelesen. Eine uncommittete Änderung an einer betroffenen Datei blockiert vor Staging. M79 führt weder Commit, Reset, Clean, Checkout noch Stash aus. Ohne Git gelten Hashinventar und Backup als alleinige Sicherheitsbasis.

## 12. Nachweis und Nicht-Ziele

`--existing-app-registration-diagnostic` verwendet eine echte Bestands-App-Kopie, echte Dateien, echte Builds, sichtbare WPF-Prozesse, provozierte Installations-/Updatefehler, Git-Dirty-Konflikt, Reanalyse, Update, Deinstallation und Hashvergleiche. Der Zielprozess stellt Registry, Layoutzustand und validierte Layoutänderungen ausschließlich über eine lokale Named Pipe bereit. Der Manager öffnet daran den vorhandenen nativen M77-UI-/PDF-Editor, ändert ein registriertes Element, speichert und restauriert das App-spezifische UI-Profil und erzeugt eine echte mehrseitige PDF. Zusätzlich bleibt die vorhandene M77-UI-/PDF-Diagnose grün. Browser, WebView, Server, HTTP, WebSocket, Cloud, Telemetrie, Binärausführung während Analyse, Fachaktionsausführung, weitere Frameworkclaims und automatische Bestätigung sind ausgeschlossen.
