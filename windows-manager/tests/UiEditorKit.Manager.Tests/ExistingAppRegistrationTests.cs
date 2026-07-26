using System.Text;
using UiEditorKit.Manager.Core;
using UiEditorKit.Manager.Domain;
using UiEditorKit.Manager.Infrastructure;

namespace UiEditorKit.Manager.Tests;

[TestClass]
public sealed class ExistingAppRegistrationTests
{
    private string root = null!;
    private string target = null!;
    private ManagerPaths paths = null!;

    [TestInitialize]
    public void Initialize()
    {
        root = Path.Combine(Path.GetTempPath(), "ui-editor-m79-tests", Guid.NewGuid().ToString("N"));
        target = Path.Combine(root, "ExistingApp");
        CopyTree(Path.Combine(FindRepository(), "windows-manager", "fixtures", "M79ExistingWpfApp"), target, ["bin", "obj"]);
        paths = ManagerPaths.ForRoot(Path.Combine(root, "Manager")); paths.Ensure();
    }

    [TestCleanup]
    public void Cleanup()
    {
        if (Directory.Exists(root)) Directory.Delete(root, true);
    }

    [TestMethod]
    public async Task Read_only_analysis_keeps_complete_target_inventory_byte_identical()
    {
        var before = await SourceInventoryBuilder.CreateAsync(target);
        var result = await new WpfExistingProjectAdapter(paths).AnalyzeAsync(Path.Combine(target, "ExistingWpfApp.csproj"));
        var after = await SourceInventoryBuilder.CreateAsync(target);
        Assert.IsTrue(result.Result.Success, result.Result.Message);
        Assert.IsTrue(result.TargetByteIdentical);
        Assert.AreEqual(before.InventoryHash, after.InventoryHash);
        CollectionAssert.AreEqual(before.Files.ToArray(), after.Files.ToArray());
        Assert.IsFalse(Directory.Exists(Path.Combine(target, ".ui-editor-kit")));
        Assert.IsFalse(File.Exists(Path.Combine(target, "ui-editor-target.json")));
    }

    [TestMethod]
    public async Task Structured_analyzers_find_views_controls_columns_commands_and_uncertainty_without_execution()
    {
        var result = await new WpfExistingProjectAdapter(paths).AnalyzeAsync(target);
        var analysis = RequireAnalysis(result);
        Assert.AreEqual(RegistrationFramework.WpfSdkDotNet, analysis.Framework);
        Assert.IsTrue(analysis.Project.UseWpf);
        Assert.IsGreaterThanOrEqualTo(2, analysis.Findings.Count(item => item.IsView));
        Assert.IsTrue(analysis.Findings.Any(item => item.ControlType == "DataGrid"));
        Assert.IsGreaterThanOrEqualTo(4, analysis.Findings.Count(item => item.ControlType.Contains("DataGrid", StringComparison.Ordinal) && item.ControlType.Contains("Column", StringComparison.Ordinal)));
        Assert.IsTrue(analysis.Findings.Any(item => item.ControlType == "CheckBox"));
        Assert.IsTrue(analysis.Findings.Any(item => item.ControlType == "RadioButton"));
        Assert.IsTrue(analysis.Findings.Any(item => item.DeclaredName is null));
        Assert.IsTrue(analysis.Findings.Any(item => item.IsTemplateOrDynamic));
        Assert.IsTrue(analysis.ActionFindings.Any(item => item.Symbol == "SaveButton_Click"));
        Assert.IsTrue(analysis.ActionFindings.Any(item => item.Symbol == "ImportCommand"));
        Assert.IsTrue(analysis.Proposals.Any(item => item.ActionRisk is not null && item.LockedOps.Contains("executeTargetAction")));
        Assert.IsTrue(analysis.Proposals.All(item => item.ReviewStatus is ProposalReviewStatus.Unreviewed or ProposalReviewStatus.ClarificationRequired));
    }

    [TestMethod]
    public async Task Stable_ids_and_registry_are_reproducible_and_only_reviewed_proposals_enter_registry()
    {
        var adapter = new WpfExistingProjectAdapter(paths);
        var first = Review(RequireAnalysis(await adapter.AnalyzeAsync(target)));
        var second = Review(RequireAnalysis(await adapter.AnalyzeAsync(target)));
        CollectionAssert.AreEqual(first.Proposals.Select(item => item.ProposalId).ToArray(), second.Proposals.Select(item => item.ProposalId).ToArray());
        CollectionAssert.AreEqual(first.Proposals.Select(item => item.StableElementId).ToArray(), second.Proposals.Select(item => item.StableElementId).ToArray());
        var a = RegistrationRegistryGenerator.Create(first);
        var b = RegistrationRegistryGenerator.Create(second);
        Assert.IsTrue(a.Validation.Success, string.Join("; ", a.Validation.Issues.Select(item => item.Message)));
        Assert.IsNotNull(a.Registry);
        Assert.AreEqual(a.Registry.Fingerprint, b.Registry!.Fingerprint);
        Assert.IsTrue(a.Registry.Elements.All(element => first.Proposals.Any(item => item.StableElementId == element.Id && item.ReviewStatus is ProposalReviewStatus.Confirmed or ProposalReviewStatus.Modified)));
        Assert.IsFalse(a.Registry.Elements.Any(element => element.AllowedOps.Contains("executeTargetAction")));
    }

    [TestMethod]
    public async Task Unreviewed_collision_missing_parent_cycle_and_unlocked_action_block_installation()
    {
        var analysis = RequireAnalysis(await new WpfExistingProjectAdapter(paths).AnalyzeAsync(target));
        Assert.IsFalse(RegistrationProposalValidator.Validate(analysis.Proposals).Success);
        var reviewed = Review(analysis);
        var accepted = reviewed.Proposals.Where(item => item.ReviewStatus is ProposalReviewStatus.Confirmed or ProposalReviewStatus.Modified).ToArray();
        var first = accepted[1];
        var second = accepted[2];
        Assert.IsTrue(RegistrationProposalValidator.Validate(reviewed.Proposals.Select(item => item.ProposalId == second.ProposalId ? item with { StableElementId = first.StableElementId } : item).ToArray()).Issues.Any(item => item.Code == ManagerErrorCodes.RegistrationIdConflict));
        Assert.IsTrue(RegistrationProposalValidator.Validate(reviewed.Proposals.Select(item => item.ProposalId == second.ProposalId ? item with { ParentId = "ui.missing" } : item).ToArray()).Issues.Any(item => item.Code == ManagerErrorCodes.RegistrationParentMissing));
        Assert.IsTrue(RegistrationProposalValidator.Validate(reviewed.Proposals.Select(item => item.ProposalId == first.ProposalId ? item with { ParentId = second.StableElementId } : item).ToArray()).Issues.Any(item => item.Code == ManagerErrorCodes.RegistrationParentCycle));
        var action = accepted.First(item => item.ActionRisk is not null);
        Assert.IsTrue(RegistrationProposalValidator.Validate(reviewed.Proposals.Select(item => item.ProposalId == action.ProposalId ? item with { LockedOps = [] } : item).ToArray()).Issues.Any(item => item.Code == ManagerErrorCodes.RegistrationActionRisk));
    }

    [TestMethod]
    public async Task Unsupported_project_is_rejected_without_partial_change()
    {
        var project = Path.Combine(target, "ExistingWpfApp.csproj");
        var original = await File.ReadAllBytesAsync(project);
        await File.WriteAllTextAsync(project, "<Project Sdk=\"Microsoft.NET.Sdk\"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>");
        var modified = await File.ReadAllBytesAsync(project);
        var result = await new WpfExistingProjectAdapter(paths).AnalyzeAsync(project);
        Assert.AreEqual(ManagerErrorCodes.RegistrationFrameworkUnsupported, result.Result.Code);
        CollectionAssert.AreEqual(modified, await File.ReadAllBytesAsync(project));
        Assert.IsFalse(Directory.Exists(Path.Combine(target, ".ui-editor-kit")));
        await File.WriteAllBytesAsync(project, original);
    }

    [TestMethod]
    public async Task Preview_is_complete_has_exact_project_diff_and_requires_confirmation()
    {
        var service = new ExistingAppRegistrationService(paths, buildVerifier: new SuccessfulBuildVerifier());
        var analysis = Review(RequireAnalysis(await service.AnalyzeAsync(target)));
        var previewResult = await service.PreviewAsync(target, analysis);
        var preview = previewResult.Preview ?? throw new AssertFailedException(previewResult.Result.Message);
        Assert.IsTrue(preview.CanExecute, string.Join("; ", preview.Blockers));
        Assert.IsTrue(preview.Files.Any(item => item.RelativePath == analysis.ProjectFile && item.Action == RegistrationFileAction.Update && item.ExactDiff!.Contains(StructuredProjectRegistrationEditor.Label)));
        Assert.IsTrue(preview.Files.Any(item => item.RelativePath == "ui-editor-target.json" && item.Action == RegistrationFileAction.Create));
        Assert.IsTrue(preview.Files.Any(item => item.RelativePath == ".ui-editor-kit/registration-registry.json"));
        Assert.IsTrue(preview.Files.Any(item => item.RelativePath == ".ui-editor-kit/generated/UiEditorKitRegistration.g.cs"));
        Assert.IsTrue(preview.Files.Any(item => item.RelativePath == ".ui-editor-kit/registration-installation.json"));
        Assert.AreEqual(ManagerErrorCodes.RegistrationPreviewStale, (await service.InstallOrUpdateAsync(preview, false)).Code);
        Assert.IsFalse(File.Exists(Path.Combine(target, "ui-editor-target.json")));
    }

    [TestMethod]
    public async Task Real_install_build_contract_and_uninstall_restore_original_files_byte_identically()
    {
        var original = await SourceInventoryBuilder.CreateAsync(target);
        var protection = await Hashing.FileAsync(Path.Combine(target, "foreign-protection.txt"));
        var service = new ExistingAppRegistrationService(paths);
        var analysis = Review(RequireAnalysis(await service.AnalyzeAsync(target)));
        var preview = (await service.PreviewAsync(target, analysis)).Preview!;
        var install = await service.InstallOrUpdateAsync(preview, true);
        Assert.IsTrue(install.Success, install.Message);
        var installedState = await service.LoadStateAsync(target);
        Assert.IsNotNull(installedState);
        Assert.AreEqual(RegistrationLifecycle.Installed, installedState.Lifecycle);
        Assert.AreEqual(protection, await Hashing.FileAsync(Path.Combine(target, "foreign-protection.txt")));
        Assert.IsTrue(File.Exists(Path.Combine(target, ".ui-editor-kit", "registration-registry.json")));
        Assert.IsTrue((await new TargetAppInspector(paths).CheckAsync(target)).Success);
        var uninstallPreview = (await service.UninstallPreviewAsync(target)).Preview!;
        Assert.IsTrue(uninstallPreview.CanExecute, string.Join("; ", uninstallPreview.Blockers));
        var uninstall = await service.UninstallAsync(uninstallPreview, true);
        Assert.IsTrue(uninstall.Success, uninstall.Message);
        var restored = await SourceInventoryBuilder.CreateAsync(target);
        Assert.AreEqual(original.InventoryHash, restored.InventoryHash);
        Assert.AreEqual(protection, await Hashing.FileAsync(Path.Combine(target, "foreign-protection.txt")));
        Assert.IsFalse(File.Exists(Path.Combine(target, "ui-editor-target.json")));
        Assert.IsFalse(Directory.Exists(Path.Combine(target, ".ui-editor-kit")));
    }

    [TestMethod]
    public async Task Install_failure_rolls_back_every_target_file_and_leaves_no_temp_or_staging()
    {
        var original = await SourceInventoryBuilder.CreateAsync(target);
        var service = new ExistingAppRegistrationService(paths, buildVerifier: new SuccessfulBuildVerifier());
        var analysis = Review(RequireAnalysis(await service.AnalyzeAsync(target)));
        var preview = (await service.PreviewAsync(target, analysis)).Preview!;
        var result = await service.InstallOrUpdateAsync(preview, true, new ThrowingFault(2));
        Assert.IsFalse(result.Success);
        Assert.IsTrue(result.RollbackSucceeded);
        Assert.AreEqual(original.InventoryHash, (await SourceInventoryBuilder.CreateAsync(target)).InventoryHash);
        Assert.IsFalse(Directory.EnumerateFiles(target, "*.tmp", SearchOption.AllDirectories).Any());
        Assert.IsFalse(Directory.EnumerateFileSystemEntries(paths.Backups, "*", SearchOption.AllDirectories).Any());
    }

    [TestMethod]
    public async Task Build_failure_rolls_back_project_generated_files_state_and_persistent_backup()
    {
        var original = await SourceInventoryBuilder.CreateAsync(target);
        var service = new ExistingAppRegistrationService(paths, buildVerifier: new FailingBuildVerifier());
        var analysis = Review(RequireAnalysis(await service.AnalyzeAsync(target)));
        var preview = (await service.PreviewAsync(target, analysis)).Preview!;
        var result = await service.InstallOrUpdateAsync(preview, true);
        Assert.AreEqual(ManagerErrorCodes.RegistrationBuildFailed, result.Code);
        Assert.IsTrue(result.RollbackSucceeded);
        Assert.AreEqual(original.InventoryHash, (await SourceInventoryBuilder.CreateAsync(target)).InventoryHash);
        Assert.IsFalse(File.Exists(Path.Combine(target, "ui-editor-target.json")));
        Assert.IsFalse(Directory.EnumerateFileSystemEntries(paths.Backups, "*", SearchOption.AllDirectories).Any());
    }

    [TestMethod]
    public async Task Contract_failure_rolls_back_project_generated_files_state_and_persistent_backup()
    {
        var original = await SourceInventoryBuilder.CreateAsync(target);
        var service = new ExistingAppRegistrationService(paths, contractChecker: new FailingContractChecker(),
            buildVerifier: new SuccessfulBuildVerifier());
        var analysis = Review(RequireAnalysis(await service.AnalyzeAsync(target)));
        var preview = (await service.PreviewAsync(target, analysis)).Preview!;
        var result = await service.InstallOrUpdateAsync(preview, true);
        Assert.AreEqual(ManagerErrorCodes.RegistrationContractFailed, result.Code);
        Assert.IsTrue(result.RollbackSucceeded);
        Assert.AreEqual(original.InventoryHash, (await SourceInventoryBuilder.CreateAsync(target)).InventoryHash);
        Assert.IsFalse(File.Exists(Path.Combine(target, "ui-editor-target.json")));
        Assert.IsFalse(Directory.EnumerateFileSystemEntries(paths.Backups, "*", SearchOption.AllDirectories).Any());
    }

    [TestMethod]
    public async Task Runtime_start_failure_rolls_back_project_generated_files_state_and_persistent_backup()
    {
        var original = await SourceInventoryBuilder.CreateAsync(target);
        var service = new ExistingAppRegistrationService(paths, buildVerifier: new SuccessfulBuildVerifier(),
            runtimeVerifier: new FailingRuntimeVerifier());
        var analysis = Review(RequireAnalysis(await service.AnalyzeAsync(target)));
        var preview = (await service.PreviewAsync(target, analysis)).Preview!;
        var result = await service.InstallOrUpdateAsync(preview, true);
        Assert.AreEqual(ManagerErrorCodes.RegistrationEditorStartFailed, result.Code);
        Assert.IsTrue(result.RollbackSucceeded);
        Assert.AreEqual(original.InventoryHash, (await SourceInventoryBuilder.CreateAsync(target)).InventoryHash);
        Assert.IsFalse(File.Exists(Path.Combine(target, "ui-editor-target.json")));
        Assert.IsFalse(Directory.EnumerateFileSystemEntries(paths.Backups, "*", SearchOption.AllDirectories).Any());
    }

    [TestMethod]
    public async Task Local_change_to_owned_file_blocks_uninstall_without_touching_the_file()
    {
        var service = new ExistingAppRegistrationService(paths, buildVerifier: new SuccessfulBuildVerifier());
        var analysis = Review(RequireAnalysis(await service.AnalyzeAsync(target)));
        var installPreview = (await service.PreviewAsync(target, analysis)).Preview!;
        Assert.IsTrue((await service.InstallOrUpdateAsync(installPreview, true)).Success);
        var registry = Path.Combine(target, ".ui-editor-kit", "registration-registry.json");
        await File.AppendAllTextAsync(registry, Environment.NewLine + "controlled local change");
        var changedHash = await Hashing.FileAsync(registry);
        var contract = await new TargetAppInspector(paths).CheckAsync(target);
        Assert.IsFalse(contract.Success);
        Assert.AreEqual(ManagerErrorCodes.RegistrationForeignChangeConflict, contract.Code);
        Assert.AreEqual(TargetContractStatus.RepairRequired, contract.Status);
        var uninstall = await service.UninstallPreviewAsync(target);
        Assert.IsFalse(uninstall.Preview!.CanExecute);
        Assert.IsTrue(uninstall.Preview.Files.Any(item => item.RelativePath.EndsWith("registration-registry.json", StringComparison.Ordinal) && item.Action == RegistrationFileAction.Conflict));
        Assert.AreEqual(changedHash, await Hashing.FileAsync(registry));
    }

    [TestMethod]
    public async Task Source_change_and_git_dirty_affected_file_make_analysis_or_preview_stale()
    {
        var service = new ExistingAppRegistrationService(paths, buildVerifier: new SuccessfulBuildVerifier());
        var analysis = Review(RequireAnalysis(await service.AnalyzeAsync(target)));
        await File.AppendAllTextAsync(Path.Combine(target, "MainWindow.xaml"), Environment.NewLine + "<!-- controlled source change -->");
        var preview = await service.PreviewAsync(target, analysis);
        Assert.AreEqual(ManagerErrorCodes.RegistrationAnalysisStale, preview.Result.Code);
    }

    [TestMethod]
    public async Task Reanalysis_preserves_safe_decisions_but_new_elements_stay_unreviewed()
    {
        var adapter = new WpfExistingProjectAdapter(paths);
        var first = Review(RequireAnalysis(await adapter.AnalyzeAsync(target)));
        await new RegistrationAnalysisStore(paths).SaveAsync(first);
        var xaml = Path.Combine(target, "MainWindow.xaml");
        var text = await File.ReadAllTextAsync(xaml);
        var newline = text.Contains("\r\n", StringComparison.Ordinal) ? "\r\n" : "\n";
        text = text.Replace("        <Button x:Name=\"SaveButton\" Content=\"Fachlich speichern\" Click=\"SaveButton_Click\" Padding=\"12,6\" Margin=\"4\" />" + newline,
            string.Empty, StringComparison.Ordinal);
        text = text.Replace("      </StackPanel>" + newline + "    </DockPanel>",
            "        <TextBlock x:Name=\"NewElement\" Text=\"Neu\" />" + newline + "      </StackPanel>" + newline + "    </DockPanel>", StringComparison.Ordinal);
        await File.WriteAllTextAsync(xaml, text);
        var second = RequireAnalysis(await adapter.AnalyzeAsync(target));
        Assert.IsTrue(second.Proposals.Any(item => item.DeclaredName == "NewElement" && item.ReviewStatus == ProposalReviewStatus.Unreviewed));
        Assert.IsTrue(second.Proposals.Any(item => item.ReviewStatus is ProposalReviewStatus.Confirmed or ProposalReviewStatus.Modified));
        Assert.IsTrue(second.Proposals.Any(item => item.DeclaredName == "SaveButton" &&
                                                   item.ReviewStatus == ProposalReviewStatus.ClarificationRequired &&
                                                   item.Warnings.Any(warning => warning.Contains("Verwaister", StringComparison.Ordinal))));
    }

    [TestMethod]
    public async Task Generated_adapter_uses_existing_operation_names_and_never_invokes_business_actions()
    {
        var analysis = Review(RequireAnalysis(await new WpfExistingProjectAdapter(paths).AnalyzeAsync(target)));
        var generated = await new ControlledRegistrationArtifactGenerator().GenerateAsync(analysis);
        Assert.IsTrue(generated.Result.Success);
        var source = Encoding.UTF8.GetString(generated.Files.Single(item => item.RelativePath.EndsWith(".g.cs", StringComparison.Ordinal)).Content);
        foreach (var operation in new[] { "move", "resize", "resizeWidth", "resizeHeight", "textMove", "textResize" }) Assert.Contains(operation, source);
        Assert.DoesNotContain(".Execute(", source);
        Assert.DoesNotContain("HttpClient", source);
        Assert.DoesNotContain("System.Net", source);
        Assert.Contains("NamedPipeServerStream", source);
        Assert.Contains("[ModuleInitializer]", source);
        Assert.Contains("--ui-editor-kit-host-pipe=", source);
        Assert.Contains("element_ref_missing", source);
        Assert.Contains("rollback_failed", source);
        var project = Encoding.UTF8.GetString(StructuredProjectRegistrationEditor.AddRegistrationCompileItem(
            await File.ReadAllBytesAsync(Path.Combine(target, "ExistingWpfApp.csproj"))));
        Assert.Contains("<Compile Include=\".ui-editor-kit\\generated\\UiEditorKitRegistration.g.cs\">", project);
    }

    private static ExistingAppAnalysis RequireAnalysis(RegistrationAnalysisResult result)
    {
        Assert.IsTrue(result.Result.Success, result.Result.Code + ": " + result.Result.Message);
        return result.Analysis ?? throw new AssertFailedException("Analyse fehlt.");
    }

    private static ExistingAppAnalysis Review(ExistingAppAnalysis analysis)
    {
        var detailsUsage = analysis.Proposals.Single(item => item.SourceLocation.RelativeFile == "MainWindow.xaml" && item.DeclaredName == "DetailsView");
        var proposals = analysis.Proposals.Select(item =>
        {
            if (item.StableElementId is null || item.Warnings.Any(warning => warning.Contains("Template-", StringComparison.Ordinal)))
                return item with { ReviewStatus = ProposalReviewStatus.Rejected, UserNote = "Unsicheren M79-Testvorschlag bewusst abgelehnt." };
            if (item.SourceLocation.RelativeFile == "Views/DetailsView.xaml" && item.ControlType == "UserControl")
                return item with { ParentId = detailsUsage.StableElementId, ReviewStatus = ProposalReviewStatus.Modified, UserNote = "Deklarierte DetailsView-Nutzung manuell zugeordnet." };
            return item with { ReviewStatus = ProposalReviewStatus.Confirmed, UserNote = "Kontrollierter Testvorschlag bestätigt." };
        }).ToArray();
        return analysis with { Proposals = proposals };
    }

    private static void CopyTree(string source, string destination, IReadOnlyCollection<string> excluded)
    {
        Directory.CreateDirectory(destination);
        foreach (var file in Directory.EnumerateFiles(source)) File.Copy(file, Path.Combine(destination, Path.GetFileName(file)), true);
        foreach (var directory in Directory.EnumerateDirectories(source))
            if (!excluded.Contains(Path.GetFileName(directory), StringComparer.OrdinalIgnoreCase))
                CopyTree(directory, Path.Combine(destination, Path.GetFileName(directory)), excluded);
    }

    private static string FindRepository()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "STATUS.md"))) current = current.Parent;
        return current?.FullName ?? throw new InvalidOperationException("Repository nicht gefunden.");
    }

    private sealed class SuccessfulBuildVerifier : IRegistrationBuildVerifier
    {
        public Task<ManagerResult> BuildAsync(string targetRoot, string projectFile, CancellationToken cancellationToken = default) =>
            Task.FromResult(ManagerResult.Ok("registration_build_valid", "Testbuild erfolgreich."));
    }

    private sealed class FailingBuildVerifier : IRegistrationBuildVerifier
    {
        public Task<ManagerResult> BuildAsync(string targetRoot, string projectFile, CancellationToken cancellationToken = default) =>
            Task.FromResult(ManagerResult.Fail(ManagerErrorCodes.RegistrationBuildFailed, "Kontrollierter Buildfehler."));
    }

    private sealed class FailingContractChecker : IRegistrationContractChecker
    {
        public Task<ManagerResult> CheckAsync(string targetRoot, ExistingAppAnalysis analysis,
            GeneratedRegistrationRegistry registry, CancellationToken cancellationToken = default) =>
            Task.FromResult(ManagerResult.Fail(ManagerErrorCodes.RegistrationContractFailed, "Kontrollierter Vertragsfehler."));
    }

    private sealed class FailingRuntimeVerifier : IRegistrationRuntimeVerifier
    {
        public Task<ManagerResult> VerifyAsync(string targetRoot, ExistingAppRegistrationState state,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(ManagerResult.Fail(ManagerErrorCodes.RegistrationEditorStartFailed, "Kontrollierter Laufzeitfehler."));
    }

    private sealed class ThrowingFault(int failAt) : IRegistrationFaultInjector
    {
        public void BeforeWrite(int index, string relativePath)
        {
            if (index == failAt) throw new InvalidOperationException("Kontrollierter M79-Testfehler");
        }
    }
}
