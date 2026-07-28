using System.Text.Json;
using System.Text.Json.Serialization;
using System.IO;
using ReferenceTargetApp.EditorIntegration.Geometry;

namespace ReferenceTargetApp.EditorIntegration.Persistence;

public sealed record EditorPreferences(int SchemaVersion, string ApplicationId, string EditMode, DateTimeOffset SavedAt);

public sealed class EditorPreferenceStore
{
    private readonly string rootDirectory;
    private readonly string applicationId;
    private readonly JsonSerializerOptions jsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true,
    };

    public EditorPreferenceStore(string rootDirectory, string applicationId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(rootDirectory);
        ArgumentException.ThrowIfNullOrWhiteSpace(applicationId);
        this.rootDirectory = Path.GetFullPath(rootDirectory);
        this.applicationId = applicationId;
    }

    public string FilePath => Path.Combine(rootDirectory, "editor-preferences.json");

    public async Task<string> LoadEditModeAsync(CancellationToken cancellationToken = default)
    {
        if (!File.Exists(FilePath)) return GeometryEditModes.Guided;
        try
        {
            await using var stream = new FileStream(FilePath, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.Asynchronous);
            var document = await JsonSerializer.DeserializeAsync<EditorPreferences>(stream, jsonOptions, cancellationToken);
            return document is { SchemaVersion: 1 } && document.ApplicationId == applicationId
                ? GeometryEditModes.Normalize(document.EditMode)
                : GeometryEditModes.Guided;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)
        {
            return GeometryEditModes.Guided;
        }
    }

    public async Task<bool> SaveEditModeAsync(string editMode, CancellationToken cancellationToken = default)
    {
        var normalized = GeometryEditModes.Normalize(editMode);
        var temporary = Path.Combine(rootDirectory, $".editor-preferences.{Guid.NewGuid():N}.tmp");
        try
        {
            Directory.CreateDirectory(rootDirectory);
            await using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096,
                             FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await JsonSerializer.SerializeAsync(stream, new EditorPreferences(1, applicationId, normalized, DateTimeOffset.UtcNow), jsonOptions, cancellationToken);
                await stream.FlushAsync(cancellationToken);
                stream.Flush(true);
            }
            if (File.Exists(FilePath)) File.Replace(temporary, FilePath, null, true);
            else File.Move(temporary, FilePath);
            return true;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)
        {
            return false;
        }
        finally
        {
            try { if (File.Exists(temporary)) File.Delete(temporary); }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { }
        }
    }
}
