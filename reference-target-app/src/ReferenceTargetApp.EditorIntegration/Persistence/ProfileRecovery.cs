using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using ReferenceTargetApp.EditorIntegration.Electron;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Pdf;

namespace ReferenceTargetApp.EditorIntegration.Persistence;

public enum ProfileCompatibilityState
{
    Compatible,
    MigrationAvailable,
    Incompatible,
    Corrupt,
    Missing,
    Blocked,
    Archived
}

public sealed record ProfileRecoveryContext(
    string ApplicationId,
    string Workspace,
    string ContractVersion,
    string RegistryVersion,
    string CurrentFingerprint,
    string? DocumentTypeId = null);

public sealed record ProfileInspection(
    ProfileCompatibilityState State,
    string Workspace,
    string FilePath,
    string Code,
    string Message,
    string ApplicationId,
    string? SchemaVersion,
    string? DocumentTypeId,
    string? StoredFingerprint,
    string CurrentFingerprint,
    bool MigrationAvailable,
    PersistedLayoutProfileDocument? UiDocument = null,
    PdfLayoutProfileDocument? PdfDocument = null,
    string? CauseCode = null,
    string? MigrationReport = null)
{
    public string StateValue => State switch
    {
        ProfileCompatibilityState.Compatible => "compatible",
        ProfileCompatibilityState.MigrationAvailable => "migrationAvailable",
        ProfileCompatibilityState.Incompatible => "incompatible",
        ProfileCompatibilityState.Corrupt => "corrupt",
        ProfileCompatibilityState.Missing => "missing",
        ProfileCompatibilityState.Blocked => "blocked",
        ProfileCompatibilityState.Archived => "archived",
        _ => "blocked"
    };
}

public sealed record ProfileArchiveResult(
    bool Success,
    string Code,
    string Message,
    string OriginalPath,
    string? ArchivePath = null,
    string? MetadataPath = null,
    string? Sha256 = null)
{
    public ProfileCompatibilityState State => Success ? ProfileCompatibilityState.Archived : ProfileCompatibilityState.Blocked;
}

public sealed class ProfileArchiveService(string profileRoot)
{
    private readonly string root = Path.GetFullPath(profileRoot ?? throw new ArgumentNullException(nameof(profileRoot)));
    private readonly JsonSerializerOptions jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true
    };

    public async Task<ProfileArchiveResult> ArchiveAsync(
        ProfileInspection inspection,
        ProfileRecoveryContext context,
        string reason,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(inspection);
        ArgumentNullException.ThrowIfNull(context);
        var source = Path.GetFullPath(inspection.FilePath);
        if (!IsInsideRoot(source) || !File.Exists(source))
            return Failed("electron_profile_archive_failed", "Das betroffene Profil ist nicht sicher archivierbar.", source);

        var applicationDirectory = Path.Combine(root, "archive", SafePart(context.ApplicationId));
        var original = new FileInfo(source);
        var timestamp = DateTimeOffset.UtcNow;
        var stem = $"{timestamp:yyyyMMddTHHmmssfffZ}_{SafePart(reason)}_{SafeFileName(original.Name)}";
        var archivePath = UniquePath(applicationDirectory, stem);
        var metadataPath = archivePath + ".metadata.json";
        var metadataTemporaryPath = metadataPath + $".{Guid.NewGuid():N}.tmp";
        string sha256;
        try
        {
            Directory.CreateDirectory(applicationDirectory);
            sha256 = await HashAsync(source, cancellationToken).ConfigureAwait(false);
            var metadata = new ProfileArchiveMetadata(
                1,
                Path.GetFileName(archivePath),
                context.ApplicationId,
                context.Workspace,
                original.Name,
                original.LastWriteTimeUtc,
                timestamp,
                reason,
                inspection.StateValue,
                inspection.SchemaVersion,
                context.ContractVersion,
                context.RegistryVersion,
                inspection.StoredFingerprint,
                context.CurrentFingerprint,
                context.DocumentTypeId,
                sha256);
            await WriteMetadataAsync(metadataTemporaryPath, metadata, cancellationToken).ConfigureAwait(false);
            File.Move(metadataTemporaryPath, metadataPath);
            try
            {
                File.Move(source, archivePath);
                var archivedHash = await HashAsync(archivePath, cancellationToken).ConfigureAwait(false);
                if (!string.Equals(sha256, archivedHash, StringComparison.Ordinal))
                    throw new IOException("Hashpruefung des Archivs ist fehlgeschlagen.");
            }
            catch
            {
                if (!File.Exists(source) && File.Exists(archivePath)) File.Move(archivePath, source);
                if (File.Exists(metadataPath)) File.Delete(metadataPath);
                throw;
            }
            return new(true, "electron_profile_archived", "Das Altprofil wurde bytegleich archiviert.", source,
                archivePath, metadataPath, sha256);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException or OperationCanceledException)
        {
            return Failed("electron_profile_archive_failed", "Das Altprofil konnte nicht sicher archiviert werden.", source);
        }
        finally
        {
            try { if (File.Exists(metadataTemporaryPath)) File.Delete(metadataTemporaryPath); }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { }
        }
    }

    public ProfileArchiveResult Restore(ProfileArchiveResult archive)
    {
        if (!archive.Success || string.IsNullOrWhiteSpace(archive.ArchivePath) || !File.Exists(archive.ArchivePath))
            return Failed("electron_profile_migration_failed", "Das archivierte Profil kann nicht zurueckgerollt werden.", archive.OriginalPath);
        try
        {
            if (File.Exists(archive.OriginalPath)) File.Delete(archive.OriginalPath);
            File.Move(archive.ArchivePath, archive.OriginalPath);
            if (!string.IsNullOrWhiteSpace(archive.MetadataPath) && File.Exists(archive.MetadataPath)) File.Delete(archive.MetadataPath);
            return new(true, "electron_profile_archive_restored", "Das Altprofil wurde vollstaendig wiederhergestellt.", archive.OriginalPath);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return Failed("electron_profile_migration_failed", "Migration und Profilrollback sind fehlgeschlagen.", archive.OriginalPath);
        }
    }

    private bool IsInsideRoot(string path)
    {
        var relative = Path.GetRelativePath(root, path);
        return relative != ".." && !relative.StartsWith(".." + Path.DirectorySeparatorChar, StringComparison.Ordinal) &&
               !Path.IsPathRooted(relative) && !relative.StartsWith("archive" + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
    }

    private static ProfileArchiveResult Failed(string code, string message, string originalPath) =>
        new(false, code, message, originalPath);

    private static string SafePart(string value)
    {
        var safe = new string(value.Select(character => char.IsLetterOrDigit(character) || character is '-' or '_' ? character : '-').ToArray());
        return string.IsNullOrWhiteSpace(safe) ? "unknown" : safe;
    }

    private static string SafeFileName(string value) => Path.GetFileName(value).Replace(' ', '-');

    private static string UniquePath(string directory, string stem)
    {
        var candidate = Path.Combine(directory, stem);
        for (var counter = 1; File.Exists(candidate) || File.Exists(candidate + ".metadata.json"); counter++)
            candidate = Path.Combine(directory, $"{stem}_{counter}");
        return candidate;
    }

    private static async Task<string> HashAsync(string path, CancellationToken cancellationToken)
    {
        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, FileOptions.Asynchronous | FileOptions.SequentialScan);
        var hash = await SHA256.HashDataAsync(stream, cancellationToken).ConfigureAwait(false);
        return Convert.ToHexString(hash);
    }

    private async Task WriteMetadataAsync(string path, ProfileArchiveMetadata metadata, CancellationToken cancellationToken)
    {
        await using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096,
            FileOptions.Asynchronous | FileOptions.WriteThrough);
        await JsonSerializer.SerializeAsync(stream, metadata, jsonOptions, cancellationToken).ConfigureAwait(false);
        await stream.FlushAsync(cancellationToken).ConfigureAwait(false);
        stream.Flush(true);
    }

    private sealed record ProfileArchiveMetadata(
        int SchemaVersion,
        string ArchiveId,
        string ApplicationId,
        string Workspace,
        string OriginalFileName,
        DateTime OriginalLastWriteTimeUtc,
        DateTimeOffset ArchivedAtUtc,
        string Reason,
        string Classification,
        string? ProfileSchemaVersion,
        string ContractVersion,
        string RegistryVersion,
        string? StoredFingerprint,
        string CurrentFingerprint,
        string? DocumentTypeId,
        string Sha256);
}

public sealed class LayoutProfileRecoveryService(
    IReadOnlyDictionary<string, IHostAdapter> adapters,
    AtomicJsonLayoutProfileStore store)
{
    public async Task<ProfileInspection> InspectAsync(string profileId, CancellationToken cancellationToken = default)
    {
        var currentFingerprint = string.Join(";", adapters.OrderBy(pair => pair.Key, StringComparer.Ordinal)
            .Select(pair => $"{pair.Key}={RegistryFingerprint.Create(pair.Value.GetRegistry())}"));
        var load = await store.LoadAsync(profileId, adapters, cancellationToken, allowCompatibleRegistryReconciliation: false).ConfigureAwait(false);
        if (load.Success && load.Found)
            return Inspection(ProfileCompatibilityState.Compatible, load, currentFingerprint, false);
        if (load.Success && !load.Found)
            return Inspection(ProfileCompatibilityState.Missing, load, currentFingerprint, false);
        if (load.Code == "storage_read_failed")
            return Inspection(ProfileCompatibilityState.Blocked, load, currentFingerprint, false);
        if (load.Code is "invalid_json" or "invalid_layout_document" or "invalid_layout_value" or "duplicate_scope" or "duplicate_element")
            return Inspection(ProfileCompatibilityState.Corrupt, load, currentFingerprint, false);
        var migration = load.Document is not null && TryCreateSafeMigration(load.Document, profileId, out _);
        return Inspection(migration ? ProfileCompatibilityState.MigrationAvailable : ProfileCompatibilityState.Incompatible,
            load, currentFingerprint, migration);
    }

    public async Task<LayoutProfileSaveResult> MigrateAsync(
        ProfileInspection inspection,
        string profileId,
        ProfileArchiveService archiveService,
        ProfileRecoveryContext context,
        CancellationToken cancellationToken = default)
    {
        if (inspection.State != ProfileCompatibilityState.MigrationAvailable || inspection.UiDocument is null ||
            !TryCreateSafeMigration(inspection.UiDocument, profileId, out var states))
            return new(false, "electron_profile_migration_failed", "Das Profil ist nicht eindeutig sicher migrierbar.", inspection.FilePath);
        var archive = await archiveService.ArchiveAsync(inspection, context, "safe-migration", cancellationToken).ConfigureAwait(false);
        if (!archive.Success) return new(false, archive.Code, archive.Message, inspection.FilePath);
        var saved = await store.SaveAsync(profileId, adapters, states, cancellationToken).ConfigureAwait(false);
        if (saved.Success)
        {
            var verified = await store.LoadAsync(profileId, adapters, cancellationToken, false).ConfigureAwait(false);
            if (verified.Success && verified.Found) return saved with { Code = "electron_profile_migrated", Message = "Profil wurde sicher migriert und validiert." };
        }
        try { if (File.Exists(inspection.FilePath)) File.Delete(inspection.FilePath); }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { }
        var rollback = archiveService.Restore(archive);
        return new(false, "electron_profile_migration_failed",
            rollback.Success ? "Migration ist fehlgeschlagen; das Altprofil wurde wiederhergestellt." : rollback.Message,
            inspection.FilePath);
    }

    private ProfileInspection Inspection(ProfileCompatibilityState state, LayoutProfileLoadResult load,
        string currentFingerprint, bool migrationAvailable)
    {
        var stored = load.Document?.Scopes is null ? null : string.Join(";", load.Document.Scopes.OrderBy(scope => scope.ScopeId, StringComparer.Ordinal)
            .Select(scope => $"{scope.ScopeId}={scope.RegistryFingerprint}"));
        var migrationReport = migrationAvailable && load.Document?.Scopes is not null
            ? $"Unverändert übernommen: {string.Join(", ", load.Document.Scopes.Select(scope => scope.ScopeId).OrderBy(value => value, StringComparer.Ordinal))}. " +
              $"Neu aus der Ziel-App-Baseline: {string.Join(", ", adapters.Keys.Except(load.Document.Scopes.Select(scope => scope.ScopeId), StringComparer.Ordinal).OrderBy(value => value, StringComparer.Ordinal))}."
            : null;
        var code = state switch
        {
            ProfileCompatibilityState.Incompatible => ElectronEditorErrorCodes.ProfileIncompatible,
            ProfileCompatibilityState.Corrupt => ElectronEditorErrorCodes.ProfileCorrupt,
            ProfileCompatibilityState.MigrationAvailable => ElectronEditorErrorCodes.ProfileMigrationAvailable,
            _ => load.Code
        };
        return new(state, "ui", load.FilePath, code, UserMessage(state), load.Document?.ApplicationId ?? store.DocumentApplicationId,
            load.Document?.SchemaVersion.ToString(), null, stored, currentFingerprint, migrationAvailable, load.Document,
            CauseCode: code == load.Code ? null : load.Code, MigrationReport: migrationReport);
    }

    private bool TryCreateSafeMigration(PersistedLayoutProfileDocument source, string profileId,
        out IReadOnlyDictionary<string, LayoutState> states)
    {
        states = new Dictionary<string, LayoutState>();
        if (source.SchemaVersion != LayoutProfileDocumentFactory.SchemaVersion || source.ApplicationId != store.DocumentApplicationId ||
            source.ProfileId != profileId || source.SavedAt == default || source.Scopes is null)
            return false;
        var byScope = source.Scopes.ToDictionary(scope => scope.ScopeId, StringComparer.Ordinal);
        if (source.Scopes.Count == adapters.Count || source.Scopes.Any(scope => !adapters.ContainsKey(scope.ScopeId))) return false;
        var result = adapters.ToDictionary(pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal);
        foreach (var scope in source.Scopes)
        {
            var adapter = adapters[scope.ScopeId];
            if (scope.RegistryFingerprint != RegistryFingerprint.Create(adapter.GetRegistry())) return false;
            var legacy = new PersistedLayoutDocument(PersistedLayoutDocumentFactory.SchemaVersion, source.ApplicationId, source.ProfileId,
                scope.ScopeId, source.SavedAt, scope.RegistryFingerprint, scope.LayoutState);
            var validation = LayoutDocumentValidator.Validate(legacy,
                LayoutProfileDocumentFactory.ScopeOptions(source.ApplicationId, source.ProfileId, scope.ScopeId), adapter.GetRegistry());
            if (!validation.Success) return false;
            var baseline = result[scope.ScopeId].Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
            result[scope.ScopeId] = new LayoutState(scope.ScopeId, source.SavedAt, scope.LayoutState.Elements.Select(element =>
            {
                var fallback = baseline[element.ElementId];
                return new ElementLayoutState(element.ElementId, element.ScopeId,
                    element.X ?? fallback.X, element.Y ?? fallback.Y, element.Width ?? fallback.Width, element.Height ?? fallback.Height,
                    element.TextOffsetX ?? fallback.TextOffsetX, element.TextOffsetY ?? fallback.TextOffsetY,
                    element.FontSize ?? fallback.FontSize, element.Visible ?? fallback.Visible,
                    element.Spacing ?? fallback.Spacing, element.Table ?? fallback.Table);
            }).ToArray());
        }
        states = result;
        return true;
    }

    private static string UserMessage(ProfileCompatibilityState state) => state switch
    {
        ProfileCompatibilityState.Corrupt => "Das gespeicherte UI-Layout ist beschaedigt.",
        ProfileCompatibilityState.Blocked => "Das gespeicherte UI-Layout kann derzeit nicht sicher gelesen werden.",
        ProfileCompatibilityState.MigrationAvailable => "Das UI-Layout kann eindeutig sicher migriert werden.",
        ProfileCompatibilityState.Incompatible => "Das gespeicherte UI-Layout passt nicht mehr zur aktuellen Registry.",
        ProfileCompatibilityState.Missing => "Es ist noch kein UI-Layout gespeichert.",
        _ => "Das gespeicherte UI-Layout ist kompatibel."
    };
}

public sealed class PdfProfileRecoveryService(AtomicJsonPdfLayoutProfileStore store)
{
    public async Task<ProfileInspection> InspectAsync(PdfElementRegistry registry, CancellationToken cancellationToken = default)
    {
        var currentFingerprint = PdfRegistryFingerprint.Create(registry);
        var load = await store.LoadAsync(registry, cancellationToken).ConfigureAwait(false);
        var state = load.Success && load.Found ? ProfileCompatibilityState.Compatible
            : load.Success ? ProfileCompatibilityState.Missing
            : load.Code == PdfErrorCodes.LoadFailed ? ProfileCompatibilityState.Blocked
            : load.Code == PdfErrorCodes.ProfileInvalid && IsIdentityIncompatible(load.Document, registry) ? ProfileCompatibilityState.Incompatible
            : load.Code == PdfErrorCodes.ProfileInvalid ? ProfileCompatibilityState.Corrupt
            : ProfileCompatibilityState.Incompatible;
        var code = state switch
        {
            ProfileCompatibilityState.Incompatible => ElectronEditorErrorCodes.ProfileIncompatible,
            ProfileCompatibilityState.Corrupt => ElectronEditorErrorCodes.ProfileCorrupt,
            _ => load.Code
        };
        return new(state, "pdf", load.FilePath, code, state switch
        {
            ProfileCompatibilityState.Corrupt => "Das gespeicherte PDF-Layout ist beschaedigt.",
            ProfileCompatibilityState.Blocked => "Das gespeicherte PDF-Layout kann derzeit nicht sicher gelesen werden.",
            ProfileCompatibilityState.Incompatible => "Das gespeicherte PDF-Layout passt nicht mehr zur aktuellen Registry.",
            ProfileCompatibilityState.Missing => "Es ist noch kein PDF-Layout gespeichert.",
            _ => "Das gespeicherte PDF-Layout ist kompatibel."
        }, load.Document?.ApplicationId ?? registry.Document.ApplicationId, load.Document?.SchemaVersion.ToString(),
            load.Document?.DocumentType, load.Document?.RegistryFingerprint, currentFingerprint, false, PdfDocument: load.Document,
            CauseCode: code == load.Code ? null : load.Code);
    }

    private static bool IsIdentityIncompatible(PdfLayoutProfileDocument? document, PdfElementRegistry registry) =>
        document is not null &&
        (document.SchemaVersion != PdfLayoutProfileDocumentValidator.SchemaVersion ||
         document.DocumentKind != PdfLayoutProfileDocumentValidator.DocumentKind ||
         document.ApplicationId != registry.Document.ApplicationId ||
         document.DocumentType != registry.Document.DocumentType ||
         document.ProfileId != PdfLayoutProfileDocumentValidator.ProfileId ||
         document.ScopeId != registry.Document.DocumentId ||
         document.LayoutState?.ScopeId != registry.Document.DocumentId);
}
