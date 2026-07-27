namespace UiEditorKit.Manager.Domain;

public static class StarterFrameworks
{
    public const string Wpf = "wpf";
    public const string Electron = "electron";
    public static readonly IReadOnlySet<string> Supported = new HashSet<string>(StringComparer.Ordinal) { Wpf, Electron };
}

public static class StarterIntegrationModes
{
    public const string NewApp = "new-app";
    public const string ExistingApp = "existing-app";
}

public static class StarterRegistryStatuses
{
    public const string Development = "development";
    public const string RegistrationRequired = "registrationRequired";
    public const string RegistrationInProgress = "registrationInProgress";
    public const string Incomplete = "incomplete";
    public const string Complete = "complete";
    public const string Changed = "changed";
    public const string Incompatible = "incompatible";
    public const string Blocked = "blocked";
    public static readonly IReadOnlySet<string> Supported = new HashSet<string>(StringComparer.Ordinal)
    {
        Development, RegistrationRequired, RegistrationInProgress, Incomplete, Complete, Changed, Incompatible, Blocked
    };
}

public sealed record StarterInstallationOwnership(string Owner, string ManifestPath, IReadOnlyList<string> OwnedFiles);

public sealed record StarterTargetManifest(
    int SchemaVersion,
    string StarterPackageVersion,
    string ApplicationId,
    string DisplayName,
    string Framework,
    string IntegrationMode,
    string ContractVersion,
    string AdapterVersion,
    int RegistryVersion,
    string RegistryFingerprint,
    string RegistryStatus,
    IReadOnlyList<string> ActiveScopes,
    string UiCapability,
    string PdfCapability,
    string ProfileRoot,
    IReadOnlyList<string> SupportedOperations,
    string SelectionCapability,
    bool VisibilityCapability,
    bool LabelFieldSeparation,
    string TransportProtocolVersion,
    IReadOnlyList<StarterScopeStatus> Scopes,
    TargetAppManifest? ManagerTarget,
    StarterInstallationOwnership InstallationOwnership,
    DateTimeOffset InstalledAt,
    DateTimeOffset UpdatedAt);

public sealed record StarterPackageFile(
    string Framework,
    string IntegrationMode,
    string RelativePath,
    string SourcePath,
    string Sha256,
    bool Template,
    bool PreserveOnUpdate,
    bool PreserveOnUninstall);

public sealed record StarterPackageManifest(
    int SchemaVersion,
    string ProductName,
    string PackageVersion,
    string ContractVersion,
    IReadOnlyList<string> SupportedFrameworks,
    IReadOnlyList<StarterPackageFile> Files);

public sealed record StarterPreparationRequest(
    string TargetRoot,
    string DisplayName,
    string ApplicationId,
    string Framework,
    string IntegrationMode,
    bool UiEditorEnabled,
    bool PdfEditorEnabled,
    string ProfileRoot);

public sealed record StarterPlanFile(
    string RelativePath,
    InstallationAction Action,
    bool ManagerOwned,
    string? OldHash,
    string? NewHash,
    string? ExactDiff,
    string? Conflict,
    bool BackupRequired,
    bool PreserveOnUninstall);

public sealed record StarterInstallationPlan(
    string PreviewId,
    string TargetRoot,
    string PackageVersion,
    DateTimeOffset CreatedAt,
    StarterPreparationRequest Request,
    IReadOnlyList<StarterPlanFile> Files,
    bool GitRepository,
    bool GitSafe,
    string GitStatus,
    IReadOnlyList<string> Warnings,
    IReadOnlyList<string> Blockers)
{
    public bool CanExecute => GitSafe && Blockers.Count == 0;
}

public sealed record StarterOwnedFile(string RelativePath, string InstalledHash, bool PreserveOnUninstall);

public sealed record StarterInstallationState(
    int SchemaVersion,
    string ProductName,
    string ApplicationId,
    string Framework,
    string IntegrationMode,
    string InstalledPackageVersion,
    DateTimeOffset InstalledAt,
    DateTimeOffset UpdatedAt,
    IReadOnlyList<StarterOwnedFile> Files);

public sealed record StarterScopeStatus(string ScopeId, string Status, string? Reason, int ElementCount, int MissingReferenceCount);

public sealed record StarterTargetStatus(
    string TargetRoot,
    string DisplayName,
    string Framework,
    string IntegrationMode,
    string AdapterStatus,
    string ContractStatus,
    string RegistryStatus,
    int RegistryVersion,
    string RegistryFingerprint,
    string UiCapability,
    string PdfCapability,
    string? InstalledPackageVersion,
    string AvailablePackageVersion,
    bool GitRepository,
    bool GitSafe,
    bool Writable,
    string NextAction,
    IReadOnlyList<StarterScopeStatus> Scopes,
    StarterTargetManifest? Manifest);
