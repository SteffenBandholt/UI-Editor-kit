using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Globalization;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;
using ReferenceTargetApp.EditorIntegration.EditorUi;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Process;
using ReferenceTargetApp.EditorIntegration.Session;
using ReferenceTargetApp.UI.Editor;

namespace ReferenceTargetApp.UI.ViewModels;

internal sealed record EditorScopeChoice(string ScopeId, string DisplayName);

internal sealed class EditorWindowViewModel : INotifyPropertyChanged
{
    private readonly EditorProcessCoordinator coordinator;
    private readonly LayoutProfileSession layoutSession;
    private readonly TargetAppSelectionService selectionService;
    private readonly IEditorDialogService dialogService;
    private readonly Func<Window?> getOwner;
    private readonly Func<Task> requestClose;
    private readonly CancellationToken lifetimeToken;
    private readonly Dispatcher dispatcher;
    private readonly IPdfEditorWorkspace pdfWorkspace;
    private EditorUiState? state;
    private LayoutProfileSessionStatus? layoutStatus;
    private string stepText = "1";
    private double lastValidStep = 1;
    private bool stepValid = true;
    private bool busy;
    private bool closing;
    private string statusMessage = "Editor wird gestartet …";
    private string errorMessage = string.Empty;
    private string errorCode = string.Empty;
    private int activeWorkspaceIndex;

    public EditorWindowViewModel(
        EditorProcessCoordinator coordinator,
        LayoutProfileSession layoutSession,
        TargetAppSelectionService selectionService,
        IEditorDialogService dialogService,
        Func<Window?> getOwner,
        Func<Task> requestClose,
        CancellationToken lifetimeToken,
        IPdfEditorWorkspace pdfWorkspace)
    {
        this.coordinator = coordinator;
        this.layoutSession = layoutSession;
        this.selectionService = selectionService;
        this.dialogService = dialogService;
        this.getOwner = getOwner;
        this.requestClose = requestClose;
        this.lifetimeToken = lifetimeToken;
        this.pdfWorkspace = pdfWorkspace;
        dispatcher = Dispatcher.CurrentDispatcher;
        SetLayerCommand = new AsyncCommand(SetLayerAsync, parameter => CanInteract && parameter is string);
        SetModeCommand = new AsyncCommand(SetModeAsync, parameter => CanInteract && parameter is string);
        DirectionCommand = new AsyncCommand(ApplyDirectionAsync, parameter => CanUseDirection(parameter as string));
        ToggleVisibilityCommand = new AsyncCommand(_ => ToggleVisibilityAsync(), _ => CanChangeVisibility);
        SaveCommand = new AsyncCommand(_ => SaveAsync(), _ => CanOperate && IsDirty);
        LoadCommand = new AsyncCommand(_ => RunLayoutActionAsync(() => layoutSession.LoadAsync(lifetimeToken), "Profil wurde geladen."), _ => CanOperate);
        DiscardElementCommand = new AsyncCommand(_ => DiscardElementAsync(), _ => CanOperate && CanDiscardElement);
        DiscardAllCommand = new AsyncCommand(_ => ConfirmAndRunAsync("Alle Änderungen verwerfen", "Alle ungespeicherten Änderungen werden auf die letzte gespeicherte Profilversion zurückgesetzt.", () => layoutSession.DiscardAllAsync(lifetimeToken)), _ => CanOperate && IsDirty);
        ResetElementCommand = new AsyncCommand(_ => ResetElementAsync(), _ => CanOperate && CanResetElement);
        ResetAllCommand = new AsyncCommand(_ => ConfirmAndRunAsync("Gesamtes Layout zurücksetzen", "Alle registrierten Elemente werden auf die ursprüngliche Ziel-App-Baseline zurückgesetzt. Die gespeicherte Datei bleibt unverändert.", () => layoutSession.ResetAllAsync(lifetimeToken)), _ => CanOperate && CanResetAll);
        BeginAppSelectionCommand = new AsyncCommand(_ => BeginAppSelectionAsync(), _ => CanOperate && !IsAppSelectionActive);
        CancelAppSelectionCommand = new AsyncCommand(_ => CancelAppSelectionAsync(), _ => CanOperate && IsAppSelectionActive);
        CloseCommand = new AsyncCommand(_ => RequestCloseAsync(), _ => !closing);
        selectionService.ElementSelected += SelectionService_ElementSelected;
        selectionService.SelectionRejected += SelectionService_SelectionRejected;
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    public PdfEditorWorkspaceViewModel Pdf => pdfWorkspace as PdfEditorWorkspaceViewModel
        ?? throw new InvalidOperationException("PDF-Arbeitsbereich ist für diese Ziel-App nicht verfügbar.");
    public IPdfEditorWorkspace PdfBinding => pdfWorkspace;
    public int ActiveWorkspaceIndex
    {
        get => activeWorkspaceIndex;
        set
        {
            if (Set(ref activeWorkspaceIndex, value))
                StatusMessage = value == 0 ? "Arbeitsbereich Programmoberfläche aktiv." : "Arbeitsbereich PDF-Ausgabe aktiv.";
        }
    }
    public ObservableCollection<EditorTreeNodeViewModel> TreeRoots { get; } = [];
    public ObservableCollection<EditorChoiceViewModel> Layers { get; } = [];
    public ObservableCollection<EditorChoiceViewModel> Modes { get; } = [];
    public ObservableCollection<LayoutProfileDefinition> Profiles { get; } = [];
    public ObservableCollection<EditorScopeChoice> Scopes { get; } = [];
    public ICommand SetLayerCommand { get; }
    public ICommand SetModeCommand { get; }
    public ICommand DirectionCommand { get; }
    public ICommand ToggleVisibilityCommand { get; }
    public ICommand SaveCommand { get; }
    public ICommand LoadCommand { get; }
    public ICommand DiscardElementCommand { get; }
    public ICommand DiscardAllCommand { get; }
    public ICommand ResetElementCommand { get; }
    public ICommand ResetAllCommand { get; }
    public ICommand BeginAppSelectionCommand { get; }
    public ICommand CancelAppSelectionCommand { get; }
    public ICommand CloseCommand { get; }
    public bool CanInteract => state is not null && !busy && !closing && stepValid;
    public bool CanOperate => state is not null && !busy && !closing;
    public bool ControlsEnabled => state is not null && !busy && !closing;
    public bool IsBusy { get => busy; private set { if (Set(ref busy, value)) RaiseCommandStates(); } }
    public bool IsClosing { get => closing; private set { if (Set(ref closing, value)) RaiseCommandStates(); } }
    public string StatusMessage { get => statusMessage; private set => Set(ref statusMessage, value); }
    public string ErrorMessage { get => errorMessage; private set => Set(ref errorMessage, value); }
    public string ErrorCode { get => errorCode; private set => Set(ref errorCode, value); }
    public string ErrorCodeDisplay => string.IsNullOrWhiteSpace(ErrorCode) ? string.Empty : $"Technischer Code: {ErrorCode}";
    public bool HasError => !string.IsNullOrWhiteSpace(ErrorMessage);
    public string ActiveProfileId => layoutSession.ActiveProfileId;
    public string ActiveScopeId => coordinator.ActiveScopeId;
    public bool IsDirty => layoutStatus?.IsDirty == true;
    public string DirtyStatus => IsDirty ? "Ungespeicherte Änderungen vorhanden" : "Änderungen gespeichert";
    public bool IsAppSelectionActive => selectionService.IsActive;
    public string SelectedName { get; private set; } = "Kein Element ausgewählt";
    public string SelectedId { get; private set; } = "–";
    public string SelectedType { get; private set; } = "–";
    public string SelectedScope { get; private set; } = "–";
    public string SelectedParent { get; private set; } = "–";
    public string SelectedRole { get; private set; } = "–";
    public string Operations { get; private set; } = "–";
    public string Position { get; private set; } = "–";
    public string Size { get; private set; } = "–";
    public string TextPosition { get; private set; } = "–";
    public string FontSize { get; private set; } = "–";
    public string VisibilityStatus { get; private set; } = "–";
    public bool IsSelectedVisible { get; private set; } = true;
    public bool CanChangeVisibility => CanOperate && state?.Details?.Operations?.AvailableOps.Contains(
        ReferenceTargetApp.EditorIntegration.HostAdapter.HostAdapterOperations.SetVisibility,
        StringComparer.Ordinal) == true;
    public string VisibilityActionLabel => IsSelectedVisible ? "Ausblenden" : "Einblenden";
    public bool LeftEnabled { get; private set; }
    public bool RightEnabled { get; private set; }
    public bool UpEnabled { get; private set; }
    public bool DownEnabled { get; private set; }
    public bool CanDiscardElement => layoutStatus?.DirtyElementIds.Contains(SelectedId, StringComparer.Ordinal) == true;
    public bool CanResetElement => SelectedId != "–" && ElementDiffers(layoutStatus?.Working, layoutStatus?.Baseline, SelectedScope, SelectedId);
    public bool CanResetAll => layoutStatus is not null && layoutStatus.Baseline.Any(pair => pair.Value.Elements.Any(element => ElementDiffers(layoutStatus.Working, layoutStatus.Baseline, pair.Key, element.ElementId)));
    public string StepText
    {
        get => stepText;
        set { if (Set(ref stepText, value)) ValidateStep(value); }
    }

    internal EditorUiState? CurrentState => state;
    internal int? ProcessId => coordinator.ProcessId;
    internal string? SessionId => coordinator.SessionId;
    internal double LastValidStep => lastValidStep;
    internal bool IsApplyingState { get; private set; }

    internal async Task InitializeAsync()
    {
        IsBusy = true;
        ClearError();
        try
        {
            var activation = await coordinator.ActivateAsync(lifetimeToken);
            if (!activation.Success) throw new EditorProcessException(activation.Code, activation.Message);
            var session = await coordinator.StartSessionAsync(lifetimeToken);
            if (!session.Success) throw new EditorProcessException(session.Code, session.Message);
            var initialState = await coordinator.GetEditorUiStateAsync(lifetimeToken);
            await pdfWorkspace.InitializeAsync();
            RunOnUi(() =>
            {
                Profiles.ReplaceWith(LayoutProfileCatalog.All);
                Scopes.ReplaceWith(coordinator.ScopeIds.Select(scopeId =>
                    new EditorScopeChoice(scopeId, coordinator.ScopeDisplayName(scopeId))));
                ApplyState(initialState);
                RefreshLayoutStatus();
                StatusMessage = "Editor bereit.";
            });
        }
        catch (Exception exception) when (exception is EditorProcessException or InvalidOperationException or OperationCanceledException)
        {
            RunOnUi(() => { ShowError(ErrorCodeFor(exception), exception.Message); StatusMessage = "Editor konnte nicht vollständig gestartet werden."; });
        }
        finally { RunOnUi(() => IsBusy = false); }
    }

    internal async Task SelectElementAsync(string elementId)
    {
        if (!CanOperate) return;
        await RunStateActionAsync(() => coordinator.SelectEditorElementAsync(elementId, lifetimeToken), $"Element {elementId} ausgewählt.");
        if (state?.Details is not null)
            await selectionService.HighlightAsync(state.ScopeId, state.Details.ElementId, lifetimeToken);
    }

    internal async Task SelectScopeAsync(string scopeId)
    {
        if (!CanOperate || string.Equals(scopeId, ActiveScopeId, StringComparison.Ordinal)) return;
        await RunStateActionAsync(() => coordinator.SelectEditorScopeAsync(scopeId, lifetimeToken), $"Bereich {scopeId} ist aktiv.");
        OnPropertyChanged(nameof(ActiveScopeId));
    }

    internal async Task SelectProfileAsync(string profileId)
    {
        if (!CanOperate || string.Equals(profileId, ActiveProfileId, StringComparison.Ordinal)) return;
        if (IsDirty)
        {
            var decision = dialogService.AskUnsavedChanges(getOwner()!, "Vor dem Profilwechsel müssen die Änderungen gespeichert, bewusst verworfen oder der Wechsel abgebrochen werden.");
            if (decision == UnsavedChangesDecision.Cancel) { StatusMessage = "Profilwechsel abgebrochen."; return; }
            if (decision == UnsavedChangesDecision.Save && !await SaveAsync()) return;
        }
        await RunLayoutActionAsync(() => layoutSession.SwitchProfileAsync(profileId, lifetimeToken), "Profil wurde gewechselt.");
        OnPropertyChanged(nameof(ActiveProfileId));
    }

    internal async Task ApplyDirectionForDiagnosticAsync(string direction) => await ApplyDirectionAsync(direction);
    internal async Task SetLayerForDiagnosticAsync(string layer) => await SetLayerAsync(layer);
    internal async Task SetModeForDiagnosticAsync(string mode) => await SetModeAsync(mode);
    internal async Task<bool> SaveForDiagnosticAsync() => await SaveAsync();
    internal async Task BeginAppSelectionForDiagnosticAsync() => await BeginAppSelectionAsync();
    internal async Task DiscardElementForDiagnosticAsync() => await DiscardElementAsync();
    internal async Task DiscardAllForDiagnosticAsync() => await RunLayoutActionAsync(() => layoutSession.DiscardAllAsync(lifetimeToken), "Alle Änderungen verworfen.");
    internal async Task ResetElementForDiagnosticAsync() => await ResetElementAsync();
    internal async Task ResetAllForDiagnosticAsync() => await RunLayoutActionAsync(() => layoutSession.ResetAllAsync(lifetimeToken), "Gesamtes Layout zurückgesetzt.");
    internal async Task SetVisibilityForDiagnosticAsync(bool visible)
    {
        if (IsSelectedVisible != visible) await ToggleVisibilityAsync();
    }

    internal async Task<bool> ConfirmCloseAsync()
    {
        if (!IsDirty && !pdfWorkspace.IsDirty) return true;
        var dirtyAreas = IsDirty && pdfWorkspace.IsDirty ? "Programmoberfläche und PDF-Ausgabe" : IsDirty ? "Programmoberfläche" : "PDF-Ausgabe";
        var decision = dialogService.AskUnsavedChanges(getOwner()!, "Der Editor wird geschlossen. Wählen Sie Speichern und schließen, Ohne Speichern schließen oder Abbrechen.");
        if (decision == UnsavedChangesDecision.Cancel) { StatusMessage = "Schließen abgebrochen."; return false; }
        if (decision != UnsavedChangesDecision.Save) return true;
        StatusMessage = "Ungespeichert: " + dirtyAreas + ". Zustände werden gespeichert …";
        if (IsDirty && !await SaveAsync()) return false;
        return !pdfWorkspace.IsDirty || await pdfWorkspace.SaveAsync();
    }

    internal void BeginClosing(bool operationWasRunning)
    {
        selectionService.Cancel();
        pdfWorkspace.Cancel();
        IsClosing = true;
        StatusMessage = operationWasRunning ? "Editor wird nach der laufenden Änderung geschlossen …" : "Editor wird geschlossen …";
    }

    internal void MarkClosed()
    {
        selectionService.ElementSelected -= SelectionService_ElementSelected;
        selectionService.SelectionRejected -= SelectionService_SelectionRejected;
        pdfWorkspace.Dispose();
        StatusMessage = "Editor geschlossen.";
    }

    private async Task RequestCloseAsync()
    {
        if (await ConfirmCloseAsync()) await requestClose();
    }

    private async Task SetLayerAsync(object? parameter)
    {
        if (parameter is string layer) await RunStateActionAsync(() => coordinator.SetEditorLayerAsync(layer, lifetimeToken), $"Ebene {layer} ist aktiv.");
    }

    private async Task SetModeAsync(object? parameter)
    {
        if (parameter is string mode) await RunStateActionAsync(() => coordinator.SetEditorModeAsync(mode, lifetimeToken), $"Modus {mode} ist aktiv.");
    }

    private async Task ApplyDirectionAsync(object? parameter)
    {
        if (parameter is not string direction || !CanUseDirection(direction)) return;
        IsBusy = true;
        ClearError();
        try
        {
            await coordinator.SetEditorStepAsync(lastValidStep, lifetimeToken);
            var outcome = await coordinator.RunEditorDirectionAsync(direction, lifetimeToken);
            RunOnUi(() =>
            {
                ApplyState(outcome.State);
                RefreshLayoutStatus();
                if (!outcome.Result.Success)
                {
                    ShowError(outcome.Result.RollbackSucceeded ? outcome.Result.ErrorCode ?? "target_rejected_change" : "rollback_failed", outcome.Result.Message);
                    StatusMessage = "Änderung wurde abgewiesen.";
                }
                else StatusMessage = $"{SelectedName}: {outcome.Result.Operation}, Schritt {lastValidStep:G} DIP erfolgreich.";
            });
        }
        catch (Exception exception) when (exception is EditorProcessException or InvalidOperationException or OperationCanceledException)
        {
            RunOnUi(() => { ShowError(ErrorCodeFor(exception), exception.Message); StatusMessage = "Änderung fehlgeschlagen."; });
        }
        finally { RunOnUi(() => IsBusy = false); }
    }

    internal void ShowConnectionLost(string code, string message)
    {
        RunOnUi(() =>
        {
            ShowError(code, message);
            StatusMessage = "Ziel-App-Verbindung getrennt. BBM kann unabhängig weiterlaufen.";
            IsBusy = false;
        });
    }

    private async Task ToggleVisibilityAsync()
    {
        if (!CanChangeVisibility) return;
        IsBusy = true;
        ClearError();
        try
        {
            var outcome = await coordinator.SetEditorVisibilityAsync(!IsSelectedVisible, lifetimeToken);
            RunOnUi(() =>
            {
                ApplyState(outcome.State);
                RefreshLayoutStatus();
                if (!outcome.Result.Success)
                {
                    ShowError(outcome.Result.RollbackSucceeded ? outcome.Result.ErrorCode ?? "target_rejected_change" : "rollback_failed", outcome.Result.Message);
                    StatusMessage = "Sichtbarkeit wurde abgewiesen.";
                }
                else StatusMessage = $"{SelectedName}: Sichtbarkeit geändert.";
            });
        }
        catch (Exception exception) when (exception is EditorProcessException or InvalidOperationException or OperationCanceledException)
        {
            RunOnUi(() => { ShowError(ErrorCodeFor(exception), exception.Message); StatusMessage = "Sichtbarkeitsänderung fehlgeschlagen."; });
        }
        finally { RunOnUi(() => IsBusy = false); }
    }

    private async Task<bool> SaveAsync()
    {
        var result = await RunLayoutActionAsync(() => layoutSession.SaveAsync(lifetimeToken), "Änderungen gespeichert.", refreshProcess: false);
        return result.Success;
    }

    private Task DiscardElementAsync() => RunLayoutActionAsync(
        () => layoutSession.DiscardElementAsync(SelectedScope, SelectedId, lifetimeToken), "Änderung des Elements wurde verworfen.");

    private Task ResetElementAsync() => RunLayoutActionAsync(
        () => layoutSession.ResetElementAsync(SelectedScope, SelectedId, lifetimeToken), "Element wurde auf die App-Baseline zurückgesetzt.");

    private async Task ConfirmAndRunAsync(string title, string message, Func<Task<LayoutOperationResult>> action)
    {
        if (dialogService.Confirm(getOwner()!, title, message)) await RunLayoutActionAsync(action, title + " abgeschlossen.");
    }

    private async Task<LayoutOperationResult> RunLayoutActionAsync(
        Func<Task<LayoutOperationResult>> action,
        string successMessage,
        bool refreshProcess = true)
    {
        IsBusy = true;
        ClearError();
        try
        {
            var result = await action();
            if (result.Success && refreshProcess)
                ApplyState(await coordinator.RefreshEditorLayoutStatesAsync(lifetimeToken));
            RefreshLayoutStatus();
            if (result.Success) StatusMessage = successMessage;
            else
            {
                ShowError(result.RollbackSucceeded ? result.Code : "rollback_failed", result.Message);
                StatusMessage = "Layoutoperation fehlgeschlagen.";
            }
            return result;
        }
        catch (Exception exception) when (exception is EditorProcessException or InvalidOperationException or OperationCanceledException)
        {
            ShowError(ErrorCodeFor(exception), exception.Message);
            StatusMessage = "Layoutoperation fehlgeschlagen.";
            return new(false, ErrorCodeFor(exception), exception.Message);
        }
        finally { IsBusy = false; }
    }

    private async Task BeginAppSelectionAsync()
    {
        await selectionService.BeginAsync(lifetimeToken);
        StatusMessage = "In App auswählen: Klicken Sie ein registriertes Element in der Ziel-App.";
        OnPropertyChanged(nameof(IsAppSelectionActive));
        RaiseCommandStates();
    }

    private async Task CancelAppSelectionAsync()
    {
        await selectionService.CancelAsync(lifetimeToken);
        StatusMessage = "Auswahlmodus abgebrochen.";
        OnPropertyChanged(nameof(IsAppSelectionActive));
        RaiseCommandStates();
    }

    private async void SelectionService_ElementSelected(object? sender, TargetAppElementSelectedEventArgs e)
    {
        try
        {
            if (!string.Equals(e.ScopeId, ActiveScopeId, StringComparison.Ordinal)) await SelectScopeAsync(e.ScopeId);
            await SelectElementAsync(e.ElementId);
            StatusMessage = $"Element {e.ElementId} wurde direkt in der Ziel-App ausgewählt.";
        }
        catch (Exception exception) when (exception is EditorProcessException or InvalidOperationException or OperationCanceledException)
        {
            ShowError("app_selection_failed", exception.Message);
        }
        finally
        {
            OnPropertyChanged(nameof(IsAppSelectionActive));
            RaiseCommandStates();
        }
    }

    private void SelectionService_SelectionRejected(object? sender, EventArgs e)
    {
        ShowError("app_selection_not_registered", "Das angeklickte Control ist nicht registriert und wurde nicht ausgewählt.");
        StatusMessage = "Nicht registriertes Control wurde abgewiesen; Auswahlmodus bleibt aktiv.";
    }

    private async Task RunStateActionAsync(Func<Task<EditorUiState>> action, string successMessage)
    {
        IsBusy = true;
        ClearError();
        try
        {
            var next = await action();
            RunOnUi(() => { ApplyState(next); RefreshLayoutStatus(); StatusMessage = successMessage; });
        }
        catch (Exception exception) when (exception is EditorProcessException or InvalidOperationException or OperationCanceledException)
        {
            RunOnUi(() => ShowError(ErrorCodeFor(exception), exception.Message));
        }
        finally { RunOnUi(() => IsBusy = false); }
    }

    private void ApplyState(EditorUiState next)
    {
        IsApplyingState = true;
        try
        {
            state = next;
            var details = next.Details;
            SelectedId = details?.ElementId ?? "–";
            TreeRoots.Clear();
            if (next.Tree.Root is not null) TreeRoots.Add(new EditorTreeNodeViewModel(next.Tree.Root, next.Panel.Selection.ElementId));
        Layers.ReplaceWith(next.Panel.Layers.Select(choice => new EditorChoiceViewModel(choice.Id, choice.Label, choice.Enabled, choice.Active)));
        Modes.ReplaceWith(next.Panel.Modes.Select(choice => new EditorChoiceViewModel(choice.Id, choice.Label, choice.Enabled, choice.Active)));
        LeftEnabled = next.Panel.Dpad.Left.Enabled;
        RightEnabled = next.Panel.Dpad.Right.Enabled;
        UpEnabled = next.Panel.Dpad.Up.Enabled;
        DownEnabled = next.Panel.Dpad.Down.Enabled;
        SelectedName = details?.Label ?? "Kein Element ausgewählt";
        SelectedType = details?.Type ?? "–";
        SelectedScope = next.ScopeId;
        SelectedParent = details?.ParentId ?? "–";
        SelectedRole = details?.Role ?? "–";
        Operations = details?.Operations is null ? "–" : string.Join(", ", details.Operations.AvailableOps);
        Position = details?.CurrentLayout.Element is { } element ? $"X {element.X:G} / Y {element.Y:G} DIP" : "–";
        Size = details?.CurrentLayout.Element is { } size ? $"{size.Width:G} × {size.Height:G} DIP" : "–";
        TextPosition = details?.CurrentLayout.Text is { } text && (text.OffsetX is not null || text.OffsetY is not null)
            ? $"X {text.OffsetX?.ToString("G", CultureInfo.CurrentCulture) ?? "–"} / Y {text.OffsetY?.ToString("G", CultureInfo.CurrentCulture) ?? "–"} DIP" : "nicht verfügbar";
        FontSize = details?.CurrentLayout.Text?.FontSize is { } fontSize ? $"{fontSize:G} DIP" : "nicht verfügbar";
        IsSelectedVisible = details?.Visible ?? true;
        VisibilityStatus = details is null ? "–" : IsSelectedVisible ? "sichtbar" : "unsichtbar";
        RaiseDetailsChanged();
        OnPropertyChanged(nameof(ActiveScopeId));
            RaiseCommandStates();
        }
        finally { IsApplyingState = false; }
    }

    private void RefreshLayoutStatus()
    {
        layoutStatus = layoutSession.GetStatus();
        foreach (var name in new[] { nameof(IsDirty), nameof(DirtyStatus), nameof(CanDiscardElement), nameof(CanResetElement), nameof(CanResetAll), nameof(ActiveProfileId) })
            OnPropertyChanged(name);
        RaiseCommandStates();
    }

    private void ValidateStep(string value)
    {
        var valid = double.TryParse(value, NumberStyles.Float, CultureInfo.CurrentCulture, out var parsed) ||
                    double.TryParse(value, NumberStyles.Float, CultureInfo.GetCultureInfo("de-DE"), out parsed) ||
                    double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out parsed);
        stepValid = valid && double.IsFinite(parsed) && parsed > 0;
        if (stepValid) { lastValidStep = parsed; if (ErrorCode == "invalid_step_size") ClearError(); }
        else ShowError("invalid_step_size", "Die Schrittweite muss eine positive endliche Zahl sein; der letzte gültige Wert bleibt erhalten.");
        RaiseCommandStates();
    }

    private bool CanUseDirection(string? direction) => CanInteract && direction switch
    {
        "left" => LeftEnabled, "right" => RightEnabled, "up" => UpEnabled, "down" => DownEnabled, _ => false
    };

    private static bool ElementDiffers(
        IReadOnlyDictionary<string, EditorIntegration.HostAdapter.LayoutState>? left,
        IReadOnlyDictionary<string, EditorIntegration.HostAdapter.LayoutState>? right,
        string scopeId,
        string elementId)
    {
        if (left is null || right is null || !left.TryGetValue(scopeId, out var leftState) || !right.TryGetValue(scopeId, out var rightState)) return false;
        var a = leftState.Elements.FirstOrDefault(item => item.ElementId == elementId);
        var b = rightState.Elements.FirstOrDefault(item => item.ElementId == elementId);
        if (a is null || b is null) return false;
        return Math.Abs(a.X - b.X) > 0.000001 || Math.Abs(a.Y - b.Y) > 0.000001 || Math.Abs(a.Width - b.Width) > 0.000001 || Math.Abs(a.Height - b.Height) > 0.000001 ||
               Different(a.TextOffsetX, b.TextOffsetX) || Different(a.TextOffsetY, b.TextOffsetY) || Different(a.FontSize, b.FontSize) || a.Visible != b.Visible;
    }

    private static bool Different(double? a, double? b) => a is null != b is null || a is not null && b is not null && Math.Abs(a.Value - b.Value) > 0.000001;
    private void ShowError(string code, string message) { ErrorCode = code; ErrorMessage = message; OnPropertyChanged(nameof(ErrorCodeDisplay)); OnPropertyChanged(nameof(HasError)); }
    private void ClearError() { ErrorCode = string.Empty; ErrorMessage = string.Empty; OnPropertyChanged(nameof(ErrorCodeDisplay)); OnPropertyChanged(nameof(HasError)); }
    private static string ErrorCodeFor(Exception exception) => exception switch { EditorProcessException process => process.Code, OperationCanceledException => "cancelled", _ => "editor_ui_error" };

    private void RaiseDetailsChanged()
    {
        foreach (var property in new[] { nameof(SelectedName), nameof(SelectedId), nameof(SelectedType), nameof(SelectedScope), nameof(SelectedParent), nameof(SelectedRole), nameof(Operations), nameof(Position), nameof(Size), nameof(TextPosition), nameof(FontSize), nameof(VisibilityStatus), nameof(IsSelectedVisible), nameof(CanChangeVisibility), nameof(VisibilityActionLabel), nameof(LeftEnabled), nameof(RightEnabled), nameof(UpEnabled), nameof(DownEnabled), nameof(CanInteract), nameof(ControlsEnabled) })
            OnPropertyChanged(property);
    }

    private void RaiseCommandStates()
    {
        foreach (var command in new[] { SetLayerCommand, SetModeCommand, DirectionCommand, ToggleVisibilityCommand, SaveCommand, LoadCommand, DiscardElementCommand, DiscardAllCommand, ResetElementCommand, ResetAllCommand, BeginAppSelectionCommand, CancelAppSelectionCommand, CloseCommand }.OfType<AsyncCommand>())
            command.RaiseCanExecuteChanged();
        OnPropertyChanged(nameof(CanInteract));
        OnPropertyChanged(nameof(CanOperate));
        OnPropertyChanged(nameof(ControlsEnabled));
        OnPropertyChanged(nameof(CanChangeVisibility));
    }

    private bool Set<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return false;
        field = value; OnPropertyChanged(propertyName); return true;
    }

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null) => PropertyChanged?.Invoke(this, new(propertyName));
    private void RunOnUi(Action action) { if (dispatcher.CheckAccess()) action(); else dispatcher.Invoke(action); }
}

internal static class ObservableCollectionExtensions
{
    public static void ReplaceWith<T>(this ObservableCollection<T> collection, IEnumerable<T> values)
    {
        collection.Clear();
        foreach (var value in values) collection.Add(value);
    }
}
