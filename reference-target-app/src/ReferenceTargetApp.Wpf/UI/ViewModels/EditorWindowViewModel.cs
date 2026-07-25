using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Globalization;
using System.Runtime.CompilerServices;
using System.Windows.Input;
using System.Windows.Threading;
using ReferenceTargetApp.EditorIntegration.EditorUi;
using ReferenceTargetApp.EditorIntegration.Process;
using ReferenceTargetApp.EditorIntegration.Session;

namespace ReferenceTargetApp.UI.ViewModels;

internal sealed class EditorWindowViewModel : INotifyPropertyChanged
{
    private readonly EditorProcessCoordinator coordinator;
    private readonly Func<Task> requestClose;
    private readonly CancellationToken lifetimeToken;
    private readonly Dispatcher dispatcher;
    private EditorUiState? state;
    private string stepText = "1";
    private double lastValidStep = 1;
    private bool stepValid = true;
    private bool busy;
    private bool closing;
    private string statusMessage = "Editor wird gestartet …";
    private string errorMessage = string.Empty;
    private string errorCode = string.Empty;

    public EditorWindowViewModel(EditorProcessCoordinator coordinator, Func<Task> requestClose, CancellationToken lifetimeToken)
    {
        this.coordinator = coordinator;
        this.requestClose = requestClose;
        this.lifetimeToken = lifetimeToken;
        dispatcher = Dispatcher.CurrentDispatcher;
        SetLayerCommand = new AsyncCommand(SetLayerAsync, parameter => CanInteract && parameter is string);
        SetModeCommand = new AsyncCommand(SetModeAsync, parameter => CanInteract && parameter is string);
        DirectionCommand = new AsyncCommand(ApplyDirectionAsync, parameter => CanUseDirection(parameter as string));
        CloseCommand = new AsyncCommand(_ => requestClose(), _ => !closing);
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    public ObservableCollection<EditorTreeNodeViewModel> TreeRoots { get; } = [];
    public ObservableCollection<EditorChoiceViewModel> Layers { get; } = [];
    public ObservableCollection<EditorChoiceViewModel> Modes { get; } = [];
    public ICommand SetLayerCommand { get; }
    public ICommand SetModeCommand { get; }
    public ICommand DirectionCommand { get; }
    public ICommand CloseCommand { get; }
    public bool CanInteract => state is not null && !busy && !closing && stepValid;
    public bool ControlsEnabled => state is not null && !busy && !closing;
    public bool IsBusy { get => busy; private set { if (Set(ref busy, value)) RaiseCommandStates(); } }
    public bool IsClosing { get => closing; private set { if (Set(ref closing, value)) RaiseCommandStates(); } }
    public string StatusMessage { get => statusMessage; private set => Set(ref statusMessage, value); }
    public string ErrorMessage { get => errorMessage; private set => Set(ref errorMessage, value); }
    public string ErrorCode { get => errorCode; private set => Set(ref errorCode, value); }
    public string ErrorCodeDisplay => string.IsNullOrWhiteSpace(ErrorCode) ? string.Empty : $"Technischer Code: {ErrorCode}";
    public bool HasError => !string.IsNullOrWhiteSpace(ErrorMessage);
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
    public bool LeftEnabled { get; private set; }
    public bool RightEnabled { get; private set; }
    public bool UpEnabled { get; private set; }
    public bool DownEnabled { get; private set; }
    public string StepText
    {
        get => stepText;
        set
        {
            if (!Set(ref stepText, value)) return;
            ValidateStep(value);
        }
    }

    internal EditorUiState? CurrentState => state;
    internal int? ProcessId => coordinator.ProcessId;
    internal string? SessionId => coordinator.SessionId;
    internal double LastValidStep => lastValidStep;

    internal async Task InitializeAsync()
    {
        IsBusy = true;
        StatusMessage = "Editor wird gestartet …";
        ClearError();
        try
        {
            var activation = await coordinator.ActivateAsync(lifetimeToken);
            if (!activation.Success) throw new EditorProcessException(activation.Code, activation.Message);
            var session = await coordinator.StartSessionAsync(lifetimeToken);
            if (!session.Success) throw new EditorProcessException(session.Code, session.Message);
            var initialState = await coordinator.GetEditorUiStateAsync(lifetimeToken);
            RunOnUi(() =>
            {
                ApplyState(initialState);
                StatusMessage = "Editor bereit.";
            });
        }
        catch (Exception exception) when (exception is EditorProcessException or InvalidOperationException or OperationCanceledException)
        {
            RunOnUi(() =>
            {
                ShowError(ErrorCodeFor(exception), exception.Message);
                StatusMessage = "Editor konnte nicht vollständig gestartet werden.";
            });
        }
        finally { RunOnUi(() => IsBusy = false); }
    }

    internal async Task SelectElementAsync(string elementId)
    {
        if (!CanInteract) return;
        await RunStateActionAsync(() => coordinator.SelectEditorElementAsync(elementId, lifetimeToken), $"Element {elementId} ausgewählt.");
    }

    internal async Task ApplyDirectionForDiagnosticAsync(string direction) => await ApplyDirectionAsync(direction);
    internal async Task SetLayerForDiagnosticAsync(string layer) => await SetLayerAsync(layer);
    internal async Task SetModeForDiagnosticAsync(string mode) => await SetModeAsync(mode);

    internal void BeginClosing(bool operationWasRunning)
    {
        IsClosing = true;
        StatusMessage = operationWasRunning
            ? "Editor wird nach der laufenden Änderung geschlossen …"
            : "Editor wird geschlossen …";
        if (operationWasRunning) ShowError("close_during_operation", "Schließen wurde während einer laufenden Änderung angefordert; die Änderung wird kontrolliert beendet.");
    }

    internal void MarkClosed() => StatusMessage = "Editor geschlossen.";

    private async Task SetLayerAsync(object? parameter)
    {
        if (parameter is string layer)
            await RunStateActionAsync(() => coordinator.SetEditorLayerAsync(layer, lifetimeToken), $"Ebene {layer} ist aktiv.");
    }

    private async Task SetModeAsync(object? parameter)
    {
        if (parameter is string mode)
            await RunStateActionAsync(() => coordinator.SetEditorModeAsync(mode, lifetimeToken), $"Modus {mode} ist aktiv.");
    }

    private async Task ApplyDirectionAsync(object? parameter)
    {
        if (parameter is not string direction || !CanUseDirection(direction)) return;
        if (!stepValid)
        {
            ShowError("invalid_step_size", "Die Schrittweite muss eine positive endliche Zahl sein.");
            return;
        }

        IsBusy = true;
        ClearError();
        StatusMessage = "Änderung wird ausgeführt …";
        try
        {
            var steppedState = await coordinator.SetEditorStepAsync(lastValidStep, lifetimeToken);
            var outcome = await coordinator.RunEditorDirectionAsync(direction, lifetimeToken);
            RunOnUi(() =>
            {
                state = steppedState;
                ApplyState(outcome.State);
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
            RunOnUi(() =>
            {
                ShowError(ErrorCodeFor(exception), exception.Message);
                StatusMessage = "Änderung fehlgeschlagen.";
            });
        }
        finally { RunOnUi(() => IsBusy = false); }
    }

    private async Task RunStateActionAsync(Func<Task<EditorUiState>> action, string successMessage)
    {
        IsBusy = true;
        ClearError();
        try
        {
            var next = await action();
            RunOnUi(() =>
            {
                ApplyState(next);
                if (state?.Panel.Status.Kind is "blocked" or "error")
                    ShowError(state.Panel.Status.Code, state.Panel.Status.Message);
                else
                    StatusMessage = successMessage;
            });
        }
        catch (Exception exception) when (exception is EditorProcessException or InvalidOperationException or OperationCanceledException)
        {
            RunOnUi(() => ShowError(ErrorCodeFor(exception), exception.Message));
        }
        finally { RunOnUi(() => IsBusy = false); }
    }

    private void ApplyState(EditorUiState next)
    {
        state = next;
        if (TreeRoots.Count == 0 && next.Tree.Root is not null)
            TreeRoots.Add(new EditorTreeNodeViewModel(next.Tree.Root, next.Panel.Selection.ElementId));
        Layers.ReplaceWith(next.Panel.Layers.Select(choice => new EditorChoiceViewModel(choice.Id, choice.Label, choice.Enabled, choice.Active)));
        Modes.ReplaceWith(next.Panel.Modes.Select(choice => new EditorChoiceViewModel(choice.Id, choice.Label, choice.Enabled, choice.Active)));
        LeftEnabled = next.Panel.Dpad.Left.Enabled;
        RightEnabled = next.Panel.Dpad.Right.Enabled;
        UpEnabled = next.Panel.Dpad.Up.Enabled;
        DownEnabled = next.Panel.Dpad.Down.Enabled;

        var details = next.Details;
        SelectedName = details?.Label ?? "Kein Element ausgewählt";
        SelectedId = details?.ElementId ?? "–";
        SelectedType = details?.Type ?? "–";
        SelectedScope = next.ScopeId;
        SelectedParent = details?.ParentId ?? "–";
        SelectedRole = details?.Role ?? "–";
        Operations = details?.Operations is null ? "–" : string.Join(", ", details.Operations.AvailableOps);
        Position = details?.CurrentLayout.Element is { } element ? $"X {element.X:G} / Y {element.Y:G} DIP" : "–";
        Size = details?.CurrentLayout.Element is { } size ? $"{size.Width:G} × {size.Height:G} DIP" : "–";
        TextPosition = details?.CurrentLayout.Text is { } text && (text.OffsetX is not null || text.OffsetY is not null)
            ? $"X {text.OffsetX?.ToString("G", CultureInfo.CurrentCulture) ?? "–"} / Y {text.OffsetY?.ToString("G", CultureInfo.CurrentCulture) ?? "–"} DIP"
            : "nicht verfügbar";
        FontSize = details?.CurrentLayout.Text?.FontSize is { } fontSize ? $"{fontSize:G} DIP" : "nicht verfügbar";
        RaiseDetailsChanged();
        RaiseCommandStates();
    }

    private void ValidateStep(string value)
    {
        var styles = NumberStyles.Float;
        var valid = double.TryParse(value, styles, CultureInfo.CurrentCulture, out var parsed) ||
                    double.TryParse(value, styles, CultureInfo.GetCultureInfo("de-DE"), out parsed) ||
                    double.TryParse(value, styles, CultureInfo.InvariantCulture, out parsed);
        stepValid = valid && double.IsFinite(parsed) && parsed > 0;
        if (stepValid)
        {
            lastValidStep = parsed;
            if (ErrorCode == "invalid_step_size") ClearError();
        }
        else ShowError("invalid_step_size", "Die Schrittweite muss eine positive endliche Zahl sein; der letzte gültige Wert bleibt erhalten.");
        OnPropertyChanged(nameof(CanInteract));
        OnPropertyChanged(nameof(ControlsEnabled));
        RaiseCommandStates();
    }

    private bool CanUseDirection(string? direction) => CanInteract && direction switch
    {
        "left" => LeftEnabled,
        "right" => RightEnabled,
        "up" => UpEnabled,
        "down" => DownEnabled,
        _ => false
    };

    private void ShowError(string code, string message)
    {
        ErrorCode = code;
        ErrorMessage = message;
        OnPropertyChanged(nameof(ErrorCodeDisplay));
        OnPropertyChanged(nameof(HasError));
    }

    private void ClearError()
    {
        ErrorCode = string.Empty;
        ErrorMessage = string.Empty;
        OnPropertyChanged(nameof(ErrorCodeDisplay));
        OnPropertyChanged(nameof(HasError));
    }

    private static string ErrorCodeFor(Exception exception) => exception switch
    {
        EditorProcessException process => process.Code,
        OperationCanceledException => "cancelled",
        _ => "editor_ui_error"
    };

    private void RaiseDetailsChanged()
    {
        foreach (var property in new[] { nameof(SelectedName), nameof(SelectedId), nameof(SelectedType), nameof(SelectedScope), nameof(SelectedParent), nameof(SelectedRole), nameof(Operations), nameof(Position), nameof(Size), nameof(TextPosition), nameof(FontSize), nameof(LeftEnabled), nameof(RightEnabled), nameof(UpEnabled), nameof(DownEnabled), nameof(CanInteract), nameof(ControlsEnabled) })
            OnPropertyChanged(property);
    }

    private void RaiseCommandStates()
    {
        ((AsyncCommand)SetLayerCommand).RaiseCanExecuteChanged();
        ((AsyncCommand)SetModeCommand).RaiseCanExecuteChanged();
        ((AsyncCommand)DirectionCommand).RaiseCanExecuteChanged();
        ((AsyncCommand)CloseCommand).RaiseCanExecuteChanged();
        OnPropertyChanged(nameof(CanInteract));
        OnPropertyChanged(nameof(ControlsEnabled));
    }

    private bool Set<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return false;
        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));

    private void RunOnUi(Action action)
    {
        if (dispatcher.CheckAccess()) action();
        else dispatcher.Invoke(action);
    }
}

internal static class ObservableCollectionExtensions
{
    public static void ReplaceWith<T>(this ObservableCollection<T> collection, IEnumerable<T> values)
    {
        collection.Clear();
        foreach (var value in values) collection.Add(value);
    }
}
