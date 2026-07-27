using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using ReferenceTargetApp.EditorIntegration.Electron;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Pdf;
using ReferenceTargetApp.EditorIntegration.Registry;
using ReferenceTargetApp.UI.Editor;

namespace ReferenceTargetApp.Tests;

[TestClass]
[DoNotParallelize]
public sealed class M811ProfileRecoveryTests
{
    [TestMethod]
    public void CompatibleUiProfileRestoresAndBaselineStartsCleanWithoutAutosave()
    {
        StaTest.Run(() => WithRoot(root =>
        {
            var adapters = Adapters(("ui.a", 200d));
            var store = new AtomicJsonLayoutProfileStore(root, "bbm-produktiv");
            Assert.IsTrue(Await(store.SaveAsync("standard", adapters, States(adapters))).Success);
            var inspection = Await(new LayoutProfileRecoveryService(adapters, store).InspectAsync("standard"));
            Assert.AreEqual(ProfileCompatibilityState.Compatible, inspection.State);
            var startup = Await(new LayoutProfileStartupCoordinator(adapters, store, new ActiveLayoutProfileStore(root)).RestoreAsync());
            Assert.IsTrue(startup.Success, startup.Message);
            Assert.IsFalse(startup.Session.GetStatus().IsDirty);

            File.Delete(store.GetFilePath("standard"));
            var baseline = Await(new LayoutProfileStartupCoordinator(adapters, store, new ActiveLayoutProfileStore(root)).RestoreAsync());
            Assert.IsTrue(baseline.Success);
            Assert.AreEqual("layout_profile_not_found", baseline.Code);
            Assert.IsFalse(baseline.Session.GetStatus().IsDirty);
            Assert.IsFalse(File.Exists(store.GetFilePath("standard")), "Baseline darf kein Profil automatisch speichern.");
        }));
    }

    [TestMethod]
    public void CompatibleRemoteNormalizationStartsCleanWithoutRewritingProfile()
    {
        StaTest.Run(() => WithRoot(root =>
        {
            var source = Adapters(("ui.a", 200.4d));
            var store = new AtomicJsonLayoutProfileStore(root, "bbm-produktiv");
            Assert.IsTrue(Await(store.SaveAsync("standard", source, States(source))).Success);
            var path = store.GetFilePath("standard");
            var original = File.ReadAllBytes(path);

            var target = new NormalizingAsyncHostAdapter(Adapter("ui.a", 320.4d));
            var adapters = new Dictionary<string, IHostAdapter>(StringComparer.Ordinal) { ["ui.a"] = target };
            var startup = Await(new LayoutProfileStartupCoordinator(
                adapters, store, new ActiveLayoutProfileStore(root), allowCompatibleRegistryReconciliation: false).RestoreAsync());

            Assert.IsTrue(startup.Success, startup.Message);
            Assert.IsFalse(startup.Session.GetStatus().IsDirty,
                "Eine erfolgreiche Zielnormalisierung darf den soeben geladenen Profilstand nicht sofort als ungespeichert markieren.");
            Assert.AreEqual(200d, target.GetCurrentLayoutState().Elements.Single(element => element.ElementId == "ui.a.field").Width);
            CollectionAssert.AreEqual(original, File.ReadAllBytes(path), "Restore darf das Profil nicht automatisch neu schreiben.");
        }));
    }

    [TestMethod]
    public void IncompatibleUiProfileIsArchivedByteIdenticallyAndNewSaveIsValid()
    {
        StaTest.Run(() => WithRoot(root =>
        {
            var oldAdapters = Adapters(("ui.a", 200d));
            var store = new AtomicJsonLayoutProfileStore(root, "bbm-produktiv");
            Assert.IsTrue(Await(store.SaveAsync("standard", oldAdapters, States(oldAdapters))).Success);
            var path = store.GetFilePath("standard");
            var bytes = File.ReadAllBytes(path);
            var current = ChangedAdapter("ui.a", 200d);
            var adapters = new Dictionary<string, IHostAdapter>(StringComparer.Ordinal) { ["ui.a"] = current };
            var recovery = new LayoutProfileRecoveryService(adapters, store);
            var inspection = Await(recovery.InspectAsync("standard"));
            Assert.AreEqual(ProfileCompatibilityState.Incompatible, inspection.State);
            Assert.IsFalse(inspection.MigrationAvailable);
            var context = Context("ui", inspection.CurrentFingerprint);
            var archived = Await(new ProfileArchiveService(root).ArchiveAsync(inspection, context, "baseline-start"));
            Assert.IsTrue(archived.Success, archived.Message);
            Assert.AreEqual(ProfileCompatibilityState.Archived, archived.State);
            CollectionAssert.AreEqual(bytes, File.ReadAllBytes(archived.ArchivePath!));
            Assert.IsFalse(File.Exists(path));
            Assert.IsTrue(File.Exists(archived.MetadataPath!));

            var startup = Await(new LayoutProfileStartupCoordinator(adapters, store, new ActiveLayoutProfileStore(root)).RestoreAsync());
            Assert.IsTrue(startup.Success);
            Assert.IsFalse(startup.Session.GetStatus().IsDirty);
            Assert.IsTrue(Await(startup.Session.SaveAsync()).Success);
            Assert.IsTrue((Await(store.LoadAsync("standard", adapters))).Success);
        }));
    }

    [TestMethod]
    public void SafeMigrationOnlyAddsNewScopesAndArchivesSource()
    {
        StaTest.Run(() => WithRoot(root =>
        {
            var sourceAdapters = Adapters(("ui.a", 200d));
            var store = new AtomicJsonLayoutProfileStore(root, "bbm-produktiv");
            Assert.IsTrue(Await(store.SaveAsync("standard", sourceAdapters, States(sourceAdapters))).Success);
            var sourceBytes = File.ReadAllBytes(store.GetFilePath("standard"));
            var currentAdapters = Adapters(("ui.a", 200d), ("ui.b", 300d));
            var recovery = new LayoutProfileRecoveryService(currentAdapters, store);
            var inspection = Await(recovery.InspectAsync("standard"));
            Assert.AreEqual(ProfileCompatibilityState.MigrationAvailable, inspection.State);
            Assert.IsTrue(inspection.MigrationAvailable);
            StringAssert.Contains(inspection.MigrationReport, "ui.a");
            StringAssert.Contains(inspection.MigrationReport, "ui.b");
            var migrated = Await(recovery.MigrateAsync(inspection, "standard", new ProfileArchiveService(root),
                Context("ui", inspection.CurrentFingerprint)));
            Assert.IsTrue(migrated.Success, migrated.Message);
            var loaded = Await(store.LoadAsync("standard", currentAdapters));
            Assert.IsTrue(loaded.Success);
            Assert.HasCount(2, loaded.Document!.Scopes);
            var archive = Directory.GetFiles(Path.Combine(root, "archive", "bbm-produktiv"), "*standard.layout-profile.json")
                .Single(path => !path.EndsWith(".metadata.json", StringComparison.Ordinal));
            CollectionAssert.AreEqual(sourceBytes, File.ReadAllBytes(archive));
        }));
    }

    [TestMethod]
    public void ParentOrCapabilityChangeIsNotMigratedAutomatically()
    {
        StaTest.Run(() => WithRoot(root =>
        {
            var sourceAdapters = Adapters(("ui.a", 200d));
            var store = new AtomicJsonLayoutProfileStore(root, "bbm-produktiv");
            Assert.IsTrue(Await(store.SaveAsync("standard", sourceAdapters, States(sourceAdapters))).Success);
            var changed = ChangedAdapter("ui.a", 200d);
            var current = new Dictionary<string, IHostAdapter>(StringComparer.Ordinal) { ["ui.a"] = changed };
            var inspection = Await(new LayoutProfileRecoveryService(current, store).InspectAsync("standard"));
            Assert.AreEqual(ProfileCompatibilityState.Incompatible, inspection.State);
            Assert.IsFalse(inspection.MigrationAvailable);
        }));
    }

    [TestMethod]
    public void CorruptJsonAndArchiveFailureLeaveOriginalUntouched()
    {
        StaTest.Run(() => WithRoot(root =>
        {
            var adapters = Adapters(("ui.a", 200d));
            var store = new AtomicJsonLayoutProfileStore(root, "bbm-produktiv");
            var path = store.GetFilePath("standard");
            File.WriteAllText(path, "{broken-json");
            var bytes = File.ReadAllBytes(path);
            var inspection = Await(new LayoutProfileRecoveryService(adapters, store).InspectAsync("standard"));
            Assert.AreEqual(ProfileCompatibilityState.Corrupt, inspection.State);
            using (new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.None))
            {
                var archived = Await(new ProfileArchiveService(root).ArchiveAsync(inspection, Context("ui", inspection.CurrentFingerprint), "baseline-start"));
                Assert.IsFalse(archived.Success);
                Assert.AreEqual(ElectronEditorErrorCodes.ProfileArchiveFailed, archived.Code);
            }
            CollectionAssert.AreEqual(bytes, File.ReadAllBytes(path));
            Assert.IsFalse(Directory.Exists(Path.Combine(root, "archive")) &&
                           Directory.EnumerateFiles(Path.Combine(root, "archive"), "*", SearchOption.AllDirectories).Any());
        }));
    }

    [TestMethod]
    public void CancelChangesNoFileAndLaterBaselineOpenSucceeds()
    {
        StaTest.Run(() => WithRoot(root =>
        {
            var source = Adapters(("ui.a", 200d));
            var store = new AtomicJsonLayoutProfileStore(root, "bbm-produktiv");
            Assert.IsTrue(Await(store.SaveAsync("standard", source, States(source))).Success);
            var path = store.GetFilePath("standard");
            var bytes = File.ReadAllBytes(path);
            var current = new Dictionary<string, IHostAdapter>(StringComparer.Ordinal) { ["ui.a"] = ChangedAdapter("ui.a", 200d) };
            var cancelled = Assert.ThrowsExactly<ElectronEditorException>(() => Await(new ProfileRecoveryWorkflow(
                new FixedPrompt(ProfileRecoveryDecision.Cancel)).PrepareUiAsync(current, store, new ActiveLayoutProfileStore(root),
                Context("ui", "current"), CancellationToken.None)));
            Assert.AreEqual(ElectronEditorErrorCodes.ProfileUserCancelled, cancelled.Code);
            CollectionAssert.AreEqual(bytes, File.ReadAllBytes(path));

            var opened = Await(new ProfileRecoveryWorkflow(new FixedPrompt(ProfileRecoveryDecision.Baseline)).PrepareUiAsync(
                current, store, new ActiveLayoutProfileStore(root), Context("ui", "current"), CancellationToken.None));
            Assert.IsTrue(opened.Startup.Success);
            Assert.AreEqual(ElectronEditorErrorCodes.ProfileBaselineStarted, opened.Startup.Code);
            Assert.IsFalse(opened.Startup.Session.GetStatus().IsDirty);
        }));
    }

    [TestMethod]
    public void PdfProfileClassificationRemainsIndependentFromUiProfile()
    {
        StaTest.Run(() =>
        {
            var root = NewRoot();
            try
            {
                var registry = PdfOrderDocumentRegistryFactory.Create();
                var adapter = new PdfHostAdapter(registry);
                var store = new AtomicJsonPdfLayoutProfileStore(root);
                Assert.IsTrue(Await(store.SaveAsync(registry, adapter.GetCurrentLayoutState())).Success);
                var compatible = Await(new PdfProfileRecoveryService(store).InspectAsync(registry));
                Assert.AreEqual(ProfileCompatibilityState.Compatible, compatible.State);

                var json = JsonNode.Parse(File.ReadAllText(store.FilePath))!.AsObject();
                json["registryFingerprint"] = "sha256:" + new string('0', 64);
                File.WriteAllText(store.FilePath, json.ToJsonString());
                var incompatible = Await(new PdfProfileRecoveryService(store).InspectAsync(registry));
                Assert.AreEqual(ProfileCompatibilityState.Incompatible, incompatible.State);
                Assert.AreEqual(ElectronEditorErrorCodes.ProfileIncompatible, incompatible.Code);

                var uiAdapters = Adapters(("ui.a", 200d));
                var uiStore = new AtomicJsonLayoutProfileStore(root, "bbm-produktiv");
                Assert.IsTrue(Await(uiStore.SaveAsync("standard", uiAdapters, States(uiAdapters))).Success);
                var ui = Await(new LayoutProfileRecoveryService(uiAdapters, uiStore).InspectAsync("standard"));
                Assert.AreEqual(ProfileCompatibilityState.Compatible, ui.State, "Ein inkompatibles PDF-Profil darf das UI-Profil nicht blockieren.");
            }
            finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
        });
    }

    [TestMethod]
    public void DialogContractContainsRequiredSafeActionsAndNoEditorRegistration()
    {
        var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
        var xaml = File.ReadAllText(Path.Combine(root, "src", "ReferenceTargetApp.Wpf", "UI", "Views", "ProfileRecoveryDialog.xaml"));
        StringAssert.Contains(xaml, "Gespeichertes Editorlayout ist nicht mehr kompatibel");
        StringAssert.Contains(xaml, "Mit Standardlayout öffnen");
        StringAssert.Contains(xaml, "Details anzeigen");
        StringAssert.Contains(xaml, "Abbrechen");
        StringAssert.Contains(xaml, "Profil migrieren und öffnen");
        Assert.IsFalse(xaml.Contains("data-ui-editor", StringComparison.Ordinal));
    }

    private static ProfileRecoveryContext Context(string workspace, string fingerprint) =>
        new("bbm-produktiv", workspace, "1.2", "3", fingerprint, workspace == "pdf" ? "bbm-protocol" : null);

    private static IReadOnlyDictionary<string, IHostAdapter> Adapters(params (string Scope, double Width)[] definitions) =>
        definitions.ToDictionary(item => item.Scope, item => Adapter(item.Scope, item.Width), StringComparer.Ordinal);

    private static IHostAdapter Adapter(string scopeId, double width)
    {
        var root = new Grid { Width = 600, Height = 300 };
        var field = new TextBox { Width = width, Height = 30, Text = "Fachwert bleibt unverändert" };
        return new WpfHostAdapter(new UiElementRegistry([
            new(scopeId, scopeId, null, UiElementKind.Scope, scopeId, 0, UiCapability.None, root),
            new($"{scopeId}.field", scopeId, scopeId, UiElementKind.InputField, "Feld", 10,
                UiCapability.Width | UiCapability.Height | UiCapability.Visibility, field)
        ]));
    }

    private static IHostAdapter ChangedAdapter(string scopeId, double width)
    {
        var root = new Grid { Width = 600, Height = 300 };
        var group = new Border { Width = 400, Height = 100 };
        var field = new TextBox { Width = width, Height = 30, Text = "Fachwert bleibt unverändert" };
        return new WpfHostAdapter(new UiElementRegistry([
            new(scopeId, scopeId, null, UiElementKind.Scope, scopeId, 0, UiCapability.None, root),
            new($"{scopeId}.group", scopeId, scopeId, UiElementKind.Group, "Gruppe", 5, UiCapability.Width, group),
            new($"{scopeId}.field", scopeId, $"{scopeId}.group", UiElementKind.InputField, "Feld", 10,
                UiCapability.Width | UiCapability.Visibility, field)
        ]));
    }

    private static IReadOnlyDictionary<string, LayoutState> States(IReadOnlyDictionary<string, IHostAdapter> adapters) =>
        adapters.ToDictionary(pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal);

    private static string NewRoot()
    {
        var root = Path.Combine(Path.GetTempPath(), "ui-editor-kit-m81-1-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        return root;
    }

    private static void WithRoot(Action<string> action)
    {
        var root = NewRoot();
        try { action(root); }
        finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
    }

    private static T Await<T>(Task<T> task)
    {
        if (task.IsCompleted) return task.GetAwaiter().GetResult();
        var frame = new DispatcherFrame();
        _ = task.ContinueWith(_ => frame.Continue = false, CancellationToken.None,
            TaskContinuationOptions.None, TaskScheduler.Default);
        Dispatcher.PushFrame(frame);
        return task.GetAwaiter().GetResult();
    }

    private sealed class FixedPrompt(ProfileRecoveryDecision decision) : IProfileRecoveryPrompt
    {
        public ProfileRecoveryDecision Ask(ProfileInspection inspection) => decision;
    }

    private sealed class NormalizingAsyncHostAdapter(IHostAdapter inner) : IAsyncHostAdapter
    {
        private LayoutState state = inner.GetCurrentLayoutState();

        public IUiElementRegistry GetRegistry() => inner.GetRegistry();

        public LayoutState GetCurrentLayoutState() => new(
            state.ScopeId,
            state.CapturedAt,
            state.Elements.Select(element => element with { }).ToArray());

        public ChangeResult SubmitChangeRequest(ChangeRequest changeRequest) =>
            throw new InvalidOperationException("Der Testadapter wird ausschliesslich asynchron verwendet.");

        public Task<ChangeResult> SubmitChangeRequestAsync(ChangeRequest changeRequest, CancellationToken cancellationToken = default)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var result = inner.SubmitChangeRequest(changeRequest);
            if (!result.Success || result.NewState is null) return Task.FromResult(result);

            var previous = state.Elements.Single(element => element.ElementId == changeRequest.ElementId);
            var returned = result.NewState;
            var normalized = returned with
            {
                X = changeRequest.Operation == HostAdapterOperations.Move ? returned.X : previous.X,
                Y = changeRequest.Operation == HostAdapterOperations.Move ? returned.Y : previous.Y,
                Width = changeRequest.Operation is HostAdapterOperations.Resize or HostAdapterOperations.ResizeWidth
                    ? Math.Round(returned.Width)
                    : previous.Width,
                Height = changeRequest.Operation is HostAdapterOperations.Resize or HostAdapterOperations.ResizeHeight
                    ? returned.Height
                    : previous.Height,
                TextOffsetX = changeRequest.Operation == HostAdapterOperations.TextMove ? returned.TextOffsetX : previous.TextOffsetX,
                TextOffsetY = changeRequest.Operation == HostAdapterOperations.TextMove ? returned.TextOffsetY : previous.TextOffsetY,
                FontSize = changeRequest.Operation == HostAdapterOperations.TextResize ? returned.FontSize : previous.FontSize,
                Visible = changeRequest.Operation == HostAdapterOperations.SetVisibility ? returned.Visible : previous.Visible
            };
            state = new LayoutState(state.ScopeId, DateTimeOffset.UtcNow,
                state.Elements.Select(element => element.ElementId == normalized.ElementId ? normalized : element).ToArray());
            return Task.FromResult(result with { PreviousState = previous, NewState = normalized });
        }
    }
}
