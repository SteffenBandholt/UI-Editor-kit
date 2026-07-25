using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.EditorIntegration.Persistence;

public sealed class AtomicJsonLayoutStore
{
    private readonly LayoutPersistenceOptions options;
    private readonly JsonSerializerOptions jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true
    };

    public AtomicJsonLayoutStore(LayoutPersistenceOptions options)
    {
        this.options = options ?? throw new ArgumentNullException(nameof(options));
        FilePath = LayoutStoragePathResolver.GetLayoutFilePath(options);
    }

    public string FilePath { get; }
    public LayoutPersistenceOptions Options => options;

    public LayoutSaveResult Save(IUiElementRegistry registry, LayoutState layoutState, DateTimeOffset? savedAt = null)
    {
        var document = PersistedLayoutDocumentFactory.Create(options, registry, layoutState, savedAt ?? DateTimeOffset.UtcNow);
        var validation = LayoutDocumentValidator.Validate(document, options, registry);
        if (!validation.Success)
            return new(false, validation.Errors[0].Code, validation.Errors[0].Message, FilePath, document);

        var temporaryPath = Path.Combine(options.RootDirectory, $".{options.FileName}.{Guid.NewGuid():N}.tmp");
        try
        {
            Directory.CreateDirectory(options.RootDirectory);
            using (var stream = new FileStream(
                       temporaryPath,
                       FileMode.CreateNew,
                       FileAccess.Write,
                       FileShare.None,
                       4096,
                       FileOptions.WriteThrough))
            {
                JsonSerializer.Serialize(stream, document, jsonOptions);
                stream.Flush(flushToDisk: true);
            }

            if (File.Exists(FilePath)) File.Replace(temporaryPath, FilePath, null, ignoreMetadataErrors: true);
            else File.Move(temporaryPath, FilePath);
            return new(true, "layout_saved", "Layout wurde atomar gespeichert.", FilePath, document);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)
        {
            return new(false, "storage_write_failed", $"Layout konnte nicht gespeichert werden: {exception.Message}", FilePath, document);
        }
        finally
        {
            try { if (File.Exists(temporaryPath)) File.Delete(temporaryPath); }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
    }

    public LayoutLoadResult Load(IUiElementRegistry registry)
    {
        ArgumentNullException.ThrowIfNull(registry);
        if (!File.Exists(FilePath))
            return new(true, false, "layout_not_found", "Noch kein gespeichertes Layout vorhanden.", FilePath);

        try
        {
            using var stream = new FileStream(FilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            using var json = JsonDocument.Parse(stream);
            var shape = LayoutDocumentValidator.ValidateJsonShape(json.RootElement);
            if (!shape.Success)
                return Invalid(shape.Errors);

            var document = json.RootElement.Deserialize<PersistedLayoutDocument>(jsonOptions);
            var validation = LayoutDocumentValidator.Validate(document, options, registry);
            if (!validation.Success)
                return Invalid(validation.Errors, document);
            return new(true, true, "layout_loaded", "Layout wurde geladen und validiert.", FilePath, document);
        }
        catch (JsonException exception)
        {
            return new(false, true, "invalid_json", $"Layoutdatei enthält kein gültiges JSON: {exception.Message}", FilePath);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return new(false, true, "storage_read_failed", $"Layoutdatei konnte nicht gelesen werden: {exception.Message}", FilePath);
        }
    }

    public bool DeleteDiagnosticFile()
    {
        if (!File.Exists(FilePath)) return true;
        File.Delete(FilePath);
        return !File.Exists(FilePath);
    }

    private LayoutLoadResult Invalid(
        IReadOnlyList<LayoutPersistenceError> errors,
        PersistedLayoutDocument? document = null) => new(
            false,
            true,
            errors[0].Code,
            errors[0].Message,
            FilePath,
            document,
            errors);
}
