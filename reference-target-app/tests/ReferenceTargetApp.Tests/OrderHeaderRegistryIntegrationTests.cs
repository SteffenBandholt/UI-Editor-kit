using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.OrderHeader;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Registry;
using ReferenceTargetApp.UI.Views;

namespace ReferenceTargetApp.Tests;

[TestClass]
[DoNotParallelize]
public sealed class OrderHeaderRegistryIntegrationTests
{
    private static readonly string[] ExpectedIds =
    [
        OrderHeaderRegistryIds.Scope,
        OrderHeaderRegistryIds.CoreGroup,
        OrderHeaderRegistryIds.OrderNumber,
        OrderHeaderRegistryIds.OrderDate,
        OrderHeaderRegistryIds.DueDate,
        OrderHeaderRegistryIds.Subject,
        OrderHeaderRegistryIds.ResponsiblePerson,
        OrderHeaderRegistryIds.Status
    ];

    [TestMethod]
    public void LoadedWindowProvidesAtomicThreadSafeHostAdapterWithoutBusinessSideEffects()
    {
        StaTest.Run(() =>
        {
            var persistenceRoot = Path.Combine(Path.GetTempPath(), "ui-editor-kit-m735-window-test", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(persistenceRoot);
            var layoutStore = new AtomicJsonLayoutStore(LayoutStoragePathResolver.ForRoot(persistenceRoot));
            File.WriteAllText(layoutStore.FilePath, "{broken");
            var application = new ReferenceTargetApp.App();
            application.InitializeComponent();
            var window = new MainWindow(layoutStore);
            try
            {
                Assert.IsNull(window.UiRegistry, "Registry must not be built before the WPF Loaded event.");
                Assert.IsNull(window.HostAdapter, "HostAdapter must not be built before the WPF Loaded event.");
                var activityBeforeRegistration = window.ViewModel.ActivityMessage;
                var layoutBeforeRegistration = CaptureConfiguredLayout(window);

                window.Show();
                window.Dispatcher.Invoke(() => { }, DispatcherPriority.ApplicationIdle);

                var registry = window.UiRegistry;
                var hostAdapter = window.HostAdapter;
                Assert.IsNotNull(registry);
                Assert.IsNotNull(hostAdapter);
                Assert.IsNull(window.DiagnosticChangeResult, "Normal application start must not execute the diagnostic change.");
                Assert.IsNull(window.EditorProcessCoordinator, "Normal application start must not start or prepare a Node process.");
                Assert.IsNull(window.EditorProcessDiagnosticTask);
                Assert.IsNotNull(window.LayoutStartupResult);
                Assert.IsFalse(window.LayoutStartupResult.Success, "A corrupt layout file must be diagnosed without blocking startup.");
                Assert.AreEqual("invalid_json", window.LayoutStartupResult.Code);
                Assert.AreSame(registry, hostAdapter.GetRegistry());
                CollectionAssert.AreEqual(ExpectedIds, registry.Entries.Select(entry => entry.ElementId).ToArray());
                Assert.AreEqual(activityBeforeRegistration, window.ViewModel.ActivityMessage, "Registry and HostAdapter creation must not trigger a business action.");
                CollectionAssert.AreEqual(layoutBeforeRegistration, CaptureConfiguredLayout(window), "Registry and HostAdapter creation must not change WPF layout properties.");

                AssertNativeReferences(window, registry);
                AssertRegistryHierarchy(registry);
                AssertUnregisteredControlsExcluded(window, registry);

                var initialLayoutState = hostAdapter.GetCurrentLayoutState();
                CollectionAssert.AreEqual(ExpectedIds, initialLayoutState.Elements.Select(element => element.ElementId).ToArray());
                Assert.AreEqual(OrderHeaderRegistryIds.Scope, initialLayoutState.ScopeId);
                AssertLayoutStateHasNoBusinessValueProperties();

                var originalBusinessValues = CaptureBusinessValues(window);
                var activityBeforeChanges = window.ViewModel.ActivityMessage;

                var widthBefore = State(hostAdapter, OrderHeaderRegistryIds.OrderNumber);
                var widthResult = hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.OrderNumber,
                    HostAdapterOperations.ResizeWidth,
                    Payload(("width", widthBefore.Width + 24))));
                AssertSuccessful(widthResult);
                Assert.AreEqual(widthBefore.Width + 24, window.OrderNumberInput.Width, 0.001);

                var heightBefore = State(hostAdapter, OrderHeaderRegistryIds.OrderDate);
                var heightResult = hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.OrderDate,
                    HostAdapterOperations.ResizeHeight,
                    Payload(("height", heightBefore.Height + 6))));
                AssertSuccessful(heightResult);
                Assert.AreEqual(heightBefore.Height + 6, window.OrderDateInput.Height, 0.001);

                var positionResult = hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.DueDate,
                    HostAdapterOperations.Move,
                    Payload(("x", 7d), ("y", 4d))));
                AssertSuccessful(positionResult);
                var translation = window.DueDateInput.RenderTransform as TranslateTransform;
                Assert.IsNotNull(translation);
                Assert.AreEqual(7d, translation.X, 0.001);
                Assert.AreEqual(4d, translation.Y, 0.001);

                var fontBefore = State(hostAdapter, OrderHeaderRegistryIds.Subject);
                var fontResult = hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.Subject,
                    HostAdapterOperations.TextResize,
                    TextPayload("fontSize", fontBefore.FontSize!.Value + 3)));
                AssertSuccessful(fontResult);
                Assert.AreEqual(fontBefore.FontSize.Value + 3, window.SubjectInput.FontSize, 0.001);

                var textPositionBefore = State(hostAdapter, OrderHeaderRegistryIds.ResponsiblePerson);
                var textPositionResult = hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.ResponsiblePerson,
                    HostAdapterOperations.TextMove,
                    TextPayload(
                        ("offsetX", textPositionBefore.TextOffsetX!.Value + 2),
                        ("offsetY", textPositionBefore.TextOffsetY!.Value + 1))));
                AssertSuccessful(textPositionResult);
                Assert.AreEqual(textPositionBefore.TextOffsetX.Value + 2, window.ResponsiblePersonInput.Padding.Left, 0.001);
                Assert.AreEqual(textPositionBefore.TextOffsetY.Value + 1, window.ResponsiblePersonInput.Padding.Top, 0.001);

                AssertBusinessValuesUnchanged(window, originalBusinessValues);
                Assert.AreEqual(activityBeforeChanges, window.ViewModel.ActivityMessage, "Layout changes must not execute a business action.");

                AssertRejected(HostAdapterErrorCodes.OperationNotAllowed, hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.Scope, HostAdapterOperations.Move, Payload(("x", 1d)))));
                AssertRejected(HostAdapterErrorCodes.UnknownElement, hostAdapter.SubmitChangeRequest(Request(
                    "ui.order-header.unknown", HostAdapterOperations.Move, Payload(("x", 1d)))));
                AssertRejected(HostAdapterErrorCodes.WrongScope, hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.OrderNumber, HostAdapterOperations.Move, Payload(("x", 1d)), "ui.other")));
                AssertRejected(HostAdapterErrorCodes.OperationNotAllowed, hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.OrderNumber, "save", Payload(("x", 1d)))));
                AssertRejected(HostAdapterErrorCodes.InvalidPayload, hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.OrderNumber, HostAdapterOperations.Move, null)));
                AssertRejected(HostAdapterErrorCodes.InvalidPayload, hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.OrderNumber, HostAdapterOperations.Move, Payload())));
                AssertRejected(HostAdapterErrorCodes.InvalidPayload, hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.OrderNumber, HostAdapterOperations.ResizeWidth, Payload(("width", -1d)))));
                AssertRejected(HostAdapterErrorCodes.InvalidPayload, hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.OrderNumber, HostAdapterOperations.ResizeHeight, Payload(("height", -1d)))));
                AssertRejected(HostAdapterErrorCodes.InvalidPayload, hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.OrderNumber, HostAdapterOperations.ResizeHeight, Payload(("height", double.NaN)))));
                AssertRejected(HostAdapterErrorCodes.InvalidPayload, hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.OrderNumber, HostAdapterOperations.ResizeWidth, Payload(("width", double.PositiveInfinity)))));
                AssertRejected(HostAdapterErrorCodes.OperationNotAllowed, hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.CoreGroup, HostAdapterOperations.TextResize, TextPayload("fontSize", 18d))));
                AssertRejected(HostAdapterErrorCodes.ForbiddenField, hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.OrderNumber,
                    HostAdapterOperations.Move,
                    Payload(("x", 2d), ("businessData", "verboten")))));

                var stateBeforeRejectedChanges = hostAdapter.GetCurrentLayoutState().Elements.ToArray();
                AssertRejected(HostAdapterErrorCodes.InvalidPayload, hostAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.Subject,
                    HostAdapterOperations.TextResize,
                    TextPayload("fontSize", -5d))));
                CollectionAssert.AreEqual(stateBeforeRejectedChanges, hostAdapter.GetCurrentLayoutState().Elements.ToArray(),
                    "Rejected requests must not change any registered layout state.");

                var rollbackStateBefore = State(hostAdapter, OrderHeaderRegistryIds.OrderDate);
                var failingAdapter = new WpfHostAdapter(registry, new ThrowAfterApplyLayoutAccess());
                var failedResult = failingAdapter.SubmitChangeRequest(Request(
                    OrderHeaderRegistryIds.OrderDate,
                    HostAdapterOperations.Resize,
                    Payload(("width", rollbackStateBefore.Width + 19), ("height", rollbackStateBefore.Height + 8))));
                AssertRejected(HostAdapterErrorCodes.TargetRejectedChange, failedResult);
                Assert.IsTrue(failedResult.RollbackSucceeded);
                Assert.AreEqual(rollbackStateBefore, State(hostAdapter, OrderHeaderRegistryIds.OrderDate),
                    "Failed native application must restore the complete previous layout state.");

                var uiThreadId = Environment.CurrentManagedThreadId;
                var workerThreadId = 0;
                var workerTask = Task.Run(() =>
                {
                    workerThreadId = Environment.CurrentManagedThreadId;
                    return hostAdapter.SubmitChangeRequest(Request(
                        OrderHeaderRegistryIds.OrderNumber,
                        HostAdapterOperations.Move,
                        Payload(("x", 11d), ("y", 3d))));
                });
                var workerResult = AwaitWithDispatcher(workerTask, window.Dispatcher);
                Assert.AreNotEqual(uiThreadId, workerThreadId);
                AssertSuccessful(workerResult);
                Assert.AreEqual(11d, ((TranslateTransform)window.OrderNumberInput.RenderTransform).X, 0.001);

                AssertBusinessValuesUnchanged(window, originalBusinessValues);
                Assert.AreEqual(activityBeforeChanges, window.ViewModel.ActivityMessage, "HostAdapter must never execute business commands.");

                var diagnostics = window.RegistryDiagnostics;
                Assert.IsNotNull(diagnostics);
                Assert.AreEqual(ExpectedIds.Length, diagnostics.Count);
                Assert.IsTrue(diagnostics.Entries.All(entry => entry.HasNativeReference));

                window.CheckOrderButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                Assert.AreEqual("Plausibilitätsprüfung ohne Beanstandung abgeschlossen", window.ViewModel.ActivityMessage,
                    "Business buttons must remain ordinary usable WPF actions independent from the HostAdapter.");
            }
            finally
            {
                window.Close();
                application.Shutdown();
                if (Directory.Exists(persistenceRoot)) Directory.Delete(persistenceRoot, recursive: true);
            }
        });
    }

    private static void AssertNativeReferences(MainWindow window, IUiElementRegistry registry)
    {
        Assert.AreSame(window.OrderHeaderScope, registry.FindById(OrderHeaderRegistryIds.Scope)?.NativeElement);
        Assert.AreSame(window.OrderHeaderCoreGroup, registry.FindById(OrderHeaderRegistryIds.CoreGroup)?.NativeElement);
        Assert.AreSame(window.OrderNumberInput, registry.FindById(OrderHeaderRegistryIds.OrderNumber)?.NativeElement);
        Assert.AreSame(window.OrderDateInput, registry.FindById(OrderHeaderRegistryIds.OrderDate)?.NativeElement);
        Assert.AreSame(window.DueDateInput, registry.FindById(OrderHeaderRegistryIds.DueDate)?.NativeElement);
        Assert.AreSame(window.SubjectInput, registry.FindById(OrderHeaderRegistryIds.Subject)?.NativeElement);
        Assert.AreSame(window.ResponsiblePersonInput, registry.FindById(OrderHeaderRegistryIds.ResponsiblePerson)?.NativeElement);
        Assert.AreSame(window.OrderStatusIndicator, registry.FindById(OrderHeaderRegistryIds.Status)?.NativeElement);
    }

    private static void AssertRegistryHierarchy(IUiElementRegistry registry)
    {
        CollectionAssert.AreEqual(
            new[] { OrderHeaderRegistryIds.CoreGroup, OrderHeaderRegistryIds.Status },
            registry.GetChildren(OrderHeaderRegistryIds.Scope).Select(entry => entry.ElementId).ToArray());
        CollectionAssert.AreEqual(
            new[]
            {
                OrderHeaderRegistryIds.OrderNumber,
                OrderHeaderRegistryIds.OrderDate,
                OrderHeaderRegistryIds.DueDate,
                OrderHeaderRegistryIds.Subject,
                OrderHeaderRegistryIds.ResponsiblePerson
            },
            registry.GetChildren(OrderHeaderRegistryIds.CoreGroup).Select(entry => entry.ElementId).ToArray());
        Assert.HasCount(ExpectedIds.Length, registry.GetByScope(OrderHeaderRegistryIds.Scope));
    }

    private static void AssertUnregisteredControlsExcluded(MainWindow window, IUiElementRegistry registry)
    {
        var nativeReferences = registry.Entries.Select(entry => entry.NativeElement).ToArray();
        Assert.IsFalse(nativeReferences.Contains(window.CustomerDataGroup));
        Assert.IsFalse(nativeReferences.Contains(window.PositionsTable));
        Assert.IsFalse(nativeReferences.Contains(window.TotalsGroup));
        Assert.IsFalse(nativeReferences.Contains(window.BusinessActionsGroup));
        Assert.IsFalse(nativeReferences.Contains(window.NewOrderButton));
        Assert.IsFalse(nativeReferences.Contains(window.AddPositionButton));
        Assert.IsFalse(nativeReferences.Contains(window.CheckOrderButton));
        Assert.IsFalse(nativeReferences.Contains(window.SaveOrderButton));
    }

    private static void AssertLayoutStateHasNoBusinessValueProperties()
    {
        var propertyNames = typeof(ElementLayoutState).GetProperties().Select(property => property.Name).ToArray();
        foreach (var forbiddenName in new[] { "Text", "Value", "Content", "Status", "Command", "BusinessData", "DomainData" })
            CollectionAssert.DoesNotContain(propertyNames, forbiddenName);
    }

    private static string[] CaptureBusinessValues(MainWindow window) =>
    [
        window.OrderNumberInput.Text,
        window.OrderDateInput.Text,
        window.DueDateInput.Text,
        window.SubjectInput.Text,
        window.ResponsiblePersonInput.Text
    ];

    private static void AssertBusinessValuesUnchanged(MainWindow window, string[] expected) =>
        CollectionAssert.AreEqual(expected, CaptureBusinessValues(window));

    private static object[] CaptureConfiguredLayout(MainWindow window) =>
    [
        window.OrderHeaderScope.Width,
        window.OrderHeaderScope.Height,
        window.OrderHeaderScope.Margin,
        window.OrderHeaderCoreGroup.Width,
        window.OrderHeaderCoreGroup.Height,
        window.OrderHeaderCoreGroup.Margin,
        window.OrderNumberInput.Width,
        window.OrderNumberInput.Height,
        window.OrderNumberInput.Margin,
        window.OrderStatusIndicator.Width,
        window.OrderStatusIndicator.Height,
        window.OrderStatusIndicator.Margin
    ];

    private static ElementLayoutState State(IHostAdapter adapter, string elementId) =>
        adapter.GetCurrentLayoutState().Elements.Single(element => element.ElementId == elementId);

    private static ChangeRequest Request(
        string elementId,
        string operation,
        IReadOnlyDictionary<string, object?>? payload,
        string? scope = OrderHeaderRegistryIds.Scope) => new(
            $"test-{Guid.NewGuid():N}",
            elementId,
            operation,
            payload,
            DateTimeOffset.UtcNow,
            "m73.3-tests",
            scope);

    private static IReadOnlyDictionary<string, object?> Payload(params (string Key, object? Value)[] values) =>
        values.ToDictionary(value => value.Key, value => value.Value, StringComparer.Ordinal);

    private static IReadOnlyDictionary<string, object?> TextPayload(string key, object? value) =>
        TextPayload((key, value));

    private static IReadOnlyDictionary<string, object?> TextPayload(params (string Key, object? Value)[] values) =>
        Payload(("text", Payload(values)));

    private static void AssertSuccessful(ChangeResult result)
    {
        Assert.IsTrue(result.Success, result.Message);
        Assert.IsNull(result.ErrorCode);
        Assert.IsNotNull(result.PreviousState);
        Assert.IsNotNull(result.NewState);
    }

    private static void AssertRejected(string expectedCode, ChangeResult result)
    {
        Assert.IsFalse(result.Success);
        Assert.AreEqual(expectedCode, result.ErrorCode, result.Message);
    }

    private static T AwaitWithDispatcher<T>(Task<T> task, Dispatcher dispatcher)
    {
        if (!task.IsCompleted)
        {
            var frame = new DispatcherFrame();
            _ = task.ContinueWith(
                _ => dispatcher.BeginInvoke(new Action(() => frame.Continue = false), DispatcherPriority.Send),
                TaskScheduler.Default);
            Dispatcher.PushFrame(frame);
        }
        return task.GetAwaiter().GetResult();
    }

    private sealed class ThrowAfterApplyLayoutAccess : IWpfLayoutAccess
    {
        private readonly WpfLayoutAccess inner = new();

        public WpfElementSnapshot Capture(UiRegistryEntry entry) => inner.Capture(entry);
        public ElementLayoutState Read(UiRegistryEntry entry) => inner.Read(entry);

        public void Apply(UiRegistryEntry entry, ValidatedLayoutChange change)
        {
            inner.Apply(entry, change);
            throw new InvalidOperationException("Absichtlich provozierter Fehler nach nativer Teiländerung.");
        }

        public void Restore(UiRegistryEntry entry, WpfElementSnapshot snapshot) => inner.Restore(entry, snapshot);
    }
}
