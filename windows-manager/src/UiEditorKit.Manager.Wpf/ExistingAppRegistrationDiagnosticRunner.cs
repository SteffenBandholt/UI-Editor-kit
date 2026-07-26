using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows;
using ReferenceTargetApp.UI.Editor;
using UiEditorKit.Manager.Core;
using UiEditorKit.Manager.Domain;
using UiEditorKit.Manager.Infrastructure;

namespace UiEditorKit.Manager.Wpf;

internal sealed class ExistingAppRegistrationDiagnosticRunner
{
    private sealed class Fault(int failAt) : IRegistrationFaultInjector
    {
        public void BeforeWrite(int index, string relativePath)
        {
            if (index == failAt) throw new InvalidOperationException("M79 provozierter Transaktionsfehler");
        }
    }

    public async Task<bool> RunAsync(string repositoryRoot, MainWindow visibleWindow)
    {
        await Task.Delay(500);
        var repo = Path.GetFullPath(repositoryRoot);
        if (!File.Exists(Path.Combine(repo, "STATUS.md"))) throw new InvalidOperationException("Repository-Root ist ungültig.");
        var defaultPaths = ManagerPaths.ForDefault(); defaultPaths.Ensure();
        if (!ManagerPathRules.IsInside(defaultPaths.App, AppContext.BaseDirectory))
            throw new InvalidOperationException("M79-Diagnose muss aus der veröffentlichten LocalAppData-Managerinstallation laufen.");
        foreach (var previous in Directory.EnumerateDirectories(defaultPaths.Diagnostics, "m79-*", SearchOption.TopDirectoryOnly))
            DeleteTree(previous);
        var diagnostic = Path.Combine(defaultPaths.Diagnostics, "m79-" + Guid.NewGuid().ToString("N"));
        var target = Path.Combine(diagnostic, "ExistingApp");
        var failedTarget = Path.Combine(diagnostic, "FailedExistingApp");
        var dirtyTarget = Path.Combine(diagnostic, "DirtyExistingApp");
        Directory.CreateDirectory(diagnostic);
        var processes = new List<Process>();
        try
        {
            var fixture = Path.Combine(repo, "windows-manager", "fixtures", "M79ExistingWpfApp");
            CopyTree(fixture, target, ["bin", "obj"]); CopyTree(fixture, failedTarget, ["bin", "obj"]); CopyTree(fixture, dirtyTarget, ["bin", "obj"]);
            var profile = Path.Combine(target, "profiles", "ui-pdf-layout.json"); Directory.CreateDirectory(Path.GetDirectoryName(profile)!);
            await File.WriteAllTextAsync(profile, "{\"ui\":true,\"pdf\":true}");
            var profileHash = await Hashing.FileAsync(profile);
            var original = await SourceInventoryBuilder.CreateAsync(target);
            var foreignHash = await Hashing.FileAsync(Path.Combine(target, "foreign-protection.txt"));
            Require((await BuildAsync(target)).Success, "Bestands-App vor Registrierung bauen");
            await StartVisibleAndCloseAsync(target, [], processes, TimeSpan.FromSeconds(15));

            var paths = ManagerPaths.ForRoot(Path.Combine(diagnostic, "ManagerData")); paths.Ensure();
            var service = new ExistingAppRegistrationService(paths);
            var analyzed = await service.AnalyzeAsync(target);
            Require(analyzed.Result.Success && analyzed.TargetByteIdentical && analyzed.Analysis is not null, "read-only WPF-/Roslyn-/XAML-Analyse");
            Require((await SourceInventoryBuilder.CreateAsync(target)).InventoryHash == original.InventoryHash, "Hashinventar nach Analyse bytegleich");
            var reviewed = Review(analyzed.Analysis!);
            Require(RegistrationProposalValidator.Validate(reviewed.Proposals).Success, "manuell entschiedene Vorschläge und Parentstruktur");
            await service.SaveReviewedAnalysisAsync(reviewed);
            var preview = await service.PreviewAsync(target, reviewed);
            Require(preview.Preview is { CanExecute: true } && preview.Preview.Files.Any(item => item.ExactDiff?.Contains(StructuredProjectRegistrationEditor.Label) == true), "vollständige Änderungsvorschau mit exaktem Diff");
            visibleWindow.Dispatcher.Invoke(() => visibleWindow.ShowM79DiagnosticState(target, reviewed, preview.Preview, "Vorschau und Einzelentscheidungen sichtbar"));
            Require(!(await service.InstallOrUpdateAsync(preview.Preview!, false)).Success, "ausdrückliche Bestätigungspflicht");

            var failedService = new ExistingAppRegistrationService(paths);
            var failedAnalysis = Review((await failedService.AnalyzeAsync(failedTarget)).Analysis!);
            var failedPreview = (await failedService.PreviewAsync(failedTarget, failedAnalysis)).Preview!;
            var failedInstall = await failedService.InstallOrUpdateAsync(failedPreview, true, new Fault(2));
            Require(!failedInstall.Success && failedInstall.RollbackSucceeded &&
                    !File.Exists(Path.Combine(failedTarget, "ui-editor-target.json")), "Installationsfehler und vollständiger Rollback");

            var install = await service.InstallOrUpdateAsync(preview.Preview!, true);
            Require(install.Success, "transaktionale Installation, Build und Vertragscheck: " + install.Message);
            Require((await new TargetAppInspector(paths).CheckAsync(target)).Registration is not null, "M79-Vertragsstatus installiert");
            Require(await Hashing.FileAsync(Path.Combine(target, "foreign-protection.txt")) == foreignHash && await Hashing.FileAsync(profile) == profileHash,
                "Fremddatei und Profile nach Installation bytegleich");
            await StartVisibleAndCloseAsync(target, [], processes, TimeSpan.FromSeconds(15));
            var registeredElementId = reviewed.Proposals.Single(item => item.DeclaredName == "OrderNumberField").StableElementId!;
            var registeredProfileRoot = Path.Combine(diagnostic, "RegisteredProfiles");
            var firstEditorHost = service.StartEditorHost(target, (await service.LoadStateAsync(target))!);
            Require(firstEditorHost.Result.Success && firstEditorHost.Process is not null && firstEditorHost.PipeName is not null,
                "M79-Zielprozess für vorhandenen Editor starten");
            processes.Add(firstEditorHost.Process!);
            double savedWidth;
            await using (var editor = await RegisteredTargetEditorLauncher.OpenAsync(visibleWindow, firstEditorHost.PipeName!,
                             reviewed.ApplicationId, registeredProfileRoot, Path.Combine(AppContext.BaseDirectory, "editor-runtime")))
            {
                var exercise = await editor.ExerciseUiAndPdfAsync(registeredElementId);
                Require(exercise.UiChanged && exercise.UiSaved && exercise.PdfRendered && !exercise.UiDirty,
                    $"vorhandener UI-/PDF-Editor ändert registriertes Element und speichert Profil " +
                    $"(changed={exercise.UiChanged}, saved={exercise.UiSaved}, pdf={exercise.PdfRendered}, uiDirty={exercise.UiDirty}, pdfDirty={exercise.PdfDirty}, " +
                    $"width={exercise.WidthBefore}->{exercise.WidthAfter}, error={exercise.ErrorCode}:{exercise.ErrorMessage})");
                savedWidth = exercise.WidthAfter;
                Require(!File.Exists(Path.Combine(target, "business-action-executed.txt")),
                    "Editor löst keine Fachaktion der Bestands-App aus");
            }
            TryStop(firstEditorHost.Process!); processes.Remove(firstEditorHost.Process!);

            var secondEditorHost = service.StartEditorHost(target, (await service.LoadStateAsync(target))!);
            Require(secondEditorHost.Result.Success && secondEditorHost.Process is not null && secondEditorHost.PipeName is not null,
                "M79-Editorziel für Neustart-Restore erneut starten");
            processes.Add(secondEditorHost.Process!);
            await using (var restoredEditor = await RegisteredTargetEditorLauncher.OpenAsync(visibleWindow, secondEditorHost.PipeName!,
                             reviewed.ApplicationId, registeredProfileRoot, Path.Combine(AppContext.BaseDirectory, "editor-runtime")))
                Require(await restoredEditor.VerifyRestoredWidthAsync(registeredElementId, savedWidth),
                    "registriertes UI-Profil wird nach echtem Prozessneustart wiederhergestellt");
            TryStop(secondEditorHost.Process!); processes.Remove(secondEditorHost.Process!);

            var xamlPath = Path.Combine(target, "MainWindow.xaml");
            var originalXaml = await File.ReadAllBytesAsync(xamlPath);
            var xaml = await File.ReadAllTextAsync(xamlPath); var newline = xaml.Contains("\r\n", StringComparison.Ordinal) ? "\r\n" : "\n";
            xaml = xaml.Replace("  </Grid>" + newline + "</Window>", "    <TextBlock x:Name=\"M79AddedElement\" Text=\"Kontrolliert ergänzt\" />" + newline + "  </Grid>" + newline + "</Window>", StringComparison.Ordinal);
            await File.WriteAllTextAsync(xamlPath, xaml);
            Require((await service.PreviewAsync(target, reviewed)).Result.Code == ManagerErrorCodes.RegistrationAnalysisStale, "alte Analyse wird als veraltet erkannt");
            var updatedAnalysis = (await service.AnalyzeAsync(target)).Analysis!;
            Require(updatedAnalysis.Proposals.Any(item => item.DeclaredName == "M79AddedElement" && item.ReviewStatus == ProposalReviewStatus.Unreviewed), "neues Element bleibt ungeprüft");
            updatedAnalysis = Review(updatedAnalysis); await service.SaveReviewedAnalysisAsync(updatedAnalysis);
            var updatePreview = (await service.PreviewAsync(target, updatedAnalysis)).Preview!;
            var registryBeforeFailedUpdate = await Hashing.FileAsync(Path.Combine(target, ".ui-editor-kit", "registration-registry.json"));
            var failedUpdate = await service.InstallOrUpdateAsync(updatePreview, true, new Fault(0));
            Require(!failedUpdate.Success && failedUpdate.RollbackSucceeded &&
                    await Hashing.FileAsync(Path.Combine(target, ".ui-editor-kit", "registration-registry.json")) == registryBeforeFailedUpdate,
                "Updatefehler und vollständiger Rollback");
            updatePreview = (await service.PreviewAsync(target, updatedAnalysis)).Preview!;
            Require((await service.InstallOrUpdateAsync(updatePreview, true)).Success, "transaktionales Update");
            var updatedRegistryBytes = await File.ReadAllBytesAsync(Path.Combine(target, ".ui-editor-kit", "registration-registry.json"));
            Require(Encoding.UTF8.GetString(updatedRegistryBytes).Contains("m79addedelement", StringComparison.Ordinal),
                "neues bestätigtes Element ist nach Update registriert");
            await File.WriteAllBytesAsync(xamlPath, originalXaml);
            var removalAnalysis = (await service.AnalyzeAsync(target)).Analysis!;
            Require(removalAnalysis.Proposals.Any(item => item.DeclaredName == "M79AddedElement" &&
                                                           item.ReviewStatus == ProposalReviewStatus.ClarificationRequired),
                "verschwundenes bestätigtes Element bleibt als Waisenvorschlag sichtbar");
            removalAnalysis = Review(removalAnalysis); await service.SaveReviewedAnalysisAsync(removalAnalysis);
            var removalPreview = (await service.PreviewAsync(target, removalAnalysis)).Preview!;
            Require((await service.InstallOrUpdateAsync(removalPreview, true)).Success,
                "verwaistes Element wird erst nach ausdrücklicher Ablehnung aus Registry entfernt");

            await InitializeDirtyGitRepositoryAsync(dirtyTarget);
            var dirtyProject = Path.Combine(dirtyTarget, "ExistingWpfApp.csproj");
            await File.AppendAllTextAsync(dirtyProject, Environment.NewLine + "<!-- uncommittete kontrollierte Änderung -->");
            var dirtyAnalysis = Review((await service.AnalyzeAsync(dirtyTarget)).Analysis!);
            var dirtyPreview = await service.PreviewAsync(dirtyTarget, dirtyAnalysis);
            Require(dirtyPreview.Preview is { CanExecute: false } && dirtyPreview.Preview.Blockers.Any(item => item.Contains(ManagerErrorCodes.RegistrationGitDirtyConflict, StringComparison.Ordinal)),
                "Git-Dirty-Konflikt blockiert ohne Stagingrest");

            var uninstallPreview = await service.UninstallPreviewAsync(target);
            Require(uninstallPreview.Preview is { CanExecute: true } && uninstallPreview.Preview.Files.Any(item => item.Action == RegistrationFileAction.Update),
                "vollständige Deinstallationsvorschau");
            var uninstall = await service.UninstallAsync(uninstallPreview.Preview!, true);
            Require(uninstall.Success, "transaktionale Deinstallation: " + uninstall.Message);
            var restored = await SourceInventoryBuilder.CreateAsync(target);
            Require(restored.InventoryHash == original.InventoryHash && await Hashing.FileAsync(Path.Combine(target, "foreign-protection.txt")) == foreignHash &&
                    await Hashing.FileAsync(profile) == profileHash, "Originalprojekt, Fremddatei und Profile bytegleich");
            Require(Directory.Exists(registeredProfileRoot), "M79-UI-Profil bleibt nach Deinstallation erhalten");
            Require((await BuildAsync(target)).Success, "Bestands-App nach Deinstallation bauen");
            await StartVisibleAndCloseAsync(target, [], processes, TimeSpan.FromSeconds(15));

            var uiPdf = await RunProcessAsync(repo, Path.Combine(repo, "reference-target-app", "src", "ReferenceTargetApp.Wpf", "ReferenceTargetApp.Wpf.csproj"),
                ["--ui-pdf-end-to-end-diagnostic"], TimeSpan.FromMinutes(4));
            Require(uiPdf == 0, "bestehender gemeinsamer UI-/PDF-Editor und Profil-Restore");
            Require(!Directory.EnumerateFiles(target, "*.tmp", SearchOption.AllDirectories).Any() &&
                    !Directory.EnumerateFiles(failedTarget, "*.tmp", SearchOption.AllDirectories).Any(), "keine temporären Zieldateien");
            visibleWindow.Dispatcher.Invoke(() => visibleWindow.ShowM79DiagnosticState(target, reviewed, null, "vollständig erfolgreich"));
            return true;
        }
        finally
        {
            foreach (var process in processes) TryStop(process);
            await Task.Delay(150);
            try { DeleteTree(diagnostic); } catch { }
            try { if (Directory.Exists(defaultPaths.Diagnostics) && !Directory.EnumerateFileSystemEntries(defaultPaths.Diagnostics).Any()) Directory.Delete(defaultPaths.Diagnostics); } catch { }
        }
    }

    private static ExistingAppAnalysis Review(ExistingAppAnalysis analysis)
    {
        var detailsUsage = analysis.Proposals.Single(item => item.SourceLocation.RelativeFile == "MainWindow.xaml" && item.DeclaredName == "DetailsView");
        var proposals = analysis.Proposals.Select(item =>
        {
            if (item.Warnings.Any(warning => warning.Contains("Verwaister", StringComparison.Ordinal)))
                return item with { ReviewStatus = ProposalReviewStatus.Rejected, UserNote = "Verwaisten Eintrag ausdrücklich entfernt." };
            if (item.StableElementId is null || item.Warnings.Any(warning => warning.Contains("Template-", StringComparison.Ordinal)))
                return item with { ReviewStatus = ProposalReviewStatus.Rejected, UserNote = "Unsicherer Vorschlag manuell abgelehnt." };
            if (item.SourceLocation.RelativeFile == "Views/DetailsView.xaml" && item.ControlType == "UserControl")
                return item with { ParentId = detailsUsage.StableElementId, ReviewStatus = ProposalReviewStatus.Modified, UserNote = "Deklarierte View-Nutzung manuell zugeordnet." };
            return item with { ReviewStatus = item.ReviewStatus is ProposalReviewStatus.Confirmed or ProposalReviewStatus.Modified ? item.ReviewStatus : ProposalReviewStatus.Confirmed,
                UserNote = "Vorschlag einzeln geprüft und bestätigt." };
        }).ToArray();
        return analysis with { Proposals = proposals };
    }

    private static Task<ManagerResult> BuildAsync(string target) => new DotNetRegistrationBuildVerifier().BuildAsync(target, "ExistingWpfApp.csproj");

    private static async Task StartVisibleAndCloseAsync(string target, IReadOnlyList<string> arguments, ICollection<Process> processes, TimeSpan timeout)
    {
        var start = new ProcessStartInfo("dotnet") { WorkingDirectory = target, UseShellExecute = false };
        start.ArgumentList.Add("run"); start.ArgumentList.Add("--no-build"); start.ArgumentList.Add("--project"); start.ArgumentList.Add(Path.Combine(target, "ExistingWpfApp.csproj"));
        if (arguments.Count > 0) start.ArgumentList.Add("--"); foreach (var argument in arguments) start.ArgumentList.Add(argument);
        var process = Process.Start(start) ?? throw new InvalidOperationException("WPF-Bestands-App konnte nicht gestartet werden."); processes.Add(process);
        var until = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < until && !process.HasExited && !HasVisibleFixtureWindow()) await Task.Delay(100);
        Require(!process.HasExited, "echter WPF-Prozess bleibt sichtbar");
        Require(HasVisibleFixtureWindow(), "echtes Fenster der WPF-Bestands-App ist sichtbar");
        TryStop(process); processes.Remove(process);
    }

    private static bool HasVisibleFixtureWindow()
    {
        var candidates = Process.GetProcessesByName("M79ExistingWpfApp");
        try { return candidates.Any(candidate => candidate.MainWindowHandle != IntPtr.Zero); }
        finally { foreach (var candidate in candidates) candidate.Dispose(); }
    }

    private static async Task<int> RunProcessAsync(string workingDirectory, string project, IReadOnlyList<string> arguments, TimeSpan timeout)
    {
        var start = new ProcessStartInfo("dotnet") { WorkingDirectory = workingDirectory, UseShellExecute = false };
        start.ArgumentList.Add("run"); start.ArgumentList.Add("--project"); start.ArgumentList.Add(project); start.ArgumentList.Add("--");
        foreach (var argument in arguments) start.ArgumentList.Add(argument);
        using var process = Process.Start(start) ?? throw new InvalidOperationException("Diagnoseprozess konnte nicht gestartet werden.");
        using var cancellation = new CancellationTokenSource(timeout);
        try { await process.WaitForExitAsync(cancellation.Token); return process.ExitCode; }
        catch (OperationCanceledException) { if (!process.HasExited) process.Kill(true); await process.WaitForExitAsync(); return 179; }
    }

    private static async Task InitializeDirtyGitRepositoryAsync(string target)
    {
        foreach (var args in new[] { new[] { "init" }, new[] { "config", "user.email", "m79@example.invalid" }, new[] { "config", "user.name", "M79 Diagnostic" }, new[] { "add", "." }, new[] { "commit", "-m", "fixture baseline" } })
        {
            var start = new ProcessStartInfo("git") { WorkingDirectory = target, UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true };
            foreach (var arg in args) start.ArgumentList.Add(arg);
            using var process = Process.Start(start) ?? throw new InvalidOperationException("Git-Diagnose konnte nicht gestartet werden.");
            await process.WaitForExitAsync(); Require(process.ExitCode == 0, "Git-Diagnoseschritt " + string.Join(' ', args));
        }
    }

    private static void TryStop(Process process)
    {
        try
        {
            if (process.HasExited) return;
            if (process.CloseMainWindow() && process.WaitForExit(3000)) return;
            process.Kill(true); process.WaitForExit(5000);
        }
        catch { }
        finally { process.Dispose(); }
    }

    private static void CopyTree(string source, string target, IReadOnlyCollection<string> excludedDirectories)
    {
        Directory.CreateDirectory(target);
        foreach (var file in Directory.EnumerateFiles(source)) File.Copy(file, Path.Combine(target, Path.GetFileName(file)), true);
        foreach (var directory in Directory.EnumerateDirectories(source))
            if (!excludedDirectories.Contains(Path.GetFileName(directory), StringComparer.OrdinalIgnoreCase))
                CopyTree(directory, Path.Combine(target, Path.GetFileName(directory)), excludedDirectories);
    }

    private static void DeleteTree(string path)
    {
        if (!Directory.Exists(path)) return;
        foreach (var file in Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories))
            File.SetAttributes(file, FileAttributes.Normal);
        foreach (var directory in Directory.EnumerateDirectories(path, "*", SearchOption.AllDirectories))
            File.SetAttributes(directory, FileAttributes.Directory);
        Directory.Delete(path, true);
    }

    private static void Require(bool condition, string step)
    {
        if (!condition) throw new InvalidOperationException("M79-Diagnoseschritt fehlgeschlagen: " + step);
    }
}
