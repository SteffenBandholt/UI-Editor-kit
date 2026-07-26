# M79-WPF-Frameworkadapter

## Belegter Umfang

Unterstützt werden lokale SDK-basierte C#-/WPF-Projekte mit genau einer ausdrücklich ausgewählten `.csproj`, `UseWPF=true`, einem Windows-TargetFramework sowie XAML und C#. `.sln`/`.slnx` dienen nur als Auswahlkontext; bei mehreren Projekten muss die konkrete WPF-`.csproj` gewählt werden. Der Status für andere Frameworks lautet `Framework derzeit nicht unterstützt`.

## Adapterausgabe

Der neutrale `IExistingProjectAdapter` liefert Framework, Projekt, XAML-/C#-Fundstellen, Views, Controls, deklarierte Namen, statische Parents, Bindings, Ereignisse, Actionrisiken, Vertrauen, Warnungen, Blocker und unterstützte Änderungspfade. WPF-Logik liegt in `Infrastructure`, nicht in Domain/Core oder der Manageroberfläche.

## XAML

`StructuredXamlSourceAnalyzer` verwendet einen XML-Baum mit Zeileninformationen. Property-Elemente werden nicht als Controls erfunden. `DataGrid` und deklarierte Spalten bleiben strukturell verbunden. Unbenannte Controls, Templates und dynamische Items werden unsicher markiert. Namespaces, Attribute, Bindings, Commands, Events, Ressourcen und sichtbare Texte werden nicht verändert.

## C#

`RoslynCSharpSourceAnalyzer` verwendet `CSharpSyntaxTree.ParseText` und ausschließlich Syntaxknoten. Methodennamen, Invocation-Ausdrücke und `ICommand`-Properties liefern begrenzte Risikohinweise. Es gibt keinen AssemblyLoad, keine Reflection, keine Ausführung, keinen Build während Analyse und keine Regex-basierte Primärinterpretation.

## Kontrollierte Integration

Der feste Generator schreibt einen source-kompatiblen WPF-HostAdapter in einen eigenen M79-Ordner und bindet ihn mit einem additiven `Compile Include` ein. Auflösung erfolgt nur über bestätigte deklarierte Namen und bestätigte WPF-Namescopes; fehlende Referenzen liefern `element_ref_missing`. Der Adapter akzeptiert nur Registry-Layoutoperationen, sichert den Elementzustand und rollt bei Fehler zurück. Commands und Handler werden nie aufgerufen.

Nur der explizite Prozessparameter `--ui-editor-kit-host-pipe=<zufälliger lokaler Name>` aktiviert die generierte Prozessbrücke. Sie transportiert ausschließlich Registry-, LayoutState-, ChangeRequest- und ChangeResult-DTOs über eine lokale Named Pipe. Der vorhandene M77-Editor wird als wiederverwendete native WPF-Komponente im Manager geöffnet; es gibt weder einen zweiten Editor-Core noch Server-, Netzwerk- oder Browsercode.
