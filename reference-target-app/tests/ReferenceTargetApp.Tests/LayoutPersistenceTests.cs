using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.OrderHeader;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.Tests;

[TestClass]
[DoNotParallelize]
public sealed class LayoutPersistenceTests
{
    [TestMethod]
    public void DefaultPathIsUserLocalAndAtomicStoreWritesVersionedNeutralDocument()
    {
        var defaults = LayoutStoragePathResolver.ResolveDefault();
        StringAssert.StartsWith(defaults.RootDirectory,
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), StringComparison.OrdinalIgnoreCase);
        Assert.IsFalse(IsUnder(defaults.RootDirectory, RepositoryRoot()));

        StaTest.Run(() => WithTemporaryStore((store, root) =>
        {
            var adapter = CreateAdapter(out var orderNumber);
            var businessValue = orderNumber.Text;
            var save = store.Save(adapter.GetRegistry(), adapter.GetCurrentLayoutState(),
                new DateTimeOffset(2026, 7, 25, 12, 0, 0, TimeSpan.Zero));

            Assert.IsTrue(save.Success, save.Message);
            Assert.IsTrue(Directory.Exists(root));
            Assert.IsTrue(File.Exists(store.FilePath));
            Assert.IsEmpty(Directory.GetFiles(root, "*.tmp"));

            var json = File.ReadAllText(store.FilePath);
            StringAssert.Contains(json, "\"schemaVersion\": 1");
            StringAssert.Contains(json, "\"applicationId\": \"reference-target-app\"");
            StringAssert.Contains(json, "\"profileId\": \"order-header-default\"");
            StringAssert.Contains(json, "\"registryFingerprint\": \"sha256:");
            Assert.IsFalse(json.Contains(businessValue, StringComparison.Ordinal));
            Assert.IsFalse(json.Contains("nativeElement", StringComparison.OrdinalIgnoreCase));
            Assert.IsFalse(json.Contains("command", StringComparison.OrdinalIgnoreCase));
            Assert.IsFalse(json.Contains("businessData", StringComparison.OrdinalIgnoreCase));

            var load = store.Load(adapter.GetRegistry());
            Assert.IsTrue(load.Success, load.Message);
            Assert.IsTrue(load.Found);
            Assert.AreEqual(PersistedLayoutDocumentFactory.SchemaVersion, load.Document!.SchemaVersion);
            Assert.HasCount(adapter.GetRegistry().Entries.Count, load.Document.LayoutState.Elements);
        }));
    }

    [TestMethod]
    public void StoreHandlesMissingCorruptIncompatibleAndForbiddenDocumentsWithoutMutation()
    {
        StaTest.Run(() => WithTemporaryStore((store, _) =>
        {
            var adapter = CreateAdapter(out var _unusedOrderNumber);
            var registry = adapter.GetRegistry();
            var missing = store.Load(registry);
            Assert.IsTrue(missing.Success);
            Assert.IsFalse(missing.Found);
            Assert.AreEqual("layout_not_found", missing.Code);

            File.WriteAllText(store.FilePath, "{not-json");
            Assert.AreEqual("invalid_json", store.Load(registry).Code);

            Assert.IsTrue(store.Save(registry, adapter.GetCurrentLayoutState()).Success);
            AssertRejectedMutation(store, registry, root => root["schemaVersion"] = 99, "unsupported_schema_version");
            AssertRejectedMutation(store, registry, root => root["applicationId"] = "other-app", "wrong_application");
            AssertRejectedMutation(store, registry, root => root["profileId"] = "other-profile", "wrong_profile");
            AssertRejectedMutation(store, registry, root => root["scopeId"] = "ui.other", "wrong_scope");
            AssertRejectedMutation(store, registry, root => root["registryFingerprint"] = "sha256:wrong", "incompatible_registry");
            AssertRejectedMutation(store, registry, root =>
                root["layoutState"]!["elements"]![0]!["elementId"] = "ui.order-header.unknown", "unknown_element");
            AssertRejectedMutation(store, registry, root => root["businessData"] = "forbidden", "forbidden_field");
            AssertRejectedMutation(store, registry, root =>
            {
                var element = FindElement(root, OrderHeaderRegistryIds.OrderNumber);
                element["width"] = -1;
            }, "invalid_layout_value");

            Assert.IsTrue(store.Save(registry, adapter.GetCurrentLayoutState()).Success);
            var oversizedNumber = File.ReadAllText(store.FilePath)
                .Replace("\"width\": 200", "\"width\": 1e999", StringComparison.Ordinal);
            File.WriteAllText(store.FilePath, oversizedNumber);
            var nonFinite = store.Load(registry);
            Assert.IsFalse(nonFinite.Success);
            Assert.AreEqual("invalid_layout_value", nonFinite.Code);
        }));
    }

    [TestMethod]
    public void AtomicWriteFailureLeavesNoPartialTargetOrTemporaryFile()
    {
        StaTest.Run(() => WithTemporaryStore((store, root) =>
        {
            var adapter = CreateAdapter(out _);
            Assert.IsTrue(store.Save(adapter.GetRegistry(), adapter.GetCurrentLayoutState()).Success);
            var original = File.ReadAllText(store.FilePath);
            using (var lockedTarget = new FileStream(store.FilePath, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                var save = store.Save(adapter.GetRegistry(), adapter.GetCurrentLayoutState());
                Assert.IsFalse(save.Success);
                Assert.AreEqual("storage_write_failed", save.Code);
            }
            Assert.AreEqual(original, File.ReadAllText(store.FilePath));
            Assert.IsEmpty(Directory.GetFiles(root, "*.tmp"));
        }));
    }

    [TestMethod]
    public void FingerprintIsStableAndChangesWithContractRelevantRegistryData()
    {
        StaTest.Run(() =>
        {
            var adapter = CreateAdapter(out _);
            var first = RegistryFingerprint.Create(adapter.GetRegistry());
            var second = RegistryFingerprint.Create(adapter.GetRegistry());
            Assert.AreEqual(first, second);

            var entries = adapter.GetRegistry().Entries.Select(entry =>
                entry.ElementId == OrderHeaderRegistryIds.OrderNumber
                    ? entry with { Capabilities = entry.Capabilities & ~UiCapability.FontSize }
                    : entry).ToArray();
            var changed = RegistryFingerprint.Create(new UiElementRegistry(entries));
            Assert.AreNotEqual(first, changed);
        });
    }

    [TestMethod]
    public void RestoreAppliesMultipleChangesOnlyThroughHostAdapterAndPreservesBusinessState()
    {
        StaTest.Run(() => WithTemporaryStore((store, _) =>
        {
            var adapter = CreateAdapter(out var orderNumber);
            var activity = "unchanged";
            var businessValue = orderNumber.Text;
            var document = PersistedLayoutDocumentFactory.Create(
                store.Options, adapter.GetRegistry(), adapter.GetCurrentLayoutState(), DateTimeOffset.UtcNow);
            document = document with
            {
                LayoutState = new PersistedLayoutState(document.LayoutState.Elements.Select(element => element.ElementId switch
                {
                    OrderHeaderRegistryIds.OrderNumber => element with { Width = element.Width + 31, TextOffsetX = element.TextOffsetX + 2 },
                    OrderHeaderRegistryIds.Subject => element with { X = element.X + 9, FontSize = element.FontSize + 3 },
                    _ => element
                }).ToArray())
            };

            var recording = new RecordingHostAdapter(adapter);
            var result = new LayoutRestoreCoordinator(recording).Restore(document, store.Options);

            Assert.IsTrue(result.Success, result.Message);
            Assert.IsGreaterThan(2, recording.Requests.Count);
            Assert.AreEqual(document.LayoutState.Elements.Single(e => e.ElementId == OrderHeaderRegistryIds.OrderNumber).Width,
                adapter.GetCurrentLayoutState().Elements.Single(e => e.ElementId == OrderHeaderRegistryIds.OrderNumber).Width);
            Assert.AreEqual(businessValue, orderNumber.Text);
            Assert.AreEqual("unchanged", activity);
            Assert.IsTrue(recording.Requests.All(request => request.Source == "layout-restore"));
            var allowedOperations = new HashSet<string>(StringComparer.Ordinal)
            {
                HostAdapterOperations.Move,
                HostAdapterOperations.Resize,
                HostAdapterOperations.ResizeWidth,
                HostAdapterOperations.ResizeHeight,
                HostAdapterOperations.TextMove,
                HostAdapterOperations.TextResize,
                HostAdapterOperations.SpacingSet
            };
            Assert.IsTrue(recording.Requests.All(request => allowedOperations.Contains(request.Operation)));
        }));
    }

    [TestMethod]
    public void MidBatchFailureRollsBackCompleteStateAndRollbackFailureIsStructured()
    {
        StaTest.Run(() => WithTemporaryStore((store, _) =>
        {
            var real = CreateAdapter(out var _unusedOrderNumber);
            var baseline = real.GetCurrentLayoutState();
            var document = PersistedLayoutDocumentFactory.Create(store.Options, real.GetRegistry(), baseline, DateTimeOffset.UtcNow);
            document = document with
            {
                LayoutState = new PersistedLayoutState(document.LayoutState.Elements.Select(element =>
                    element.ElementId == OrderHeaderRegistryIds.OrderNumber
                        ? element with { Width = element.Width + 20 }
                        : element).ToArray())
            };

            var failOnce = new ScriptedHostAdapter(real, [4]);
            var rolledBack = new LayoutRestoreCoordinator(failOnce).Restore(document, store.Options);
            Assert.IsFalse(rolledBack.Success);
            Assert.IsTrue(rolledBack.RollbackSucceeded, rolledBack.Message);
            CollectionAssert.AreEqual(baseline.Elements.ToArray(), real.GetCurrentLayoutState().Elements.ToArray());

            var failRollback = new ScriptedHostAdapter(real, [4, 7]);
            var rollbackFailed = new LayoutRestoreCoordinator(failRollback).Restore(document, store.Options);
            Assert.IsFalse(rollbackFailed.Success);
            Assert.IsFalse(rollbackFailed.RollbackSucceeded);
            Assert.AreEqual("rollback_failed", rollbackFailed.Code);
            Assert.IsGreaterThanOrEqualTo(2, rollbackFailed.Failures.Count);
        }));
    }

    [TestMethod]
    public void RestoreCreatesSeparatedResizeRequestsWhenCombinedResizeIsNotAllowed()
    {
        StaTest.Run(() =>
        {
            var entry = new UiRegistryEntry(
                "pilot.field", "pilot.root", "pilot.root", UiElementKind.InputField, "Pilotfeld", 1,
                UiCapability.Width | UiCapability.Height, new Border(), "field", "dataFieldLayout",
                [HostAdapterOperations.ResizeWidth, HostAdapterOperations.ResizeHeight], []);
            var desired = new PersistedElementLayout(
                entry.ElementId, entry.ScopeId, null, null, 320, 64, null, null, null, true);
            var sequence = 1;

            var requests = LayoutRestoreCoordinator.CreateRequests(entry, desired, "test", ref sequence);

            CollectionAssert.AreEqual(
                new[] { HostAdapterOperations.ResizeWidth, HostAdapterOperations.ResizeHeight },
                requests.Select(request => request.Operation).ToArray());
        });
    }

    [TestMethod]
    public async Task DiagnosticUsesTwoRealAppProcessesAndCleansProfileAndProcesses()
    {
        var executable = Path.Combine(AppContext.BaseDirectory, "ReferenceTargetApp.exe");
        Assert.IsTrue(File.Exists(executable));
        var process = Process.Start(new ProcessStartInfo
        {
            FileName = executable,
            UseShellExecute = false,
            WorkingDirectory = AppContext.BaseDirectory,
            ArgumentList = { "--layout-persistence-diagnostic" }
        });
        Assert.IsNotNull(process);
        using (process)
        {
            await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(30));
            Assert.AreEqual(0, process.ExitCode);
        }

        var diagnosticRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "UI-Editor-kit", "ReferenceTargetApp", "diagnostics");
        Assert.IsFalse(Directory.Exists(diagnosticRoot) && Directory.EnumerateFileSystemEntries(diagnosticRoot).Any());
        Assert.IsEmpty(Process.GetProcessesByName("ReferenceTargetApp"));
        Assert.IsEmpty(Process.GetProcessesByName("node"));
    }

    private static void AssertRejectedMutation(
        AtomicJsonLayoutStore store,
        IUiElementRegistry registry,
        Action<JsonObject> mutate,
        string expectedCode)
    {
        Assert.IsTrue(store.Save(registry, CreateAdapter(out _).GetCurrentLayoutState()).Success);
        var root = JsonNode.Parse(File.ReadAllText(store.FilePath))!.AsObject();
        mutate(root);
        File.WriteAllText(store.FilePath, root.ToJsonString());
        var result = store.Load(registry);
        Assert.IsFalse(result.Success);
        Assert.AreEqual(expectedCode, result.Code, result.Message);
    }

    private static JsonObject FindElement(JsonObject root, string elementId) =>
        root["layoutState"]!["elements"]!.AsArray()
            .Select(node => node!.AsObject())
            .Single(node => node["elementId"]!.GetValue<string>() == elementId);

    private static IHostAdapter CreateAdapter(out TextBox orderNumber)
    {
        static T Size<T>(T element, double width, double height) where T : FrameworkElement
        {
            element.Width = width;
            element.Height = height;
            return element;
        }

        orderNumber = Size(new TextBox { Text = "AU-2026-0471", FontSize = 14, Padding = new Thickness(4, 2, 4, 2) }, 200, 30);
        var registry = new OrderHeaderRegistryFactory().Create(new OrderHeaderElementReferences(
            Size(new GroupBox(), 800, 300),
            Size(new Grid(), 760, 220),
            orderNumber,
            Size(new TextBox { Text = "24.07.2026", Padding = new Thickness(4) }, 180, 30),
            Size(new TextBox { Text = "14.08.2026", Padding = new Thickness(4) }, 180, 30),
            Size(new TextBox { Text = "Betreff", Padding = new Thickness(4) }, 400, 30),
            Size(new TextBox { Text = "Daniel Krüger", Padding = new Thickness(4) }, 200, 30),
            Size(new Border { Padding = new Thickness(4) }, 140, 30)));
        return new WpfHostAdapter(registry);
    }

    private static void WithTemporaryStore(Action<AtomicJsonLayoutStore, string> action)
    {
        var root = Path.Combine(Path.GetTempPath(), "ui-editor-kit-m735-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try { action(new AtomicJsonLayoutStore(LayoutStoragePathResolver.ForRoot(root)), root); }
        finally { if (Directory.Exists(root)) Directory.Delete(root, recursive: true); }
    }

    private static bool IsUnder(string candidate, string parent)
    {
        var relative = Path.GetRelativePath(Path.GetFullPath(parent), Path.GetFullPath(candidate));
        return relative != ".." && !relative.StartsWith($"..{Path.DirectorySeparatorChar}", StringComparison.Ordinal);
    }

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "package.json"))) directory = directory.Parent;
        return directory?.FullName ?? throw new DirectoryNotFoundException();
    }

    private sealed class RecordingHostAdapter(IHostAdapter inner) : IHostAdapter
    {
        public List<ChangeRequest> Requests { get; } = [];
        public IUiElementRegistry GetRegistry() => inner.GetRegistry();
        public LayoutState GetCurrentLayoutState() => inner.GetCurrentLayoutState();
        public ChangeResult SubmitChangeRequest(ChangeRequest changeRequest)
        {
            Requests.Add(changeRequest);
            return inner.SubmitChangeRequest(changeRequest);
        }
    }

    private sealed class ScriptedHostAdapter(IHostAdapter inner, IReadOnlyCollection<int> failingCalls) : IHostAdapter
    {
        private int calls;
        public IUiElementRegistry GetRegistry() => inner.GetRegistry();
        public LayoutState GetCurrentLayoutState() => inner.GetCurrentLayoutState();
        public ChangeResult SubmitChangeRequest(ChangeRequest request)
        {
            calls++;
            if (failingCalls.Contains(calls))
                return ChangeResult.Rejected(request, HostAdapterErrorCodes.TargetRejectedChange, $"Absichtlicher Fehler in Aufruf {calls}.");
            return inner.SubmitChangeRequest(request);
        }
    }
}
