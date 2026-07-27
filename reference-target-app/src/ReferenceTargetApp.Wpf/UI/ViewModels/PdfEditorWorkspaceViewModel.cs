using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Runtime.CompilerServices;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using ReferenceTargetApp.Domain.Models;
using ReferenceTargetApp.EditorIntegration.Electron;
using ReferenceTargetApp.EditorIntegration.Pdf;
using ReferenceTargetApp.PdfPreview;
using ReferenceTargetApp.PdfRendering;

namespace ReferenceTargetApp.UI.ViewModels;

internal sealed class PdfTreeNodeViewModel
{
    public PdfTreeNodeViewModel(PdfElementDefinition definition, IEnumerable<PdfTreeNodeViewModel> children)
    {
        Definition = definition;
        Children = new(children);
    }
    public PdfElementDefinition Definition { get; }
    public string Id => Definition.ElementId;
    public string DisplayLabel => $"{Definition.Name} · {Definition.Kind}" + (Definition.Editable ? string.Empty : " · geschützt");
    public ObservableCollection<PdfTreeNodeViewModel> Children { get; }
}

internal sealed record PdfPageViewModel(int PageNumber, BitmapSource Image)
{
    public string Label => $"Seite {PageNumber}";
}

internal sealed class PdfEditorWorkspaceViewModel : INotifyPropertyChanged, IPdfEditorWorkspace
{
    private readonly PdfElementRegistry registry;
    private readonly IPdfHostAdapter adapter;
    private readonly PdfLayoutSession session;
    private readonly PdfOrderDocumentRenderer? renderer;
    private readonly NativePdfPreviewRenderer previewRenderer;
    private readonly Order? order;
    private readonly ElectronPdfPipeHostAdapter? electronAdapter;
    private string outputPath;
    private readonly CancellationToken lifetimeToken;
    private readonly SemaphoreSlim renderLock = new(1, 1);
    private CancellationTokenSource? activeRender;
    private PdfElementDefinition? selected;
    private PdfPageViewModel? selectedPage;
    private IReadOnlyList<PdfRenderBound> bounds = [];
    private string layer = "element";
    private string mode = "position";
    private string stepText = "1";
    private double step = 1;
    private bool stepValid = true;
    private bool busy;
    private bool previewStale = true;
    private long layoutVersion;
    private long previewVersion = -1;
    private string status = "PDF-Editor bereit. Vorschau noch nicht erzeugt.";
    private string error = string.Empty;
    private string errorCode = string.Empty;
    private double overlayLeft;
    private double overlayTop;
    private double overlayWidth;
    private double overlayHeight;

    public PdfEditorWorkspaceViewModel(PdfElementRegistry registry, IPdfHostAdapter adapter, PdfLayoutSession session,
        PdfOrderDocumentRenderer renderer, NativePdfPreviewRenderer previewRenderer, Order order, string outputPath,
        CancellationToken lifetimeToken)
    {
        this.registry = registry;
        this.adapter = adapter;
        this.session = session;
        this.renderer = renderer;
        this.previewRenderer = previewRenderer;
        this.order = order;
        this.outputPath = Path.GetFullPath(outputPath);
        this.lifetimeToken = lifetimeToken;
        TreeRoots.ReplaceWith(BuildTree());
        SelectElement(registry.Entries.First(element => element.Editable).ElementId);
        SaveCommand = new AsyncCommand(_ => SaveAsync(), _ => CanOperate && IsDirty);
        LoadCommand = new AsyncCommand(_ => LayoutActionAsync(() => session.LoadAsync(lifetimeToken), "PDF-Layout geladen."), _ => CanOperate);
        DiscardElementCommand = new AsyncCommand(_ => LayoutActionAsync(() => session.DiscardElementAsync(SelectedId, lifetimeToken), "PDF-Elementänderung verworfen."), _ => CanOperate && CanDiscardElement);
        DiscardAllCommand = new AsyncCommand(_ => LayoutActionAsync(() => session.DiscardAsync(lifetimeToken), "Alle PDF-Änderungen verworfen."), _ => CanOperate && IsDirty);
        ResetElementCommand = new AsyncCommand(_ => LayoutActionAsync(() => session.ResetElementAsync(SelectedId, lifetimeToken), "PDF-Element auf Baseline zurückgesetzt."), _ => CanOperate && selected is not null);
        ResetAllCommand = new AsyncCommand(_ => LayoutActionAsync(() => session.ResetAsync(lifetimeToken), "PDF-Layout auf Baseline zurückgesetzt."), _ => CanOperate);
        RenderCommand = new AsyncCommand(_ => RenderAsync(), _ => CanOperate);
        RefreshPreviewCommand = new AsyncCommand(_ => RefreshPreviewAsync(), _ => CanOperate);
        SetLayerCommand = new AsyncCommand(p => SetLayerAsync(p as string), p => CanOperate && p is string);
        SetModeCommand = new AsyncCommand(p => SetModeAsync(p as string), p => CanOperate && p is string);
        DirectionCommand = new AsyncCommand(p => ApplyDirectionAsync(p as string), p => CanDirection(p as string));
        PropertyCommand = new AsyncCommand(p => ApplyPropertyAsync(p as string), p => CanProperty(p as string));
    }

    public PdfEditorWorkspaceViewModel(PdfElementRegistry registry, ElectronPdfPipeHostAdapter adapter, PdfLayoutSession session,
        NativePdfPreviewRenderer previewRenderer, CancellationToken lifetimeToken)
        : this(registry, adapter, session, null!, previewRenderer, null!, Path.Combine(Path.GetTempPath(), "ui-editor-pdf-preview.pdf"), lifetimeToken)
    {
        electronAdapter = adapter;
        outputPath = string.Empty;
        status = "BBM-PDF-Editor bereit. Vorschau noch nicht angefordert.";
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    public ObservableCollection<PdfTreeNodeViewModel> TreeRoots { get; } = [];
    public ObservableCollection<PdfPageViewModel> Pages { get; } = [];
    public ICommand SaveCommand { get; }
    public ICommand LoadCommand { get; }
    public ICommand DiscardElementCommand { get; }
    public ICommand DiscardAllCommand { get; }
    public ICommand ResetElementCommand { get; }
    public ICommand ResetAllCommand { get; }
    public ICommand RenderCommand { get; }
    public ICommand RefreshPreviewCommand { get; }
    public ICommand SetLayerCommand { get; }
    public ICommand SetModeCommand { get; }
    public ICommand DirectionCommand { get; }
    public ICommand PropertyCommand { get; }
    public string ProfileId => PdfLayoutProfileDocumentValidator.ProfileId;
    public int RegistryElementCount => registry.Entries.Count;
    public string OutputPath => outputPath;
    public bool IsBusy { get => busy; private set { if (Set(ref busy, value)) RaiseAll(); } }
    public bool CanOperate => !busy;
    public bool IsDirty => session.GetStatus().IsDirty;
    public bool IsAvailable => true;
    public string UnavailableMessage => string.Empty;
    public bool CanDiscardElement => session.GetStatus().DirtyElementIds.Contains(SelectedId, StringComparer.Ordinal);
    public string DirtyStatus => IsDirty ? "Ungespeicherte PDF-Änderungen" : "PDF-Layout gespeichert";
    public bool IsPreviewStale => previewStale || previewVersion != layoutVersion;
    public string PreviewStatus => Pages.Count == 0 ? "Keine Vorschau" : IsPreviewStale ? "Vorschau veraltet" : "Vorschau aktuell";
    public string StatusMessage { get => status; private set => Set(ref status, value); }
    public string ErrorMessage { get => error; private set { if (Set(ref error, value)) OnPropertyChanged(nameof(HasError)); } }
    public string ErrorCode { get => errorCode; private set => Set(ref errorCode, value); }
    public string ErrorCodeDisplay => string.IsNullOrEmpty(ErrorCode) ? string.Empty : "Technischer Code: " + ErrorCode;
    public bool HasError => !string.IsNullOrEmpty(ErrorMessage);
    public string SelectedId => selected?.ElementId ?? "–";
    public string SelectedName => selected?.Name ?? "Kein PDF-Element ausgewählt";
    public string SelectedKind => selected?.Kind.ToString() ?? "–";
    public string SelectedRole => selected?.Role.ToString() ?? "–";
    public string SelectedParent => selected?.ParentId ?? "–";
    public string SelectedScope => selected?.ScopeId ?? "–";
    public string SelectedArea => selected?.PageArea.ToString() ?? "–";
    public string SelectedCapabilities => selected?.Capabilities.ToString() ?? "None";
    public string SelectedPageText => SelectedPage is null ? "Seitentemplate" : $"Seite {SelectedPage.PageNumber}";
    public string Position => Current is { } value ? Pair(value.X, value.Y) + " mm" : "–";
    public string Size => Current is { } value ? Pair(value.Width, value.Height) + " mm" : "–";
    public string TextPosition => Current is { } value ? Pair(value.TextOffsetX, value.TextOffsetY) + " mm" : "–";
    public string FontSize => Current?.FontSize is double value ? value.ToString("0.###", CultureInfo.CurrentCulture) + " mm" : "–";
    public string TableInfo => CreateTableInfo();
    public string ActiveLayer => layer;
    public string ActiveMode => mode;
    public bool ElementLayerActive => layer == "element";
    public bool TextLayerActive => layer == "text";
    public bool PositionModeActive => mode == "position";
    public bool WidthModeActive => mode == "width";
    public bool HeightModeActive => mode == "height";
    public bool TextPositionModeActive => mode == "textPosition";
    public bool FontSizeModeActive => mode == "fontSize";
    public bool CanPosition => selected?.Capabilities.HasFlag(PdfCapability.Position) == true;
    public bool CanWidth => selected?.Capabilities.HasFlag(PdfCapability.Width) == true;
    public bool CanHeight => selected?.Capabilities.HasFlag(PdfCapability.Height) == true;
    public bool CanTextPosition => selected?.Capabilities.HasFlag(PdfCapability.TextPosition) == true;
    public bool CanFontSize => selected?.Capabilities.HasFlag(PdfCapability.FontSize) == true;
    public bool CanTextAlignment => selected?.Capabilities.HasFlag(PdfCapability.TextAlignment) == true;
    public bool CanLineSpacing => selected?.Capabilities.HasFlag(PdfCapability.LineSpacing) == true;
    public bool CanVisibility => selected?.Capabilities.HasFlag(PdfCapability.Visibility) == true;
    public bool CanPageMargins => selected?.Capabilities.HasFlag(PdfCapability.PageMargins) == true;
    public string TextAlignment => Current?.TextAlignment ?? "–";
    public string LineSpacing => Current?.LineSpacing is double value ? value.ToString("0.###", CultureInfo.CurrentCulture) : "–";
    public string Visibility => Current?.Visible is bool value ? (value ? "sichtbar" : "ausgeblendet") : "–";
    public string StepText { get => stepText; set { if (Set(ref stepText, value)) ValidateStep(); } }
    public PdfPageViewModel? SelectedPage { get => selectedPage; set { if (Set(ref selectedPage, value)) { OnPropertyChanged(nameof(SelectedPageText)); UpdateOverlay(lastViewportWidth, lastViewportHeight); } } }
    public BitmapSource? SelectedPageImage => SelectedPage?.Image;
    public bool HasOverlay => overlayWidth > 0 && overlayHeight > 0;
    public double OverlayLeft { get => overlayLeft; private set => Set(ref overlayLeft, value); }
    public double OverlayTop { get => overlayTop; private set => Set(ref overlayTop, value); }
    public double OverlayWidth { get => overlayWidth; private set { if (Set(ref overlayWidth, value)) OnPropertyChanged(nameof(HasOverlay)); } }
    public double OverlayHeight { get => overlayHeight; private set { if (Set(ref overlayHeight, value)) OnPropertyChanged(nameof(HasOverlay)); } }
    internal IReadOnlyList<PdfRenderBound> RenderBounds => bounds;
    internal PdfLayoutSessionStatus LayoutStatus => session.GetStatus();
    internal Task SetLayerForDiagnosticAsync(string value) => SetLayerAsync(value);
    internal Task SetModeForDiagnosticAsync(string value) => SetModeAsync(value);
    internal Task ApplyDirectionForDiagnosticAsync(string value) => ApplyDirectionAsync(value);
    internal Task DiscardElementForDiagnosticAsync() => LayoutActionAsync(() => session.DiscardElementAsync(SelectedId, lifetimeToken), "PDF-Elementänderung verworfen.");
    internal Task DiscardAllForDiagnosticAsync() => LayoutActionAsync(() => session.DiscardAsync(lifetimeToken), "Alle PDF-Änderungen verworfen.");
    internal Task ResetElementForDiagnosticAsync() => LayoutActionAsync(() => session.ResetElementAsync(SelectedId, lifetimeToken), "PDF-Element zurückgesetzt.");
    internal Task ResetAllForDiagnosticAsync() => LayoutActionAsync(() => session.ResetAsync(lifetimeToken), "PDF-Layout zurückgesetzt.");
    private double lastViewportWidth;
    private double lastViewportHeight;

    public async Task InitializeAsync()
    {
        if (electronAdapter is not null)
        {
            var metadata = await electronAdapter.GetPreviewMetadataAsync(lifetimeToken);
            ApplyMetadata(metadata);
        }
        if (File.Exists(outputPath)) await RefreshPreviewAsync();
        else RefreshState();
    }

    public void SelectElement(string elementId)
    {
        selected = registry.FindById(elementId);
        if (selected is null) { ShowError(PdfErrorCodes.UnknownElement, "PDF-Element ist nicht registriert."); return; }
        var page = bounds.FirstOrDefault(bound => bound.ElementId == elementId)?.PageNumber;
        if (page.HasValue) SelectedPage = Pages.FirstOrDefault(item => item.PageNumber == page.Value) ?? SelectedPage;
        NormalizeMode();
        StatusMessage = $"PDF-Element {selected.Name} ausgewählt.";
        RaiseAll();
        UpdateOverlay(lastViewportWidth, lastViewportHeight);
    }

    public void SelectPage(PdfPageViewModel? page)
    {
        SelectedPage = page;
        OnPropertyChanged(nameof(SelectedPageImage));
        StatusMessage = page is null ? "Keine PDF-Seite ausgewählt." : $"Seite {page.PageNumber} ausgewählt.";
    }

    public void SelectAtPreview(double x, double y, double width, double height)
    {
        if (SelectedPage is null) return;
        var point = PdfPreviewCoordinateMapper.ToPdf(x, y, width, height);
        if (!point.Success) { StatusMessage = "Klick liegt außerhalb der PDF-Seite."; return; }
        var hit = PdfPreviewCoordinateMapper.HitTest(bounds, SelectedPage.PageNumber, point.X, point.Y);
        if (hit is null) { StatusMessage = "An dieser Stelle ist kein registriertes PDF-Element."; return; }
        SelectElement(hit.ElementId);
    }

    public void UpdateOverlay(double width, double height)
    {
        lastViewportWidth = width;
        lastViewportHeight = height;
        var bound = SelectedPage is null ? null : bounds.Where(item => item.PageNumber == SelectedPage.PageNumber && item.ElementId == SelectedId)
            .OrderBy(item => item.Box.Width * item.Box.Height).FirstOrDefault();
        if (bound is null) { OverlayWidth = OverlayHeight = 0; return; }
        var mapped = PdfPreviewCoordinateMapper.ToViewport(bound.Box, width, height);
        OverlayLeft = mapped.Left; OverlayTop = mapped.Top; OverlayWidth = mapped.Width; OverlayHeight = mapped.Height;
    }

    public async Task<bool> SaveAsync()
    {
        var result = await session.SaveAsync(lifetimeToken);
        ApplyResult(result, "PDF-Layout gespeichert.", false);
        return result.Success;
    }

    public async Task RenderAsync()
    {
        if (!await renderLock.WaitAsync(0, lifetimeToken)) { ShowError(PdfErrorCodes.RenderFailed, "PDF-Erzeugung läuft bereits."); return; }
        var generation = ++layoutVersion;
        activeRender = CancellationTokenSource.CreateLinkedTokenSource(lifetimeToken);
        IsBusy = true; ClearError(); StatusMessage = "PDF wird erzeugt …";
        try
        {
            if (electronAdapter is not null)
            {
                var metadata = await electronAdapter.RegeneratePreviewAsync(activeRender.Token);
                ApplyMetadata(metadata);
                if (metadata.Stale || !File.Exists(outputPath))
                {
                    ShowError(PdfErrorCodes.RenderFailed, "BBM hat keine aktuelle kontrollierte PDF-Vorschau bereitgestellt.");
                    StatusMessage = "PDF-Erzeugung fehlgeschlagen; letzte gueltige Vorschau bleibt erhalten.";
                    return;
                }
                var remotePreview = await previewRenderer.RenderAsync(outputPath, cancellationToken: activeRender.Token);
                if (!remotePreview.Success) { ShowError(remotePreview.Code, remotePreview.Message); return; }
                PublishPreview(remotePreview);
                previewVersion = layoutVersion;
                previewStale = false;
                StatusMessage = $"Echte BBM-PDF erfolgreich erzeugt; {Pages.Count} Seiten, Vorschau aktuell.";
                return;
            }
            var result = await renderer!.RenderAsync(registry, adapter.GetCurrentLayoutState(), order!, outputPath, null, activeRender.Token);
            if (!result.Success) { ShowError(result.Code, result.Message); StatusMessage = "PDF-Erzeugung fehlgeschlagen; letzte gültige Vorschau bleibt erhalten."; return; }
            var preview = await previewRenderer.RenderAsync(result.OutputPath, cancellationToken: activeRender.Token);
            if (!preview.Success) { ShowError(preview.Code, preview.Message); StatusMessage = "PDF erzeugt, Vorschau konnte nicht aktualisiert werden."; return; }
            if (generation != layoutVersion || activeRender.IsCancellationRequested) return;
            bounds = result.RenderBounds;
            PublishPreview(preview);
            previewVersion = layoutVersion;
            previewStale = false;
            StatusMessage = $"PDF erfolgreich erzeugt; {Pages.Count} Seiten, Vorschau aktuell.";
        }
        finally { activeRender?.Dispose(); activeRender = null; IsBusy = false; renderLock.Release(); RaiseAll(); }
    }

    public async Task RefreshPreviewAsync()
    {
        if (!await renderLock.WaitAsync(0, lifetimeToken)) { ShowError(PdfPreviewErrorCodes.RenderFailed, "Vorschau wird bereits geladen."); return; }
        activeRender = CancellationTokenSource.CreateLinkedTokenSource(lifetimeToken);
        IsBusy = true; ClearError(); StatusMessage = "Vorschau wird geladen …";
        try
        {
            if (electronAdapter is not null)
            {
                var metadata = await electronAdapter.GetPreviewMetadataAsync(activeRender.Token);
                ApplyMetadata(metadata);
            }
            var inspection = PdfTechnicalInspector.Inspect(outputPath);
            if (!inspection.Success) { ShowError(PdfPreviewErrorCodes.LoadFailed, inspection.Message); StatusMessage = "Letzte gültige Vorschau bleibt erhalten."; return; }
            var preview = await previewRenderer.RenderAsync(outputPath, cancellationToken: activeRender.Token);
            if (!preview.Success) { ShowError(preview.Code, preview.Message); StatusMessage = "Letzte gültige Vorschau bleibt erhalten."; return; }
            PublishPreview(preview);
            StatusMessage = $"Vorschau aus bestehender PDF aktualisiert; {Pages.Count} Seiten.";
        }
        finally { activeRender?.Dispose(); activeRender = null; IsBusy = false; renderLock.Release(); RaiseAll(); }
    }

    public void Cancel() => activeRender?.Cancel();
    public void Dispose() { Cancel(); activeRender?.Dispose(); renderLock.Dispose(); }

    private async Task ApplyDirectionAsync(string? direction)
    {
        if (selected is null || direction is null || !CanDirection(direction)) return;
        var current = Current!;
        string operation;
        IReadOnlyDictionary<string, object?> payload;
        if (mode == "position")
        {
            operation = PdfLayoutOperations.Move;
            payload = new Dictionary<string, object?> { ["x"] = current.X!.Value + (direction == "left" ? -step : direction == "right" ? step : 0), ["y"] = current.Y!.Value + (direction == "up" ? -step : direction == "down" ? step : 0) };
        }
        else if (mode == "width") { operation = PdfLayoutOperations.ResizeWidth; payload = new Dictionary<string, object?> { ["width"] = current.Width!.Value + (direction == "left" ? -step : step) }; }
        else if (mode == "height") { operation = PdfLayoutOperations.ResizeHeight; payload = new Dictionary<string, object?> { ["height"] = current.Height!.Value + (direction == "up" ? -step : step) }; }
        else if (mode == "textPosition")
        {
            operation = PdfLayoutOperations.TextMove;
            payload = new Dictionary<string, object?> { ["text"] = new Dictionary<string, object?> { ["offsetX"] = current.TextOffsetX!.Value + (direction == "left" ? -step : direction == "right" ? step : 0), ["offsetY"] = current.TextOffsetY!.Value + (direction == "up" ? -step : direction == "down" ? step : 0) } };
        }
        else { operation = PdfLayoutOperations.TextResize; payload = new Dictionary<string, object?> { ["text"] = new Dictionary<string, object?> { ["fontSize"] = current.FontSize!.Value + (direction == "left" ? -step : step) } }; }
        var request = new PdfChangeRequest(Guid.NewGuid().ToString("N"), selected.ElementId, operation, payload,
            DateTimeOffset.UtcNow, "native-pdf-editor", registry.Document.DocumentId);
        var result = await session.ApplyBatchAsync([request], lifetimeToken);
        ApplyResult(result, $"{selected.Name}: {operation}, Schritt {step:G} mm erfolgreich.", true);
    }

    private async Task ApplyPropertyAsync(string? action)
    {
        if (selected is null || action is null || !CanProperty(action)) return;
        var current = Current!;
        string operation;
        IReadOnlyDictionary<string, object?> payload;
        if (action.StartsWith("align:", StringComparison.Ordinal))
        {
            operation = PdfLayoutOperations.SetTextAlignment;
            payload = new Dictionary<string, object?> { ["textAlignment"] = action[6..] };
        }
        else if (action == "visibility")
        {
            operation = PdfLayoutOperations.SetVisibility;
            payload = new Dictionary<string, object?> { ["visible"] = !(current.Visible ?? true) };
        }
        else if (action is "lineSpacing+" or "lineSpacing-")
        {
            operation = PdfLayoutOperations.SetLineSpacing;
            payload = new Dictionary<string, object?> { ["lineSpacing"] = Math.Max(0.1, (current.LineSpacing ?? 1) + (action.EndsWith('+') ? 0.1 : -0.1)) };
        }
        else
        {
            operation = PdfLayoutOperations.SetPageMargins;
            var delta = action.EndsWith('+') ? step : -step;
            payload = new Dictionary<string, object?>
            {
                ["marginTop"] = Math.Max(0, (current.MarginTop ?? 0) + (action.StartsWith("marginTop", StringComparison.Ordinal) ? delta : 0)),
                ["marginRight"] = Math.Max(0, (current.MarginRight ?? 0) + (action.StartsWith("marginRight", StringComparison.Ordinal) ? delta : 0)),
                ["marginBottom"] = Math.Max(0, (current.MarginBottom ?? 0) + (action.StartsWith("marginBottom", StringComparison.Ordinal) ? delta : 0)),
                ["marginLeft"] = Math.Max(0, (current.MarginLeft ?? 0) + (action.StartsWith("marginLeft", StringComparison.Ordinal) ? delta : 0)),
            };
        }
        var request = new PdfChangeRequest(Guid.NewGuid().ToString("N"), selected.ElementId, operation, payload,
            DateTimeOffset.UtcNow, "native-pdf-editor", registry.Document.DocumentId);
        ApplyResult(await session.ApplyBatchAsync([request], lifetimeToken), $"{selected.Name}: {operation} erfolgreich.", true);
    }

    private bool CanProperty(string? action) => CanOperate && selected is not null && action switch
    {
        string value when value.StartsWith("align:", StringComparison.Ordinal) => CanTextAlignment,
        "visibility" => CanVisibility,
        "lineSpacing+" or "lineSpacing-" => CanLineSpacing,
        string value when value.StartsWith("margin", StringComparison.Ordinal) => CanPageMargins && stepValid,
        _ => false,
    };

    private Task SetLayerAsync(string? value) { if (value is "element" or "text") { layer = value; NormalizeMode(); RaiseAll(); } return Task.CompletedTask; }
    private Task SetModeAsync(string? value) { if (value is not null && ModeAllowed(value)) { mode = value; RaiseAll(); } return Task.CompletedTask; }
    private bool CanDirection(string? direction) => CanOperate && stepValid && selected is not null && direction is not null && ModeAllowed(mode) &&
        (mode is "position" or "textPosition" || (mode is "width" or "fontSize") && (direction is "left" or "right") ||
         mode == "height" && (direction is "up" or "down"));
    private bool ModeAllowed(string value) => value switch { "position" => CanPosition, "width" => CanWidth, "height" => CanHeight, "textPosition" => CanTextPosition, "fontSize" => CanFontSize, _ => false };
    private void NormalizeMode()
    {
        if (layer == "text" && !CanTextPosition && !CanFontSize) layer = "element";
        if (!ModeAllowed(mode)) mode = layer == "text" ? (CanTextPosition ? "textPosition" : "fontSize") : CanPosition ? "position" : CanWidth ? "width" : "height";
    }

    private async Task LayoutActionAsync(Func<Task<PdfLayoutOperationResult>> action, string success)
    {
        IsBusy = true; ClearError();
        try { ApplyResult(await action(), success, true); }
        finally { IsBusy = false; }
    }

    private void ApplyResult(PdfLayoutOperationResult result, string success, bool stale)
    {
        if (!result.Success) { ShowError(result.Code, result.Message); StatusMessage = "PDF-Layoutaktion fehlgeschlagen."; }
        else { if (stale) MarkPreviewStale(); StatusMessage = success; ClearError(); }
        RefreshState();
    }

    private void MarkPreviewStale() { layoutVersion++; previewStale = true; }
    private void PublishPreview(PdfPreviewResult result)
    {
        var previous = SelectedPage?.PageNumber ?? 1;
        Pages.ReplaceWith(result.Pages.Select(page => new PdfPageViewModel(page.PageNumber, ToBitmap(page.PngBytes))));
        SelectedPage = Pages.FirstOrDefault(page => page.PageNumber == previous) ?? Pages.FirstOrDefault();
        OnPropertyChanged(nameof(SelectedPageImage));
    }

    private static BitmapSource ToBitmap(byte[] bytes)
    {
        using var stream = new MemoryStream(bytes, writable: false);
        var image = new BitmapImage();
        image.BeginInit(); image.CacheOption = BitmapCacheOption.OnLoad; image.StreamSource = stream; image.EndInit(); image.Freeze();
        return image;
    }

    private IEnumerable<PdfTreeNodeViewModel> BuildTree() => Build(null);
    private IEnumerable<PdfTreeNodeViewModel> Build(string? parent) => registry.Entries.Where(element => element.ParentId == parent)
        .OrderBy(element => element.StableOrder).Select(element => new PdfTreeNodeViewModel(element, Build(element.ElementId)));
    private PdfElementLayoutState? Current => selected is null ? null : State(selected.ElementId);
    private PdfElementLayoutState State(string id) => adapter.GetCurrentLayoutState().Elements.Single(element => element.ElementId == id);
    private static string Pair(double? x, double? y) => x.HasValue && y.HasValue ? $"{x:0.###} / {y:0.###}" : "–";
    private string CreateTableInfo()
    {
        var table = selected?.Kind == PdfElementKind.Table ? selected : selected?.Kind == PdfElementKind.TableColumn
            ? registry.FindById(selected.ParentId ?? string.Empty) : registry.Entries.FirstOrDefault(element => element.Kind == PdfElementKind.Table);
        if (table is null) return "Keine Tabelle registriert";
        var columns = registry.Entries.Where(element => element.Kind == PdfElementKind.TableColumn && element.ParentId == table.ElementId).ToArray();
        return $"Tabellenbreite {State(table.ElementId).Width:0.###} mm · Spaltensumme {columns.Sum(column => State(column.ElementId).Width ?? 0):0.###} mm · Mindestbreite 5 mm";
    }
    private void ApplyMetadata(ElectronPdfPreviewMetadata metadata)
    {
        outputPath = metadata.ControlledOutputPath is null ? string.Empty : Path.GetFullPath(metadata.ControlledOutputPath);
        bounds = metadata.RenderBounds.Select(bound => new PdfRenderBound(bound.ElementId, bound.PageNumber, bound.Box,
            registry.FindById(bound.ElementId)?.StableOrder ?? int.MaxValue, false)).ToArray();
        previewStale = metadata.Stale;
        OnPropertyChanged(nameof(OutputPath));
    }
    private void ValidateStep()
    {
        var normalized = stepText.Trim().Replace(',', '.');
        stepValid = double.TryParse(normalized, NumberStyles.Float, CultureInfo.InvariantCulture, out var value) && double.IsFinite(value) && value > 0;
        if (stepValid) { step = value; ClearError(); } else ShowError(PdfErrorCodes.InvalidNumber, "Schrittweite muss positiv und endlich sein; letzter gültiger Wert bleibt aktiv.");
        RaiseAll();
    }
    private void RefreshState() => RaiseAll();
    private void ClearError() { ErrorMessage = string.Empty; ErrorCode = string.Empty; OnPropertyChanged(nameof(ErrorCodeDisplay)); }
    private void ShowError(string code, string message) { ErrorCode = code; ErrorMessage = message; OnPropertyChanged(nameof(ErrorCodeDisplay)); }
    private void RaiseAll()
    {
        foreach (var name in new[] { nameof(CanOperate), nameof(IsDirty), nameof(CanDiscardElement), nameof(DirtyStatus), nameof(IsPreviewStale), nameof(PreviewStatus), nameof(SelectedId), nameof(SelectedName), nameof(SelectedKind), nameof(SelectedRole), nameof(SelectedParent), nameof(SelectedScope), nameof(SelectedArea), nameof(SelectedCapabilities), nameof(Position), nameof(Size), nameof(TextPosition), nameof(FontSize), nameof(TextAlignment), nameof(LineSpacing), nameof(Visibility), nameof(TableInfo), nameof(ElementLayerActive), nameof(TextLayerActive), nameof(PositionModeActive), nameof(WidthModeActive), nameof(HeightModeActive), nameof(TextPositionModeActive), nameof(FontSizeModeActive), nameof(CanPosition), nameof(CanWidth), nameof(CanHeight), nameof(CanTextPosition), nameof(CanFontSize), nameof(CanTextAlignment), nameof(CanLineSpacing), nameof(CanVisibility), nameof(CanPageMargins), nameof(SelectedPageImage) }) OnPropertyChanged(name);
        foreach (var command in new[] { SaveCommand, LoadCommand, DiscardElementCommand, DiscardAllCommand, ResetElementCommand, ResetAllCommand, RenderCommand, RefreshPreviewCommand, SetLayerCommand, SetModeCommand, DirectionCommand, PropertyCommand }) (command as AsyncCommand)?.RaiseCanExecuteChanged();
    }
    private bool Set<T>(ref T field, T value, [CallerMemberName] string? name = null) { if (EqualityComparer<T>.Default.Equals(field, value)) return false; field = value; OnPropertyChanged(name); return true; }
    private void OnPropertyChanged(string? name) => PropertyChanged?.Invoke(this, new(name));
}
