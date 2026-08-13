using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ReferenceTargetApp.EditorIntegration.Pdf;

public sealed record PdfLayoutProfileDocument(
    int SchemaVersion,
    string DocumentKind,
    string ApplicationId,
    string DocumentType,
    string ProfileId,
    string ScopeId,
    DateTimeOffset SavedAt,
    string RegistryFingerprint,
    PdfLayoutState LayoutState);

public sealed record PdfProfileSaveResult(bool Success, string Code, string Message, string FilePath, PdfLayoutProfileDocument? Document = null);
public sealed record PdfProfileLoadResult(bool Success, bool Found, string Code, string Message, string FilePath, PdfLayoutProfileDocument? Document = null);

public static class PdfLayoutProfileDocumentValidator
{
    public const int SchemaVersion = 1;
    public const string DocumentKind = "pdf-layout-profile";
    public const string ProfileId = "pdf-standard";

    public static (bool Success, string Code, string Message) Validate(PdfLayoutProfileDocument? document, PdfElementRegistry registry)
    {
        if (document is null) return Fail("PDF-Profildokument fehlt.");
        if (document.SchemaVersion != SchemaVersion) return Fail("PDF-Profilschema wird nicht unterstützt.");
        if (document.DocumentKind != DocumentKind) return Fail("Dokument ist kein PDF-Layoutprofil.");
        if (document.ApplicationId != registry.Document.ApplicationId) return Fail("applicationId passt nicht zur Ziel-App.");
        if (document.DocumentType != registry.Document.DocumentType) return Fail("PDF-Dokumenttyp ist falsch.");
        if (document.ProfileId != ProfileId) return Fail("PDF-profileId ist falsch.");
        if (document.ScopeId != registry.Document.DocumentId || document.LayoutState?.ScopeId != registry.Document.DocumentId) return Fail("PDF-Scope ist falsch.");
        if (document.SavedAt == default) return Fail("savedAt fehlt.");
        if (document.RegistryFingerprint != PdfRegistryFingerprint.Create(registry)) return Fail("PDF-Registry-Fingerprint ist inkompatibel.", PdfErrorCodes.LayoutIncompatible);
        if (document.LayoutState?.Elements is null) return Fail("PDF-LayoutState fehlt.");

        var expected = registry.Entries.OrderBy(element => element.StableOrder).ToArray();
        var actual = document.LayoutState.Elements;
        if (actual.Count != expected.Length || actual.Select(element => element.ElementId).Distinct(StringComparer.Ordinal).Count() != actual.Count)
            return Fail("PDF-Elementmenge ist unvollständig oder doppelt.");
        var byId = actual.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
        foreach (var definition in expected)
        {
            if (!byId.TryGetValue(definition.ElementId, out var state)) return Fail("PDF-Element fehlt: " + definition.ElementId);
            if (state.ScopeId != registry.Document.DocumentId || state.ElementId.StartsWith("ui.", StringComparison.Ordinal)) return Fail("UI-ID oder falscher Scope im PDF-Profil.");
            if (!AllowedFieldsMatch(definition, state) || !Finite(state)) return Fail("PDF-Layoutfelder passen nicht zu den Capabilities: " + definition.ElementId);
            var resolved = PdfLayoutStateFactory.Resolve(definition, state);
            if (resolved.Width <= 0 || resolved.Height <= 0 || resolved.FontSize is <= 0 || resolved.TextOffsetX is < 0 || resolved.TextOffsetY is < 0)
                return Fail("PDF-Layoutwerte sind ungültig: " + definition.ElementId);
        }
        var layoutValidation = PdfLayoutStateValidator.Validate(document.LayoutState, registry);
        if (!layoutValidation.Success) return layoutValidation;
        return (true, "pdf_profile_valid", "PDF-Layoutprofil ist gültig.");
    }

    internal static bool AllowedFieldsMatch(PdfElementDefinition definition, PdfElementLayoutState state) =>
        Present(state.X) == definition.Capabilities.HasFlag(PdfCapability.Position) &&
        Present(state.Y) == definition.Capabilities.HasFlag(PdfCapability.Position) &&
        Present(state.Width) == definition.Capabilities.HasFlag(PdfCapability.Width) &&
        Present(state.Height) == definition.Capabilities.HasFlag(PdfCapability.Height) &&
        Present(state.TextOffsetX) == definition.Capabilities.HasFlag(PdfCapability.TextPosition) &&
        Present(state.TextOffsetY) == definition.Capabilities.HasFlag(PdfCapability.TextPosition) &&
        Present(state.FontSize) == definition.Capabilities.HasFlag(PdfCapability.FontSize) &&
        (state.TextAlignment is not null) == definition.Capabilities.HasFlag(PdfCapability.TextAlignment) &&
        Present(state.LineSpacing) == definition.Capabilities.HasFlag(PdfCapability.LineSpacing) &&
        state.Visible.HasValue == definition.Capabilities.HasFlag(PdfCapability.Visibility) &&
        Present(state.MarginTop) == definition.Capabilities.HasFlag(PdfCapability.PageMargins) &&
        Present(state.MarginRight) == definition.Capabilities.HasFlag(PdfCapability.PageMargins) &&
        Present(state.MarginBottom) == definition.Capabilities.HasFlag(PdfCapability.PageMargins) &&
        Present(state.MarginLeft) == definition.Capabilities.HasFlag(PdfCapability.PageMargins);

    internal static bool Finite(PdfElementLayoutState state) =>
        new[] { state.X, state.Y, state.Width, state.Height, state.TextOffsetX, state.TextOffsetY, state.FontSize, state.LineSpacing,
                state.MarginTop, state.MarginRight, state.MarginBottom, state.MarginLeft }
            .Where(value => value.HasValue).All(value => double.IsFinite(value!.Value));
    private static bool Present(double? value) => value.HasValue;
    private static (bool, string, string) Fail(string message, string code = PdfErrorCodes.ProfileInvalid) => (false, code, message);
}

public static class PdfLayoutStateValidator
{
    private const double Epsilon = 0.000001;

    public static (bool Success, string Code, string Message) Validate(PdfLayoutState state, PdfElementRegistry registry)
    {
        var states = state.Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
        var boxes = registry.Entries.ToDictionary(element => element.ElementId,
            element => PdfLayoutStateFactory.Resolve(element, states[element.ElementId]), StringComparer.Ordinal);
        foreach (var table in registry.Entries.Where(element => element.Kind == PdfElementKind.Table))
        {
            var tableBox = boxes[table.ElementId];
            var nextColumnX = tableBox.X;
            foreach (var column in registry.Entries
                         .Where(element => element.Kind == PdfElementKind.TableColumn && element.ParentId == table.ElementId)
                         .OrderBy(element => element.StableOrder))
            {
                var columnBox = boxes[column.ElementId];
                boxes[column.ElementId] = columnBox with { X = nextColumnX };
                nextColumnX += columnBox.Width;
            }
        }
        foreach (var element in registry.Entries)
        {
            var box = boxes[element.ElementId];
            var page = registry.Document.PageTemplate;
            if (box.X < -Epsilon || box.Y < -Epsilon || box.X + box.Width > page.Width + Epsilon || box.Y + box.Height > page.Height + Epsilon)
                return (false, PdfErrorCodes.OutOfPageBounds, "PDF-Element überschreitet die Seitengrenze: " + element.ElementId);
            var zone = element.Kind == PdfElementKind.Header
                ? new PdfBox(page.HeaderArea.X, page.HeaderArea.Y, page.HeaderArea.Width, page.BodyArea.Y - page.HeaderArea.Y)
                : PdfRegistryValidator.Zone(page, element.PageArea);
            if (box.X < zone.X - Epsilon || box.Y < zone.Y - Epsilon || box.X + box.Width > zone.X + zone.Width + Epsilon ||
                box.Y + box.Height > zone.Y + zone.Height + Epsilon)
                return (false, PdfErrorCodes.InvalidPageZone, "PDF-Element verlässt seinen Seitenbereich: " + element.ElementId);
            if (box.TextOffsetX is < 0 || box.TextOffsetY is < 0 || box.TextOffsetX >= box.Width || box.TextOffsetY >= box.Height)
                return (false, PdfErrorCodes.InvalidPageZone, "PDF-Textposition liegt außerhalb des Elements: " + element.ElementId);
            if (element.Kind == PdfElementKind.TableColumn && box.Width < 5)
                return (false, PdfErrorCodes.InvalidColumnWidth, "PDF-Spaltenbreite ist kleiner als 5 mm: " + element.ElementId);
        }
        if (registry.Document.DocumentId != PdfRegistryIds.Scope)
        {
            foreach (var table in registry.Entries.Where(element => element.Kind == PdfElementKind.Table))
            {
                var columns = registry.Entries.Where(element => element.Kind == PdfElementKind.TableColumn && element.ParentId == table.ElementId);
                if (columns.Sum(column => boxes[column.ElementId].Width) > boxes[table.ElementId].Width + Epsilon)
                    return (false, PdfErrorCodes.InvalidTableWidth, "Spaltensumme ueberschreitet die PDF-Tabellenbreite.");
            }
            return (true, "pdf_layout_valid", "PDF-LayoutState ist gueltig.");
        }
        if (registry.Document.DocumentId == PdfRegistryIds.Scope)
        {
        var tableWidth = boxes[PdfRegistryIds.Table].Width;
        if (PdfRegistryIds.Columns.Sum(id => boxes[id].Width) > tableWidth + Epsilon)
            return (false, PdfErrorCodes.InvalidTableWidth, "Spaltensumme überschreitet die PDF-Tabellenbreite.");
        foreach (var parentId in new[] { PdfRegistryIds.Header, PdfRegistryIds.Footer })
        {
            var parent = boxes[parentId];
            var descendants = registry.Entries.Where(element => IsDescendant(element, parentId, registry));
            if (descendants.Any(element => boxes[element.ElementId].Y < parent.Y - Epsilon ||
                                           boxes[element.ElementId].Y + boxes[element.ElementId].Height > parent.Y + parent.Height + Epsilon))
                return (false, PdfErrorCodes.InvalidPageZone, "PDF-Bereichshöhe schneidet registrierte Kinder ab: " + parentId);
        }
        return (true, "pdf_layout_valid", "PDF-LayoutState ist gültig.");
        }
        return (false, PdfErrorCodes.ProfileInvalid, "PDF-LayoutState gehoert zu einer unbekannten Registry.");
    }

    private static bool IsDescendant(PdfElementDefinition element, string parentId, PdfElementRegistry registry)
    {
        var current = element;
        while (current.ParentId is not null)
        {
            if (current.ParentId == parentId) return true;
            current = registry.FindById(current.ParentId)!;
        }
        return false;
    }
}

public sealed class AtomicJsonPdfLayoutProfileStore
{
    private readonly string applicationId;
    private readonly string documentType;
    private readonly bool allowCompatibleRegistryReconciliation;
    private readonly JsonSerializerOptions jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        WriteIndented = true
    };

    public AtomicJsonPdfLayoutProfileStore(string applicationLayoutRoot, string? applicationId = null, string? documentType = null,
        bool allowCompatibleRegistryReconciliation = false)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(applicationLayoutRoot);
        this.applicationId = applicationId ?? PdfOrderDocumentRegistryFactory.ApplicationId;
        this.documentType = documentType ?? PdfOrderDocumentRegistryFactory.DocumentType;
        this.allowCompatibleRegistryReconciliation = allowCompatibleRegistryReconciliation;
        RootDirectory = Path.Combine(Path.GetFullPath(applicationLayoutRoot), "pdf-layouts");
        var fileName = applicationId is null && documentType is null
            ? "pdf-standard.pdf-layout.json"
            : $"{SafeFilePart(this.applicationId)}.{SafeFilePart(this.documentType)}.pdf-standard.pdf-layout.json";
        FilePath = Path.Combine(RootDirectory, fileName);
    }

    public string RootDirectory { get; }
    public string FilePath { get; }

    public async Task<PdfProfileSaveResult> SaveAsync(PdfElementRegistry registry, PdfLayoutState state, CancellationToken cancellationToken = default)
    {
        var document = new PdfLayoutProfileDocument(PdfLayoutProfileDocumentValidator.SchemaVersion,
            PdfLayoutProfileDocumentValidator.DocumentKind, applicationId,
            documentType, PdfLayoutProfileDocumentValidator.ProfileId,
            registry.Document.DocumentId, DateTimeOffset.UtcNow, PdfRegistryFingerprint.Create(registry), Clone(state));
        var validation = PdfLayoutProfileDocumentValidator.Validate(document, registry);
        if (!validation.Success) return new(false, validation.Code, validation.Message, FilePath, document);
        var temporaryPath = Path.Combine(RootDirectory, $".pdf-standard.{Guid.NewGuid():N}.tmp");
        try
        {
            Directory.CreateDirectory(RootDirectory);
            await using (var stream = new FileStream(temporaryPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096,
                             FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await JsonSerializer.SerializeAsync(stream, document, jsonOptions, cancellationToken).ConfigureAwait(false);
                await stream.FlushAsync(cancellationToken).ConfigureAwait(false);
                stream.Flush(true);
            }
            if (File.Exists(FilePath)) File.Replace(temporaryPath, FilePath, null, true);
            else File.Move(temporaryPath, FilePath);
            return new(true, "pdf_layout_saved", "PDF-Layoutprofil wurde atomar gespeichert.", FilePath, document);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException or NotSupportedException or InvalidOperationException)
        {
            return new(false, PdfErrorCodes.SaveFailed, "PDF-Layoutprofil konnte nicht gespeichert werden: " + exception.Message, FilePath, document);
        }
        finally
        {
            try { if (File.Exists(temporaryPath)) File.Delete(temporaryPath); }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { }
        }
    }

    public async Task<PdfProfileLoadResult> LoadAsync(PdfElementRegistry registry, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(FilePath)) return new(true, false, PdfErrorCodes.ProfileNotFound, "PDF-Layoutprofil ist noch nicht vorhanden.", FilePath);
        try
        {
            await using var stream = new FileStream(FilePath, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.Asynchronous);
            var document = await JsonSerializer.DeserializeAsync<PdfLayoutProfileDocument>(stream, jsonOptions, cancellationToken).ConfigureAwait(false);
            var validation = PdfLayoutProfileDocumentValidator.Validate(document, registry);
            if (!validation.Success && allowCompatibleRegistryReconciliation && TryReconcile(document, registry, out var reconciled))
                return new(true, true, "pdf_layout_reconciled", "PDF-Layoutprofil wurde mit der aktuellen Registry kontrolliert abgeglichen.", FilePath, reconciled);
            return validation.Success
                ? new(true, true, "pdf_layout_loaded", "PDF-Layoutprofil wurde vom Datenträger geladen.", FilePath, document)
                : new(false, true, validation.Code, validation.Message, FilePath, document);
        }
        catch (Exception exception) when (exception is JsonException or NotSupportedException or InvalidOperationException)
        {
            return new(false, true, PdfErrorCodes.ProfileInvalid, "PDF-Layoutprofildatei ist beschädigt: " + exception.Message, FilePath);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return new(false, true, PdfErrorCodes.LoadFailed, "PDF-Layoutprofil konnte nicht gelesen werden: " + exception.Message, FilePath);
        }
    }

    public static PdfLayoutState Clone(PdfLayoutState state) => new(state.ScopeId, state.CapturedAt, state.Elements.Select(element => element with { }).ToArray());

    private bool TryReconcile(PdfLayoutProfileDocument? source, PdfElementRegistry registry, out PdfLayoutProfileDocument reconciled)
    {
        reconciled = null!;
        if (source is null || source.SchemaVersion != PdfLayoutProfileDocumentValidator.SchemaVersion ||
            source.DocumentKind != PdfLayoutProfileDocumentValidator.DocumentKind || source.ApplicationId != applicationId ||
            source.DocumentType != documentType || source.ProfileId != PdfLayoutProfileDocumentValidator.ProfileId ||
            source.ScopeId != registry.Document.DocumentId || source.LayoutState?.ScopeId != registry.Document.DocumentId ||
            source.LayoutState.Elements is null || source.SavedAt == default)
            return false;
        var knownIds = registry.Entries.Select(entry => entry.ElementId).ToHashSet(StringComparer.Ordinal);
        var known = source.LayoutState.Elements.Where(element => knownIds.Contains(element.ElementId)).ToArray();
        if (known.GroupBy(element => element.ElementId, StringComparer.Ordinal).Any(group => group.Count() != 1)) return false;
        var byId = known.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
        var elements = registry.Entries.OrderBy(element => element.StableOrder).Select(definition =>
            byId.TryGetValue(definition.ElementId, out var state) && state.ScopeId == registry.Document.DocumentId &&
            PdfLayoutProfileDocumentValidator.AllowedFieldsMatch(definition, state) && PdfLayoutProfileDocumentValidator.Finite(state)
                ? state with { }
                : PdfLayoutStateFactory.FromBox(definition, definition.BaselineLayout)).ToArray();
        var layout = new PdfLayoutState(registry.Document.DocumentId, DateTimeOffset.UtcNow, elements);
        var candidate = new PdfLayoutProfileDocument(PdfLayoutProfileDocumentValidator.SchemaVersion,
            PdfLayoutProfileDocumentValidator.DocumentKind, applicationId, documentType,
            PdfLayoutProfileDocumentValidator.ProfileId, registry.Document.DocumentId, source.SavedAt,
            PdfRegistryFingerprint.Create(registry), layout);
        if (!PdfLayoutProfileDocumentValidator.Validate(candidate, registry).Success) return false;
        reconciled = candidate;
        return true;
    }

    private static string SafeFilePart(string value) => new(value.Select(character => char.IsLetterOrDigit(character) || character is '-' or '_' ? character : '-').ToArray());
}
