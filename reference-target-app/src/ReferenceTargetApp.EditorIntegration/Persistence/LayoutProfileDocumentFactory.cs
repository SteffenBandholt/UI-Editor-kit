using System.IO;
using ReferenceTargetApp.EditorIntegration.HostAdapter;

namespace ReferenceTargetApp.EditorIntegration.Persistence;

public static class LayoutProfileDocumentFactory
{
    public const int SchemaVersion = 2;

    public static PersistedLayoutProfileDocument Create(
        string applicationId,
        string profileId,
        IReadOnlyDictionary<string, IHostAdapter> adapters,
        IReadOnlyDictionary<string, LayoutState> states,
        DateTimeOffset savedAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(applicationId);
        ArgumentException.ThrowIfNullOrWhiteSpace(profileId);
        ArgumentNullException.ThrowIfNull(adapters);
        ArgumentNullException.ThrowIfNull(states);

        var scopes = adapters.OrderBy(pair => pair.Key, StringComparer.Ordinal).Select(pair =>
        {
            if (!states.TryGetValue(pair.Key, out var state))
                throw new InvalidOperationException($"LayoutState für Scope '{pair.Key}' fehlt.");
            var options = ScopeOptions(applicationId, profileId, pair.Key);
            var legacy = PersistedLayoutDocumentFactory.Create(options, pair.Value.GetRegistry(), state, savedAt);
            return new PersistedLayoutScope(pair.Key, legacy.RegistryFingerprint, legacy.LayoutState);
        }).ToArray();

        return new(SchemaVersion, applicationId, profileId, savedAt, scopes);
    }

    internal static LayoutPersistenceOptions ScopeOptions(string applicationId, string profileId, string scopeId) =>
        new(Path.GetTempPath(), applicationId, profileId, scopeId, "validation.layout.json");
}
