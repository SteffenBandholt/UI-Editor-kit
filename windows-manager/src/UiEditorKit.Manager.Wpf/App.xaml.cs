using System.Threading;
using System.IO;
using System.Windows;
using UiEditorKit.Manager.Core;
using UiEditorKit.Manager.Infrastructure;

namespace UiEditorKit.Manager.Wpf;

public partial class App : Application
{
    private Mutex? instanceMutex;
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        instanceMutex = new(true, "Local\\UIEditorKit.M78.Manager", out var created);
        if (!created) { MessageBox.Show("Der UI-Editor Manager läuft bereits.", "UI-Editor Manager", MessageBoxButton.OK, MessageBoxImage.Information); Shutdown(2); return; }
        DispatcherUnhandledException += (_, args) => { MessageBox.Show(args.Exception.Message, "Managerfehler", MessageBoxButton.OK, MessageBoxImage.Error); args.Handled = true; };
        var window = new MainWindow();
        MainWindow = window;
        window.Show();
        var managerPaths = ManagerPaths.ForDefault();
        if (ManagerPathRules.IsInside(managerPaths.App, AppContext.BaseDirectory) && Environment.ProcessPath is { } executable)
            _ = new DesktopShortcutService().Create(executable, AppContext.BaseDirectory);
        if (e.Args.Contains("--manager-installer-diagnostic", StringComparer.Ordinal))
        {
            ShutdownMode = ShutdownMode.OnExplicitShutdown;
            _ = RunDiagnosticAsync(window, e.Args);
        }
    }
    private async Task RunDiagnosticAsync(Window window, string[] args)
    {
        var prefix = "--repository-root=";
        var repositoryRoot = args.FirstOrDefault(arg => arg.StartsWith(prefix, StringComparison.Ordinal))?[prefix.Length..] ?? Environment.CurrentDirectory;
        try
        {
            var errorPath = Path.Combine(ManagerPaths.ForDefault().Logs, "m78-diagnostic-error.txt");
            if (File.Exists(errorPath)) File.Delete(errorPath);
            var result = await new ManagerDiagnosticRunner().RunAsync(repositoryRoot, window);
            Shutdown(result ? 0 : 78);
        }
        catch (Exception exception)
        {
            var paths = ManagerPaths.ForDefault(); paths.Ensure();
            await File.WriteAllTextAsync(Path.Combine(paths.Logs, "m78-diagnostic-error.txt"), exception.ToString());
            Shutdown(178);
        }
    }
    protected override void OnExit(ExitEventArgs e) { instanceMutex?.ReleaseMutex(); instanceMutex?.Dispose(); base.OnExit(e); }
}
