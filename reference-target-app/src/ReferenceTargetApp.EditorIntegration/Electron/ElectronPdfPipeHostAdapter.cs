using System.Text.Json;
using ReferenceTargetApp.EditorIntegration.Pdf;

namespace ReferenceTargetApp.EditorIntegration.Electron;

public sealed record ElectronPdfRenderBound(string ElementId, int PageNumber, PdfBox Box, string? Part = null, double? ContentWidth = null);
public sealed record ElectronPdfPreviewMetadata(
    string State, bool Stale, int Generation, int PageCount, DateTimeOffset? GeneratedAt,
    string ActiveDocumentId, string? ControlledOutputPath, IReadOnlyList<ElectronPdfRenderBound> RenderBounds);

public sealed class ElectronPdfPipeHostAdapter : IAsyncPdfHostAdapter
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true };
    private readonly LocalTargetPipeConnection connection;
    private readonly object stateLock = new();
    private readonly PdfElementRegistry registry;
    private PdfLayoutState state;

    private ElectronPdfPipeHostAdapter(LocalTargetPipeConnection connection, PdfElementRegistry registry, PdfLayoutState state)
    {
        this.connection = connection;
        this.registry = registry;
        this.state = state;
    }

    public static async Task<ElectronPdfPipeHostAdapter> CreateAsync(
        LocalTargetPipeConnection connection, ElectronPdfTargetContract contract, CancellationToken cancellationToken)
    {
        var registryResponse = await connection.RequestAsync("getPdfRegistry", timeout: TimeSpan.FromSeconds(10), cancellationToken: cancellationToken).ConfigureAwait(false);
        var remoteRegistry = Required<RemotePdfRegistry>(registryResponse, "pdfRegistry");
        if (remoteRegistry.RegistryVersion != contract.RegistryVersion || remoteRegistry.RegistryFingerprint != contract.RegistryFingerprint ||
            remoteRegistry.ApplicationId != contract.ApplicationId || remoteRegistry.DocumentTypeId != contract.DocumentTypeId || remoteRegistry.ScopeId != contract.ProfileScope)
            throw new ElectronEditorException(ElectronEditorErrorCodes.RegistryFingerprintMismatch, "PDF-Registry und PDF-Zielvertrag stimmen nicht ueberein.");
        var registry = BuildRegistry(remoteRegistry);
        var stateResponse = await connection.RequestAsync("getCurrentPdfLayoutState", timeout: TimeSpan.FromSeconds(10), cancellationToken: cancellationToken).ConfigureAwait(false);
        var state = ToLocal(Required<RemotePdfLayoutState>(stateResponse, "layoutState"), registry);
        var validation = PdfLayoutStateValidator.Validate(state, registry);
        if (!validation.Success) throw new ElectronEditorException(ElectronEditorErrorCodes.RegistryInvalid, validation.Message);
        return new(connection, registry, state);
    }

    public PdfElementRegistry GetRegistry() => registry;
    public PdfLayoutState GetCurrentLayoutState() { lock (stateLock) return Clone(state); }
    public PdfChangeResult SubmitChangeRequest(PdfChangeRequest request) =>
        PdfChangeResult.Reject(request, "async_transport_required", "Electron-PDF-Aenderungen werden asynchron uebertragen.");

    public async Task<PdfChangeResult> SubmitChangeRequestAsync(PdfChangeRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await connection.RequestAsync("submitPdfChangeRequest", new { changeRequest = request }, TimeSpan.FromSeconds(10), cancellationToken).ConfigureAwait(false);
            var remote = Required<RemotePdfChangeResult>(response, "changeResult");
            var result = new PdfChangeResult(remote.Success, remote.ChangeId, remote.ElementId, remote.Operation, remote.ErrorCode, remote.Message,
                remote.PreviousState is null ? null : ToLocal(remote.PreviousState, registry),
                remote.NewState is null ? null : ToLocal(remote.NewState, registry), remote.RollbackSucceeded,
                remote.AffectedStates?.Select(item => ToLocal(item, registry)).ToArray());
            if (result.Success)
            {
                var updates = new Dictionary<string, PdfElementLayoutState>(StringComparer.Ordinal);
                if (result.NewState is not null) updates[result.NewState.ElementId] = result.NewState;
                if (result.AffectedStates is not null) foreach (var affected in result.AffectedStates) updates[affected.ElementId] = affected;
                lock (stateLock)
                    state = new(state.ScopeId, DateTimeOffset.UtcNow,
                        state.Elements.Select(element => updates.GetValueOrDefault(element.ElementId) ?? element with { }).ToArray());
            }
            return result;
        }
        catch (ElectronEditorException exception)
        {
            return PdfChangeResult.Reject(request, exception.Code, exception.Message);
        }
    }

    public async Task<ElectronPdfPreviewMetadata> RegeneratePreviewAsync(CancellationToken cancellationToken = default)
    {
        var response = await connection.RequestAsync("regeneratePdfPreview", timeout: TimeSpan.FromMinutes(2), cancellationToken: cancellationToken).ConfigureAwait(false);
        return Required<RemotePdfPreviewMetadata>(response, "previewMetadata").ToLocal();
    }

    public async Task<ElectronPdfPreviewMetadata> GetPreviewMetadataAsync(CancellationToken cancellationToken = default)
    {
        var response = await connection.RequestAsync("getPreviewMetadata", timeout: TimeSpan.FromSeconds(10), cancellationToken: cancellationToken).ConfigureAwait(false);
        return Required<RemotePdfPreviewMetadata>(response, "previewMetadata").ToLocal();
    }

    private static PdfElementRegistry BuildRegistry(RemotePdfRegistry remote)
    {
        var orientation = remote.PageSettings.Orientation == "landscape" ? PdfPageOrientation.Landscape : PdfPageOrientation.Portrait;
        var pageEntry = remote.Elements.Single(element => element.Kind == "page");
        PdfBox Zone(string kind, PdfBox fallback) => remote.Elements.FirstOrDefault(element => element.Kind == kind)?.Baseline.ToBox() ?? fallback;
        var width = remote.PageSettings.Width;
        var height = remote.PageSettings.Height;
        var margins = remote.PageSettings.Margins;
        var page = new PdfPageDefinition(pageEntry.Id, width, height,
            new(margins.Left, margins.Top, width - margins.Left - margins.Right, height - margins.Top - margins.Bottom),
            Zone("header", new(0, 0, width, height)), Zone("area", new(0, 0, width, height)), Zone("footer", new(0, 0, width, height)));
        var entries = remote.Elements.Select(entry => new PdfElementDefinition(
            entry.Id, entry.Name, entry.ScopeId, entry.ParentId, Kind(entry.Kind), Role(entry.Role), Capabilities(entry.Capabilities),
            Area(entry.PageArea), entry.Baseline.ToBox(), entry.Order, entry.Visible, entry.Editable,
            entry.AllowedOps, entry.LockedOps, entry.ColumnRole, entry.RefKey, entry.RendererKey, entry.LayoutBounds.ToLocal(), entry.BoundaryResizePolicy)).ToArray();
        return new(new(remote.ScopeId, remote.ApplicationId, remote.DocumentTypeId, PdfPageFormat.A4, orientation,
            PdfLayoutUnit.Millimeter, new(margins.Left, margins.Top, margins.Right, margins.Bottom), "Arial", page, entries));
    }

    private static PdfLayoutState ToLocal(RemotePdfLayoutState remote, PdfElementRegistry registry) => new(remote.ScopeId, remote.CapturedAt,
        remote.Elements.Where(element => registry.FindById(element.ElementId) is not null).Select(element => ToLocal(element, registry)).ToArray());
    private static PdfElementLayoutState ToLocal(RemotePdfElementState state, PdfElementRegistry registry)
    {
        var definition = registry.FindById(state.ElementId) ?? throw new ElectronEditorException(ElectronEditorErrorCodes.RegistryInvalid, "PDF-State enthaelt ein unbekanntes Element.");
        var baseline = definition.BaselineLayout;
        var box = baseline with
        {
            X = state.X ?? baseline.X, Y = state.Y ?? baseline.Y, Width = state.Width ?? baseline.Width, Height = state.Height ?? baseline.Height,
            TextOffsetX = state.TextOffsetX ?? baseline.TextOffsetX, TextOffsetY = state.TextOffsetY ?? baseline.TextOffsetY,
            FontSize = state.FontSize ?? baseline.FontSize, TextAlignment = state.TextAlignment ?? baseline.TextAlignment,
            LineSpacing = state.LineSpacing ?? baseline.LineSpacing, Visible = state.Visible ?? baseline.Visible,
            MarginTop = state.MarginTop ?? baseline.MarginTop, MarginRight = state.MarginRight ?? baseline.MarginRight,
            MarginBottom = state.MarginBottom ?? baseline.MarginBottom, MarginLeft = state.MarginLeft ?? baseline.MarginLeft
        };
        return PdfLayoutStateFactory.FromBox(definition, box);
    }
    private static PdfLayoutState Clone(PdfLayoutState value) => new(value.ScopeId, value.CapturedAt, value.Elements.Select(element => element with { }).ToArray());

    private static T Required<T>(JsonElement payload, string property)
    {
        if (!payload.TryGetProperty(property, out var value)) throw new ElectronEditorException(ElectronEditorErrorCodes.MessageInvalid, $"PDF-Antwortfeld '{property}' fehlt.");
        try { return value.Deserialize<T>(JsonOptions) ?? throw new JsonException("Wert fehlt."); }
        catch (JsonException exception) { throw new ElectronEditorException(ElectronEditorErrorCodes.MessageInvalid, $"PDF-Antwortfeld '{property}' ist ungueltig.", exception); }
    }

    private static PdfElementKind Kind(string value) => value switch
    {
        "document" => PdfElementKind.Document, "page" => PdfElementKind.Page, "area" => PdfElementKind.Area,
        "header" => PdfElementKind.Header, "footer" => PdfElementKind.Footer, "group" => PdfElementKind.Group,
        "label" => PdfElementKind.Label, "value" => PdfElementKind.Value, "text" => PdfElementKind.Text,
        "image" => PdfElementKind.Image, "table" => PdfElementKind.Table, "tableColumn" => PdfElementKind.TableColumn,
        "repeatingArea" => PdfElementKind.RepeatingArea,
        _ => throw new ElectronEditorException(ElectronEditorErrorCodes.RegistryInvalid, $"PDF-Elementart '{value}' ist unbekannt.")
    };
    private static PdfElementRole Role(string value) => value switch
    {
        "layout" => PdfElementRole.Layout, "content" => PdfElementRole.Content, "meta" => PdfElementRole.Meta,
        "structure" => PdfElementRole.Structure, "date" => PdfElementRole.Date, "fieldLabel" => PdfElementRole.FieldLabel,
        "heading" => PdfElementRole.Heading, "columnHeader" => PdfElementRole.ColumnHeader, _ => PdfElementRole.Content
    };
    private static PdfPageArea Area(string value) => value switch
    { "document" => PdfPageArea.Document, "header" => PdfPageArea.Header, "footer" => PdfPageArea.Footer, _ => PdfPageArea.Body };
    private static PdfCapability Capabilities(IReadOnlyList<string> operations)
    {
        var result = PdfCapability.None;
        foreach (var operation in operations) result |= operation switch
        {
            "move" => PdfCapability.Position, "resize" => PdfCapability.Width | PdfCapability.Height,
            "resizeWidth" => PdfCapability.Width, "resizeHeight" => PdfCapability.Height,
            "textMove" => PdfCapability.TextPosition, "textResize" => PdfCapability.FontSize,
            "setTextAlignment" => PdfCapability.TextAlignment, "setLineSpacing" => PdfCapability.LineSpacing,
            "setVisibility" => PdfCapability.Visibility, "setPageMargins" => PdfCapability.PageMargins, _ => PdfCapability.None
        };
        return result;
    }

    private sealed record RemotePdfRegistry(string ApplicationId, string DocumentTypeId, string DisplayName, string ScopeId, string Unit,
        int RegistryVersion, string RegistryFingerprint, RemotePageSettings PageSettings, IReadOnlyList<RemotePdfElement> Elements);
    private sealed record RemotePageSettings(string Format, string Orientation, double Width, double Height, RemoteMargins Margins);
    private sealed record RemoteMargins(double Top, double Right, double Bottom, double Left);
    private sealed record RemotePdfElement(string Id, string Name, string ScopeId, string? ParentId, string Kind, string Role, string PageArea,
        int Order, bool Visible, bool Editable, IReadOnlyList<string> Capabilities, IReadOnlyList<string> AllowedOps, IReadOnlyList<string> LockedOps,
        RemotePdfBox Baseline, RemotePdfBounds LayoutBounds, string RefKey, string RendererKey, string? ColumnRole = null,
        string? BoundaryResizePolicy = null);
    private sealed record RemotePdfBounds(double MinX, double MaxX, double MinY, double MaxY, double MinWidth, double MaxWidth, double MinHeight, double MaxHeight)
    { public PdfLayoutBounds ToLocal() => new(MinX, MaxX, MinY, MaxY, MinWidth, MaxWidth, MinHeight, MaxHeight); }
    private sealed record RemotePdfBox(double X, double Y, double Width, double Height, double? TextOffsetX = null, double? TextOffsetY = null,
        double? FontSize = null, string? TextAlignment = null, double? LineSpacing = null, bool? Visible = null,
        double? MarginTop = null, double? MarginRight = null, double? MarginBottom = null, double? MarginLeft = null)
    { public PdfBox ToBox() => new(X, Y, Width, Height, TextOffsetX, TextOffsetY, FontSize, TextAlignment, LineSpacing, Visible, MarginTop, MarginRight, MarginBottom, MarginLeft); }
    private sealed record RemotePdfLayoutState(string ScopeId, DateTimeOffset CapturedAt, IReadOnlyList<RemotePdfElementState> Elements);
    private sealed record RemotePdfElementState(string ElementId, double? X, double? Y, double? Width, double? Height,
        double? TextOffsetX, double? TextOffsetY, double? FontSize, string? TextAlignment, double? LineSpacing, bool? Visible,
        double? MarginTop, double? MarginRight, double? MarginBottom, double? MarginLeft);
    private sealed record RemotePdfChangeResult(bool Success, string ChangeId, string ElementId, string Operation, string? ErrorCode, string Message,
        RemotePdfElementState? PreviousState, RemotePdfElementState? NewState, bool RollbackSucceeded,
        IReadOnlyList<RemotePdfElementState>? AffectedStates = null);
    private sealed record RemotePdfRenderBound(string ElementId, int PageNumber, RemotePdfBox Box, string? Part = null, double? ContentWidth = null);
    private sealed record RemotePdfPreviewMetadata(string State, bool Stale, int Generation, int PageCount, DateTimeOffset? GeneratedAt,
        string ActiveDocumentId, string? ControlledOutputPath, IReadOnlyList<RemotePdfRenderBound> RenderBounds)
    { public ElectronPdfPreviewMetadata ToLocal() => new(State, Stale, Generation, PageCount, GeneratedAt, ActiveDocumentId, ControlledOutputPath,
        RenderBounds.Select(bound => new ElectronPdfRenderBound(bound.ElementId, bound.PageNumber, bound.Box.ToBox(), bound.Part, bound.ContentWidth)).ToArray()); }
}
