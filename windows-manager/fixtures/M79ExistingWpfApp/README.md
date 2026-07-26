# Kontrollierte M79-Bestands-App

Diese SDK-basierte C#-/WPF-Fixture simuliert eine bereits vorhandene lokale Anwendung. Sie besitzt bewusst kein `ui-editor-target.json`, keine Registry, keinen HostAdapter und keine Editoraktivierung. Zwei XAML-Views enthalten verschachtelte Container, benannte und unbenannte Controls, Tabelle und Spalten, Click-Handler, `ICommand`-Bindings sowie eine unsichere DataTemplate-Struktur. `foreign-protection.txt` und der vorhandene `None`-Eintrag in der Projektdatei sind fremdes Eigentum.

Die vorhandenen Click-/Command-Fachaktionen schreiben nur bei echter Ausführung den Diagnosemarker `business-action-executed.txt`. Der M79-End-to-End-Nachweis ändert über den generierten HostAdapter ausschließlich Layout und bestätigt, dass dieser Marker nicht entsteht. Nach Deinstallation werden Projektdatei und vollständiges Ausgangsinventar bytegleich geprüft; die Fixture enthält dauerhaft keine generierten M79-Dateien.

Alle sichtbaren Werte sind kontrollierte Testwerte. Die App muss vor Registrierung, nach Registrierung und nach Deinstallation mit `dotnet build ExistingWpfApp.csproj` baubar bleiben. Diagnosekopien werden ausschließlich im Manager-Diagnosebereich erzeugt und vollständig entfernt.
