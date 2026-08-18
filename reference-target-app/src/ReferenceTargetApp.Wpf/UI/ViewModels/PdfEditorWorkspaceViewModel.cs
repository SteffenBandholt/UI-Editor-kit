using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Runtime.CompilerServices;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using ReferenceTargetApp.Domain.Models;
using ReferenceTargetApp.EditorIntegration.Electron;
using ReferenceTargetApp.EditorIntegration.Pdf;
using ReferenceTargetApp.EditorIntegration.Geometry;
using System.Text.Json;
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

internal sealed record PdfTableColumnEditorItem(string ColumnId, string DisplayName, double LogicalWidth, double EffectiveWidth,
    double HeaderWidthMinimum, double HeaderWidthMaximum, double DataWidthMinimum, double DataWidthMaximum,
    double ContentWidthMinimum, double ContentWidthMaximum, bool RuntimeWidthValid, double PreviewWidth)
{
    public string WidthLabel => $"wirksam {EffectiveWidth:0.###} mm · gespeichert {LogicalWidth:0.###} mm";
    public string RuntimeLabel => $"Kopf {HeaderWidthMinimum:0.###}–{HeaderWidthMaximum:0.###} · Zellen {DataWidthMinimum:0.###}–{DataWidthMaximum:0.###} · Inhalt {ContentWidthMinimum:0.###}–{ContentWidthMaximum:0.###} mm · {(RuntimeWidthValid ? "konsistent" : "Abweichung")}";
}

internal sealed record PdfTableBoundaryEditorItem(
    string LeftColumnId, string LeftDisplayName, string RightColumnId, string RightDisplayName,
    double CurrentPosition, double MinimumDelta, double MaximumDelta)
{
    public string DisplayName => $"{LeftDisplayName}  |  {RightDisplayName}";
    public string PositionLabel => $"Grenze bei {CurrentPosition:0.###} mm";
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
    private readonly Dispatcher dispatcher;
    private readonly SemaphoreSlim renderLock = new(1, 1);
    private CancellationTokenSource? activeRender;
    private PdfElementDefinition? selected;
    private PdfPageViewModel? selectedPage;
    private PdfTableBoundaryEditorItem? selectedTableBoundary;
    private IReadOnlyList<PdfRenderBound> bounds = [];
    private IReadOnlyList<ElectronPdfRenderBound> runtimeBounds = [];
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
    private string technicalDetails = string.Empty;
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
        dispatcher = Dispatcher.CurrentDispatcher;
        TreeRoots.ReplaceWith(BuildTree());
        SelectElement(registry.Entries.First(element => element.Editable).ElementId);
        SaveCommand = new AsyncCommand(_ => SaveAsync(), _ => CanOperate && IsDirty);
        UndoCommand = new AsyncCommand(_ => LayoutActionAsync(() => session.UndoAsync(lifetimeToken), "Letzte PDF-LayoutÃ¤nderung rÃ¼ckgÃ¤ngig gemacht."), _ => CanOperate && CanUndo);
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
        MoveTableBoundaryCommand = new AsyncCommand(MoveTableBoundaryAsync, p => CanMoveTableBoundary && p is string);
        ResetTableCommand = new AsyncCommand(_ => ResetCurrentTableAsync(), _ => CanOperate && CurrentTable() is not null);
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
    public ICommand UndoCommand { get; }
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
    public ICommand MoveTableBoundaryCommand { get; }
    public ICommand ResetTableCommand { get; }
    public string ProfileId => PdfLayoutProfileDocumentValidator.ProfileId;
    public int RegistryElementCount => registry.Entries.Count;
    public string OutputPath => outputPath;
    public bool IsBusy { get => busy; private set { if (Set(ref busy, value)) RaiseAll(); } }
    public bool CanOperate => !busy;
    public bool IsDirty => session.GetStatus().IsDirty;
    public bool CanUndo => session.CanUndo;
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
    public string TechnicalDetails { get => technicalDetails; private set => Set(ref technicalDetails, value); }
    public bool HasTechnicalDetails => !string.IsNullOrWhiteSpace(TechnicalDetails);
    public string SelectedId => selected?.ElementId ?? "–";
    public string SelectedName => selected?.Name ?? "Kein PDF-Element ausgewählt";
    public string SelectedKind => selected?.Kind.ToString() ?? "–";
    public string SelectedRole => selected?.Role.ToString() ?? "–";
    public string SelectedParent => selected?.ParentId ?? "–";
    public string SelectedScope => selected?.ScopeId ?? "–";
    public string SelectedArea => selected?.PageArea.ToString() ?? "–";
    public string SelectedCapabilities => selected?.Capabilities.ToString() ?? "None";
    public string SelectedPageText => SelectedPage is null ? "Seitentemplate" : $"Seite {SelectedPage.PageNumber}";
    public string Position => selected is { } definition && Current is { } value
        ? Pair(InspectorDisplayBox(definition, value).X, InspectorDisplayBox(definition, value).Y) + " mm"
        : "–";
    public string Width => selected is { } definition && Current is { } value ? InspectorDisplayBox(definition, value).Width.ToString("0.###", CultureInfo.CurrentCulture) + " mm" : "–";
    public string Height => selected is { } definition && Current is { } value ? InspectorDisplayBox(definition, value).Height.ToString("0.###", CultureInfo.CurrentCulture) + " mm" : "–";
    public string TextPosition => Current is { } value ? Pair(value.TextOffsetX, value.TextOffsetY) + " mm" : "–";
    public string FontSize => Current?.FontSize is double value ? value.ToString("0.###", CultureInfo.CurrentCulture) + " pt" : "–";
    public string StepLabel => mode == "fontSize" ? "Schrittweite (pt)" : "Schrittweite (mm)";
    public string TableInfo => CreateTableInfo();
    public ObservableCollection<PdfTableColumnEditorItem> TableColumns { get; } = [];
    public ObservableCollection<PdfTableBoundaryEditorItem> TableBoundaries { get; } = [];
    public PdfTableBoundaryEditorItem? SelectedTableBoundary
    {
        get => selectedTableBoundary;
        set { if (Set(ref selectedTableBoundary, value)) { OnPropertyChanged(nameof(CanMoveTableBoundary)); RaiseCommandStates(); } }
    }
    public bool HasTableOverview => selected?.Kind is PdfElementKind.Table or PdfElementKind.TableColumn && TableColumns.Count > 0;
    public string TableEditorTitle => CurrentTable()?.Name ?? "PDF-Tabelle";
    public bool CanMoveTableBoundary => CanOperate && stepValid && HasTableOverview && SelectedTableBoundary is not null && CurrentTable()?.AllowedOperations.Contains(PdfLayoutOperations.ResizeColumnBoundary, StringComparer.Ordinal) == true;
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
    public bool CanWidth => selected?.Kind != PdfElementKind.TableColumn && selected?.Capabilities.HasFlag(PdfCapability.Width) == true;
    public bool CanHeight => selected?.Capabilities.HasFlag(PdfCapability.Height) == true;
    public bool CanTextPosition => selected?.Capabilities.HasFlag(PdfCapability.TextPosition) == true;
    public bool CanFontSize => selected?.Capabilities.HasFlag(PdfCapability.FontSize) == true;
    public bool HasElementModes => CanPosition || CanWidth || CanHeight;
    public bool HasTextModes => CanTextPosition || CanFontSize;
    public bool HasDirectModes => HasElementModes || HasTextModes;
    public bool CanTextAlignment => selected?.Capabilities.HasFlag(PdfCapability.TextAlignment) == true;
    public bool CanLineSpacing => selected?.Capabilities.HasFlag(PdfCapability.LineSpacing) == true;
    public bool CanVisibility => selected?.Capabilities.HasFlag(PdfCapability.Visibility) == true;
    public bool CanPageMargins => selected?.Capabilities.HasFlag(PdfCapability.PageMargins) == true;
    public string TextAlignment => Current?.TextAlignment ?? "–";
    public string LineSpacing => Current?.LineSpacing is double value ? value.ToString("0.###", CultureInfo.CurrentCulture) : "–";
    public string Visibility => selected is { } definition && Current is { } current
        ? ((current.Visible ?? definition.BaselineLayout.Visible ?? true) ? "sichtbar" : "ausgeblendet")
        : "–";
    public string StepText { get => stepText; set { if (Set(ref stepText, value)) ValidateStep(); } }
    public PdfPageViewModel? SelectedPage { get => selectedPage; set { if (Set(ref selectedPage, value)) { OnPropertyChanged(nameof(SelectedPageText)); OnPropertyChanged(nameof(Position)); OnPropertyChanged(nameof(Width)); OnPropertyChanged(nameof(Height)); UpdateOverlay(lastViewportWidth, lastViewportHeight); } } }
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
            await dispatcher.InvokeAsync(() => ApplyMetadata(metadata));
        }
        if (File.Exists(outputPath)) await RefreshPreviewAsync();
        else await dispatcher.InvokeAsync(RefreshState);
    }

    public void SelectElement(string elementId)
    {
        selected = registry.FindById(elementId);
        if (selected is null) { ShowError(PdfErrorCodes.UnknownElement, "PDF-Element ist nicht registriert."); return; }
        var page = bounds.FirstOrDefault(bound => bound.ElementId == elementId)?.PageNumber;
        if (page.HasValue) SelectedPage = Pages.FirstOrDefault(item => item.PageNumber == page.Value) ?? SelectedPage;
        NormalizeMode();
        RefreshTableEditor();
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
        var selectedBounds = SelectedPage is null ? [] : bounds
            .Where(item => item.PageNumber == SelectedPage.PageNumber && item.ElementId == SelectedId).ToArray();
        var box = selected?.Kind == PdfElementKind.TableColumn && SelectedPage is not null
            ? TableColumnReadbackBox(selected.ElementId, SelectedPage.PageNumber, runtimeBounds)
            : selectedBounds.OrderBy(item => item.Box.Width * item.Box.Height).FirstOrDefault()?.Box;
        if (box is null) { OverlayWidth = OverlayHeight = 0; return; }
        var mapped = PdfPreviewCoordinateMapper.ToViewport(box, width, height);
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
        catch (OperationCanceledException) when (activeRender?.IsCancellationRequested == true)
        {
            StatusMessage = "PDF-Erzeugung abgebrochen. Sie können direkt weiterarbeiten.";
        }
        catch (ElectronEditorException exception)
        {
            ShowError(exception.Code, "PDF konnte nicht erzeugt werden. Sie können direkt weiterarbeiten.", exception.Message);
            StatusMessage = "PDF-Erzeugung fehlgeschlagen; letzte gültige Vorschau bleibt erhalten.";
        }
        catch (Exception exception)
        {
            ShowError(PdfErrorCodes.RenderFailed, "PDF konnte nicht erzeugt werden. Sie können direkt weiterarbeiten.", exception.Message);
            StatusMessage = "PDF-Erzeugung fehlgeschlagen; letzte gültige Vorschau bleibt erhalten.";
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

    public async Task<bool> DiscardAllForCloseAsync()
    {
        IsBusy = true;
        ClearError();
        try
        {
            var result = await session.DiscardAsync(lifetimeToken);
            ApplyResult(result, "Nicht gespeicherte PDF-Änderungen wurden verworfen.", true);
            return result.Success;
        }
        finally { IsBusy = false; }
    }

    private async Task ResetCurrentTableAsync()
    {
        var table = CurrentTable();
        if (table is null) return;
        await LayoutActionAsync(() => session.ResetTableAsync(table.ElementId, lifetimeToken),
            "Die vollständige PDF-Tabelle verwendet wieder ihr ursprüngliches Layout.");
    }

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
        var unit = mode == "fontSize" ? "pt" : "mm";
        await LayoutActionAsync(() => session.ApplyBatchAsync([request], lifetimeToken),
            $"{selected.Name}: {operation}, Schritt {step:G} {unit} erfolgreich.");
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
        await LayoutActionAsync(() => session.ApplyBatchAsync([request], lifetimeToken),
            $"{selected.Name}: {operation} erfolgreich.");
    }

    private async Task MoveTableBoundaryAsync(object? parameter)
    {
        if (!CanMoveTableBoundary || SelectedTableBoundary is null || parameter is not string text) return;
        var delta = text switch
        {
            "left" => -step,
            "right" => step,
            _ when double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) => parsed,
            _ => double.NaN,
        };
        if (!double.IsFinite(delta)) return;
        if (delta < SelectedTableBoundary.MinimumDelta - 0.000001 || delta > SelectedTableBoundary.MaximumDelta + 0.000001)
        {
            ShowError(PdfErrorCodes.InvalidColumnWidth, "Diese Grenzverschiebung würde eine registrierte Mindest- oder Maximalbreite überschreiten.");
            return;
        }
        var table = CurrentTable();
        if (table is null) return;
        var request = new PdfChangeRequest(Guid.NewGuid().ToString("N"), table.ElementId, PdfLayoutOperations.ResizeColumnBoundary,
            new Dictionary<string, object?>
            {
                ["table"] = new Dictionary<string, object?>
                {
                    ["leftColumnId"] = SelectedTableBoundary.LeftColumnId,
                    ["rightColumnId"] = SelectedTableBoundary.RightColumnId,
                    ["delta"] = delta,
                },
            }, DateTimeOffset.UtcNow, "native-pdf-editor", registry.Document.DocumentId);
        await LayoutActionAsync(() => session.ApplyBatchAsync([request], lifetimeToken),
            $"PDF-Grenze {SelectedTableBoundary.DisplayName} wurde um {Math.Abs(delta):G} mm nach {(delta > 0 ? "rechts" : "links")} verschoben.");
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
        var hasElementMode = HasElementModes;
        var hasTextMode = HasTextModes;
        if (layer == "element" && !hasElementMode && hasTextMode) layer = "text";
        if (layer == "text" && !hasTextMode && hasElementMode) layer = "element";
        if (!ModeAllowed(mode)) mode = layer == "text"
            ? (CanTextPosition ? "textPosition" : "fontSize")
            : CanPosition ? "position" : CanWidth ? "width" : "height";
    }

    private async Task LayoutActionAsync(Func<Task<PdfLayoutOperationResult>> action, string success)
    {
        IsBusy = true; ClearError();
        try
        {
            var result = await action();
            ApplyResult(result, success, true);
            if (result.Success && electronAdapter is not null) await RenderAsync();
        }
        finally { IsBusy = false; }
    }

    private void ApplyResult(PdfLayoutOperationResult result, string success, bool stale)
    {
        if (!result.Success)
        {
            var boundaryFailure = result.Failures?.FirstOrDefault(failure =>
                failure.Code is PdfErrorCodes.OutOfPageBounds or PdfErrorCodes.InvalidPageZone);
            if (result.Code is PdfErrorCodes.OutOfPageBounds or PdfErrorCodes.InvalidPageZone || boundaryFailure is not null)
            {
                var notice = GeometryRiskMessages.ForPdf(GeometryRiskTypes.LeavesEditableArea, selected?.Name ?? "PDF-Element", selected?.PageArea.ToString() ?? "Seitenbereich");
                ShowError(boundaryFailure?.Code ?? result.Code, notice.Message,
                    boundaryFailure is null ? result.Message : $"{boundaryFailure.Message}\n{result.Message}");
            }
            else ShowError(result.Code, result.Message);
            StatusMessage = result.RollbackSucceeded
                ? "Änderung wurde nicht übernommen. Sie können direkt weiterarbeiten."
                : "PDF-Layoutaktion und Rollback sind fehlgeschlagen.";
        }
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
    private static PdfBox InspectorBox(PdfElementDefinition definition, PdfElementLayoutState state) => new(
        state.X ?? definition.BaselineLayout.X,
        state.Y ?? definition.BaselineLayout.Y,
        state.Width ?? definition.BaselineLayout.Width,
        state.Height ?? definition.BaselineLayout.Height,
        state.TextOffsetX ?? definition.BaselineLayout.TextOffsetX,
        state.TextOffsetY ?? definition.BaselineLayout.TextOffsetY,
        state.FontSize ?? definition.BaselineLayout.FontSize,
        state.TextAlignment ?? definition.BaselineLayout.TextAlignment,
        state.LineSpacing ?? definition.BaselineLayout.LineSpacing,
        state.Visible ?? definition.BaselineLayout.Visible);
    internal static PdfBox InspectorBoxForDiagnostic(PdfElementDefinition definition, PdfElementLayoutState state) => InspectorBox(definition, state);
    private PdfBox InspectorDisplayBox(PdfElementDefinition definition, PdfElementLayoutState state) =>
        InspectorDisplayBoxForDiagnostic(definition, state, runtimeBounds, SelectedPage?.PageNumber);
    internal static PdfBox InspectorDisplayBoxForDiagnostic(PdfElementDefinition definition, PdfElementLayoutState state,
        IEnumerable<ElectronPdfRenderBound> measuredBounds, int? pageNumber) =>
        definition.Kind == PdfElementKind.TableColumn && pageNumber.HasValue
            ? TableColumnReadbackBox(definition.ElementId, pageNumber.Value, measuredBounds) ?? InspectorBox(definition, state)
            : InspectorBox(definition, state);
    internal static bool HasTableOverviewForDiagnostic(PdfElementDefinition? definition, int columnCount) =>
        definition?.Kind is PdfElementKind.Table or PdfElementKind.TableColumn && columnCount > 0;
    internal static bool CanUseDirectWidthModeForDiagnostic(PdfElementDefinition? definition) =>
        definition?.Kind != PdfElementKind.TableColumn && definition?.Capabilities.HasFlag(PdfCapability.Width) == true;
    private static PdfBox? UnionBoxes(IEnumerable<PdfBox> boxes)
    {
        var values = boxes.ToArray();
        if (values.Length == 0) return null;
        var left = values.Min(box => box.X);
        var top = values.Min(box => box.Y);
        var right = values.Max(box => box.X + box.Width);
        var bottom = values.Max(box => box.Y + box.Height);
        return new(left, top, right - left, bottom - top);
    }
    internal static PdfBox? UnionBoxesForDiagnostic(IEnumerable<PdfBox> boxes) => UnionBoxes(boxes);
    internal static PdfBox? TableColumnReadbackBox(string elementId, int pageNumber,
        IEnumerable<ElectronPdfRenderBound> measuredBounds)
    {
        var pageBounds = measuredBounds.Where(bound => bound.ElementId == elementId && bound.PageNumber == pageNumber &&
            bound.Box.Width > 0 && bound.Box.Height > 0).ToArray();
        var tracks = pageBounds.Where(bound => bound.Part == "track").Select(bound => bound.Box).ToArray();
        if (tracks.Length > 0) return UnionBoxes(tracks);
        return UnionBoxes(pageBounds.Where(bound => bound.Part is "header" or "data").Select(bound => bound.Box));
    }
    private string CreateTableInfo()
    {
        var table = selected?.Kind == PdfElementKind.Table ? selected : selected?.Kind == PdfElementKind.TableColumn
            ? registry.FindById(selected.ParentId ?? string.Empty) : registry.Entries.FirstOrDefault(element => element.Kind == PdfElementKind.Table);
        if (table is null) return "Keine Tabelle registriert";
        var columns = registry.Entries.Where(element => element.Kind == PdfElementKind.TableColumn && element.ParentId == table.ElementId).ToArray();
        var prefix = selected?.Kind == PdfElementKind.TableColumn
            ? $"{table.Name} · aktuelle Spaltenbreite {(State(selected.ElementId).Width ?? selected.BaselineLayout.Width):0.###} mm · "
            : string.Empty;
        return $"{prefix}Tabellenbreite {State(table.ElementId).Width:0.###} mm · Spaltensumme {columns.Sum(column => State(column.ElementId).Width ?? column.BaselineLayout.Width):0.###} mm · Mindestbreite 5 mm";
    }
    private PdfElementDefinition? CurrentTable() => selected?.Kind == PdfElementKind.Table ? selected : selected?.Kind == PdfElementKind.TableColumn
        ? registry.FindById(selected.ParentId ?? string.Empty) : null;

    private static string FriendlyTableColumnName(PdfElementDefinition column) =>
        string.Equals(column.ColumnRole, "metaColumn", StringComparison.Ordinal) || column.Role == PdfElementRole.Meta
            ? "Meta rechts"
            : column.Name.StartsWith("Spalte ", StringComparison.Ordinal) ? column.Name[7..] : column.Name;

    private void RefreshTableEditor()
    {
        (string LeftColumnId, string RightColumnId)? previous = SelectedTableBoundary is null
            ? null
            : (SelectedTableBoundary.LeftColumnId, SelectedTableBoundary.RightColumnId);
        TableColumns.Clear();
        TableBoundaries.Clear();
        var table = CurrentTable();
        if (table is not null)
        {
            var columns = registry.Entries.Where(element => element.Kind == PdfElementKind.TableColumn && element.ParentId == table.ElementId)
                .OrderBy(element => element.StableOrder).ToArray();
            var widths = columns.Select(column => State(column.ElementId).Width ?? column.BaselineLayout.Width).ToArray();
            var total = Math.Max(1, widths.Sum());
            for (var index = 0; index < columns.Length; index++)
            {
                var measured = runtimeBounds.Where(bound => bound.ElementId == columns[index].ElementId).ToArray();
                var tracks = measured.Where(bound => bound.Part == "track" && bound.Box.Width > 0).Select(bound => bound.Box.Width).ToArray();
                var headers = measured.Where(bound => bound.Part == "header" && bound.Box.Width > 0).Select(bound => bound.Box.Width).ToArray();
                var dataCells = measured.Where(bound => bound.Part == "data" && bound.Box.Width > 0).Select(bound => bound.Box.Width).ToArray();
                var contents = measured.Where(bound => bound.Part is "header" or "data" && bound.ContentWidth is > 0).Select(bound => bound.ContentWidth!.Value).ToArray();
                var effective = tracks.FirstOrDefault(widths[index]);
                var headerMin = headers.DefaultIfEmpty(effective).Min();
                var headerMax = headers.DefaultIfEmpty(effective).Max();
                var dataMin = dataCells.DefaultIfEmpty(effective).Min();
                var dataMax = dataCells.DefaultIfEmpty(effective).Max();
                var contentMin = contents.DefaultIfEmpty(effective).Min();
                var contentMax = contents.DefaultIfEmpty(effective).Max();
                var valid = measured.Length == 0 || new[] { effective, headerMin, headerMax, dataMin, dataMax }
                    .All(value => Math.Abs(value - effective) <= 0.05) && contentMin > 0 && contentMax <= effective + 0.05;
                TableColumns.Add(new(columns[index].ElementId, FriendlyTableColumnName(columns[index]), widths[index], effective,
                    headerMin, headerMax, dataMin, dataMax, contentMin, contentMax, valid,
                    Math.Max(28, 270 * effective / Math.Max(1, tracks.Length > 0 ? columns.Select((_, position) =>
                        runtimeBounds.FirstOrDefault(bound => bound.ElementId == columns[position].ElementId && bound.Part == "track")?.Box.Width ?? widths[position]).Sum() : total))));
            }
            var position = 0d;
            for (var index = 0; index + 1 < columns.Length; index++)
            {
                var left = columns[index];
                var right = columns[index + 1];
                var leftWidth = widths[index];
                var rightWidth = widths[index + 1];
                position += leftWidth;
                var leftMinimum = Math.Max(5, left.LayoutBounds?.MinWidth ?? 5);
                var rightMinimum = Math.Max(5, right.LayoutBounds?.MinWidth ?? 5);
                var leftMaximum = left.LayoutBounds?.MaxWidth ?? double.MaxValue;
                var rightMaximum = right.LayoutBounds?.MaxWidth ?? double.MaxValue;
                TableBoundaries.Add(new(left.ElementId, FriendlyTableColumnName(left), right.ElementId, FriendlyTableColumnName(right), position,
                    Math.Max(leftMinimum - leftWidth, rightWidth - rightMaximum),
                    Math.Min(leftMaximum - leftWidth, rightWidth - rightMinimum)));
            }
        }
        SelectedTableBoundary = previous is { } pair
            ? TableBoundaries.FirstOrDefault(boundary => boundary.LeftColumnId == pair.Item1 && boundary.RightColumnId == pair.Item2)
            : null;
        SelectedTableBoundary ??= TableBoundaries.FirstOrDefault(boundary => boundary.RightColumnId == SelectedId)
            ?? TableBoundaries.FirstOrDefault(boundary => boundary.LeftColumnId == SelectedId)
            ?? TableBoundaries.LastOrDefault();
        OnPropertyChanged(nameof(HasTableOverview));
        OnPropertyChanged(nameof(CanMoveTableBoundary));
    }
    private void ApplyMetadata(ElectronPdfPreviewMetadata metadata)
    {
        outputPath = metadata.ControlledOutputPath is null ? string.Empty : Path.GetFullPath(metadata.ControlledOutputPath);
        runtimeBounds = metadata.RenderBounds;
        bounds = metadata.RenderBounds.Select(bound => new PdfRenderBound(bound.ElementId, bound.PageNumber, bound.Box,
            registry.FindById(bound.ElementId)?.StableOrder ?? int.MaxValue,
            registry.FindById(bound.ElementId)?.Editable == true)).ToArray();
        previewStale = metadata.Stale;
        OnPropertyChanged(nameof(OutputPath));
        RefreshTableEditor();
        RaiseAll();
    }
    private void ValidateStep()
    {
        var normalized = stepText.Trim().Replace(',', '.');
        stepValid = double.TryParse(normalized, NumberStyles.Float, CultureInfo.InvariantCulture, out var value) && double.IsFinite(value) && value > 0;
        if (stepValid) { step = value; ClearError(); } else ShowError(PdfErrorCodes.InvalidNumber, "Schrittweite muss positiv und endlich sein; letzter gültiger Wert bleibt aktiv.");
        RaiseAll();
    }
    private void RefreshState() { RefreshTableEditor(); RaiseAll(); }
    private void ClearError() { ErrorMessage = string.Empty; ErrorCode = string.Empty; TechnicalDetails = string.Empty; OnPropertyChanged(nameof(ErrorCodeDisplay)); OnPropertyChanged(nameof(HasTechnicalDetails)); }
    private void ShowError(string code, string message, string? hostDetails = null)
    {
        ErrorCode = code; ErrorMessage = message;
        TechnicalDetails = JsonSerializer.Serialize(new { errorCode = code, hostAdapterReadback = hostDetails ?? message }, new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true });
        OnPropertyChanged(nameof(ErrorCodeDisplay)); OnPropertyChanged(nameof(HasTechnicalDetails));
    }
    private void RaiseAll()
    {
        OnPropertyChanged(nameof(CanUndo));
        foreach (var name in new[] { nameof(CanOperate), nameof(IsDirty), nameof(CanDiscardElement), nameof(DirtyStatus), nameof(IsPreviewStale), nameof(PreviewStatus), nameof(SelectedId), nameof(SelectedName), nameof(SelectedKind), nameof(SelectedRole), nameof(SelectedParent), nameof(SelectedScope), nameof(SelectedArea), nameof(SelectedCapabilities), nameof(Position), nameof(Width), nameof(Height), nameof(TextPosition), nameof(FontSize), nameof(StepLabel), nameof(TextAlignment), nameof(LineSpacing), nameof(Visibility), nameof(TableInfo), nameof(HasTableOverview), nameof(TableEditorTitle), nameof(CanMoveTableBoundary), nameof(ElementLayerActive), nameof(TextLayerActive), nameof(PositionModeActive), nameof(WidthModeActive), nameof(HeightModeActive), nameof(TextPositionModeActive), nameof(FontSizeModeActive), nameof(CanPosition), nameof(CanWidth), nameof(CanHeight), nameof(CanTextPosition), nameof(CanFontSize), nameof(HasElementModes), nameof(HasTextModes), nameof(HasDirectModes), nameof(CanTextAlignment), nameof(CanLineSpacing), nameof(CanVisibility), nameof(CanPageMargins), nameof(SelectedPageImage) }) OnPropertyChanged(name);
        RaiseCommandStates();
    }
    private void RaiseCommandStates()
    {
        (UndoCommand as AsyncCommand)?.RaiseCanExecuteChanged();
        foreach (var command in new[] { SaveCommand, LoadCommand, DiscardElementCommand, DiscardAllCommand, ResetElementCommand, ResetAllCommand, RenderCommand, RefreshPreviewCommand, SetLayerCommand, SetModeCommand, DirectionCommand, PropertyCommand, MoveTableBoundaryCommand, ResetTableCommand }) (command as AsyncCommand)?.RaiseCanExecuteChanged();
    }
    private bool Set<T>(ref T field, T value, [CallerMemberName] string? name = null) { if (EqualityComparer<T>.Default.Equals(field, value)) return false; field = value; OnPropertyChanged(name); return true; }
    private void OnPropertyChanged(string? name) => PropertyChanged?.Invoke(this, new(name));
}
