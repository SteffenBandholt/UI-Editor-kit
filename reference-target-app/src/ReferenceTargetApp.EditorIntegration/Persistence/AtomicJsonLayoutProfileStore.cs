using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using ReferenceTargetApp.EditorIntegration.HostAdapter;

namespace ReferenceTargetApp.EditorIntegration.Persistence;

public sealed class AtomicJsonLayoutProfileStore
{
    public const string ApplicationId = "reference-target-app";
    private readonly string rootDirectory;
    private readonly string documentApplicationId;
    private readonly JsonSerializerOptions jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        WriteIndented = true
    };

    public AtomicJsonLayoutProfileStore(string rootDirectory, string? applicationId = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(rootDirectory);
        this.rootDirectory = Path.GetFullPath(rootDirectory);
        documentApplicationId = string.IsNullOrWhiteSpace(applicationId) ? ApplicationId : applicationId;
    }

    public string RootDirectory => rootDirectory;
    public string DocumentApplicationId => documentApplicationId;
    public string GetFilePath(string profileId)
    {
        if (LayoutProfileCatalog.Find(profileId) is null)
            throw new ArgumentException("Unbekannte profileId.", nameof(profileId));
        return Path.Combine(rootDirectory, $"{profileId}.layout-profile.json");
    }

    public async Task<LayoutProfileSaveResult> SaveAsync(
        string profileId,
        IReadOnlyDictionary<string, IHostAdapter> adapters,
        IReadOnlyDictionary<string, LayoutState> states,
        CancellationToken cancellationToken = default,
        IReadOnlyDictionary<string, IReadOnlyDictionary<string, IReadOnlyList<string>>>? explicitOperations = null)
    {
        var path = GetFilePath(profileId);
        PersistedLayoutProfileDocument document;
        try
        {
            document = LayoutProfileDocumentFactory.Create(documentApplicationId, profileId, adapters, states, DateTimeOffset.UtcNow, explicitOperations);
        }
        catch (Exception exception) when (exception is ArgumentException or InvalidOperationException)
        {
            return new(false, "invalid_layout_document", exception.Message, path);
        }
        var validation = LayoutProfileDocumentValidator.Validate(document, documentApplicationId, profileId, adapters);
        if (!validation.Success)
            return new(false, validation.Errors[0].Code, validation.Errors[0].Message, path, document);
        var temporaryPath = Path.Combine(rootDirectory, $".{profileId}.{Guid.NewGuid():N}.tmp");
        try
        {
            Directory.CreateDirectory(rootDirectory);
            await using (var stream = new FileStream(temporaryPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096,
                             FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await JsonSerializer.SerializeAsync(stream, document, jsonOptions, cancellationToken);
                await stream.FlushAsync(cancellationToken);
                stream.Flush(flushToDisk: true);
            }
            if (File.Exists(path)) File.Replace(temporaryPath, path, null, ignoreMetadataErrors: true);
            else File.Move(temporaryPath, path);
            return new(true, "layout_profile_saved", "Layoutprofil wurde atomar gespeichert.", path, document);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)
        {
            return new(false, "storage_write_failed", $"Layoutprofil konnte nicht gespeichert werden: {exception.Message}", path, document);
        }
        finally
        {
            try { if (File.Exists(temporaryPath)) File.Delete(temporaryPath); }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { }
        }
    }

    public async Task<LayoutProfileLoadResult> LoadAsync(
        string profileId,
        IReadOnlyDictionary<string, IHostAdapter> adapters,
        CancellationToken cancellationToken = default,
        bool allowCompatibleRegistryReconciliation = false)
    {
        var path = GetFilePath(profileId);
        if (!File.Exists(path))
            return new(true, false, "layout_profile_not_found", "Für dieses Profil ist noch kein Layout gespeichert.", path);
        try
        {
            await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.Asynchronous);
            var document = await JsonSerializer.DeserializeAsync<PersistedLayoutProfileDocument>(stream, jsonOptions, cancellationToken);
            var validation = LayoutProfileDocumentValidator.Validate(document, documentApplicationId, profileId, adapters);
            var compatibleRegistryErrors = new HashSet<string>(
                ["incompatible_registry", "unknown_element", "missing_element", "operation_not_allowed", "missing_scope", "unknown_scope"],
                StringComparer.Ordinal);
            if (!validation.Success && allowCompatibleRegistryReconciliation && document is not null &&
                validation.Errors.All(error => compatibleRegistryErrors.Contains(error.Code)))
            {
                var reconciled = ReconcileRegistry(document, adapters);
                var reconciledValidation = LayoutProfileDocumentValidator.Validate(reconciled, documentApplicationId, profileId, adapters);
                if (reconciledValidation.Success)
                    return new(true, true, "layout_profile_registry_reconciled", "Stabile Profilwerte wurden mit der aktuellen Registry abgeglichen; neue Elemente verwenden ihre Baseline.", path, reconciled, validation.Errors);
            }
            if (!validation.Success)
                return new(false, true, validation.Errors[0].Code, validation.Errors[0].Message, path, document, validation.Errors);
            return new(true, true, "layout_profile_loaded", "Layoutprofil wurde vom Datenträger geladen und validiert.", path, document);
        }
        catch (JsonException exception)
        {
            var code = exception.Message.Contains("schemaVersion", StringComparison.OrdinalIgnoreCase)
                ? "invalid_layout_document" : "invalid_json";
            return new(false, true, code, $"Layoutprofildatei ist beschädigt: {exception.Message}", path);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return new(false, true, "storage_read_failed", $"Layoutprofil konnte nicht gelesen werden: {exception.Message}", path);
        }
    }

    private PersistedLayoutProfileDocument ReconcileRegistry(
        PersistedLayoutProfileDocument source,
        IReadOnlyDictionary<string, IHostAdapter> adapters)
    {
        var sourceScopes = source.Scopes.ToDictionary(scope => scope.ScopeId, StringComparer.Ordinal);
        var scopes = adapters.OrderBy(pair => pair.Key, StringComparer.Ordinal).Select(pair =>
        {
            var registry = pair.Value.GetRegistry();
            var baseline = pair.Value.GetCurrentLayoutState().Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
            var saved = sourceScopes.TryGetValue(pair.Key, out var sourceScope)
                ? sourceScope.LayoutState.Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal)
                : new Dictionary<string, PersistedElementLayout>(StringComparer.Ordinal);
            var elements = registry.Entries.OrderBy(entry => entry.ElementId, StringComparer.Ordinal).Select(entry =>
            {
                var fallback = baseline[entry.ElementId];
                saved.TryGetValue(entry.ElementId, out var previous);
                return new PersistedElementLayout(
                    entry.ElementId,
                    entry.ScopeId,
                    entry.Capabilities.HasFlag(Registry.UiCapability.Position) ? previous?.X ?? fallback.X : null,
                    entry.Capabilities.HasFlag(Registry.UiCapability.Position) ? previous?.Y ?? fallback.Y : null,
                    entry.Capabilities.HasFlag(Registry.UiCapability.Width) ? previous?.Width ?? fallback.Width : null,
                    entry.Capabilities.HasFlag(Registry.UiCapability.Height) ? previous?.Height ?? fallback.Height : null,
                    entry.Capabilities.HasFlag(Registry.UiCapability.TextPosition) ? previous?.TextOffsetX ?? fallback.TextOffsetX : null,
                    entry.Capabilities.HasFlag(Registry.UiCapability.TextPosition) ? previous?.TextOffsetY ?? fallback.TextOffsetY : null,
                    entry.Capabilities.HasFlag(Registry.UiCapability.FontSize) ? previous?.FontSize ?? fallback.FontSize : null,
                    entry.Capabilities.HasFlag(Registry.UiCapability.Visibility) ? previous?.Visible ?? fallback.Visible : null,
                    entry.Capabilities.HasFlag(Registry.UiCapability.Spacing) ? previous?.Spacing ?? fallback.Spacing ?? new Dictionary<string, double>(StringComparer.Ordinal) : null);
            }).ToArray();
            var reconciledOperations = sourceScope?.ExplicitOperations?
                .Where(operation => baseline.ContainsKey(operation.Key))
                .ToDictionary(operation => operation.Key, operation => operation.Value, StringComparer.Ordinal);
            return new PersistedLayoutScope(pair.Key, RegistryFingerprint.Create(registry), new(elements), reconciledOperations);
        }).ToArray();
        return new(LayoutProfileDocumentFactory.SchemaVersion, documentApplicationId, source.ProfileId, source.SavedAt, scopes);
    }
}
