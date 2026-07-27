using System.Threading;
using System.IO;
using System.Windows;
using UiEditorKit.Manager.Core;
using UiEditorKit.Manager.Infrastructure;
using ReferenceTargetApp.EditorIntegration.Electron;
using ReferenceTargetApp.UI.Editor;

namespace UiEditorKit.Manager.Wpf;

public partial class App : Application
{
    private Mutex? instanceMutex;
    private bool ownsInstanceMutex;
    private ElectronTargetEditorSession? electronEditorSession;
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        if (e.Args.Contains("--electron-target-editor", StringComparer.Ordinal))
        {
            StartElectronTargetEditor(e.Args);
            return;
        }
        instanceMutex = new(true, "Local\\UIEditorKit.M78.Manager", out var created);
        ownsInstanceMutex = created;
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
        else if (e.Args.Contains("--existing-app-registration-diagnostic", StringComparer.Ordinal))
        {
            ShutdownMode = ShutdownMode.OnExplicitShutdown;
            _ = RunRegistrationDiagnosticAsync(window, e.Args);
        }
    }
    private void StartElectronTargetEditor(string[] args)
    {
        try
        {
        var applicationId = Required(args, "--application-id=");
        var mutexSuffix = new string(applicationId.Select(character => char.IsLetterOrDigit(character) ? character : '_').ToArray());
        instanceMutex = new(true, "Local\\UIEditorKit.M80.Electron." + mutexSuffix, out var created);
        ownsInstanceMutex = created;
        if (!created)
        {
            MessageBox.Show("Der UI-Editor für diese Ziel-App läuft bereits.", "UI-Editor", MessageBoxButton.OK, MessageBoxImage.Information);
            Shutdown(80);
            return;
        }
        ShutdownMode = ShutdownMode.OnExplicitShutdown;
        _ = RunElectronTargetEditorAsync(
            Required(args, "--pipe-name="),
            Required(args, "--session-nonce="),
            applicationId,
            Required(args, "--profile-root="),
            Required(args, "--editor-runtime-root="));
        }
        catch (ElectronEditorException exception)
        {
            MessageBox.Show($"Der UI-Editor konnte nicht gestartet werden.\n\nTechnischer Code: {exception.Code}",
                "UI-Editor", MessageBoxButton.OK, MessageBoxImage.Error);
            Shutdown(82);
        }
    }

    private async Task RunElectronTargetEditorAsync(
        string pipeName,
        string nonce,
        string applicationId,
        string profileRoot,
        string editorRuntimeRoot)
    {
        try
        {
            electronEditorSession = await ElectronTargetEditorSession.OpenAsync(
                pipeName, nonce, applicationId, profileRoot, editorRuntimeRoot);
            electronEditorSession.Closed += ElectronEditorSession_Closed;
        }
        catch (ElectronEditorException exception)
        {
            await WriteElectronDiagnosticAsync(profileRoot, exception);
            if (exception.Code == ElectronEditorErrorCodes.ProfileUserCancelled)
            {
                Shutdown(0);
                return;
            }
            var profileCodes = new HashSet<string>(StringComparer.Ordinal)
            {
                ElectronEditorErrorCodes.ProfileIncompatible,
                ElectronEditorErrorCodes.ProfileCorrupt,
                ElectronEditorErrorCodes.ProfileMigrationFailed,
                ElectronEditorErrorCodes.ProfileArchiveFailed,
                ElectronEditorErrorCodes.UiProfileRestoreFailed,
                ElectronEditorErrorCodes.PdfProfileRestoreFailed
            };
            var message = profileCodes.Contains(exception.Code)
                ? "Das gespeicherte Editorlayout konnte nicht sicher vorbereitet werden. Das vorhandene Profil wurde nicht stillschweigend überschrieben."
                : "Der UI-Editor konnte nicht gestartet werden.";
            MessageBox.Show($"{message}\n\nTechnischer Code: {exception.Code}",
                "UI-Editor", MessageBoxButton.OK, MessageBoxImage.Error);
            Shutdown(profileCodes.Contains(exception.Code) ? 83 : 81);
        }
        catch (Exception exception)
        {
            await WriteElectronDiagnosticAsync(profileRoot, exception);
            MessageBox.Show($"Der UI-Editor konnte nicht gestartet werden.\n\nTechnischer Code: {ElectronEditorErrorCodes.EditorStartFailed}",
                "UI-Editor", MessageBoxButton.OK, MessageBoxImage.Error);
            Shutdown(82);
        }
    }

    private static async Task WriteElectronDiagnosticAsync(string profileRoot, Exception exception)
    {
        try
        {
            var diagnosticDirectory = Path.Combine(profileRoot, "diagnostics");
            Directory.CreateDirectory(diagnosticDirectory);
            await File.WriteAllTextAsync(Path.Combine(diagnosticDirectory, "m80-last-error.log"), exception.ToString());
        }
        catch { }
    }

    private void ElectronEditorSession_Closed(object? sender, EventArgs e) => Shutdown(0);

    private static string Required(IReadOnlyList<string> args, string prefix)
    {
        var value = args.FirstOrDefault(argument => argument.StartsWith(prefix, StringComparison.Ordinal))?[prefix.Length..];
        if (string.IsNullOrWhiteSpace(value))
            throw new ElectronEditorException(ElectronEditorErrorCodes.EditorStartFailed, "Vertrauenswürdiger Startparameter fehlt.");
        return value;
    }
    private async Task RunRegistrationDiagnosticAsync(MainWindow window, string[] args)
    {
        var prefix = "--repository-root=";
        var repositoryRoot = args.FirstOrDefault(arg => arg.StartsWith(prefix, StringComparison.Ordinal))?[prefix.Length..] ?? Environment.CurrentDirectory;
        try
        {
            var errorPath = Path.Combine(ManagerPaths.ForDefault().Logs, "m79-diagnostic-error.txt");
            if (File.Exists(errorPath)) File.Delete(errorPath);
            var result = await new ExistingAppRegistrationDiagnosticRunner().RunAsync(repositoryRoot, window);
            Shutdown(result ? 0 : 79);
        }
        catch (Exception exception)
        {
            var paths = ManagerPaths.ForDefault(); paths.Ensure();
            await File.WriteAllTextAsync(Path.Combine(paths.Logs, "m79-diagnostic-error.txt"), exception.ToString());
            Shutdown(179);
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
    protected override void OnExit(ExitEventArgs e)
    {
        if (electronEditorSession is not null) electronEditorSession.Closed -= ElectronEditorSession_Closed;
        if (ownsInstanceMutex) instanceMutex?.ReleaseMutex();
        instanceMutex?.Dispose();
        base.OnExit(e);
    }
}
