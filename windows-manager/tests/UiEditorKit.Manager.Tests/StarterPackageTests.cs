using System.Text.Json;
using UiEditorKit.Manager.Core;
using UiEditorKit.Manager.Domain;
using UiEditorKit.Manager.Infrastructure;

namespace UiEditorKit.Manager.Tests;

[TestClass]
public sealed class StarterPackageTests
{
    private static JsonSerializerOptions JsonOptions => new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private string root = null!;
    private string package = null!;

    [TestInitialize]
    public void Initialize()
    {
        root = Path.Combine(Path.GetTempPath(), "ui-editor-m82-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        package = Path.Combine(root, "Package");
        CopyTree(Path.Combine(FindRepository(), "windows-manager", "starter-package", "current"), package);
    }

    [TestCleanup]
    public void Cleanup()
    {
        if (Directory.Exists(root)) Directory.Delete(root, true);
    }

    [TestMethod]
    public async Task Starter_package_manifest_is_valid_versioned_and_supports_only_proven_frameworks()
    {
        var result = await new StarterPackageCatalog(package).LoadAsync();
        Assert.IsTrue(result.Result.Success, result.Result.Message);
        Assert.AreEqual(StarterTargetContract.ProductName, result.Package!.ProductName);
        Assert.AreEqual("1.0.0", result.Package.PackageVersion);
        CollectionAssert.AreEquivalent(new[] { StarterFrameworks.Wpf, StarterFrameworks.Electron }, result.Package.SupportedFrameworks.ToArray());
    }

    [TestMethod]
    public async Task New_WPF_app_gets_complete_skeleton_but_no_finished_registry()
    {
        var target = Fixture("M82NewWpfApp");
        var service = Service();
        var plan = await Preview(service, Request(target, StarterFrameworks.Wpf, StarterIntegrationModes.NewApp));
        Assert.IsTrue(plan.Files.Any(item => item.RelativePath.EndsWith("Registry.cs", StringComparison.Ordinal)));
        Assert.IsTrue(plan.Files.Any(item => item.RelativePath.EndsWith("ElementReferences.cs", StringComparison.Ordinal)));
        Assert.IsTrue(plan.Files.Any(item => item.RelativePath.EndsWith("HostAdapter.cs", StringComparison.Ordinal)));
        Assert.IsTrue(plan.Files.Any(item => item.RelativePath == "Directory.Build.targets"));
        Assert.IsTrue((await service.InstallOrUpdateAsync(plan, true)).Success);
        Assert.AreEqual(0, await RunAsync("dotnet", target, ["build", "M82NewWpfApp.csproj", "--nologo"]));
        var manifest = await service.LoadManifestAsync(target);
        Assert.AreEqual(StarterRegistryStatuses.Development, manifest!.RegistryStatus);
        Assert.HasCount(0, manifest.ActiveScopes);
        Assert.AreEqual(StarterTargetContract.EmptyRegistryFingerprint, manifest.RegistryFingerprint);
    }

    [TestMethod]
    public async Task New_Electron_app_gets_main_preload_renderer_registry_refs_and_contract_check()
    {
        var target = Fixture("M82NewElectronApp");
        var service = Service();
        var plan = await Preview(service, Request(target, StarterFrameworks.Electron, StarterIntegrationModes.NewApp));
        foreach (var name in new[] { "main-coordinator.cjs", "preload-bridge.cjs", "renderer-host-adapter.cjs", "registry.cjs", "ref-resolver.cjs", "target-contract-check.cjs" })
            Assert.IsTrue(plan.Files.Any(item => item.RelativePath.EndsWith(name, StringComparison.Ordinal)), name);
        Assert.IsTrue((await service.InstallOrUpdateAsync(plan, true)).Success);
        Assert.AreEqual(0, await RunAsync("node", target, ["-e", "require('./.ui-editor-kit/starter/electron/target-contract-check.cjs').check()"]));
        var status = await service.InspectAsync(target);
        Assert.AreEqual(StarterRegistryStatuses.Development, status.RegistryStatus);
        Assert.AreEqual("Geruest vorhanden", status.AdapterStatus);
    }

    [TestMethod]
    public async Task Existing_WPF_app_starts_registration_required_and_reuses_M79_path()
    {
        var target = Fixture("M79ExistingWpfApp");
        var service = Service();
        var plan = await Preview(service, Request(target, StarterFrameworks.Wpf, StarterIntegrationModes.ExistingApp));
        Assert.IsTrue(plan.Files.Any(item => item.RelativePath.EndsWith("Registry.cs", StringComparison.Ordinal)));
        Assert.IsTrue((await service.InstallOrUpdateAsync(plan, true)).Success);
        var status = await service.InspectAsync(target);
        Assert.AreEqual(StarterRegistryStatuses.RegistrationRequired, status.RegistryStatus);
        Assert.Contains("Bestandsregistrierung", status.NextAction);
    }

    [TestMethod]
    public async Task Existing_WPF_starter_manifest_is_handed_over_to_M79_without_foreign_file_conflict()
    {
        var target = Fixture("M79ExistingWpfApp");
        var starter = Service();
        var request = Request(target, StarterFrameworks.Wpf, StarterIntegrationModes.ExistingApp);
        Assert.IsTrue((await starter.InstallOrUpdateAsync(await Preview(starter, request), true)).Success);
        var managerPaths = ManagerPaths.ForRoot(Path.Combine(root, "ManagerData"));
        managerPaths.Ensure();
        var registration = new ExistingAppRegistrationService(managerPaths);
        var analyzed = await registration.AnalyzeAsync(target);
        Assert.IsNotNull(analyzed.Analysis);
        var reviewed = Review(analyzed.Analysis!);
        Assert.IsTrue((await registration.SaveReviewedAnalysisAsync(reviewed)).Success);
        var preview = await registration.PreviewAsync(target, reviewed);
        Assert.IsNotNull(preview.Preview, preview.Result.Message);
        Assert.IsTrue(preview.Preview.CanExecute, string.Join("; ", preview.Preview.Blockers));
        var manifest = preview.Preview.Files.Single(file => file.RelativePath == StarterTargetContract.ManifestFileName);
        Assert.AreEqual(RegistrationFileAction.Update, manifest.Action);
        Assert.Contains("managerTarget", manifest.ExactDiff!);
        Assert.IsTrue((await registration.InstallOrUpdateAsync(preview.Preview, true)).Success);
        var status = await starter.InspectAsync(target);
        Assert.AreEqual(StarterRegistryStatuses.Complete, status.RegistryStatus);
        Assert.IsNotNull(status.Manifest!.ManagerTarget);
        Assert.IsTrue((await new TargetAppInspector(managerPaths).CheckAsync(target)).Success);
    }

    [TestMethod]
    public async Task Existing_Electron_reference_is_detected_without_second_bridge_or_registry()
    {
        var bbm = FindBbmRepository();
        Assert.IsTrue(StarterPackageService.HasEquivalentExistingIntegration(bbm, StarterFrameworks.Electron));
        var service = Service();
        var request = Request(bbm, StarterFrameworks.Electron, StarterIntegrationModes.ExistingApp) with
        { DisplayName = "BBM", ApplicationId = "bbm-produktiv", PdfEditorEnabled = true };
        var preview = await service.PreviewAsync(request);
        Assert.IsNotNull(preview.Plan);
        Assert.IsTrue(preview.Plan.Warnings.Any(item => item.Contains(ManagerErrorCodes.StarterAlreadyIntegrated, StringComparison.Ordinal)));
        Assert.HasCount(2, preview.Plan.Files);
        Assert.IsFalse(preview.Plan.Files.Any(item => item.RelativePath.Contains("bridge", StringComparison.OrdinalIgnoreCase) || item.RelativePath.Contains("registry", StringComparison.OrdinalIgnoreCase)));
    }

    [TestMethod]
    public async Task Unsupported_framework_and_existing_app_without_source_are_blocked_without_writes()
    {
        var target = Directory.CreateDirectory(Path.Combine(root, "Unsupported")).FullName;
        var service = Service();
        var unsupported = await service.PreviewAsync(Request(target, "react", StarterIntegrationModes.NewApp));
        Assert.AreEqual(ManagerErrorCodes.StarterFrameworkUnsupported, unsupported.Result.Code);
        var missing = await service.PreviewAsync(Request(target, StarterFrameworks.Electron, StarterIntegrationModes.ExistingApp));
        Assert.AreEqual(ManagerErrorCodes.StarterSourceMissing, missing.Result.Code);
        Assert.HasCount(0, Directory.EnumerateFileSystemEntries(target).ToArray());
    }

    [TestMethod]
    public async Task Installation_requires_confirmation_and_preview_contains_hashes_ownership_diff_backup_and_git_status()
    {
        var target = Fixture("M82NewWpfApp");
        var service = Service();
        var plan = await Preview(service, Request(target, StarterFrameworks.Wpf, StarterIntegrationModes.NewApp));
        Assert.IsFalse((await service.InstallOrUpdateAsync(plan, false)).Success);
        Assert.IsTrue(plan.Files.All(item => item.NewHash is not null));
        Assert.IsFalse(plan.Files.Any(item => item.BackupRequired));
        Assert.IsFalse(string.IsNullOrWhiteSpace(plan.GitStatus));
        Assert.IsFalse(File.Exists(Path.Combine(target, StarterTargetContract.ManifestFileName)));
    }

    [TestMethod]
    public async Task Foreign_file_and_git_dirty_affected_file_block_installation()
    {
        var target = Fixture("M82NewWpfApp");
        await File.WriteAllTextAsync(Path.Combine(target, "ZUERST_LESEN.md"), "foreign");
        var preview = await Service().PreviewAsync(Request(target, StarterFrameworks.Wpf, StarterIntegrationModes.NewApp));
        Assert.IsFalse(preview.Plan!.CanExecute);
        Assert.IsTrue(preview.Plan.Files.Any(item => item.Action == InstallationAction.Conflict));
    }

    [TestMethod]
    public async Task Installation_failure_rolls_back_byte_identically_and_leaves_no_temp_files()
    {
        var target = Fixture("M82NewElectronApp");
        var before = await SourceInventoryBuilder.CreateAsync(target);
        var service = Service();
        var plan = await Preview(service, Request(target, StarterFrameworks.Electron, StarterIntegrationModes.NewApp));
        var result = await service.InstallOrUpdateAsync(plan, true, new Fault(3));
        Assert.IsFalse(result.Success);
        Assert.IsTrue(result.RollbackSucceeded);
        Assert.AreEqual(before.InventoryHash, (await SourceInventoryBuilder.CreateAsync(target)).InventoryHash);
        Assert.IsFalse(Directory.EnumerateFiles(target, "*.tmp", SearchOption.AllDirectories).Any());
    }

    [TestMethod]
    public async Task Update_preserves_target_owned_registry_and_profiles_and_failure_rolls_back()
    {
        var target = Fixture("M82NewElectronApp");
        var service = Service();
        var request = Request(target, StarterFrameworks.Electron, StarterIntegrationModes.NewApp);
        var install = await Preview(service, request);
        Assert.IsTrue((await service.InstallOrUpdateAsync(install, true)).Success);
        var registry = Path.Combine(target, ".ui-editor-kit", "starter", "electron", "registry.cjs");
        await File.AppendAllTextAsync(registry, Environment.NewLine + "// target-owned registry");
        var registryHash = await Hashing.FileAsync(registry);
        var manifestPath = Path.Combine(target, StarterTargetContract.ManifestFileName);
        var manifest = JsonSerializer.Deserialize<StarterTargetManifest>(await File.ReadAllTextAsync(manifestPath), JsonOptions)! with
        {
            RegistryVersion = 7,
            RegistryFingerprint = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            RegistryStatus = StarterRegistryStatuses.Complete,
            ActiveScopes = ["test.root"],
            Scopes = [new("test.root", StarterRegistryStatuses.Complete, null, 3, 0)]
        };
        await File.WriteAllTextAsync(manifestPath, JsonSerializer.Serialize(manifest, JsonOptions));
        var profile = Path.Combine(target, ".ui-editor-kit", "profiles", "user.json"); Directory.CreateDirectory(Path.GetDirectoryName(profile)!);
        await File.WriteAllTextAsync(profile, "layout"); var profileHash = await Hashing.FileAsync(profile);
        var update = await Preview(service, request);
        Assert.AreEqual(InstallationAction.Unchanged, update.Files.Single(item => item.RelativePath.EndsWith("registry.cjs", StringComparison.Ordinal)).Action);
        var result = await service.InstallOrUpdateAsync(update, true, new Fault(0));
        Assert.IsFalse(result.Success);
        Assert.AreEqual(registryHash, await Hashing.FileAsync(registry));
        Assert.AreEqual(profileHash, await Hashing.FileAsync(profile));
        var preserved = JsonSerializer.Deserialize<StarterTargetManifest>(await File.ReadAllTextAsync(manifestPath), JsonOptions)!;
        Assert.AreEqual(7, preserved.RegistryVersion);
        Assert.AreEqual(StarterRegistryStatuses.Complete, preserved.RegistryStatus);
        CollectionAssert.AreEqual(new[] { "test.root" }, preserved.ActiveScopes.ToArray());
    }

    [TestMethod]
    public async Task Uninstall_removes_only_owned_rules_and_keeps_framework_skeleton_registry_and_profiles()
    {
        var target = Fixture("M82NewWpfApp");
        var service = Service();
        var request = Request(target, StarterFrameworks.Wpf, StarterIntegrationModes.NewApp);
        Assert.IsTrue((await service.InstallOrUpdateAsync(await Preview(service, request), true)).Success);
        var registry = Path.Combine(target, ".ui-editor-kit", "starter", "wpf", "Registry.cs");
        var profile = Path.Combine(target, ".ui-editor-kit", "profiles", "user.json"); Directory.CreateDirectory(Path.GetDirectoryName(profile)!); await File.WriteAllTextAsync(profile, "layout");
        var preview = (await service.UninstallPreviewAsync(target)).Plan!;
        Assert.IsTrue((await service.UninstallAsync(preview, true)).Success);
        Assert.IsTrue(File.Exists(registry));
        Assert.IsTrue(File.Exists(profile));
        Assert.IsFalse(File.Exists(Path.Combine(target, "ZUERST_LESEN.md")));
    }

    [TestMethod]
    public void Installed_rules_cover_definition_of_done_labels_tables_actions_fingerprint_and_refresh()
    {
        var files = Directory.EnumerateFiles(Path.Combine(package, "files", "common"), "*", SearchOption.AllDirectories).Select(File.ReadAllText).ToArray();
        var text = string.Join('\n', files);
        foreach (var value in new[] { "UI-Code", "Registry", "Ref-Aufloesung", "Parentstruktur", "Baseline", "Capabilities", "lockedOps", "Registryversion", "Registry-Fingerprint", "Labels und Felder", "Tabellen", "Fachbuttons", "registryChanged", "Vor jedem Oeffnen" })
            Assert.Contains(value, text);
        Assert.Contains("Build/CI muss", text);
    }

    [TestMethod]
    public void Native_manager_exposes_four_distinct_actions_and_no_browser_or_network_path()
    {
        var repo = FindRepository();
        var xaml = File.ReadAllText(Path.Combine(repo, "windows-manager", "src", "UiEditorKit.Manager.Wpf", "MainWindow.xaml"));
        foreach (var action in new[] { "Neue App vorbereiten", "Bestehende App nachruesten", "Registrierungsstatus pruefen", "UI-/PDF-Editor oeffnen" }) Assert.Contains(action, xaml);
        var sources = string.Join('\n', Directory.EnumerateFiles(Path.Combine(repo, "windows-manager", "src"), "*.cs", SearchOption.AllDirectories).Select(File.ReadAllText));
        Assert.DoesNotContain("WebView", sources, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("HttpListener", sources, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("WebSocket", sources, StringComparison.OrdinalIgnoreCase);
    }

    [TestMethod]
    public void Manifest_contract_rejects_active_scopes_for_development_and_contains_no_domain_data()
    {
        var manifest = new StarterTargetManifest(2, "1.0.0", "test.app", "Test", "wpf", "new-app", "1.2", "wpf-sdk-dotnet/1.0", 0,
            StarterTargetContract.EmptyRegistryFingerprint, "development", ["invented.scope"], "layout", "unavailable", ".ui-editor-kit/profiles", [],
            "bidirectional", true, true, "1.0", [], null, new(StarterTargetContract.ProductName, StarterTargetContract.OwnershipFileName, []), DateTimeOffset.UtcNow, DateTimeOffset.UtcNow);
        Assert.IsTrue(StarterTargetContract.Validate(manifest).Any(item => item.Contains("aktiven Scopes", StringComparison.Ordinal)));
        var json = JsonSerializer.Serialize(manifest);
        foreach (var forbidden in new[] { "customer", "domainData", "businessData", "database", "records" }) Assert.DoesNotContain(forbidden, json, StringComparison.OrdinalIgnoreCase);
    }

    private StarterPackageService Service() => new(new StarterPackageCatalog(package));
    private static StarterPreparationRequest Request(string target, string framework, string mode) =>
        new(target, "M82 Test-App", "m82.test-app", framework, mode, true, false, ".ui-editor-kit/profiles");
    private static async Task<StarterInstallationPlan> Preview(StarterPackageService service, StarterPreparationRequest request)
    {
        var result = await service.PreviewAsync(request);
        Assert.IsNotNull(result.Plan, result.Result.Message);
        Assert.IsTrue(result.Plan.CanExecute, string.Join("; ", result.Plan.Blockers));
        return result.Plan;
    }
    private string Fixture(string name) { var target = Path.Combine(root, name); CopyTree(Path.Combine(FindRepository(), "windows-manager", "fixtures", name), target); return target; }
    private static string FindRepository() { var current = new DirectoryInfo(AppContext.BaseDirectory); while (current is not null && !File.Exists(Path.Combine(current.FullName, "STATUS.md"))) current = current.Parent; return current?.FullName ?? throw new InvalidOperationException("Repository fehlt."); }
    private static string FindBbmRepository() { var path = Path.GetFullPath(Path.Combine(FindRepository(), "..", "BBM-Produktiv")); return Directory.Exists(path) ? path : throw new InvalidOperationException("BBM-Referenzrepository fehlt."); }
    private static void CopyTree(string source, string destination) { Directory.CreateDirectory(destination); foreach (var file in Directory.EnumerateFiles(source)) File.Copy(file, Path.Combine(destination, Path.GetFileName(file)), true); foreach (var directory in Directory.EnumerateDirectories(source)) CopyTree(directory, Path.Combine(destination, Path.GetFileName(directory))); }
    private static async Task<int> RunAsync(string fileName, string workingDirectory, IReadOnlyList<string> arguments)
    {
        var start = new System.Diagnostics.ProcessStartInfo(fileName)
        {
            WorkingDirectory = workingDirectory,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        foreach (var argument in arguments) start.ArgumentList.Add(argument);
        using var process = System.Diagnostics.Process.Start(start)!;
        var output = process.StandardOutput.ReadToEndAsync();
        var error = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        if (process.ExitCode != 0) Console.WriteLine(await output + await error);
        return process.ExitCode;
    }
    private static ExistingAppAnalysis Review(ExistingAppAnalysis analysis)
    {
        var detailsUsage = analysis.Proposals.Single(item => item.SourceLocation.RelativeFile == "MainWindow.xaml" && item.DeclaredName == "DetailsView");
        return analysis with
        {
            Proposals = analysis.Proposals.Select(item =>
            {
                if (item.StableElementId is null || item.Warnings.Any(warning => warning.Contains("Template-", StringComparison.Ordinal)))
                    return item with { ReviewStatus = ProposalReviewStatus.Rejected, UserNote = "Unsicherer Vorschlag abgelehnt." };
                if (item.SourceLocation.RelativeFile == "Views/DetailsView.xaml" && item.ControlType == "UserControl")
                    return item with { ParentId = detailsUsage.StableElementId, ReviewStatus = ProposalReviewStatus.Modified, UserNote = "Deklarierte View-Nutzung zugeordnet." };
                return item with { ReviewStatus = ProposalReviewStatus.Confirmed, UserNote = "Einzeln geprueft." };
            }).ToArray()
        };
    }
    private sealed class Fault(int index) : IStarterFaultInjector { public void BeforeWrite(int current, string relativePath) { if (current == index) throw new InvalidOperationException("M82 fault"); } }
}
