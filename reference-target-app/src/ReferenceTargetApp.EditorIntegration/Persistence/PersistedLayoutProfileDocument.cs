namespace ReferenceTargetApp.EditorIntegration.Persistence;

public sealed record PersistedLayoutProfileDocument(
    int SchemaVersion,
    string ApplicationId,
    string ProfileId,
    DateTimeOffset SavedAt,
    IReadOnlyList<PersistedLayoutScope> Scopes);

public sealed record PersistedLayoutScope(
    string ScopeId,
    string RegistryFingerprint,
    PersistedLayoutState LayoutState,
    IReadOnlyDictionary<string, IReadOnlyList<string>>? ExplicitOperations = null);

public sealed record LayoutProfileLoadResult(
    bool Success,
    bool Found,
    string Code,
    string Message,
    string FilePath,
    PersistedLayoutProfileDocument? Document = null,
    IReadOnlyList<LayoutPersistenceError>? Errors = null);

public sealed record LayoutProfileSaveResult(
    bool Success,
    string Code,
    string Message,
    string FilePath,
    PersistedLayoutProfileDocument? Document = null);
