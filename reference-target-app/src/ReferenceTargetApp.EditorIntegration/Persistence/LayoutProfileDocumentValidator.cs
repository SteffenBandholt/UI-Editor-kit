using ReferenceTargetApp.EditorIntegration.HostAdapter;

namespace ReferenceTargetApp.EditorIntegration.Persistence;

public static class LayoutProfileDocumentValidator
{
    public static LayoutDocumentValidationResult Validate(
        PersistedLayoutProfileDocument? document,
        string applicationId,
        string profileId,
        IReadOnlyDictionary<string, IHostAdapter> adapters)
    {
        ArgumentNullException.ThrowIfNull(adapters);
        var errors = new List<LayoutPersistenceError>();
        if (document is null) return new([new("invalid_layout_document", "Profildokument fehlt.")]);
        if (document.SchemaVersion != LayoutProfileDocumentFactory.SchemaVersion)
            errors.Add(new("unsupported_schema_version", "schemaVersion wird nicht unterstützt.", "schemaVersion"));
        if (!string.Equals(document.ApplicationId, applicationId, StringComparison.Ordinal))
            errors.Add(new("wrong_application", "applicationId passt nicht zur Ziel-App.", "applicationId"));
        if (!string.Equals(document.ProfileId, profileId, StringComparison.Ordinal))
            errors.Add(new("wrong_profile", "profileId passt nicht zum aktiven Profil.", "profileId"));
        if (document.SavedAt == default)
            errors.Add(new("invalid_layout_document", "savedAt fehlt oder ist ungültig.", "savedAt"));
        if (document.Scopes is null)
            return new([.. errors, new("invalid_layout_document", "scopes fehlt.", "scopes")]);

        var byScope = new Dictionary<string, PersistedLayoutScope>(StringComparer.Ordinal);
        foreach (var scope in document.Scopes)
        {
            if (scope is null || string.IsNullOrWhiteSpace(scope.ScopeId))
            {
                errors.Add(new("invalid_layout_document", "Scope-ID fehlt.", "scopes.scopeId"));
                continue;
            }
            if (!byScope.TryAdd(scope.ScopeId, scope))
                errors.Add(new("duplicate_scope", $"Scope '{scope.ScopeId}' ist doppelt vorhanden.", "scopes.scopeId"));
            if (!adapters.ContainsKey(scope.ScopeId))
                errors.Add(new("unknown_scope", $"Scope '{scope.ScopeId}' ist nicht registriert.", "scopes.scopeId"));
        }

        foreach (var pair in adapters.OrderBy(pair => pair.Key, StringComparer.Ordinal))
        {
            if (!byScope.TryGetValue(pair.Key, out var scope))
            {
                errors.Add(new("missing_scope", $"Registrierter Scope '{pair.Key}' fehlt.", "scopes"));
                continue;
            }
            var legacy = new PersistedLayoutDocument(
                PersistedLayoutDocumentFactory.SchemaVersion,
                applicationId,
                profileId,
                scope.ScopeId,
                document.SavedAt,
                scope.RegistryFingerprint,
                scope.LayoutState);
            errors.AddRange(LayoutDocumentValidator.Validate(
                legacy,
                LayoutProfileDocumentFactory.ScopeOptions(applicationId, profileId, scope.ScopeId),
                pair.Value.GetRegistry()).Errors);
        }
        return new(errors);
    }
}
