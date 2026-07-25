using System.ComponentModel;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.OrderHeader;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Process;
using ReferenceTargetApp.EditorIntegration.Registry;
using ReferenceTargetApp.EditorIntegration.Session;
using ReferenceTargetApp.Infrastructure.SampleData;
using ReferenceTargetApp.UI.ViewModels;
using ReferenceTargetApp.UI.Editor;

namespace ReferenceTargetApp.UI.Views;

public partial class MainWindow : Window
{
    private readonly MainWindowViewModel viewModel;
    private readonly CancellationTokenSource lifetimeCancellation = new();
    private readonly AtomicJsonLayoutStore layoutStore;
    private bool shutdownComplete;
    private EditorWindowCoordinator? editorWindowCoordinator;

    public MainWindow()
        : this(new AtomicJsonLayoutStore(LayoutStoragePathResolver.ResolveDefault()))
    {
    }

    internal MainWindow(AtomicJsonLayoutStore layoutStore)
    {
        this.layoutStore = layoutStore ?? throw new ArgumentNullException(nameof(layoutStore));
        InitializeComponent();
        viewModel = new MainWindowViewModel(new ReferenceOrderFactory());
        DataContext = viewModel;
        Loaded += MainWindow_Loaded;
        Closing += MainWindow_Closing;
        Closed += (_, _) => lifetimeCancellation.Dispose();
    }

    public IUiElementRegistry? UiRegistry { get; private set; }
    public UiRegistryDiagnostics? RegistryDiagnostics => UiRegistry?.GetDiagnostics();
    public IHostAdapter? HostAdapter { get; private set; }
    public ChangeResult? DiagnosticChangeResult { get; private set; }
    public EditorProcessCoordinator? EditorProcessCoordinator { get; private set; }
    public Task<EditorProcessDiagnosticRun>? EditorProcessDiagnosticTask { get; private set; }
    public LayoutStartupResult? LayoutStartupResult { get; private set; }
    internal MainWindowViewModel ViewModel => viewModel;
    internal EditorWindowCoordinator? EditorWindowCoordinator => editorWindowCoordinator;

    private void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        if (UiRegistry is not null) return;

        UiRegistry = new OrderHeaderRegistryFactory().Create(new OrderHeaderElementReferences(
            OrderHeaderScope,
            OrderHeaderCoreGroup,
            OrderNumberInput,
            OrderDateInput,
            DueDateInput,
            SubjectInput,
            ResponsiblePersonInput,
            OrderStatusIndicator));

        HostAdapter = new WpfHostAdapter(UiRegistry);
        editorWindowCoordinator = new EditorWindowCoordinator(this, HostAdapter);
        LayoutStartupResult = new LayoutPersistenceCoordinator(layoutStore).RestoreAtStartup(HostAdapter);
        if (Environment.GetCommandLineArgs().Contains("--host-adapter-diagnostic", StringComparer.Ordinal))
            DiagnosticChangeResult = RunHostAdapterDiagnostic();
        if (Environment.GetCommandLineArgs().Contains("--editor-process-diagnostic", StringComparer.Ordinal))
        {
            try
            {
                EditorProcessCoordinator = new EditorProcessCoordinator(HostAdapter, EditorProcessPathResolver.ResolveDefault());
                EditorProcessDiagnosticTask = RunEditorProcessDiagnosticSafelyAsync(EditorProcessCoordinator, lifetimeCancellation.Token);
            }
            catch (EditorProcessException exception)
            {
                var activation = EditorSessionResult.Fail(exception.Code, exception.Message, EditorSessionState.Faulted);
                EditorProcessDiagnosticTask = Task.FromResult(new EditorProcessDiagnosticRun(
                    false, exception.Code, exception.Message, null, null, activation, null, null, null, null));
            }
        }
        var persistencePhase = App.LayoutPersistencePhase(Environment.GetCommandLineArgs());
        if (persistencePhase is not null)
            _ = Dispatcher.BeginInvoke(
                new Action(() => RunLayoutPersistenceDiagnosticPhase(persistencePhase)),
                DispatcherPriority.ApplicationIdle);
        if (Environment.GetCommandLineArgs().Contains("--editor-ui-diagnostic", StringComparer.Ordinal))
            _ = Dispatcher.BeginInvoke(
                new Action(async () => await RunEditorUiDiagnosticAsync()),
                DispatcherPriority.ApplicationIdle);
    }

    private async Task RunEditorUiDiagnosticAsync()
    {
        var exitCode = 80;
        try
        {
            if (editorWindowCoordinator is null || HostAdapter is null) throw new InvalidOperationException("Editor-Lebenszyklus ist nicht initialisiert.");
            var businessValue = OrderNumberInput.Text;
            var activity = viewModel.ActivityMessage;
            var editor = await editorWindowCoordinator.OpenAsync();
            await Dispatcher.InvokeAsync(() => { }, DispatcherPriority.ApplicationIdle);
            if (!editorWindowCoordinator.HasOpenWindow || !editorWindowCoordinator.HasActiveProcess || editorWindowCoordinator.SessionId is null ||
                editor.CurrentState?.Tree.Nodes.Count != 8 || editor.CurrentState.Details?.ElementId != OrderHeaderRegistryIds.OrderNumber)
                throw new InvalidOperationException("Editorfenster, Prozess, Session, Baum oder Details fehlen.");

            var before = State(OrderHeaderRegistryIds.OrderNumber);
            editor.StepText = "1";
            await editor.SetModeForDiagnosticAsync("move");
            await editor.ApplyDirectionForDiagnosticAsync("right");
            var moved = State(OrderHeaderRegistryIds.OrderNumber);
            if (Math.Abs(moved.X - before.X - 1) > 0.001) throw new InvalidOperationException("Positionsänderung ist nicht sichtbar.");

            await editor.SetModeForDiagnosticAsync("width");
            await editor.ApplyDirectionForDiagnosticAsync("right");
            var widened = State(OrderHeaderRegistryIds.OrderNumber);
            if (Math.Abs(widened.Width - moved.Width - 1) > 0.001) throw new InvalidOperationException("Breitenänderung ist nicht sichtbar.");

            await editor.SetModeForDiagnosticAsync("height");
            await editor.ApplyDirectionForDiagnosticAsync("down");
            var heightened = State(OrderHeaderRegistryIds.OrderNumber);
            if (Math.Abs(heightened.Height - widened.Height - 1) > 0.001) throw new InvalidOperationException("Höhenänderung ist nicht sichtbar.");

            await editor.SetLayerForDiagnosticAsync("text");
            await editor.SetModeForDiagnosticAsync("text-position");
            await editor.ApplyDirectionForDiagnosticAsync("right");
            var textMoved = State(OrderHeaderRegistryIds.OrderNumber);
            if (Math.Abs(textMoved.TextOffsetX!.Value - heightened.TextOffsetX!.Value - 1) > 0.001) throw new InvalidOperationException("Textpositionsänderung ist nicht sichtbar.");

            await editor.SetModeForDiagnosticAsync("text-size");
            await editor.ApplyDirectionForDiagnosticAsync("right");
            var textSized = State(OrderHeaderRegistryIds.OrderNumber);
            if (Math.Abs(textSized.FontSize!.Value - textMoved.FontSize!.Value - 1) > 0.001) throw new InvalidOperationException("Schriftgrößenänderung ist nicht sichtbar.");

            await editor.SelectElementAsync(OrderHeaderRegistryIds.CoreGroup);
            if (editor.CurrentState!.Panel.Layers.Single(layer => layer.Id == "text").Enabled)
                throw new InvalidOperationException("Nicht erlaubte Textebene ist aktivierbar.");
            if (!string.Equals(OrderNumberInput.Text, businessValue, StringComparison.Ordinal) || !string.Equals(viewModel.ActivityMessage, activity, StringComparison.Ordinal))
                throw new InvalidOperationException("Editor hat einen Fachwert oder Fachcommand verändert.");
            CheckOrderButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            if (!string.Equals(viewModel.ActivityMessage, "Plausibilitätsprüfung ohne Beanstandung abgeschlossen", StringComparison.Ordinal))
                throw new InvalidOperationException("Normaler Fachbutton funktioniert nicht mehr.");

            await editorWindowCoordinator.CloseAsync();
            if (editorWindowCoordinator.HasOpenWindow || editorWindowCoordinator.HasActiveProcess || editorWindowCoordinator.SessionId is not null)
                throw new InvalidOperationException("Erster Editor wurde nicht vollständig geschlossen.");
            await editorWindowCoordinator.OpenAsync();
            if (editorWindowCoordinator.WindowCreationCount != 2 || !editorWindowCoordinator.HasActiveProcess)
                throw new InvalidOperationException("Editor konnte nicht erneut geöffnet werden.");
            await editorWindowCoordinator.CloseAsync();
            if (editorWindowCoordinator.HasActiveProcess) throw new InvalidOperationException("Node-Prozess blieb nach Wiederöffnung aktiv.");
            exitCode = 0;
        }
        catch
        {
            exitCode = 81;
        }
        finally
        {
            if (editorWindowCoordinator is not null) await editorWindowCoordinator.CloseAsync();
            shutdownComplete = true;
            Application.Current.Shutdown(exitCode);
        }
    }

    private ElementLayoutState State(string elementId) => HostAdapter!.GetCurrentLayoutState().Elements.Single(element => element.ElementId == elementId);

    private void RunLayoutPersistenceDiagnosticPhase(string phase)
    {
        var exitCode = phase switch
        {
            "save" => RunLayoutPersistenceSavePhase(),
            "verify" => RunLayoutPersistenceVerifyPhase(),
            _ => 70
        };
        Application.Current.Shutdown(exitCode);
    }

    private int RunLayoutPersistenceSavePhase()
    {
        if (HostAdapter is null || UiRegistry is null || LayoutStartupResult is null || LayoutStartupResult.Found)
            return 71;
        var businessValue = OrderNumberInput.Text;
        var current = HostAdapter.GetCurrentLayoutState().Elements
            .Single(element => element.ElementId == OrderHeaderRegistryIds.OrderNumber);
        var expectedWidth = current.Width + 24;
        var change = HostAdapter.SubmitChangeRequest(new ChangeRequest(
            "m73.5-persistence-diagnostic",
            OrderHeaderRegistryIds.OrderNumber,
            HostAdapterOperations.ResizeWidth,
            new Dictionary<string, object?> { ["width"] = expectedWidth },
            DateTimeOffset.UtcNow,
            "layout-persistence-diagnostic",
            OrderHeaderRegistryIds.Scope,
            reason: "Programmgesteuerter Speicher- und Neustartnachweis M73.5"));
        if (!change.Success) return 72;

        var save = layoutStore.Save(UiRegistry, HostAdapter.GetCurrentLayoutState());
        if (!save.Success) return 73;
        var resultPath = Path.Combine(layoutStore.Options.RootDirectory, "diagnostic-phase.json");
        File.WriteAllText(resultPath, JsonSerializer.Serialize(new LayoutDiagnosticPhase(expectedWidth, businessValue)));
        return 0;
    }

    private int RunLayoutPersistenceVerifyPhase()
    {
        if (HostAdapter is null || LayoutStartupResult is null ||
            !LayoutStartupResult.Success || !LayoutStartupResult.Found || LayoutStartupResult.Restore is not { Success: true })
            return 74;
        var resultPath = Path.Combine(layoutStore.Options.RootDirectory, "diagnostic-phase.json");
        if (!File.Exists(resultPath)) return 75;
        var expected = JsonSerializer.Deserialize<LayoutDiagnosticPhase>(File.ReadAllText(resultPath));
        if (expected is null || Math.Abs(OrderNumberInput.ActualWidth - expected.Width) > 0.01 ||
            !string.Equals(OrderNumberInput.Text, expected.BusinessValue, StringComparison.Ordinal))
            return 76;

        CheckOrderButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        if (!string.Equals(viewModel.ActivityMessage, "Plausibilitätsprüfung ohne Beanstandung abgeschlossen", StringComparison.Ordinal))
            return 77;
        if (EditorProcessCoordinator is not null) return 78;

        layoutStore.DeleteDiagnosticFile();
        File.Delete(resultPath);
        return Directory.GetFiles(layoutStore.Options.RootDirectory, "*.tmp").Length == 0 ? 0 : 79;
    }

    private sealed record LayoutDiagnosticPhase(double Width, string BusinessValue);

    private ChangeResult RunHostAdapterDiagnostic()
    {
        var currentState = HostAdapter!.GetCurrentLayoutState().Elements
            .Single(element => element.ElementId == OrderHeaderRegistryIds.OrderNumber);
        var fontSize = (currentState.FontSize ?? OrderNumberInput.FontSize) + 4;
        return HostAdapter.SubmitChangeRequest(new ChangeRequest(
            "m73.3-visible-diagnostic",
            OrderHeaderRegistryIds.OrderNumber,
            HostAdapterOperations.TextResize,
            new Dictionary<string, object?>
            {
                ["text"] = new Dictionary<string, object?> { ["fontSize"] = fontSize }
            },
            DateTimeOffset.UtcNow,
            "reference-target-app-diagnostic",
            OrderHeaderRegistryIds.Scope,
            reason: "Programmgesteuerter Sichtnachweis M73.3"));
    }

    private async Task<EditorProcessDiagnosticRun> RunEditorProcessDiagnosticAsync(
        EditorProcessCoordinator coordinator,
        CancellationToken cancellationToken)
    {
        var activation = await coordinator.ActivateAsync(cancellationToken);
        var processId = coordinator.ProcessId;
        if (!activation.Success)
            return new(false, activation.Code, activation.Message, processId, null, activation, null, null, null, null);

        var sessionStart = await coordinator.StartSessionAsync(cancellationToken);
        if (!sessionStart.Success)
        {
            var failedDeactivation = await coordinator.DeactivateAsync(CancellationToken.None);
            return new(false, sessionStart.Code, sessionStart.Message, processId, null, activation, sessionStart, null, null, failedDeactivation);
        }

        var currentState = HostAdapter!.GetCurrentLayoutState().Elements
            .Single(element => element.ElementId == OrderHeaderRegistryIds.OrderNumber);
        var request = new ChangeRequest(
            "m73.4-process-diagnostic",
            OrderHeaderRegistryIds.OrderNumber,
            HostAdapterOperations.ResizeWidth,
            new Dictionary<string, object?> { ["width"] = currentState.Width + 24 },
            DateTimeOffset.UtcNow,
            "reference-target-app-process-diagnostic",
            OrderHeaderRegistryIds.Scope,
            reason: "Programmgesteuerter Prozess- und Sessionnachweis M73.4");
        var changeResult = await coordinator.RunDiagnosticChangeAsync(request, cancellationToken);
        DiagnosticChangeResult = changeResult;
        var sessionEnd = await coordinator.EndSessionAsync(CancellationToken.None);
        var deactivation = await coordinator.DeactivateAsync(CancellationToken.None);
        var success = changeResult.Success && sessionEnd.Success && deactivation.Success;
        return new(
            success,
            success ? "diagnostic_complete" : "diagnostic_failed",
            success ? "Prozessdiagnose wurde vollständig ausgeführt." : "Prozessdiagnose ist fehlgeschlagen.",
            processId,
            sessionStart.SessionId,
            activation,
            sessionStart,
            changeResult,
            sessionEnd,
            deactivation);
    }

    private async Task<EditorProcessDiagnosticRun> RunEditorProcessDiagnosticSafelyAsync(
        EditorProcessCoordinator coordinator,
        CancellationToken cancellationToken)
    {
        try
        {
            return await RunEditorProcessDiagnosticAsync(coordinator, cancellationToken);
        }
        catch (Exception exception) when (exception is EditorProcessException or InvalidOperationException or OperationCanceledException)
        {
            var deactivation = await coordinator.DeactivateAsync(CancellationToken.None);
            var activation = EditorSessionResult.Fail(
                exception is EditorProcessException processException ? processException.Code : "diagnostic_failed",
                exception.Message,
                coordinator.State);
            return new(false, activation.Code, activation.Message, coordinator.ProcessId, coordinator.SessionId,
                activation, null, null, null, deactivation);
        }
    }

    private async void MainWindow_Closing(object? sender, CancelEventArgs e)
    {
        if (shutdownComplete) return;
        var visibleEditorActive = editorWindowCoordinator is { HasOpenWindow: true } || editorWindowCoordinator is { HasActiveProcess: true };
        if (!visibleEditorActive && EditorProcessCoordinator is null) return;
        e.Cancel = true;
        IsEnabled = false;
        if (editorWindowCoordinator is not null)
            await editorWindowCoordinator.DisposeAsync();
        try { lifetimeCancellation.Cancel(); }
        catch (ObjectDisposedException) { }
        if (EditorProcessDiagnosticTask is not null)
        {
            try { await EditorProcessDiagnosticTask; }
            catch (OperationCanceledException) { }
        }
        if (EditorProcessCoordinator is not null)
            await EditorProcessCoordinator.DisposeAsync();
        shutdownComplete = true;
        if (Application.Current is not null) Application.Current.Shutdown();
        else Close();
    }

    private void NewOrder_Click(object sender, RoutedEventArgs e) => viewModel.CreateNewSampleOrder();
    private void AddPosition_Click(object sender, RoutedEventArgs e) => viewModel.AddSamplePosition();
    private void CheckOrder_Click(object sender, RoutedEventArgs e) => viewModel.MarkAsChecked();
    private void SaveOrder_Click(object sender, RoutedEventArgs e) => viewModel.SaveInMemory();
    private async void OpenEditor_Click(object sender, RoutedEventArgs e)
    {
        if (editorWindowCoordinator is null) return;
        OpenEditorButton.IsEnabled = false;
        try { await editorWindowCoordinator.OpenAsync(); }
        catch (Exception exception) when (exception is EditorProcessException or InvalidOperationException or System.Windows.Markup.XamlParseException)
        {
            MessageBox.Show(this, $"Der UI-Editor konnte nicht geöffnet werden.\n\n{exception.Message}", "UI-Editor", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally { OpenEditorButton.IsEnabled = true; }
    }
}
