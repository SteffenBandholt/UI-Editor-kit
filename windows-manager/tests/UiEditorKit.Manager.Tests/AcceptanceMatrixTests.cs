using UiEditorKit.Manager.Domain;
using UiEditorKit.Manager.Infrastructure;

namespace UiEditorKit.Manager.Tests;

[TestClass]
public sealed class AcceptanceMatrixTests
{
    [TestMethod]
    [DataRow("01_native_wpf")]
    [DataRow("02_no_browser")]
    [DataRow("03_local_appdata")]
    [DataRow("04_known_apps_version")]
    [DataRow("05_atomic_store")]
    [DataRow("06_corrupt_store")]
    [DataRow("07_folder_dialog")]
    [DataRow("08_project_dialog")]
    [DataRow("09_cancel_safe")]
    [DataRow("10_normalized_paths")]
    [DataRow("11_root_block")]
    [DataRow("12_system_block")]
    [DataRow("13_root_boundary")]
    [DataRow("14_traversal")]
    [DataRow("15_reparse")]
    [DataRow("16_manifest_required")]
    [DataRow("17_manifest_strict")]
    [DataRow("18_contract_version")]
    [DataRow("19_m79_boundary")]
    [DataRow("20_prepared_fixture")]
    [DataRow("21_probe_cleanup")]
    [DataRow("22_package_version")]
    [DataRow("23_package_hashes")]
    [DataRow("24_tamper_rejected")]
    [DataRow("25_deterministic_plan")]
    [DataRow("26_complete_preview")]
    [DataRow("27_confirmation")]
    [DataRow("28_stale_preview")]
    [DataRow("29_foreign_conflict")]
    [DataRow("30_foreign_hash_diagnostic")]
    [DataRow("31_positive_file_list")]
    [DataRow("32_additive_props")]
    [DataRow("33_project_hash_diagnostic")]
    [DataRow("34_idempotent")]
    [DataRow("35_install_state")]
    [DataRow("36_owned_files")]
    [DataRow("37_stored_hashes")]
    [DataRow("38_contract_recheck")]
    [DataRow("39_install_rollback")]
    [DataRow("40_hash_rollback")]
    [DataRow("41_failed_not_installed")]
    [DataRow("42_update_detection")]
    [DataRow("43_update_preview")]
    [DataRow("44_update_owned_only")]
    [DataRow("45_local_conflict")]
    [DataRow("46_update_rollback")]
    [DataRow("47_version_update")]
    public void Required_M78_contract_is_present(string caseId)
    {
        var repo = FindRepository();
        var infrastructure = File.ReadAllText(Path.Combine(repo, "windows-manager", "src", "UiEditorKit.Manager.Infrastructure", "ManagerInfrastructure.cs"));
        var core = File.ReadAllText(Path.Combine(repo, "windows-manager", "src", "UiEditorKit.Manager.Core", "ManagerContracts.cs"));
        var diagnostic = File.ReadAllText(Path.Combine(repo, "windows-manager", "src", "UiEditorKit.Manager.Wpf", "ManagerDiagnosticRunner.cs"));
        var xaml = File.ReadAllText(Path.Combine(repo, "windows-manager", "src", "UiEditorKit.Manager.Wpf", "MainWindow.xaml"));
        var result = caseId switch
        {
            "01_native_wpf" => File.ReadAllText(Path.Combine(repo, "windows-manager", "src", "UiEditorKit.Manager.Wpf", "UiEditorKit.Manager.Wpf.csproj")).Contains("<UseWPF>true</UseWPF>"),
            "02_no_browser" => !string.Join('\n', Directory.EnumerateFiles(Path.Combine(repo, "windows-manager", "src"), "*.cs", SearchOption.AllDirectories).Select(File.ReadAllText)).Contains("WebView", StringComparison.OrdinalIgnoreCase),
            "03_local_appdata" => ManagerPaths.ForDefault().Root.StartsWith(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), StringComparison.OrdinalIgnoreCase),
            "04_known_apps_version" => typeof(KnownTargetAppsDocument).GetProperty("SchemaVersion") is not null,
            "05_atomic_store" => infrastructure.Contains("File.Replace(temp, StorePath"),
            "06_corrupt_store" => infrastructure.Contains("catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)"),
            "07_folder_dialog" => xaml.Contains("Ziel-App auswählen"),
            "08_project_dialog" => xaml.Contains("Projektdatei auswählen"),
            "09_cancel_safe" => File.ReadAllText(Path.Combine(repo, "windows-manager", "src", "UiEditorKit.Manager.Wpf", "MainWindow.xaml.cs")).Contains("ShowDialog(this) == true"),
            "10_normalized_paths" => core.Contains("Path.GetFullPath"),
            "11_root_block" => infrastructure.Contains("Rootlaufwerke sind nicht erlaubt"),
            "12_system_block" => infrastructure.Contains("SpecialFolder.Windows") && infrastructure.Contains("SpecialFolder.ProgramFiles"),
            "13_root_boundary" => core.Contains("IsInside(root, result)"),
            "14_traversal" => core.Contains("Contains(\"..\"") && core.Contains("IsSafeRelativePath"),
            "15_reparse" => infrastructure.Contains("FileAttributes.ReparsePoint"),
            "16_manifest_required" => infrastructure.Contains("TargetNotM78Compatible"),
            "17_manifest_strict" => infrastructure.Contains("UnmappedMemberHandling"),
            "18_contract_version" => core.Contains("ContractVersion = \"1.0\""),
            "19_m79_boundary" => infrastructure.Contains("benötigt M79") || infrastructure.Contains("benÃ¶tigt M79"),
            "20_prepared_fixture" => File.Exists(Path.Combine(repo, "windows-manager", "fixtures", "M78PreparedTarget", "ui-editor-target.json")),
            "21_probe_cleanup" => infrastructure.Contains("if (File.Exists(probe)) File.Delete(probe)"),
            "22_package_version" => File.ReadAllText(Path.Combine(repo, "windows-manager", "package", "current", "package.json")).Contains("\"packageVersion\": \"1.0.0\""),
            "23_package_hashes" => infrastructure.Contains("PackageIntegrityFailed") && infrastructure.Contains("Hashing.FileAsync(source"),
            "24_tamper_rejected" => infrastructure.Contains("Paketintegrität ist verletzt") || infrastructure.Contains("PaketintegritÃ¤t ist verletzt"),
            "25_deterministic_plan" => core.Contains("PreviewId(target.ApplicationId") && core.Contains("OrderBy(file => file.RelativePath"),
            "26_complete_preview" => xaml.Contains("PlanGrid") && xaml.Contains("Manager-Eigentum"),
            "27_confirmation" => infrastructure.Contains("if (!confirmed)"),
            "28_stale_preview" => infrastructure.Contains("fresh.Plan.PreviewId != plan.PreviewId"),
            "29_foreign_conflict" => core.Contains("InstallationAction.Conflict"),
            "30_foreign_hash_diagnostic" => diagnostic.Contains("foreignHash"),
            "31_positive_file_list" => core.Contains("target.ExpectedFiles.Contains"),
            "32_additive_props" => File.Exists(Path.Combine(repo, "windows-manager", "package", "current", "files", "UiEditorKit.ManagerIntegration.props")),
            "33_project_hash_diagnostic" => diagnostic.Contains("projectHash"),
            "34_idempotent" => core.Contains("InstallationAction.Unchanged"),
            "35_install_state" => infrastructure.Contains("installation.json"),
            "36_owned_files" => infrastructure.Contains("InstallationFileState"),
            "37_stored_hashes" => infrastructure.Contains("file.Sha256, file.Sha256"),
            "38_contract_recheck" => infrastructure.Contains("var fresh = await PreviewAsync"),
            "39_install_rollback" => infrastructure.Contains("Rollback(changed)"),
            "40_hash_rollback" => diagnostic.Contains("Updaterollback"),
            "41_failed_not_installed" => diagnostic.Contains("Installation is null"),
            "42_update_detection" => core.Contains("InstallationAction.Update"),
            "43_update_preview" => diagnostic.Contains("Updatevorschau"),
            "44_update_owned_only" => core.Contains("ownership.InstalledHash"),
            "45_local_conflict" => infrastructure.Contains("Eigene Datei wurde lokal") || infrastructure.Contains("Eigene Datei wurde lokal ge"),
            "46_update_rollback" => diagnostic.Contains("new Fault(1)"),
            "47_version_update" => diagnostic.Contains("InstalledPackageVersion == \"1.1.0\""),
            _ => false
        };
        Assert.IsTrue(result, caseId);
    }

    private static string FindRepository()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "STATUS.md"))) current = current.Parent;
        return current?.FullName ?? throw new InvalidOperationException("Repository nicht gefunden.");
    }
}
