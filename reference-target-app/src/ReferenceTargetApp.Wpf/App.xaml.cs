using System.Diagnostics;
using System.IO;
using System.Windows;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.UI.Views;

namespace ReferenceTargetApp;

public partial class App : Application
{
    private const string DiagnosticArgument = "--layout-persistence-diagnostic";
    private const string PhasePrefix = "--layout-persistence-phase=";
    private const string RootPrefix = "--layout-persistence-root=";
    private const string FullOperationDiagnosticArgument = "--ui-full-operation-diagnostic";
    private const string FullOperationPhasePrefix = "--ui-full-operation-phase=";

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        if (e.Args.Contains(DiagnosticArgument, StringComparer.Ordinal))
        {
            ShutdownMode = ShutdownMode.OnExplicitShutdown;
            _ = RunLayoutPersistenceDiagnosticAsync();
            return;
        }
        if (e.Args.Contains(FullOperationDiagnosticArgument, StringComparer.Ordinal))
        {
            ShutdownMode = ShutdownMode.OnExplicitShutdown;
            _ = RunFullOperationDiagnosticAsync();
            return;
        }

        var root = ArgumentValue(e.Args, RootPrefix);
        var options = root is null ? LayoutStoragePathResolver.ResolveDefault() : LayoutStoragePathResolver.ForRoot(root);
        MainWindow = new MainWindow(new AtomicJsonLayoutStore(options), LayoutPersistencePhase(e.Args) is not null);
        MainWindow.Show();
    }

    private async Task RunFullOperationDiagnosticAsync()
    {
        var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "UI-Editor-kit", "ReferenceTargetApp", "diagnostics", $"m75-{Guid.NewGuid():N}");
        try
        {
            Directory.CreateDirectory(root);
            var save = await RunDiagnosticPhaseAsync("m75-save", root, FullOperationPhasePrefix, TimeSpan.FromSeconds(40));
            if (save != 0) { Shutdown(save); return; }
            var verify = await RunDiagnosticPhaseAsync("m75-verify", root, FullOperationPhasePrefix, TimeSpan.FromSeconds(60));
            Shutdown(verify);
        }
        catch { Shutdown(99); }
        finally
        {
            try { if (Directory.Exists(root)) Directory.Delete(root, true); }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { }
        }
    }

    private async Task RunLayoutPersistenceDiagnosticAsync()
    {
        var root = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "UI-Editor-kit",
            "ReferenceTargetApp",
            "diagnostics",
            $"m73-5-{Guid.NewGuid():N}");
        try
        {
            Directory.CreateDirectory(root);
            var saveExitCode = await RunDiagnosticPhaseAsync("save", root);
            if (saveExitCode != 0)
            {
                Shutdown(saveExitCode);
                return;
            }

            var verifyExitCode = await RunDiagnosticPhaseAsync("verify", root);
            Shutdown(verifyExitCode);
        }
        catch
        {
            Shutdown(79);
        }
        finally
        {
            try { if (Directory.Exists(root)) Directory.Delete(root, recursive: true); }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
    }

    private static async Task<int> RunDiagnosticPhaseAsync(string phase, string root)
        => await RunDiagnosticPhaseAsync(phase, root, PhasePrefix, TimeSpan.FromSeconds(20));

    private static async Task<int> RunDiagnosticPhaseAsync(string phase, string root, string phasePrefix, TimeSpan timeoutValue)
    {
        var executable = Environment.ProcessPath
            ?? throw new InvalidOperationException("Pfad des WPF-Prozesses ist nicht verfügbar.");
        var startInfo = new ProcessStartInfo
        {
            FileName = executable,
            UseShellExecute = false,
            WorkingDirectory = AppContext.BaseDirectory
        };
        startInfo.ArgumentList.Add($"{phasePrefix}{phase}");
        startInfo.ArgumentList.Add($"{RootPrefix}{root}");
        using var process = Process.Start(startInfo)
            ?? throw new InvalidOperationException("Diagnose-Kindprozess konnte nicht gestartet werden.");
        using var timeout = new CancellationTokenSource(timeoutValue);
        try
        {
            await process.WaitForExitAsync(timeout.Token);
        }
        catch (OperationCanceledException)
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
            await process.WaitForExitAsync(CancellationToken.None);
            return 78;
        }
        return process.ExitCode;
    }

    internal static string? LayoutPersistencePhase(string[] args) => ArgumentValue(args, PhasePrefix);
    internal static string? UiFullOperationPhase(string[] args) => ArgumentValue(args, FullOperationPhasePrefix);

    private static string? ArgumentValue(IEnumerable<string> args, string prefix) => args
        .FirstOrDefault(argument => argument.StartsWith(prefix, StringComparison.Ordinal))?
        [prefix.Length..];
}
