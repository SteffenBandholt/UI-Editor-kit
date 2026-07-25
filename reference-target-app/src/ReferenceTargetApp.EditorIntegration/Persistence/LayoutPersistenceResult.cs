namespace ReferenceTargetApp.EditorIntegration.Persistence;

public sealed record LayoutPersistenceError(string Code, string Message, string? Field = null);

public sealed record LayoutDocumentValidationResult(IReadOnlyList<LayoutPersistenceError> Errors)
{
    public bool Success => Errors.Count == 0;
}

public sealed record LayoutSaveResult(
    bool Success,
    string Code,
    string Message,
    string FilePath,
    PersistedLayoutDocument? Document = null);

public sealed record LayoutLoadResult(
    bool Success,
    bool Found,
    string Code,
    string Message,
    string FilePath,
    PersistedLayoutDocument? Document = null,
    IReadOnlyList<LayoutPersistenceError>? Errors = null);
