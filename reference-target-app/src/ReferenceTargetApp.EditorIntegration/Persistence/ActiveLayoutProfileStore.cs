using System.IO;
using System.Text.Json;

namespace ReferenceTargetApp.EditorIntegration.Persistence;

public sealed class ActiveLayoutProfileStore
{
    private readonly string filePath;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = true };

    public ActiveLayoutProfileStore(string rootDirectory) =>
        filePath = Path.Combine(Path.GetFullPath(rootDirectory), "active-layout-profile.json");

    public string FilePath => filePath;

    public async Task<string> LoadAsync(CancellationToken cancellationToken = default)
    {
        if (!File.Exists(filePath)) return LayoutProfileCatalog.StandardId;
        try
        {
            await using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.Asynchronous);
            var selection = await JsonSerializer.DeserializeAsync<ActiveProfileSelection>(stream, JsonOptions, cancellationToken);
            return selection is { SchemaVersion: 1 } && LayoutProfileCatalog.Find(selection.ProfileId) is not null
                ? selection.ProfileId
                : LayoutProfileCatalog.StandardId;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)
        {
            return LayoutProfileCatalog.StandardId;
        }
    }

    public async Task<bool> SaveAsync(string profileId, CancellationToken cancellationToken = default)
    {
        if (LayoutProfileCatalog.Find(profileId) is null) return false;
        var directory = Path.GetDirectoryName(filePath)!;
        var temporaryPath = Path.Combine(directory, $".active-profile.{Guid.NewGuid():N}.tmp");
        try
        {
            Directory.CreateDirectory(directory);
            await using (var stream = new FileStream(temporaryPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096,
                             FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await JsonSerializer.SerializeAsync(stream, new ActiveProfileSelection(1, profileId), JsonOptions, cancellationToken);
                await stream.FlushAsync(cancellationToken);
                stream.Flush(true);
            }
            if (File.Exists(filePath)) File.Replace(temporaryPath, filePath, null, true);
            else File.Move(temporaryPath, filePath);
            return true;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)
        {
            return false;
        }
        finally
        {
            try { if (File.Exists(temporaryPath)) File.Delete(temporaryPath); }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { }
        }
    }

    private sealed record ActiveProfileSelection(int SchemaVersion, string ProfileId);
}
