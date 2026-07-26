namespace UiEditorKit.Manager.Domain;

public enum TargetContractStatus { NotChecked, NotSuitable, ReadyToInstall, Installed, UpdateAvailable, Conflict, RepairRequired, Missing }
public enum InstallationAction { Create, Update, Unchanged, Remove, Conflict }
public enum ManagerOperation { Check, Install, Update, Uninstall, StartTarget, StartEditor, CreateShortcut, RemoveShortcut }

public static class ManagerErrorCodes
{
    public const string TargetPathInvalid = "target_path_invalid";
    public const string TargetProjectNotFound = "target_project_not_found";
    public const string TargetManifestNotFound = "target_manifest_not_found";
    public const string TargetManifestInvalid = "target_manifest_invalid";
    public const string TargetContractUnsupported = "target_contract_unsupported";
    public const string TargetNotM78Compatible = "target_not_m78_compatible";
    public const string TargetPathUnsafe = "target_path_unsafe";
    public const string TargetNotWritable = "target_not_writable";
    public const string PackageNotFound = "package_not_found";
    public const string PackageInvalid = "package_invalid";
    public const string PackageIntegrityFailed = "package_integrity_failed";
    public const string InstallPreviewStale = "install_preview_stale";
    public const string ForeignFileConflict = "foreign_file_conflict";
    public const string InstallFailed = "install_failed";
    public const string InstallRollbackFailed = "install_rollback_failed";
    public const string UpdateNotAvailable = "update_not_available";
    public const string UpdateConflict = "update_conflict";
    public const string UpdateFailed = "update_failed";
    public const string UpdateRollbackFailed = "update_rollback_failed";
    public const string UninstallConflict = "uninstall_conflict";
    public const string UninstallFailed = "uninstall_failed";
    public const string UninstallRollbackFailed = "uninstall_rollback_failed";
    public const string ContractCheckFailed = "contract_check_failed";
    public const string TargetStartFailed = "target_start_failed";
    public const string EditorStartFailed = "editor_start_failed";
    public const string ShortcutCreateFailed = "shortcut_create_failed";
    public const string ShortcutRemoveFailed = "shortcut_remove_failed";
    public const string KnownAppsStoreInvalid = "known_apps_store_invalid";
    public const string ManagerLogFailed = "manager_log_failed";
}

public sealed record TargetStartConfiguration(string Kind, string Project, string? Executable, IReadOnlyList<string> Arguments);
public sealed record TargetInstallationCapabilities(bool Install, bool Update, bool Uninstall, bool StartTarget, bool StartEditor);
public sealed record TargetAppManifest(int SchemaVersion, string ApplicationId, string DisplayName, string ProjectType,
    string ProjectFile, string TargetFramework, string IntegrationMode, string IntegrationRoot,
    string EditorIntegrationProject, string HostExecutableProject, string SupportedEditorContractVersion,
    TargetInstallationCapabilities InstallationCapabilities, IReadOnlyList<string> ExpectedFiles,
    TargetStartConfiguration TargetStart, TargetStartConfiguration EditorStart, string OwnershipMarker);
public sealed record PackageFile(string RelativePath, string SourcePath, string Sha256, string Action);
public sealed record IntegrationPackage(int SchemaVersion, string PackageVersion, string ContractVersion, IReadOnlyList<PackageFile> Files);
public sealed record InstallationFileState(string RelativePath, string InstalledHash, string SourceHash, string Ownership, string? BackupReference);
public sealed record InstallationState(int SchemaVersion, string ApplicationId, string ManagerInstallationId,
    string InstalledPackageVersion, string ContractVersion, DateTimeOffset InstalledAt, DateTimeOffset UpdatedAt,
    IReadOnlyList<InstallationFileState> Files, IReadOnlyList<string> ProjectChanges, TargetStartConfiguration TargetStart,
    TargetStartConfiguration EditorStart);
public sealed record PlanFile(string RelativePath, InstallationAction Action, bool Exists, bool ManagerOwned,
    string? OldHash, string? NewHash, string? Conflict, bool BackupRequired);
public sealed record InstallationPlan(string ApplicationId, string TargetRoot, string ProjectFile, string PackageVersion,
    string ContractVersion, string PreviewId, DateTimeOffset CreatedAt, IReadOnlyList<PlanFile> Files,
    IReadOnlyList<string> Warnings, IReadOnlyList<string> Blockers)
{
    public bool CanExecute => Blockers.Count == 0;
}
public sealed record ManagerResult(bool Success, string Code, string Message, string? TransactionId = null,
    bool RollbackSucceeded = true, IReadOnlyList<string>? AffectedFiles = null)
{
    public static ManagerResult Ok(string code, string message, string? transactionId = null, IReadOnlyList<string>? files = null) =>
        new(true, code, message, transactionId, true, files);
    public static ManagerResult Fail(string code, string message, string? transactionId = null, bool rollback = true, IReadOnlyList<string>? files = null) =>
        new(false, code, message, transactionId, rollback, files);
}
public sealed record TargetCheckResult(bool Success, string Code, string Message, string TargetRoot,
    string ManifestPath, TargetContractStatus Status, TargetAppManifest? Manifest, InstallationState? Installation,
    bool Writable, DateTimeOffset CheckedAt);
public sealed record KnownTargetApp(string ApplicationId, string DisplayName, string RootPath, string ProjectFile,
    string ManifestPath, string ContractVersion, TargetContractStatus InstallationStatus,
    string? InstalledPackageVersion, DateTimeOffset LastCheckedAt, DateTimeOffset? LastActionAt, string? LastErrorCode);
public sealed record KnownTargetAppsDocument(int SchemaVersion, IReadOnlyList<KnownTargetApp> Apps);
public sealed record ManagerLogEntry(DateTimeOffset Timestamp, ManagerOperation Action, string? ApplicationId,
    string? TargetPath, bool Success, string Code, string? TransactionId, string? PackageVersion, int AffectedFileCount);
