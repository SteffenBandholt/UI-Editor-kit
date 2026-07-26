namespace ReferenceTargetApp.EditorIntegration.Persistence;

public sealed record PersistedLayoutDocument(
    int SchemaVersion,
    string ApplicationId,
    string ProfileId,
    string ScopeId,
    DateTimeOffset SavedAt,
    string RegistryFingerprint,
    PersistedLayoutState LayoutState);

public sealed record PersistedLayoutState(IReadOnlyList<PersistedElementLayout> Elements);

public sealed record PersistedElementLayout(
    string ElementId,
    string ScopeId,
    double? X,
    double? Y,
    double? Width,
    double? Height,
    double? TextOffsetX,
    double? TextOffsetY,
    double? FontSize,
    bool? Visible = null);
