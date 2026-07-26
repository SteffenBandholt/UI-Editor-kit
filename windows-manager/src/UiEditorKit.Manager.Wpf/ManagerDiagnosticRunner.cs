using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using System.Windows;
using UiEditorKit.Manager.Core;
using UiEditorKit.Manager.Domain;
using UiEditorKit.Manager.Infrastructure;

namespace UiEditorKit.Manager.Wpf;

internal sealed class ManagerDiagnosticRunner
{
    private sealed class Fault(int failAt) : IManagerFaultInjector { public void BeforeFileWrite(int index, string relativePath) { if (index == failAt) throw new InvalidOperationException("M78 provozierter Transaktionsfehler"); } }

    public async Task<bool> RunAsync(string repositoryRoot, Window visibleWindow)
    {
        await Task.Delay(500); // Das native Managerfenster ist sichtbar gerendert.
        var repo = Path.GetFullPath(repositoryRoot);
        if (!File.Exists(Path.Combine(repo, "STATUS.md"))) throw new InvalidOperationException("Repository-Root ist ungültig.");
        var paths = ManagerPaths.ForDefault(); paths.Ensure();
        if (!ManagerPathRules.IsInside(paths.App, AppContext.BaseDirectory)) throw new InvalidOperationException("Diagnose muss aus der veröffentlichten LocalAppData-Managerinstallation laufen.");
        var diagnostic = Path.Combine(paths.Diagnostics, "m78-" + Guid.NewGuid().ToString("N"));
        var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        var target = Path.Combine(diagnostic, "PreparedTarget");
        var failedTarget = Path.Combine(diagnostic, "FailedTarget");
        var package = Path.Combine(diagnostic, "Package");
        Directory.CreateDirectory(diagnostic);
        var shortcut = new DesktopShortcutService();
        try
        {
            CopyTree(Path.Combine(repo, "reference-target-app"), target, ["bin", "obj"]);
            // Die neue vorbereitete App bringt den bereits freigegebenen neutralen Editor-Runtimevertrag mit;
            // der Manager errät oder erzeugt ihn nicht.
            CopyTree(Path.Combine(repo, "src"), Path.Combine(target, "src"), []);
            File.Copy(Path.Combine(repo, "package.json"), Path.Combine(target, "package.json"), true);
            CopyTree(Path.Combine(repo, "windows-manager", "fixtures", "M78PreparedTarget"), target, []);
            CopyTree(target, failedTarget, ["bin", "obj"]);
            CopyTree(Path.Combine(AppContext.BaseDirectory, "packages", "current"), package, []);
            var shortcutResult = shortcut.Create(Environment.ProcessPath!, AppContext.BaseDirectory, desktop);
            Require(shortcutResult.Success && shortcut.IsOwned(shortcut.ShortcutPath(desktop)), "Desktop-Verknüpfung");

            var pathsForDiagnostic = ManagerPaths.ForRoot(Path.Combine(diagnostic, "ManagerData")); pathsForDiagnostic.Ensure();
            var inspector = new TargetAppInspector(pathsForDiagnostic);
            var store = new KnownTargetAppsStore(pathsForDiagnostic);
            var logger = new ManagerLogger(pathsForDiagnostic);
            var service = new TargetInstallationService(pathsForDiagnostic, inspector, new(package));
            var foreign = Path.Combine(target, "foreign-protection.txt");
            var foreignHash = await Hashing.FileAsync(foreign);
            var projectHash = await Hashing.FileAsync(Path.Combine(target, "ReferenceTargetApp.slnx"));

            var legacy = Directory.CreateDirectory(Path.Combine(diagnostic, "LegacyWithoutOptIn")).FullName;
            var rejected = await inspector.CheckAsync(legacy);
            Require(!rejected.Success && rejected.Code == ManagerErrorCodes.TargetNotM78Compatible, "nicht vorbereitete App wird abgewiesen");
            var selectedByFolder = await inspector.CheckAsync(target);
            var selectedByProject = await inspector.CheckAsync(Path.Combine(target, "ReferenceTargetApp.slnx"));
            Require(selectedByFolder.Success && selectedByProject.Success && selectedByFolder.Writable, "Ordner-/Projektwahl und Schreibprüfung");
            Require(!Directory.EnumerateFiles(target, "*.tmp", SearchOption.AllDirectories).Any(), "Schreibprobe ohne Rückstand");
            await store.UpsertAsync(ToKnown(selectedByFolder));

            var failedService = new TargetInstallationService(pathsForDiagnostic, inspector, new(package));
            var failedPreview = await failedService.PreviewAsync(failedTarget);
            Require(failedPreview.Plan is not null && (await failedService.ExecuteAsync(failedPreview.Plan, true, new Fault(0))).Success == false, "Installationsfehler ausgelöst");
            Require((await inspector.CheckAsync(failedTarget)).Installation is null && await Hashing.FileAsync(Path.Combine(failedTarget, "foreign-protection.txt")) == foreignHash, "Installationsrollback");

            var installPreview = await service.PreviewAsync(target);
            Require(installPreview.Plan is { CanExecute: true } && installPreview.Plan.Files.All(file => file.Action == InstallationAction.Create), "Installationsvorschau");
            var installPlan = installPreview.Plan!;
            Require(!(await service.ExecuteAsync(installPlan, false)).Success, "Bestätigungspflicht");
            Require((await service.ExecuteAsync(installPlan, true)).Success, "Installation");
            Require((await inspector.CheckAsync(target)).Status == TargetContractStatus.Installed, "Vertragsstatus installiert");
            Require(await Hashing.FileAsync(foreign) == foreignHash && await Hashing.FileAsync(Path.Combine(target, "ReferenceTargetApp.slnx")) == projectHash, "fremde Dateien bytegleich");

            var profile = Path.Combine(target, "profiles", "ui-pdf-layout.json"); Directory.CreateDirectory(Path.GetDirectoryName(profile)!); await File.WriteAllTextAsync(profile, "{\"ui\":true,\"pdf\":true}"); var profileHash = await Hashing.FileAsync(profile);
            await MakeUpdatePackageAsync(package);
            var updatePreview = await service.PreviewAsync(target);
            Require(updatePreview.Plan is { CanExecute: true } && updatePreview.Plan.Files.Any(file => file.Action == InstallationAction.Update), "Updatevorschau");
            var updatePlan = updatePreview.Plan!;
            var beforeUpdate = await Hashing.FileAsync(Path.Combine(target, ".ui-editor-kit", "README.md"));
            var failedUpdate = await service.ExecuteAsync(updatePlan, true, new Fault(1));
            Require(!failedUpdate.Success && failedUpdate.RollbackSucceeded && await Hashing.FileAsync(Path.Combine(target, ".ui-editor-kit", "README.md")) == beforeUpdate, "Updaterollback");
            updatePreview = await service.PreviewAsync(target);
            Require((await service.ExecuteAsync(updatePreview.Plan!, true)).Success && (await inspector.LoadInstallationAsync(target))!.InstalledPackageVersion == "1.1.0", "Update");

            Require(await RunProcessAsync(target, "--pdf-model-diagnostic") == 0, "Ziel-App-Start");
            var editorExit = await RunProcessAsync(target, "--ui-pdf-end-to-end-diagnostic");
            Require(editorExit == 0, "Editorstart und UI-/PDF-Restore, Exitcode " + editorExit);
            Require(visibleWindow.IsVisible, "Manager bleibt beim Prozessstart geöffnet");

            var uninstallPreview = await service.UninstallPreviewAsync(target);
            Require(uninstallPreview.Plan is { CanExecute: true } && (await service.UninstallAsync(uninstallPreview.Plan, true)).Success, "Deinstallation");
            var uninstallPlan = uninstallPreview.Plan!;
            Require(await Hashing.FileAsync(foreign) == foreignHash && await Hashing.FileAsync(profile) == profileHash && await Hashing.FileAsync(Path.Combine(target, "ReferenceTargetApp.slnx")) == projectHash, "Projekt/Fremddatei/Profile erhalten");
            await logger.WriteAsync(new(DateTimeOffset.UtcNow, ManagerOperation.Uninstall, selectedByFolder.Manifest!.ApplicationId, target, true, "m78_diagnostic_complete", null, "1.1.0", uninstallPlan.Files.Count));
            Require((await logger.ReadAsync()).Any(entry => entry.Code == "m78_diagnostic_complete"), "strukturiertes Protokoll");
            return true;
        }
        finally
        {
            shortcut.Remove(desktop);
            await Task.Delay(100);
            try { if (Directory.Exists(diagnostic)) Directory.Delete(diagnostic, true); } catch { }
            try { if (Directory.Exists(paths.Diagnostics) && !Directory.EnumerateFileSystemEntries(paths.Diagnostics).Any()) Directory.Delete(paths.Diagnostics); } catch { }
        }
    }

    private static async Task MakeUpdatePackageAsync(string package)
    {
        var readme = Path.Combine(package, "files", "README.md");
        await File.AppendAllTextAsync(readme, Environment.NewLine + "M78 Update 1.1.0");
        var properties = Path.Combine(package, "files", "UiEditorKit.ManagerIntegration.props");
        await File.AppendAllTextAsync(properties, Environment.NewLine + "<!-- Paket 1.1.0 -->");
        var manifestPath = Path.Combine(package, "package.json");
        using var document = JsonDocument.Parse(await File.ReadAllTextAsync(manifestPath));
        var files = document.RootElement.GetProperty("files").EnumerateArray().Select(file => new PackageFile(
            file.GetProperty("relativePath").GetString()!, file.GetProperty("sourcePath").GetString()!,
            HashFile(Path.Combine(package, file.GetProperty("sourcePath").GetString()!.Replace('/', Path.DirectorySeparatorChar))), file.GetProperty("action").GetString()!)).ToArray();
        var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = true };
        await File.WriteAllTextAsync(manifestPath, JsonSerializer.Serialize(new IntegrationPackage(1, "1.1.0", "1.0", files), options));
    }
    private static string HashFile(string path) { using var stream = File.OpenRead(path); return Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant(); }
    private static async Task<int> RunProcessAsync(string target, string argument)
    {
        var start = new ProcessStartInfo("dotnet") { WorkingDirectory = target, UseShellExecute = false };
        start.ArgumentList.Add("run"); start.ArgumentList.Add("--project"); start.ArgumentList.Add(Path.Combine(target, "src", "ReferenceTargetApp.Wpf", "ReferenceTargetApp.Wpf.csproj")); start.ArgumentList.Add("--"); start.ArgumentList.Add(argument);
        using var process = Process.Start(start) ?? throw new InvalidOperationException("Zielprozess konnte nicht gestartet werden.");
        using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(4)); await process.WaitForExitAsync(timeout.Token); return process.ExitCode;
    }
    private static void CopyTree(string source, string target, IReadOnlyCollection<string> excludedDirectories)
    {
        Directory.CreateDirectory(target);
        foreach (var file in Directory.EnumerateFiles(source)) File.Copy(file, Path.Combine(target, Path.GetFileName(file)), true);
        foreach (var directory in Directory.EnumerateDirectories(source)) if (!excludedDirectories.Contains(Path.GetFileName(directory), StringComparer.OrdinalIgnoreCase)) CopyTree(directory, Path.Combine(target, Path.GetFileName(directory)), excludedDirectories);
    }
    private static KnownTargetApp ToKnown(TargetCheckResult value) => new(value.Manifest!.ApplicationId, value.Manifest.DisplayName, value.TargetRoot, value.Manifest.ProjectFile, value.ManifestPath, value.Manifest.SupportedEditorContractVersion, value.Status, null, value.CheckedAt, null, null);
    private static void Require(bool condition, string step) { if (!condition) throw new InvalidOperationException("M78-Diagnoseschritt fehlgeschlagen: " + step); }
}
