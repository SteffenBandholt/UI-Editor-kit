using System.IO;
using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.CustomerDetails;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Registry;
using ReferenceTargetApp.UI.Editor;
using ReferenceTargetApp.UI.Views;

namespace ReferenceTargetApp.Tests;

[TestClass]
[DoNotParallelize]
public sealed class M75FullOperationTests
{
    [TestMethod]
    public void TwoScopesRemainSeparatedAndSchemaTwoSavesAllScopesAtomically()
    {
        StaTest.Run(() => WithEnvironment((root, adapters, baseline) =>
        {
            Assert.HasCount(2, adapters);
            Assert.AreNotEqual(adapters["ui.scope-a"].GetRegistry().Entries[0].ElementId,
                adapters["ui.scope-b"].GetRegistry().Entries[0].ElementId);
            var session = Session(root, adapters, baseline);
            var scopeBBefore = adapters["ui.scope-b"].GetCurrentLayoutState();
            ChangeWidth(adapters["ui.scope-a"], "ui.scope-a.field", 230);
            CollectionAssert.AreEqual(scopeBBefore.Elements.ToArray(), adapters["ui.scope-b"].GetCurrentLayoutState().Elements.ToArray());
            Assert.IsTrue(session.GetStatus().IsDirty);

            var saved = Await(session.SaveAsync());
            Assert.IsTrue(saved.Success, saved.Message);
            Assert.IsFalse(session.GetStatus().IsDirty);
            var path = Path.Combine(root, "standard.layout-profile.json");
            Assert.IsTrue(File.Exists(path));
            Assert.IsEmpty(Directory.GetFiles(root, "*.tmp"));
            using var json = JsonDocument.Parse(File.ReadAllText(path));
            Assert.AreEqual(2, json.RootElement.GetProperty("schemaVersion").GetInt32());
            Assert.AreEqual("standard", json.RootElement.GetProperty("profileId").GetString());
            Assert.AreEqual(2, json.RootElement.GetProperty("scopes").GetArrayLength());
            Assert.IsFalse(File.ReadAllText(path).Contains("Text A", StringComparison.Ordinal));
        }));
    }

    [TestMethod]
    public void ProfileLoadRejectsIncompatibleSchemaApplicationProfileScopesFingerprintAndElements()
    {
        StaTest.Run(() => WithEnvironment((root, adapters, baseline) =>
        {
            var session = Session(root, adapters, baseline);
            Assert.IsTrue(Await(session.SaveAsync()).Success);
            var store = new AtomicJsonLayoutProfileStore(root);
            var path = store.GetFilePath(LayoutProfileCatalog.StandardId);
            var original = File.ReadAllText(path);

            AssertRejected(document => document["schemaVersion"] = 99, "unsupported_schema_version");
            AssertRejected(document => document["applicationId"] = "other-app", "wrong_application");
            AssertRejected(document => document["profileId"] = "compact", "wrong_profile");
            AssertRejected(document => document["scopes"]!.AsArray().RemoveAt(0), "missing_scope");
            AssertRejected(document => document["scopes"]!.AsArray().Add(new JsonObject
            {
                ["scopeId"] = "ui.unknown",
                ["registryFingerprint"] = "unknown",
                ["layoutState"] = new JsonObject { ["elements"] = new JsonArray() }
            }), "unknown_scope");
            AssertRejected(document => document["scopes"]![0]!["registryFingerprint"] = "wrong", "incompatible_registry");
            AssertRejected(document => document["scopes"]![0]!["layoutState"]!["elements"]![0]!["elementId"] = "ui.unknown.element", "unknown_element");
            File.WriteAllText(path, original);

            void AssertRejected(Action<JsonObject> mutate, string expectedCode)
            {
                var document = JsonNode.Parse(original)!.AsObject();
                mutate(document);
                File.WriteAllText(path, document.ToJsonString());
                var result = Await(store.LoadAsync(LayoutProfileCatalog.StandardId, adapters));
                Assert.IsFalse(result.Success);
                Assert.AreEqual(expectedCode, result.Code);
            }
        }));
    }

    [TestMethod]
    public void FailedProfileSaveKeepsOldFileSavedStateAndDirtyWorkingState()
    {
        StaTest.Run(() => WithEnvironment((root, adapters, baseline) =>
        {
            var session = Session(root, adapters, baseline);
            Assert.IsTrue(Await(session.SaveAsync()).Success);
            var path = Path.Combine(root, "standard.layout-profile.json");
            var original = File.ReadAllText(path);
            ChangeWidth(adapters["ui.scope-a"], "ui.scope-a.field", 245);
            using (new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                var failed = Await(session.SaveAsync());
                Assert.IsFalse(failed.Success);
                Assert.AreEqual("storage_write_failed", failed.Code);
            }
            Assert.AreEqual(original, File.ReadAllText(path));
            Assert.IsTrue(session.GetStatus().IsDirty);
            Assert.IsEmpty(Directory.GetFiles(root, "*.tmp"));
        }));
    }

    [TestMethod]
    public void SaveLoadDiscardAndResetUseDistinctSavedAndAppBaselineStates()
    {
        StaTest.Run(() => WithEnvironment((root, adapters, baseline) =>
        {
            var session = Session(root, adapters, baseline);
            ChangeWidth(adapters["ui.scope-a"], "ui.scope-a.field", 230);
            ChangeWidth(adapters["ui.scope-b"], "ui.scope-b.field", 330);
            Assert.IsTrue(Await(session.SaveAsync()).Success);
            var fileBeforeReset = File.ReadAllText(Path.Combine(root, "standard.layout-profile.json"));

            ChangeWidth(adapters["ui.scope-a"], "ui.scope-a.field", 250);
            ChangeWidth(adapters["ui.scope-b"], "ui.scope-b.field", 350);
            Assert.IsTrue(Await(session.DiscardElementAsync("ui.scope-a", "ui.scope-a.field")).Success);
            Assert.AreEqual(230, Width(adapters["ui.scope-a"], "ui.scope-a.field"), 0.001);
            Assert.AreEqual(350, Width(adapters["ui.scope-b"], "ui.scope-b.field"), 0.001);
            Assert.IsTrue(session.GetStatus().IsDirty, "Einzelverwerfen muss Dirty für andere Elemente erhalten.");
            Assert.IsTrue(Await(session.DiscardAllAsync()).Success);
            Assert.AreEqual(330, Width(adapters["ui.scope-b"], "ui.scope-b.field"), 0.001);
            Assert.IsFalse(session.GetStatus().IsDirty);

            Assert.IsTrue(Await(session.ResetElementAsync("ui.scope-a", "ui.scope-a.field")).Success);
            Assert.AreEqual(200, Width(adapters["ui.scope-a"], "ui.scope-a.field"), 0.001);
            Assert.AreEqual(330, Width(adapters["ui.scope-b"], "ui.scope-b.field"), 0.001);
            Assert.IsTrue(session.GetStatus().IsDirty);
            Assert.AreEqual(fileBeforeReset, File.ReadAllText(Path.Combine(root, "standard.layout-profile.json")), "Reset darf die Datei nicht verändern.");
            Assert.IsTrue(Await(session.ResetAllAsync()).Success);
            Assert.AreEqual(200, Width(adapters["ui.scope-a"], "ui.scope-a.field"), 0.001);
            Assert.AreEqual(300, Width(adapters["ui.scope-b"], "ui.scope-b.field"), 0.001);
            Assert.IsTrue(session.GetStatus().IsDirty, "Reset bleibt bis Save ungespeichert.");
            Assert.IsTrue(Await(session.SaveAsync()).Success);
            Assert.IsFalse(session.GetStatus().IsDirty);
        }));
    }

    [TestMethod]
    public void M80VisibilityUsesCapabilitiesAndProfileSaveDiscardReset()
    {
        StaTest.Run(() => WithEnvironment((root, adapters, baseline) =>
        {
            var adapter = adapters["ui.scope-a"];
            var session = Session(root, adapters, baseline);
            Assert.IsTrue(Visible(adapter, "ui.scope-a.field"));
            ChangeVisibility(adapter, "ui.scope-a.field", false);
            Assert.IsFalse(Visible(adapter, "ui.scope-a.field"));
            Assert.IsNotNull(adapter.GetRegistry().FindById("ui.scope-a.field"), "Unsichtbare Elemente bleiben registriert.");
            Assert.IsTrue(Await(session.SaveAsync()).Success);
            StringAssert.Contains(File.ReadAllText(Path.Combine(root, "standard.layout-profile.json")), "\"visible\": false");

            ChangeVisibility(adapter, "ui.scope-a.field", true);
            Assert.IsTrue(Await(session.DiscardElementAsync("ui.scope-a", "ui.scope-a.field")).Success);
            Assert.IsFalse(Visible(adapter, "ui.scope-a.field"), "Discard stellt gespeicherte Sichtbarkeit wieder her.");
            Assert.IsTrue(Await(session.ResetElementAsync("ui.scope-a", "ui.scope-a.field")).Success);
            Assert.IsTrue(Visible(adapter, "ui.scope-a.field"), "Reset stellt die App-Baseline wieder her.");

            var deniedRegistry = new UiElementRegistry(adapter.GetRegistry().Entries.Select(entry =>
                entry.ElementId == "ui.scope-a.field" ? entry with { Capabilities = entry.Capabilities & ~UiCapability.Visibility } : entry));
            var denied = ChangeRequestValidator.Validate(new ChangeRequest(Guid.NewGuid().ToString("N"), "ui.scope-a.field",
                HostAdapterOperations.SetVisibility, new Dictionary<string, object?> { ["visible"] = false },
                DateTimeOffset.UtcNow, "m80-test", "ui.scope-a"), deniedRegistry);
            Assert.IsFalse(denied.Success);
            Assert.AreEqual(HostAdapterErrorCodes.OperationNotAllowed, denied.ErrorCode);
        }));
    }

    [TestMethod]
    public void ProfilesAreIndependentLoadReadsDiskAndActiveSelectionPersists()
    {
        StaTest.Run(() => WithEnvironment((root, adapters, baseline) =>
        {
            var session = Session(root, adapters, baseline);
            ChangeWidth(adapters["ui.scope-a"], "ui.scope-a.field", 220);
            Assert.IsTrue(Await(session.SaveAsync()).Success);

            var compact = Await(session.SwitchProfileAsync(LayoutProfileCatalog.CompactId));
            Assert.IsTrue(compact.Success, compact.Message);
            Assert.AreEqual("profile_started_from_baseline", compact.Code);
            Assert.AreEqual(200, Width(adapters["ui.scope-a"], "ui.scope-a.field"), 0.001);
            ChangeWidth(adapters["ui.scope-a"], "ui.scope-a.field", 180);
            Assert.IsTrue(Await(session.SaveAsync()).Success);

            Assert.IsTrue(Await(session.SwitchProfileAsync(LayoutProfileCatalog.StandardId)).Success);
            Assert.AreEqual(220, Width(adapters["ui.scope-a"], "ui.scope-a.field"), 0.001);
            Assert.AreEqual(LayoutProfileCatalog.StandardId, Await(new ActiveLayoutProfileStore(root).LoadAsync()));

            var store = new AtomicJsonLayoutProfileStore(root);
            var external = adapters.ToDictionary(pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal);
            external["ui.scope-a"] = ReplaceWidth(external["ui.scope-a"], "ui.scope-a.field", 240);
            Assert.IsTrue(Await(store.SaveAsync(LayoutProfileCatalog.StandardId, adapters, external)).Success);
            Assert.IsTrue(Await(session.LoadAsync()).Success);
            Assert.AreEqual(240, Width(adapters["ui.scope-a"], "ui.scope-a.field"), 0.001, "Load muss den aktuellen Datenträgerstand lesen.");
        }));
    }

    [TestMethod]
    public void FailedMultiScopeBatchRestoresEveryScopeAndKeepsSavedState()
    {
        StaTest.Run(() => WithEnvironment((root, realAdapters, baseline) =>
        {
            var failingB = new FailingHostAdapter(realAdapters["ui.scope-b"]);
            var adapters = new Dictionary<string, IHostAdapter>(StringComparer.Ordinal)
            {
                ["ui.scope-a"] = realAdapters["ui.scope-a"],
                ["ui.scope-b"] = failingB
            };
            var session = Session(root, adapters, baseline);
            ChangeWidth(realAdapters["ui.scope-a"], "ui.scope-a.field", 220);
            ChangeWidth(realAdapters["ui.scope-b"], "ui.scope-b.field", 320);
            Assert.IsTrue(Await(session.SaveAsync()).Success);
            ChangeWidth(realAdapters["ui.scope-a"], "ui.scope-a.field", 250);
            ChangeWidth(realAdapters["ui.scope-b"], "ui.scope-b.field", 350);
            var before = adapters.ToDictionary(pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal);
            failingB.FailNext = true;

            var result = Await(session.DiscardAllAsync());
            Assert.IsFalse(result.Success);
            Assert.IsTrue(result.RollbackSucceeded, result.Message);
            CollectionAssert.AreEqual(before["ui.scope-a"].Elements.ToArray(), realAdapters["ui.scope-a"].GetCurrentLayoutState().Elements.ToArray());
            CollectionAssert.AreEqual(before["ui.scope-b"].Elements.ToArray(), realAdapters["ui.scope-b"].GetCurrentLayoutState().Elements.ToArray());
            Assert.IsTrue(session.GetStatus().IsDirty);
        }));
    }

    [TestMethod]
    public void NativeTargetSelectionSelectsRegistryIdAndSuppressesBusinessCommands()
    {
        StaTest.Run(() =>
        {
            var scope = new Grid();
            var registered = new Button();
            var unregisteredBusinessButton = new Button();
            var registry = new UiElementRegistry([
                new("scope", "scope", null, UiElementKind.Scope, "Bereich", 0, UiCapability.None, scope),
                new("scope.action", "scope", "scope", UiElementKind.Button, "Aktion", 10, UiCapability.None, registered)
            ]);
            var businessExecutions = 0;
            registered.Click += (_, _) => businessExecutions++;
            unregisteredBusinessButton.Click += (_, _) => businessExecutions++;
            using var selection = new TargetAppSelectionService([registry], [unregisteredBusinessButton]);
            TargetAppElementSelectedEventArgs? selected = null;
            var rejected = false;
            selection.ElementSelected += (_, args) => selected = args;
            selection.SelectionRejected += (_, _) => rejected = true;

            selection.Begin();
            RaisePreviewClick(registered);
            Assert.IsFalse(selection.IsActive);
            Assert.IsNotNull(selected);
            Assert.AreEqual("scope", selected.ScopeId);
            Assert.AreEqual("scope.action", selected.ElementId);
            Assert.AreEqual(0, businessExecutions, "Der Auswahlklick darf den registrierten Fachbutton nicht ausführen.");

            selection.Begin();
            RaisePreviewClick(unregisteredBusinessButton);
            Assert.IsTrue(selection.IsActive, "Eine abgelehnte Auswahl muss den Auswahlmodus erhalten.");
            Assert.IsTrue(rejected);
            Assert.AreEqual(0, businessExecutions, "Ein nicht registrierter Fachbutton muss im Auswahlmodus blockiert werden.");
            selection.Cancel();
            unregisteredBusinessButton.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            Assert.AreEqual(1, businessExecutions, "Außerhalb des Auswahlmodus muss der Fachbutton normal funktionieren.");
            selection.Begin();
            selection.Dispose();
            Assert.IsFalse(selection.IsActive, "Beim Schließen muss ein aktiver Auswahlmodus beendet werden.");
        });
    }

    [TestMethod]
    public async Task FullOperationDiagnosticUsesRealProcessesAndLeavesNoArtifacts()
    {
        var executable = Path.Combine(AppContext.BaseDirectory, "ReferenceTargetApp.exe");
        using var process = Process.Start(new ProcessStartInfo
        {
            FileName = executable,
            UseShellExecute = false,
            WorkingDirectory = AppContext.BaseDirectory,
            ArgumentList = { "--ui-full-operation-diagnostic" }
        });
        Assert.IsNotNull(process);
        await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(90));
        Assert.AreEqual(0, process.ExitCode);
        var diagnostics = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "UI-Editor-kit", "ReferenceTargetApp", "diagnostics");
        Assert.IsFalse(Directory.Exists(diagnostics) && Directory.EnumerateFiles(diagnostics, "*", SearchOption.AllDirectories).Any());
        Assert.IsEmpty(Process.GetProcessesByName("ReferenceTargetApp"));
        Assert.IsEmpty(Process.GetProcessesByName("node"));
    }

    private static LayoutProfileSession Session(string root, IReadOnlyDictionary<string, IHostAdapter> adapters,
        IReadOnlyDictionary<string, LayoutState> baseline) => new(adapters, baseline,
        new AtomicJsonLayoutProfileStore(root), new ActiveLayoutProfileStore(root), LayoutProfileCatalog.StandardId);

    private static void WithEnvironment(Action<string, IReadOnlyDictionary<string, IHostAdapter>, IReadOnlyDictionary<string, LayoutState>> action)
    {
        var root = Path.Combine(Path.GetTempPath(), "ui-editor-kit-m75-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var adapters = new Dictionary<string, IHostAdapter>(StringComparer.Ordinal)
            {
                ["ui.scope-a"] = CreateAdapter("ui.scope-a", 200, "Text A"),
                ["ui.scope-b"] = CreateAdapter("ui.scope-b", 300, "Text B")
            };
            var baseline = adapters.ToDictionary(pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal);
            action(root, adapters, baseline);
        }
        finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
    }

    private static IHostAdapter CreateAdapter(string scopeId, double width, string businessText)
    {
        var scope = new Grid { Width = 600, Height = 300 };
        var field = new TextBox { Width = width, Height = 30, Text = businessText, Padding = new Thickness(4), FontSize = 14 };
        var registry = new UiElementRegistry([
            new(scopeId, scopeId, null, UiElementKind.Scope, scopeId, 0, UiCapability.None, scope),
            new($"{scopeId}.field", scopeId, scopeId, UiElementKind.InputField, "Feld", 10,
                UiCapability.Position | UiCapability.Width | UiCapability.Height | UiCapability.TextPosition | UiCapability.FontSize | UiCapability.Visibility, field)
        ]);
        return new WpfHostAdapter(registry);
    }

    private static void ChangeWidth(IHostAdapter adapter, string elementId, double width)
    {
        var scope = adapter.GetRegistry().FindById(elementId)!.ScopeId;
        var result = adapter.SubmitChangeRequest(new ChangeRequest(Guid.NewGuid().ToString("N"), elementId,
            HostAdapterOperations.ResizeWidth, new Dictionary<string, object?> { ["width"] = width }, DateTimeOffset.UtcNow, "m75-test", scope));
        Assert.IsTrue(result.Success, result.Message);
    }

    private static double Width(IHostAdapter adapter, string elementId) =>
        adapter.GetCurrentLayoutState().Elements.Single(element => element.ElementId == elementId).Width;

    private static void ChangeVisibility(IHostAdapter adapter, string elementId, bool visible)
    {
        var scope = adapter.GetRegistry().FindById(elementId)!.ScopeId;
        var result = adapter.SubmitChangeRequest(new ChangeRequest(Guid.NewGuid().ToString("N"), elementId,
            HostAdapterOperations.SetVisibility, new Dictionary<string, object?> { ["visible"] = visible },
            DateTimeOffset.UtcNow, "m80-test", scope));
        Assert.IsTrue(result.Success, result.Message);
    }

    private static bool Visible(IHostAdapter adapter, string elementId) =>
        adapter.GetCurrentLayoutState().Elements.Single(element => element.ElementId == elementId).Visible;

    private static LayoutState ReplaceWidth(LayoutState state, string elementId, double width) =>
        new(state.ScopeId, DateTimeOffset.UtcNow, state.Elements.Select(element => element.ElementId == elementId ? element with { Width = width } : element));

    private static void RaisePreviewClick(UIElement element) => element.RaiseEvent(new MouseButtonEventArgs(
        Mouse.PrimaryDevice, Environment.TickCount, MouseButton.Left) { RoutedEvent = UIElement.PreviewMouseDownEvent });

    private static void WaitUntil(Func<bool> predicate, Dispatcher dispatcher, Func<string>? details = null)
    {
        var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(5);
        while (!predicate() && DateTime.UtcNow < deadline)
            dispatcher.Invoke(() => { }, DispatcherPriority.Background);
        Assert.IsTrue(predicate(), $"Erwarteter UI-Zustand wurde nicht erreicht. {details?.Invoke()}");
    }

    private static T Await<T>(Task<T> task)
    {
        if (task.IsCompleted) return task.GetAwaiter().GetResult();
        var frame = new DispatcherFrame();
        _ = task.ContinueWith(_ => frame.Continue = false, CancellationToken.None, TaskContinuationOptions.None, TaskScheduler.Default);
        Dispatcher.PushFrame(frame);
        return task.GetAwaiter().GetResult();
    }

    private static void Await(Task task)
    {
        if (task.IsCompleted) { task.GetAwaiter().GetResult(); return; }
        var frame = new DispatcherFrame();
        _ = task.ContinueWith(_ => frame.Continue = false, CancellationToken.None, TaskContinuationOptions.None, TaskScheduler.Default);
        Dispatcher.PushFrame(frame);
        task.GetAwaiter().GetResult();
    }

    private sealed class FailingHostAdapter(IHostAdapter inner) : IHostAdapter
    {
        internal bool FailNext { get; set; }
        public IUiElementRegistry GetRegistry() => inner.GetRegistry();
        public LayoutState GetCurrentLayoutState() => inner.GetCurrentLayoutState();
        public ChangeResult SubmitChangeRequest(ChangeRequest request)
        {
            if (FailNext)
            {
                FailNext = false;
                return ChangeResult.Rejected(request, HostAdapterErrorCodes.TargetRejectedChange, "Absichtlich provozierter M75-Adapterfehler.");
            }
            return inner.SubmitChangeRequest(request);
        }
    }
}
