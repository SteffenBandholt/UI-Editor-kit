using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using ReferenceTargetApp.EditorIntegration.HostAdapter;

namespace ReferenceTargetApp.EditorIntegration.Persistence;

public sealed class AtomicJsonLayoutProfileStore
{
    public const string ApplicationId = "reference-target-app";
    private readonly string rootDirectory;
    private readonly JsonSerializerOptions jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        WriteIndented = true
    };

    public AtomicJsonLayoutProfileStore(string rootDirectory)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(rootDirectory);
        this.rootDirectory = Path.GetFullPath(rootDirectory);
    }

    public string RootDirectory => rootDirectory;
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
        CancellationToken cancellationToken = default)
    {
        var path = GetFilePath(profileId);
        PersistedLayoutProfileDocument document;
        try
        {
            document = LayoutProfileDocumentFactory.Create(ApplicationId, profileId, adapters, states, DateTimeOffset.UtcNow);
        }
        catch (Exception exception) when (exception is ArgumentException or InvalidOperationException)
        {
            return new(false, "invalid_layout_document", exception.Message, path);
        }
        var validation = LayoutProfileDocumentValidator.Validate(document, ApplicationId, profileId, adapters);
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
        CancellationToken cancellationToken = default)
    {
        var path = GetFilePath(profileId);
        if (!File.Exists(path))
            return new(true, false, "layout_profile_not_found", "Für dieses Profil ist noch kein Layout gespeichert.", path);
        try
        {
            await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.Asynchronous);
            var document = await JsonSerializer.DeserializeAsync<PersistedLayoutProfileDocument>(stream, jsonOptions, cancellationToken);
            var validation = LayoutProfileDocumentValidator.Validate(document, ApplicationId, profileId, adapters);
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
}
