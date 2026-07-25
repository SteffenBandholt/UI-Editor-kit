using System.ComponentModel;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using System.Windows.Input;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.CustomerDetails;
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
    private readonly bool legacyStoreRequested;
    private bool shutdownComplete;
    private EditorWindowCoordinator? editorWindowCoordinator;
    private TargetAppSelectionService? targetAppSelectionService;

    public MainWindow()
        : this(new AtomicJsonLayoutStore(LayoutStoragePathResolver.ResolveDefault()), false)
    {
    }

    internal MainWindow(AtomicJsonLayoutStore layoutStore)
        : this(layoutStore, true)
    {
    }

    internal MainWindow(AtomicJsonLayoutStore layoutStore, bool legacyStoreRequested)
    {
        this.layoutStore = layoutStore ?? throw new ArgumentNullException(nameof(layoutStore));
        this.legacyStoreRequested = legacyStoreRequested;
        InitializeComponent();
        viewModel = new MainWindowViewModel(new ReferenceOrderFactory());
        DataContext = viewModel;
        Loaded += MainWindow_Loaded;
        Closing += MainWindow_Closing;
        Closed += (_, _) => { targetAppSelectionService?.Dispose(); lifetimeCancellation.Dispose(); };
    }

    public IUiElementRegistry? UiRegistry { get; private set; }
    public UiRegistryDiagnostics? RegistryDiagnostics => UiRegistry?.GetDiagnostics();
    public IHostAdapter? HostAdapter { get; private set; }
    public IUiElementRegistry? CustomerDetailsRegistry { get; private set; }
    public IHostAdapter? CustomerDetailsHostAdapter { get; private set; }
    public IReadOnlyDictionary<string, IHostAdapter>? HostAdapters { get; private set; }
    public ChangeResult? DiagnosticChangeResult { get; private set; }
    public EditorProcessCoordinator? EditorProcessCoordinator { get; private set; }
    public Task<EditorProcessDiagnosticRun>? EditorProcessDiagnosticTask { get; private set; }
    public LayoutStartupResult? LayoutStartupResult { get; private set; }
    public LayoutProfileStartupResult? LayoutProfileStartupResult { get; private set; }
    internal MainWindowViewModel ViewModel => viewModel;
    internal EditorWindowCoordinator? EditorWindowCoordinator => editorWindowCoordinator;
    internal TargetAppSelectionService? TargetAppSelectionService => targetAppSelectionService;

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
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
        CustomerDetailsRegistry = new CustomerDetailsRegistryFactory().Create(new CustomerDetailsElementReferences(
            CustomerDataGroup,
            CustomerDetailsCoreGroup,
            CompanyNameInput,
            ContactNameInput,
            EmailInput,
            StreetInput,
            PostalCityInput,
            CheckCustomerButton));
        CustomerDetailsHostAdapter = new WpfHostAdapter(CustomerDetailsRegistry);
        HostAdapters = new Dictionary<string, IHostAdapter>(StringComparer.Ordinal)
        {
            [OrderHeaderRegistryIds.Scope] = HostAdapter,
            [CustomerDetailsRegistryIds.Scope] = CustomerDetailsHostAdapter
        };

        var persistencePhase = App.LayoutPersistencePhase(Environment.GetCommandLineArgs());
        if (legacyStoreRequested || persistencePhase is not null)
            LayoutStartupResult = new LayoutPersistenceCoordinator(layoutStore).RestoreAtStartup(HostAdapter);
        else
        {
            var legacy = layoutStore.Load(UiRegistry);
            LayoutStartupResult = legacy.Found
                ? new(false, true, "legacy_schema_requires_resave", "Ein altes Ein-Scope-Layout wurde erkannt und aus Sicherheitsgründen nicht teilweise angewandt.", legacy, null)
                : new(true, false, legacy.Code, legacy.Message, legacy, null);
        }

        var profileStore = new AtomicJsonLayoutProfileStore(layoutStore.Options.RootDirectory);
        var activeProfileStore = new ActiveLayoutProfileStore(layoutStore.Options.RootDirectory);
        LayoutProfileStartupResult = await new LayoutProfileStartupCoordinator(HostAdapters, profileStore, activeProfileStore)
            .RestoreAsync(lifetimeCancellation.Token);
        var fullOperationPhase = App.UiFullOperationPhase(Environment.GetCommandLineArgs());
        targetAppSelectionService = new TargetAppSelectionService(
            HostAdapters.Values.Select(adapter => adapter.GetRegistry()),
            [NewOrderButton, AddPositionButton, CheckOrderButton, SaveOrderButton]);
        var diagnosticDialogs = fullOperationPhase == "m75-verify"
            ? new NativeEditorDialogService([
                UnsavedChangesDecision.Cancel,
                UnsavedChangesDecision.Discard,
                UnsavedChangesDecision.Cancel,
                UnsavedChangesDecision.Discard,
                UnsavedChangesDecision.Save])
            : null;
        editorWindowCoordinator = new EditorWindowCoordinator(this, HostAdapters, LayoutProfileStartupResult.Session, targetAppSelectionService, diagnosticDialogs);
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
        if (persistencePhase is not null)
            _ = Dispatcher.BeginInvoke(
                new Action(() => RunLayoutPersistenceDiagnosticPhase(persistencePhase)),
                DispatcherPriority.ApplicationIdle);
        if (Environment.GetCommandLineArgs().Contains("--editor-ui-diagnostic", StringComparer.Ordinal))
            _ = Dispatcher.BeginInvoke(
                new Action(async () => await RunEditorUiDiagnosticAsync()),
                DispatcherPriority.ApplicationIdle);
        if (fullOperationPhase is not null)
            _ = Dispatcher.BeginInvoke(new Action(async () => await RunFullOperationDiagnosticPhaseAsync(fullOperationPhase)), DispatcherPriority.ApplicationIdle);
    }

    private async Task RunFullOperationDiagnosticPhaseAsync(string phase)
    {
        var exitCode = 90;
        try
        {
            exitCode = phase switch
            {
                "m75-save" => await RunFullOperationSavePhaseAsync(),
                "m75-verify" => await RunFullOperationVerifyPhaseAsync(),
                _ => 91
            };
        }
        catch (Exception exception)
        {
            try { await File.WriteAllTextAsync(Path.Combine(layoutStore.Options.RootDirectory, "m75-diagnostic-error.txt"), exception.ToString()); }
            catch (Exception writeException) when (writeException is IOException or UnauthorizedAccessException) { }
            exitCode = 92;
        }
        finally
        {
            if (editorWindowCoordinator is not null) await editorWindowCoordinator.CloseAsync();
            shutdownComplete = true;
            Application.Current.Shutdown(exitCode);
        }
    }

    private async Task<int> RunFullOperationSavePhaseAsync()
    {
        if (HostAdapters is null || LayoutProfileStartupResult is null || !LayoutProfileStartupResult.Success || LayoutProfileStartupResult.Found)
            return 93;
        if (editorWindowCoordinator is null || editorWindowCoordinator.HasActiveProcess) return 94;
        var business = CaptureBusinessValuesForDiagnostic();
        var editor = await editorWindowCoordinator.OpenAsync();
        if (editor.Profiles.Count != 2 || editor.Scopes.Count != 2 || editor.CurrentState?.Tree.Nodes.Count != 8) return 95;

        await editor.SelectElementAsync(OrderHeaderRegistryIds.OrderNumber);
        await editor.SetModeForDiagnosticAsync("width");
        await editor.ApplyDirectionForDiagnosticAsync("right");
        await editor.SelectScopeAsync(CustomerDetailsRegistryIds.Scope);
        await editor.SelectElementAsync(CustomerDetailsRegistryIds.CompanyName);
        await editor.SetModeForDiagnosticAsync("width");
        await editor.ApplyDirectionForDiagnosticAsync("right");
        if (!editor.IsDirty || !await editor.SaveForDiagnosticAsync() || editor.IsDirty) return 96;
        if (!business.SequenceEqual(CaptureBusinessValuesForDiagnostic(), StringComparer.Ordinal)) return 97;

        var result = new FullOperationDiagnosticState(
            ElementWidth(HostAdapters[OrderHeaderRegistryIds.Scope], OrderHeaderRegistryIds.OrderNumber),
            ElementWidth(HostAdapters[CustomerDetailsRegistryIds.Scope], CustomerDetailsRegistryIds.CompanyName),
            business);
        await File.WriteAllTextAsync(Path.Combine(layoutStore.Options.RootDirectory, "m75-diagnostic-state.json"), JsonSerializer.Serialize(result));
        await editorWindowCoordinator.CloseAsync();
        return editorWindowCoordinator.HasActiveProcess ? 98 : 0;
    }

    private async Task<int> RunFullOperationVerifyPhaseAsync()
    {
        if (HostAdapters is null || LayoutProfileStartupResult is not { Success: true, Found: true } || editorWindowCoordinator is null)
            return 100;
        if (editorWindowCoordinator.HasActiveProcess) return 101;
        var statePath = Path.Combine(layoutStore.Options.RootDirectory, "m75-diagnostic-state.json");
        var expected = JsonSerializer.Deserialize<FullOperationDiagnosticState>(await File.ReadAllTextAsync(statePath));
        if (expected is null || Math.Abs(ElementWidth(HostAdapters[OrderHeaderRegistryIds.Scope], OrderHeaderRegistryIds.OrderNumber) - expected.OrderWidth) > 0.001 ||
            Math.Abs(ElementWidth(HostAdapters[CustomerDetailsRegistryIds.Scope], CustomerDetailsRegistryIds.CompanyName) - expected.CustomerWidth) > 0.001)
            return 102;
        if (!expected.BusinessValues.SequenceEqual(CaptureBusinessValuesForDiagnostic(), StringComparer.Ordinal)) return 103;

        var editor = await editorWindowCoordinator.OpenAsync();
        if (editor.IsDirty) return 104;
        await editor.SelectScopeAsync(OrderHeaderRegistryIds.Scope);
        await editor.SelectElementAsync(OrderHeaderRegistryIds.OrderNumber);
        await editor.SetModeForDiagnosticAsync("width");
        await editor.ApplyDirectionForDiagnosticAsync("right");
        await editor.SelectScopeAsync(CustomerDetailsRegistryIds.Scope);
        await editor.SelectElementAsync(CustomerDetailsRegistryIds.CompanyName);
        await editor.SetModeForDiagnosticAsync("width");
        await editor.ApplyDirectionForDiagnosticAsync("right");
        var changedCustomer = ElementWidth(HostAdapters[CustomerDetailsRegistryIds.Scope], CustomerDetailsRegistryIds.CompanyName);

        await editor.SelectScopeAsync(OrderHeaderRegistryIds.Scope);
        await editor.SelectElementAsync(OrderHeaderRegistryIds.OrderNumber);
        await editor.DiscardElementForDiagnosticAsync();
        if (Math.Abs(ElementWidth(HostAdapters[OrderHeaderRegistryIds.Scope], OrderHeaderRegistryIds.OrderNumber) - expected.OrderWidth) > 0.001 || !editor.IsDirty)
            return 105;
        await editor.DiscardAllForDiagnosticAsync();
        if (editor.IsDirty || Math.Abs(ElementWidth(HostAdapters[CustomerDetailsRegistryIds.Scope], CustomerDetailsRegistryIds.CompanyName) - expected.CustomerWidth) > 0.001)
            return 106;

        await editor.ResetElementForDiagnosticAsync();
        if (!editor.IsDirty || Math.Abs(ElementWidth(HostAdapters[OrderHeaderRegistryIds.Scope], OrderHeaderRegistryIds.OrderNumber) - expected.OrderWidth) < 0.001)
            return 107;
        await editor.DiscardAllForDiagnosticAsync();
        await editor.ResetAllForDiagnosticAsync();
        if (!editor.IsDirty) return 108;
        await editor.DiscardAllForDiagnosticAsync();
        if (editor.IsDirty) return 109;

        await editor.SelectScopeAsync(OrderHeaderRegistryIds.Scope);
        await editor.SelectElementAsync(OrderHeaderRegistryIds.OrderNumber);
        await editor.SetModeForDiagnosticAsync("width");
        await editor.ApplyDirectionForDiagnosticAsync("right");
        await editor.SelectProfileAsync(LayoutProfileCatalog.CompactId);
        if (editor.ActiveProfileId != LayoutProfileCatalog.StandardId || !editor.IsDirty) return 118;
        await editor.SelectProfileAsync(LayoutProfileCatalog.CompactId);
        if (editor.ActiveProfileId != LayoutProfileCatalog.CompactId || editor.IsDirty) return 110;
        await editor.SelectScopeAsync(OrderHeaderRegistryIds.Scope);
        await editor.SelectElementAsync(OrderHeaderRegistryIds.OrderNumber);
        await editor.SetModeForDiagnosticAsync("width");
        await editor.ApplyDirectionForDiagnosticAsync("left");
        var compactWidth = ElementWidth(HostAdapters[OrderHeaderRegistryIds.Scope], OrderHeaderRegistryIds.OrderNumber);
        if (!await editor.SaveForDiagnosticAsync()) return 111;
        await editor.SelectProfileAsync(LayoutProfileCatalog.StandardId);
        if (Math.Abs(compactWidth - expected.OrderWidth) < 0.001 || Math.Abs(ElementWidth(HostAdapters[OrderHeaderRegistryIds.Scope], OrderHeaderRegistryIds.OrderNumber) - expected.OrderWidth) > 0.001)
            return 112;

        var activity = viewModel.ActivityMessage;
        await editor.BeginAppSelectionForDiagnosticAsync();
        CheckCustomerButton.RaiseEvent(new MouseButtonEventArgs(Mouse.PrimaryDevice, Environment.TickCount, MouseButton.Left)
            { RoutedEvent = UIElement.PreviewMouseDownEvent });
        await WaitForUiStateAsync(() => editor.SelectedId == CustomerDetailsRegistryIds.CheckCustomer &&
            editor.ActiveScopeId == CustomerDetailsRegistryIds.Scope, TimeSpan.FromSeconds(5));
        if (editor.SelectedId != CustomerDetailsRegistryIds.CheckCustomer || editor.ActiveScopeId != CustomerDetailsRegistryIds.Scope || viewModel.ActivityMessage != activity)
            return 113;
        CheckCustomerButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        if (viewModel.ActivityMessage != "Kundendaten wurden geprüft") return 114;

        await editor.SelectScopeAsync(OrderHeaderRegistryIds.Scope);
        await editor.SelectElementAsync(OrderHeaderRegistryIds.OrderNumber);
        await editor.SetModeForDiagnosticAsync("width");
        await editor.ApplyDirectionForDiagnosticAsync("right");
        await editor.SelectScopeAsync(CustomerDetailsRegistryIds.Scope);
        await editor.SelectElementAsync(CustomerDetailsRegistryIds.CompanyName);
        await editor.SetModeForDiagnosticAsync("width");
        await editor.ApplyDirectionForDiagnosticAsync("right");
        var beforeFailure = HostAdapters.ToDictionary(pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal);
        ((WpfHostAdapter)HostAdapters[CustomerDetailsRegistryIds.Scope]).ArmDiagnosticFailure(CustomerDetailsRegistryIds.CompanyName);
        await editor.DiscardAllForDiagnosticAsync();
        if (editor.ErrorCode != "batch_apply_failed" || !SameStates(beforeFailure, HostAdapters) || !editor.IsDirty)
        {
            await File.WriteAllTextAsync(Path.Combine(layoutStore.Options.RootDirectory, "m75-batch-diagnostic.json"), JsonSerializer.Serialize(new
            {
                editor.ErrorCode,
                editor.ErrorMessage,
                editor.IsDirty,
                sameStates = SameStates(beforeFailure, HostAdapters)
            }));
            return 115;
        }
        await editor.DiscardAllForDiagnosticAsync();
        if (editor.IsDirty || !expected.BusinessValues.SequenceEqual(CaptureBusinessValuesForDiagnostic(), StringComparer.Ordinal)) return 116;

        var standardPath = Path.Combine(layoutStore.Options.RootDirectory, "standard.layout-profile.json");
        var standardBeforeClose = await File.ReadAllTextAsync(standardPath);
        await editor.SelectScopeAsync(OrderHeaderRegistryIds.Scope);
        await editor.SelectElementAsync(OrderHeaderRegistryIds.OrderNumber);
        await editor.SetModeForDiagnosticAsync("width");
        await editor.ApplyDirectionForDiagnosticAsync("right");
        await editorWindowCoordinator.RequestCloseAsync();
        if (!editorWindowCoordinator.HasOpenWindow || !editor.IsDirty) return 119;
        await editorWindowCoordinator.RequestCloseAsync();
        if (editorWindowCoordinator.HasOpenWindow || editorWindowCoordinator.HasActiveProcess ||
            standardBeforeClose != await File.ReadAllTextAsync(standardPath)) return 120;

        editor = await editorWindowCoordinator.OpenAsync();
        await editor.SelectScopeAsync(OrderHeaderRegistryIds.Scope);
        await editor.SelectElementAsync(OrderHeaderRegistryIds.OrderNumber);
        await editor.SetModeForDiagnosticAsync("width");
        await editor.ApplyDirectionForDiagnosticAsync("right");
        await editorWindowCoordinator.RequestCloseAsync();
        if (editorWindowCoordinator.HasOpenWindow || editorWindowCoordinator.HasActiveProcess ||
            standardBeforeClose == await File.ReadAllTextAsync(standardPath)) return 121;
        File.Delete(statePath);
        foreach (var file in Directory.GetFiles(layoutStore.Options.RootDirectory)) File.Delete(file);
        return editorWindowCoordinator.HasActiveProcess ? 117 : 0;
    }

    private string[] CaptureBusinessValuesForDiagnostic() =>
        [OrderNumberInput.Text, OrderDateInput.Text, DueDateInput.Text, SubjectInput.Text, ResponsiblePersonInput.Text,
            CompanyNameInput.Text, ContactNameInput.Text, EmailInput.Text, StreetInput.Text, PostalCityInput.Text];

    private static double ElementWidth(IHostAdapter adapter, string elementId) =>
        adapter.GetCurrentLayoutState().Elements.Single(element => element.ElementId == elementId).Width;

    private static bool SameStates(IReadOnlyDictionary<string, LayoutState> expected, IReadOnlyDictionary<string, IHostAdapter> adapters) =>
        expected.All(pair => pair.Value.Elements.SequenceEqual(adapters[pair.Key].GetCurrentLayoutState().Elements));

    private Task WaitForUiStateAsync(Func<bool> predicate, TimeSpan timeout)
    {
        if (predicate()) return Task.CompletedTask;
        var completion = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var deadline = DateTime.UtcNow + timeout;
        var timer = new DispatcherTimer(DispatcherPriority.Background, Dispatcher) { Interval = TimeSpan.FromMilliseconds(25) };
        EventHandler tick = null!;
        tick = (_, _) =>
        {
            if (predicate()) { timer.Stop(); timer.Tick -= tick; completion.TrySetResult(); }
            else if (DateTime.UtcNow >= deadline) { timer.Stop(); timer.Tick -= tick; completion.TrySetException(new TimeoutException("UI-Diagnosezustand wurde nicht erreicht.")); }
        };
        timer.Tick += tick;
        timer.Start();
        return completion.Task;
    }

    private sealed record FullOperationDiagnosticState(double OrderWidth, double CustomerWidth, string[] BusinessValues);

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
    private void CheckCustomer_Click(object sender, RoutedEventArgs e) => viewModel.MarkCustomerAsChecked();
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
