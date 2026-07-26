using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.OrderHeader;
using ReferenceTargetApp.EditorIntegration.Process;
using ReferenceTargetApp.EditorIntegration.Protocol;
using ReferenceTargetApp.EditorIntegration.Registry;
using ReferenceTargetApp.EditorIntegration.Session;
using ReferenceTargetApp.UI.Views;

namespace ReferenceTargetApp.Tests;

[TestClass]
[DoNotParallelize]
public sealed class EditorProcessIntegrationTests
{
    [TestMethod]
    public void RealNodeProcessSupportsActivationSingleSessionChangeAndCleanShutdown()
    {
        StaTest.Run(() =>
        {
            var adapter = CreateAdapter(out var orderNumberInput);
            var dispatcher = orderNumberInput.Dispatcher;
            try
            {
                var originalBusinessValue = orderNumberInput.Text;
                var originalWidth = adapter.GetCurrentLayoutState().Elements.Single(element => element.ElementId == OrderHeaderRegistryIds.OrderNumber).Width;

                var options = EditorProcessOptions.FromRepositoryRoot(RepositoryRoot());
                var coordinator = new EditorProcessCoordinator(adapter, options);
                try
                {
                    var activation = AwaitWithDispatcher(coordinator.ActivateAsync(), dispatcher);
                    Assert.IsTrue(activation.Success, activation.Message);
                    Assert.AreEqual(EditorSessionState.Active, coordinator.State);
                    var processId = coordinator.ProcessId;
                    Assert.IsNotNull(processId);
                    using (var nodeProcess = System.Diagnostics.Process.GetProcessById(processId.Value))
                    {
                        Assert.AreEqual("node", nodeProcess.ProcessName, true);
                        Assert.AreEqual(IntPtr.Zero, nodeProcess.MainWindowHandle, "Node-Prozess darf kein Shellfenster anzeigen.");
                    }

                    var duplicateActivation = AwaitWithDispatcher(coordinator.ActivateAsync(), dispatcher);
                    Assert.IsTrue(duplicateActivation.Success);
                    Assert.AreEqual("already_active", duplicateActivation.Code);

                    var session = AwaitWithDispatcher(coordinator.StartSessionAsync(), dispatcher);
                    Assert.IsTrue(session.Success, session.Message);
                    Assert.AreEqual(EditorSessionState.SessionActive, coordinator.State);
                    Assert.IsNotNull(session.SessionId);
                    var duplicateSession = AwaitWithDispatcher(coordinator.StartSessionAsync(), dispatcher);
                    Assert.IsFalse(duplicateSession.Success);
                    Assert.AreEqual("session_already_active", duplicateSession.Code);

                    var registryJson = JsonSerializer.Serialize(
                        EditorProtocolPayloadFactory.CreateRegistryPayload(adapter.GetRegistry()),
                        EditorProtocolJson.Options);
                    Assert.IsFalse(registryJson.Contains("nativeElement", StringComparison.OrdinalIgnoreCase));
                    Assert.IsFalse(registryJson.Contains(originalBusinessValue, StringComparison.Ordinal));
                    var metadataRegistry = new UiElementRegistry([
                        new UiRegistryEntry("metadata.scope", "metadata.scope", null, UiElementKind.Scope, "Metadaten", 0,
                            UiCapability.None, new Border(), "root", "scopeRoot", [], []),
                        new UiRegistryEntry("metadata.scope.table", "metadata.scope", "metadata.scope", UiElementKind.Table, "Tabelle", 1,
                            UiCapability.Width, new Border(), "table", "contentTable", [HostAdapterOperations.ResizeWidth], []),
                        new UiRegistryEntry("metadata.scope.table.meta", "metadata.scope", "metadata.scope.table", UiElementKind.TableColumn, "Meta", 2,
                            UiCapability.Width, new Border(), "tableColumn", "metaColumn", [HostAdapterOperations.ResizeWidth], [], "metaColumn"),
                    ]);
                    var metadataJson = JsonSerializer.Serialize(
                        EditorProtocolPayloadFactory.CreateRegistryPayload(metadataRegistry),
                        EditorProtocolJson.Options);
                    StringAssert.Contains(metadataJson, "\"columnRole\":\"metaColumn\"");
                    var layoutJson = JsonSerializer.Serialize(
                        EditorProtocolPayloadFactory.CreateLayoutStatePayload(adapter.GetCurrentLayoutState()),
                        EditorProtocolJson.Options);
                    Assert.IsFalse(layoutJson.Contains(originalBusinessValue, StringComparison.Ordinal));
                    Assert.IsFalse(layoutJson.Contains("businessData", StringComparison.OrdinalIgnoreCase));

                    var request = Request(OrderHeaderRegistryIds.OrderNumber, HostAdapterOperations.ResizeWidth, originalWidth + 24);
                    var change = AwaitWithDispatcher(coordinator.RunDiagnosticChangeAsync(request), dispatcher);
                    Assert.IsTrue(change.Success, change.Message);
                    Assert.AreEqual(originalWidth + 24, orderNumberInput.Width, 0.001);
                    Assert.AreEqual(originalBusinessValue, orderNumberInput.Text);

                    var unknown = AwaitWithDispatcher(coordinator.RunDiagnosticChangeAsync(
                        Request("ui.order-header.unknown", HostAdapterOperations.ResizeWidth, 200)), dispatcher);
                    Assert.IsFalse(unknown.Success);
                    Assert.AreEqual("invalid_change_request", unknown.ErrorCode);
                    Assert.AreEqual(originalBusinessValue, orderNumberInput.Text);

                    var sessionEnd = AwaitWithDispatcher(coordinator.EndSessionAsync(), dispatcher);
                    Assert.IsTrue(sessionEnd.Success, sessionEnd.Message);
                    Assert.AreEqual(EditorSessionState.Active, coordinator.State);
                    var deactivation = AwaitWithDispatcher(coordinator.DeactivateAsync(), dispatcher);
                    Assert.IsTrue(deactivation.Success, deactivation.Message);
                    Assert.AreEqual(EditorSessionState.Inactive, coordinator.State);
                    Assert.IsNull(coordinator.ProcessId);
                    Assert.ThrowsExactly<ArgumentException>(() => System.Diagnostics.Process.GetProcessById(processId.Value));
                }
                finally
                {
                    AwaitWithDispatcher(coordinator.DisposeAsync().AsTask(), dispatcher);
                }
            }
            finally
            {
                Dispatcher.CurrentDispatcher.InvokeShutdown();
            }
        });
    }

    [TestMethod]
    public async Task ProcessClientHandlesInvalidJsonStderrTimeoutMissingPathsAndUnexpectedExit()
    {
        var root = RepositoryRoot();
        var shortTimeouts = new EditorProcessTimeouts(
            TimeSpan.FromSeconds(2), TimeSpan.FromMilliseconds(300), TimeSpan.FromMilliseconds(300),
            TimeSpan.FromMilliseconds(300), TimeSpan.FromMilliseconds(300), TimeSpan.FromMilliseconds(300), TimeSpan.FromMilliseconds(150));

        var fixture = Options(root, "stderr-invalid-json.cjs", shortTimeouts);
        await using (var client = new NodeEditorProcessClient(fixture))
        {
            await client.StartAsync();
            var reply = await client.SendRequestAsync(EditorMessageTypes.Handshake, new { }, EditorMessageTypes.HandshakeAccepted, shortTimeouts.Handshake);
            Assert.AreEqual(EditorMessageTypes.HandshakeAccepted, reply.MessageType);
            await Task.Delay(50);
            Assert.IsTrue(client.GetDiagnostics().Any(entry => entry.Code == "invalid_json"));
            Assert.IsTrue(client.GetDiagnostics().Any(entry => entry.Code == "node_stderr"));
        }

        var hanging = Options(root, "hang.cjs", shortTimeouts);
        int hangingProcessId;
        await using (var client = new NodeEditorProcessClient(hanging))
        {
            await client.StartAsync();
            hangingProcessId = client.ProcessId!.Value;
            var exception = await Assert.ThrowsExactlyAsync<EditorProcessException>(() =>
                client.SendRequestAsync(EditorMessageTypes.Handshake, new { }, EditorMessageTypes.HandshakeAccepted, shortTimeouts.Handshake));
            Assert.AreEqual("timeout", exception.Code);
        }
        Assert.ThrowsExactly<ArgumentException>(() => System.Diagnostics.Process.GetProcessById(hangingProcessId));

        await using (var client = new NodeEditorProcessClient(Options(root, "wrong-version.cjs", shortTimeouts)))
        {
            await client.StartAsync();
            var exception = await Assert.ThrowsExactlyAsync<EditorProcessException>(() =>
                client.SendRequestAsync(EditorMessageTypes.Handshake, new { }, EditorMessageTypes.HandshakeAccepted, shortTimeouts.Handshake));
            Assert.AreEqual("incompatible_protocol_version", exception.Code);
        }

        var exiting = Options(root, "exit.cjs", shortTimeouts);
        await using (var client = new NodeEditorProcessClient(exiting))
        {
            var exited = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            client.UnexpectedlyExited += (_, _) => exited.TrySetResult();
            await client.StartAsync();
            await exited.Task.WaitAsync(TimeSpan.FromSeconds(2));
            Assert.IsTrue(client.ExitedUnexpectedly);
            Assert.IsTrue(client.GetDiagnostics().Any(entry => entry.Code == "unexpected_exit"));
        }

        var missingScript = EditorProcessOptions.FromRepositoryRoot(root) with { ScriptPath = Path.Combine(root, "missing.cjs") };
        await using (var client = new NodeEditorProcessClient(missingScript))
        {
            var exception = await Assert.ThrowsExactlyAsync<EditorProcessException>(() => client.StartAsync());
            Assert.AreEqual("script_not_found", exception.Code);
        }
        var missingNode = EditorProcessOptions.FromRepositoryRoot(root, "definitely-missing-node-command") with { Timeouts = shortTimeouts };
        await using (var client = new NodeEditorProcessClient(missingNode))
        {
            var exception = await Assert.ThrowsExactlyAsync<EditorProcessException>(() => client.StartAsync());
            Assert.AreEqual("process_start_failed", exception.Code);
        }
    }

    private static EditorProcessOptions Options(string root, string fixtureName, EditorProcessTimeouts timeouts) => new(
        "node",
        Path.Combine(root, "reference-target-app", "tests", "ReferenceTargetApp.Tests", "Fixtures", fixtureName),
        root,
        timeouts);

    private static ChangeRequest Request(string elementId, string operation, double width) => new(
        $"test-{Guid.NewGuid():N}", elementId, operation,
        new Dictionary<string, object?> { ["width"] = width }, DateTimeOffset.UtcNow,
        "m73.4-integration-test", OrderHeaderRegistryIds.Scope);

    private static IHostAdapter CreateAdapter(out TextBox orderNumberInput)
    {
        static T Size<T>(T element, double width, double height) where T : FrameworkElement
        {
            element.Width = width;
            element.Height = height;
            return element;
        }

        orderNumberInput = Size(new TextBox { Text = "AU-2026-0471", FontSize = 14, Padding = new Thickness(4, 2, 4, 2) }, 200, 30);
        var registry = new OrderHeaderRegistryFactory().Create(new OrderHeaderElementReferences(
            Size(new GroupBox(), 800, 300),
            Size(new Grid(), 760, 220),
            orderNumberInput,
            Size(new TextBox { Text = "24.07.2026", Padding = new Thickness(4) }, 180, 30),
            Size(new TextBox { Text = "14.08.2026", Padding = new Thickness(4) }, 180, 30),
            Size(new TextBox { Text = "Betreff", Padding = new Thickness(4) }, 400, 30),
            Size(new TextBox { Text = "Daniel Krüger", Padding = new Thickness(4) }, 200, 30),
            Size(new Border { Padding = new Thickness(4) }, 140, 30)));
        return new WpfHostAdapter(registry);
    }

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "package.json"))) directory = directory.Parent;
        return directory?.FullName ?? throw new DirectoryNotFoundException("Repository-Stamm wurde nicht gefunden.");
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

    private static void AwaitWithDispatcher(Task task, Dispatcher dispatcher)
    {
        if (!task.IsCompleted)
        {
            var frame = new DispatcherFrame();
            _ = task.ContinueWith(
                _ => dispatcher.BeginInvoke(new Action(() => frame.Continue = false), DispatcherPriority.Send),
                TaskScheduler.Default);
            Dispatcher.PushFrame(frame);
        }
        task.GetAwaiter().GetResult();
    }
}
