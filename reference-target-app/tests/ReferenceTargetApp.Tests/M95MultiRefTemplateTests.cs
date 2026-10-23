using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using System.Windows.Media;
using ReferenceTargetApp.EditorIntegration.Electron;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Persistence;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class M95MultiRefTemplateTests
{
    [TestMethod]
    [DataRow(0, 1d)]
    [DataRow(1, 1d)]
    [DataRow(4, 1d)]
    [DataRow(0, 1.25d)]
    [DataRow(1, 1.25d)]
    [DataRow(4, 1.25d)]
    [DataRow(0, 1.5d)]
    [DataRow(1, 1.5d)]
    [DataRow(4, 1.5d)]
    public void NativeTemplateSessionSavesDiscardsAndRestartsWithDifferentMountedCounts(int count, double scale)
    {
        StaTest.Run(() =>
        {
            var directory = Path.Combine(Path.GetTempPath(), "kit-multi-" + Guid.NewGuid().ToString("N"));
            try
            {
                var host = new Host(count, scale);
                var adapters = host.Adapters;
                var baseline = new Dictionary<string, LayoutState> { ["sample"] = host.Adapter.GetCurrentLayoutState() };
                var store = new AtomicJsonLayoutProfileStore(directory, "sample-app");
                var session = new LayoutProfileSession(adapters, baseline, store, new(directory), "standard");
                var committed = false;
                session.ConfigureSaveAcknowledgement((snapshot, _) =>
                {
                    Assert.IsTrue(File.Exists(store.GetFilePath("standard") + ".save-transaction.json"));
                    Assert.IsFalse(committed, "ACK must not publish the rollback boundary.");
                    Assert.AreEqual(144d, snapshot.Document.Scopes.Single().LayoutState.Elements.Single(e => e.ElementId == "sample.rows.template").Width);
                    return Task.FromResult(new LayoutSaveAcknowledgement(true, "ok", "ok"));
                });
                session.ConfigureSaveCommitNotification((_, _) =>
                {
                    Assert.IsFalse(File.Exists(store.GetFilePath("standard") + ".save-transaction.json"));
                    committed = true;
                    return Task.CompletedTask;
                });
                Assert.IsTrue(Wait(host.Adapter.SubmitChangeRequestAsync(Request(144))).Success);
                session.RecordExplicitOperation("sample", "sample.rows.template", "resizeWidth");
                Assert.IsTrue(session.GetStatus().IsDirty);
                Assert.IsFalse(File.Exists(store.GetFilePath("standard")));
                Assert.IsTrue(Wait(session.SaveAsync()).Success);
                Assert.IsTrue(committed);
                var savedBytes = File.ReadAllBytes(store.GetFilePath("standard"));
                host.Remount(3);
                Assert.IsTrue(Wait(host.Adapter.SubmitChangeRequestAsync(Request(177))).Success);
                Assert.IsTrue(Wait(session.DiscardAllAsync()).Success);
                Assert.IsTrue(host.Nodes.All(node => node.Width == 144));
                Assert.IsFalse(session.GetStatus().IsDirty);
                CollectionAssert.AreEqual(savedBytes, File.ReadAllBytes(store.GetFilePath("standard")));
                // New adapter/session/refs: no native process state is reused.
                var restarted = new Host(count == 0 ? 2 : 0, scale);
                var second = new LayoutProfileSession(restarted.Adapters,
                    new Dictionary<string, LayoutState> { ["sample"] = restarted.Adapter.GetCurrentLayoutState() }, store, new(directory), "standard");
                Assert.IsTrue(Wait(second.LoadAsync()).Success);
                Assert.AreEqual(144d, restarted.Adapter.GetCurrentLayoutState().Elements.Single(e => e.ElementId == "sample.rows.template").Width);
                restarted.Remount(5);
                Assert.IsTrue(restarted.Nodes.All(node => node.Width == 144));
                Assert.IsFalse(second.GetStatus().IsDirty);
                Assert.AreEqual(RegistryFingerprint.Create(host.Adapter.GetRegistry()), RegistryFingerprint.Create(restarted.Adapter.GetRegistry()));
                StringAssert.Contains(File.ReadAllText(store.GetFilePath("standard")), "explicitOperations");
                Assert.IsFalse(File.ReadAllText(store.GetFilePath("standard")).Contains("mountedInstanceCount", StringComparison.Ordinal));
            }
            finally { if (Directory.Exists(directory)) Directory.Delete(directory, true); }
        });
    }

    [TestMethod]
    public void NativeTemplateRejectsMissingParentsInstanceStatesAndUnstableReadback()
    {
        StaTest.Run(() =>
        {
            var scope = Scope(0);
            var missingParent = scope with { Elements = [scope.Elements[0], scope.Elements[1] with { ParentId = "missing" }] };
            Assert.Throws<ElectronEditorException>(() => ElectronTargetSession.ValidateScope(missingParent));
            Assert.Throws<ElectronEditorException>(() => new ElectronTargetSession.ElectronPipeHostAdapter(
                (_, _, _) => throw new InvalidOperationException(), scope, new("sample", DateTimeOffset.UtcNow, [State("sample"), State("row.business.42")])));
            var host = new Host(2) { Unstable = true };
            var result = Wait(host.Adapter.SubmitChangeRequestAsync(Request(180)));
            Assert.IsFalse(result.Success);
            Assert.IsFalse(result.RollbackSucceeded);
            Assert.AreEqual("template_readback_invalid", result.ErrorCode);
            Assert.Throws<InvalidOperationException>(() => host.Adapter.GetCurrentLayoutState());
            Assert.AreEqual("template_state_uncertain", Wait(host.Adapter.SubmitChangeRequestAsync(Request(190))).ErrorCode);
            var forbidden = Request(123, new Dictionary<string, object?> { ["width"] = 123d, ["recordId"] = "42" });
            Assert.IsFalse(Wait(host.Adapter.SubmitChangeRequestAsync(forbidden)).Success);
        });
    }

    [TestMethod]
    public void RejectedSaveRetainsOldBytesAndDirtyTemplateCanRetry()
    {
        StaTest.Run(() =>
        {
            var directory = Path.Combine(Path.GetTempPath(), "kit-multi-retry-" + Guid.NewGuid().ToString("N"));
            try
            {
                var host = new Host(1);
                var store = new AtomicJsonLayoutProfileStore(directory, "sample-app");
                var session = new LayoutProfileSession(host.Adapters,
                    new Dictionary<string, LayoutState> { ["sample"] = host.Adapter.GetCurrentLayoutState() }, store, new(directory), "standard");
                Assert.IsTrue(Wait(session.SaveAsync()).Success);
                var bytes = File.ReadAllBytes(store.GetFilePath("standard"));
                Assert.IsTrue(Wait(host.Adapter.SubmitChangeRequestAsync(Request(144))).Success);
                session.RecordExplicitOperation("sample", "sample.rows.template", "resizeWidth");
                session.ConfigureSaveAcknowledgement((_, _) => Task.FromResult(new LayoutSaveAcknowledgement(false, "disconnected", "lost")));
                Assert.IsFalse(Wait(session.SaveAsync()).Success);
                CollectionAssert.AreEqual(bytes, File.ReadAllBytes(store.GetFilePath("standard")));
                Assert.IsTrue(session.GetStatus().IsDirty);
                session.ConfigureSaveAcknowledgement((_, _) => Task.FromResult(new LayoutSaveAcknowledgement(true, "ok", "ok")));
                Assert.IsTrue(Wait(session.SaveAsync()).Success);
                Assert.IsFalse(session.GetStatus().IsDirty);
            }
            finally { if (Directory.Exists(directory)) Directory.Delete(directory, true); }
        });
    }

    [TestMethod]
    public void NativeTemplateRollbackFailureRequiresReconnectAndCannotBeSaved()
    {
        StaTest.Run(() =>
        {
            var host = new Host(3) { RollbackFailure = true };
            var result = Wait(host.Adapter.SubmitChangeRequestAsync(Request(140)));
            Assert.IsFalse(result.Success);
            Assert.IsFalse(result.RollbackSucceeded);
            Assert.Throws<InvalidOperationException>(() => host.Adapter.GetCurrentLayoutState());
            Assert.AreEqual("template_state_uncertain", Wait(host.Adapter.SubmitChangeRequestAsync(Request(150))).ErrorCode);
        });
    }

    [TestMethod]
    [DataRow("spacingIncrease", 8d)]
    [DataRow("spacingDecrease", 2d)]
    [DataRow("spacingSet", 3d)]
    [DataRow("spacingReset", 1d)]
    public void NativeSpacingReadbackChecksLogicalValueAndRejectsMismatch(string operation, double expected)
    {
        var entry = Scope(0).Elements[1] with { Baseline = Scope(0).Elements[1].Baseline! with { Spacing = new Dictionary<string, double> { ["afterElement"] = 1 } } };
        var oldSpacing = new Dictionary<string, double> { ["afterElement"] = 5 };
        var newSpacing = new Dictionary<string, double> { ["afterElement"] = expected };
        var intent = new Dictionary<string, object?> { ["target"] = "afterElement" };
        if (operation != "spacingReset") intent["value"] = 3d;
        var request = new ChangeRequest("spacing-test", "sample.rows.template", operation,
            new Dictionary<string, object?> { ["spacing"] = intent }, DateTimeOffset.UtcNow, "test", "sample");
        var previous = State("sample.rows.template") with { Spacing = oldSpacing };
        var next = previous with { Spacing = newSpacing };
        var current = new ElementLayoutState(previous.ElementId, "sample", 0, 0, 100, 20, null, null, null, Spacing: oldSpacing);
        var result = new ElectronTargetSession.RemoteChangeResult(true, request.ChangeId, request.ElementId, operation, null, "ok", previous, next, true, TemplateReadback: new(0, 0, true));
        Assert.IsTrue(TemplateTargetContract.ValidResult(request, result, entry, current));
        Assert.IsFalse(TemplateTargetContract.ValidResult(request, result with { NewState = next with { Spacing = oldSpacing } }, entry, current));
        Assert.IsFalse(TemplateTargetContract.ValidResult(request, result with { TemplateReadback = new(2, 1, true) }, entry, current));
    }

    private static ChangeRequest Request(double width, IReadOnlyDictionary<string, object?>? payload = null) =>
        new(Guid.NewGuid().ToString("N"), "sample.rows.template", "resizeWidth", payload ?? new Dictionary<string, object?> { ["width"] = width }, DateTimeOffset.UtcNow, "test", "sample");

    private static T Wait<T>(Task<T> task)
    {
        var frame = new DispatcherFrame();
        var timer = new DispatcherTimer(TimeSpan.FromSeconds(20), DispatcherPriority.Send, (_, _) => frame.Continue = false, Dispatcher.CurrentDispatcher);
        var dispatcher = Dispatcher.CurrentDispatcher;
        _ = task.ContinueWith(_ => dispatcher.BeginInvoke(() => frame.Continue = false), TaskScheduler.Default);
        timer.Start();
        if (!task.IsCompleted) Dispatcher.PushFrame(frame);
        timer.Stop();
        Assert.IsTrue(task.IsCompleted, "Native operation timed out.");
        return task.GetAwaiter().GetResult();
    }

    private static ElectronTargetSession.RemoteElementLayoutState State(string id, double width = 100) => new(id, 0, 0, width, 20, null, null, null, true);
    private static ElectronTargetSession.RemoteRegistryScope Scope(int count) => new("sample", "complete", ["sample", "sample.rows.template"], [
        new("sample", "Root", "root", "scopeRoot", null, 0, true, false, [], [], RefKey: "root", ReferenceResolved: true,
            Baseline: new(0, 0, 100, 20, null, null, null, true, null, null, null, null), SemanticKey: "root", RegistrationStatus: "editorContainer"),
        new("sample.rows.template", "Rows", "group", "layout", "sample", 1, true, true, ["resizeWidth"], [], RefKey: "rows", ReferenceResolved: count > 0,
            Baseline: new(0, 0, 100, 20, null, null, null, true, null, null, null, null), SemanticKey: "rows", RegistrationStatus: "editorEnabled", ReferenceKind: "multi", MountedInstanceCount: count)
    ]);

    private sealed class Host
    {
        private readonly Dispatcher dispatcher = Dispatcher.CurrentDispatcher;
        private double width = 100;
        public bool Unstable { get; set; }
        public bool RollbackFailure { get; set; }
        public List<Border> Nodes { get; } = [];
        public ElectronTargetSession.ElectronPipeHostAdapter Adapter { get; }
        public IReadOnlyDictionary<string, IHostAdapter> Adapters => new Dictionary<string, IHostAdapter> { ["sample"] = Adapter };
        private readonly double scale;
        public Host(int count, double scale = 1)
        {
            this.scale = scale;
            Remount(count);
            Adapter = new(HandleAsync, Scope(count), new("sample", DateTimeOffset.UtcNow, [State("sample"), State("sample.rows.template")]));
        }
        public void Remount(int count)
        {
            Nodes.Clear();
            for (var i = 0; i < count; i++) Nodes.Add(new Border { Width = width, Height = 20, LayoutTransform = new ScaleTransform(scale, scale) });
        }
        private Task<JsonElement> HandleAsync(string action, object? payload, CancellationToken token)
        {
            token.ThrowIfCancellationRequested();
            var data = JsonSerializer.SerializeToElement(payload, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            var request = data.GetProperty("changeRequest");
            var previous = State("sample.rows.template", width);
            width = request.GetProperty("payload").GetProperty("width").GetDouble();
            dispatcher.Invoke(() => { foreach (var node in Nodes) node.Width = width; });
            var result = new ElectronTargetSession.RemoteChangeResult(!RollbackFailure, request.GetProperty("changeId").GetString()!, "sample.rows.template", "resizeWidth", RollbackFailure ? "rollback_failed" : null, "ok", previous,
                State("sample.rows.template", width), !RollbackFailure, TemplateReadback: new(Nodes.Count, Nodes.Count, !Unstable));
            return Task.FromResult(JsonSerializer.SerializeToElement(new { changeResult = result }, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        }
    }
}
