namespace UiEditorKit.Manager.Domain;

public enum RegistrationFramework { Unsupported, WpfSdkDotNet }
public enum RegistrationConfidence { High, Medium, Low }
public enum ProposalReviewStatus { Unreviewed, Confirmed, Modified, Rejected, Blocked, ClarificationRequired }
public enum EditorEligibility { Yes, No, Unclear }
public enum RegistrationFileAction { Create, Update, Unchanged, Remove, Conflict }
public enum RegistrationLifecycle { Analyzed, PreviewReady, Installed, Stale, UpdateAvailable, Conflict, Uninstalled }

public sealed record SourceLocation(string RelativeFile, int Line, int Column);
public sealed record SourceInventoryItem(string RelativePath, string Sha256, long Length);
public sealed record SourceInventory(string RootPathFingerprint, string InventoryHash, IReadOnlyList<SourceInventoryItem> Files);

public sealed record ProjectFileAnalysis(
    string ProjectFile,
    string Sdk,
    string TargetFramework,
    bool UseWpf,
    string? RootNamespace,
    string? AssemblyName,
    IReadOnlyList<string> ProjectReferences,
    IReadOnlyList<string> Warnings);

public sealed record UiSourceFinding(
    string FindingId,
    string ViewId,
    SourceLocation SourceLocation,
    string Framework,
    string ControlType,
    string? DeclaredName,
    string StructuralPath,
    string? ParentStructuralPath,
    IReadOnlyDictionary<string, string> Attributes,
    IReadOnlyList<string> Bindings,
    IReadOnlyList<string> EventBindings,
    RegistrationConfidence Confidence,
    bool IsView,
    bool IsTemplateOrDynamic,
    IReadOnlyList<string> Warnings);

public sealed record CodeActionFinding(
    SourceLocation SourceLocation,
    string Symbol,
    string RiskCategory,
    string Evidence,
    RegistrationConfidence Confidence,
    IReadOnlyList<string> Warnings);

public sealed record RegistrationProposal(
    string ProposalId,
    SourceLocation SourceLocation,
    string Framework,
    string ControlType,
    string? DeclaredName,
    string StructuralPath,
    string? StableElementId,
    string DisplayName,
    string ElementType,
    string Role,
    string? ParentId,
    int Order,
    IReadOnlyList<string> AllowedOps,
    IReadOnlyList<string> LockedOps,
    EditorEligibility EditorEligible,
    string? ActionRisk,
    RegistrationConfidence Confidence,
    string Reason,
    IReadOnlyList<string> Warnings,
    ProposalReviewStatus ReviewStatus,
    string? FieldKind = null,
    string? ColumnRole = null,
    string? ActionKind = null,
    string? ComponentKind = null,
    string? UserNote = null);

public sealed record RegistrationUserDecision(
    string ProposalId,
    ProposalReviewStatus Status,
    DateTimeOffset DecidedAt,
    string? Note,
    RegistrationProposal Proposal);

public sealed record ExistingAppAnalysis(
    int SchemaVersion,
    string AnalysisId,
    string ApplicationId,
    string DisplayName,
    string RootPathFingerprint,
    RegistrationFramework Framework,
    string ProjectFile,
    ProjectFileAnalysis Project,
    DateTimeOffset AnalyzedAt,
    string SourceInventoryHash,
    string AdapterVersion,
    SourceInventory Inventory,
    IReadOnlyList<UiSourceFinding> Findings,
    IReadOnlyList<CodeActionFinding> ActionFindings,
    IReadOnlyList<RegistrationProposal> Proposals,
    IReadOnlyList<string> Warnings,
    IReadOnlyList<string> Blockers,
    IReadOnlyList<RegistrationUserDecision> UserDecisions);

public sealed record RegistrationRegistryEntry(
    string Id,
    string Name,
    string Type,
    string Role,
    string? ParentId,
    int Order,
    bool Visible,
    bool Editable,
    IReadOnlyList<string> AllowedOps,
    IReadOnlyList<string> LockedOps,
    SourceLocation SourceLocation,
    string? DeclaredName,
    string StructuralPath,
    string? FieldKind = null,
    string? ColumnRole = null,
    string? ActionKind = null,
    string? ComponentKind = null);

public sealed record GeneratedRegistrationRegistry(
    int SchemaVersion,
    string ApplicationId,
    string AnalysisId,
    string Fingerprint,
    IReadOnlyList<RegistrationRegistryEntry> Elements);

public sealed record RegistrationGeneratedFile(string RelativePath, byte[] Content, string Ownership, string Description);

public sealed record RegistrationPreviewFile(
    string RelativePath,
    RegistrationFileAction Action,
    bool Exists,
    bool ManagerOwned,
    string? OldHash,
    string? NewHash,
    bool BackupRequired,
    string? ExactDiff,
    string? Conflict,
    string Description);

public sealed record RegistrationPreview(
    string PreviewId,
    string AnalysisId,
    string ApplicationId,
    string TargetRoot,
    string ProjectFile,
    DateTimeOffset CreatedAt,
    string SourceInventoryHash,
    IReadOnlyList<RegistrationPreviewFile> Files,
    IReadOnlyList<string> Warnings,
    IReadOnlyList<string> Blockers)
{
    public bool CanExecute => Blockers.Count == 0;
}

public sealed record RegistrationOwnedFile(
    string RelativePath,
    string InstalledHash,
    string Ownership,
    bool Created,
    string? OriginalHash,
    string? BackupRelativePath);

public sealed record ExistingAppRegistrationState(
    int SchemaVersion,
    string RegistrationId,
    string ApplicationId,
    string AnalysisId,
    string SourceInventoryHash,
    string RegistryFingerprint,
    string AdapterVersion,
    DateTimeOffset InstalledAt,
    DateTimeOffset UpdatedAt,
    RegistrationLifecycle Lifecycle,
    IReadOnlyList<RegistrationOwnedFile> Files,
    TargetStartConfiguration TargetStart,
    TargetStartConfiguration EditorStart);

public sealed record RegistrationValidationIssue(string Code, string Message, string? ProposalId = null, string? Field = null);
public sealed record RegistrationValidationResult(IReadOnlyList<RegistrationValidationIssue> Issues)
{
    public bool Success => Issues.Count == 0;
}

public sealed record RegistrationAnalysisResult(ExistingAppAnalysis? Analysis, ManagerResult Result, bool TargetByteIdentical);
public sealed record RegistrationPreviewResult(RegistrationPreview? Preview, GeneratedRegistrationRegistry? Registry, ManagerResult Result);
