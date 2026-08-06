using System.IO;
using System.Windows.Controls;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class M8623SaveCloseAcknowledgementTests
{
    [TestMethod]
    public void PersistentSnapshotIsWrittenBeforeAcknowledgementAndSuccessfulAckMakesSessionClean()
    {
        StaTest.Run(() =>
        {
            var fixture = CreateFixture();
            try
            {
                Resize(fixture.Adapter, 148);
                fixture.Session.RecordExplicitOperation("scope", "field", HostAdapterOperations.ResizeWidth);
                var callbackReached = false;
                fixture.Session.ConfigureSaveAcknowledgement((snapshot, _) =>
                {
                    callbackReached = true;
                    Assert.IsTrue(File.Exists(fixture.Store.GetFilePath(LayoutProfileCatalog.StandardId)),
                        "Das Profil muss vor dem Acknowledgement persistent vorhanden sein.");
                    Assert.AreEqual("app", snapshot.Document.ApplicationId);
                    Assert.AreEqual(148, snapshot.Document.Scopes.Single().LayoutState.Elements.Single(item => item.ElementId == "field").Width);
                    Assert.IsTrue(Guid.TryParseExact(snapshot.RequestId, "N", out var parsedRequestId));
                    Assert.AreNotEqual(Guid.Empty, parsedRequestId);
                    return Task.FromResult(new LayoutSaveAcknowledgement(true, "layout_save_acknowledged", "bestätigt"));
                });

                var result = fixture.Session.SaveAsync().GetAwaiter().GetResult();

                Assert.IsTrue(result.Success, result.Message);
                Assert.IsTrue(callbackReached);
                Assert.AreEqual(result.SaveRequestId, fixture.Session.LastAcknowledgedSaveRequestId);
                Assert.IsFalse(fixture.Session.GetStatus().IsDirty);
            }
            finally { fixture.Dispose(); }
        });
    }

    [TestMethod]
    public void FailedAcknowledgementKeepsSessionDirtyAndRetryUsesANewRequestId()
    {
        StaTest.Run(() =>
        {
            var fixture = CreateFixture();
            try
            {
                Resize(fixture.Adapter, 164);
                fixture.Session.RecordExplicitOperation("scope", "field", HostAdapterOperations.ResizeWidth);
                string? rejectedRequestId = null;
                fixture.Session.ConfigureSaveAcknowledgement((snapshot, _) =>
                {
                    rejectedRequestId = snapshot.RequestId;
                    return Task.FromResult(new LayoutSaveAcknowledgement(false, "layout_save_acknowledgement_failed", "abgelehnt"));
                });

                var rejected = fixture.Session.SaveAsync().GetAwaiter().GetResult();

                Assert.IsFalse(rejected.Success);
                Assert.AreEqual("layout_save_acknowledgement_failed", rejected.Code);
                Assert.IsTrue(File.Exists(fixture.Store.GetFilePath(LayoutProfileCatalog.StandardId)),
                    "Der atomare Schreibabschluss liegt vor der fehlgeschlagenen BBM-Bestätigung.");
                Assert.IsTrue(fixture.Session.GetStatus().IsDirty, "Ohne Acknowledgement darf der Editor nicht clean werden.");
                Assert.IsNull(fixture.Session.LastAcknowledgedSaveRequestId);

                fixture.Session.ConfigureSaveAcknowledgement((snapshot, _) =>
                    Task.FromResult(new LayoutSaveAcknowledgement(true, "layout_save_acknowledged", "bestätigt")));
                var retry = fixture.Session.SaveAsync().GetAwaiter().GetResult();

                Assert.IsTrue(retry.Success, retry.Message);
                Assert.AreNotEqual(rejectedRequestId, retry.SaveRequestId);
                Assert.IsFalse(fixture.Session.GetStatus().IsDirty);
            }
            finally { fixture.Dispose(); }
        });
    }

    [TestMethod]
    public void CloseFlowAwaitsSaveResultBeforeDeclaringSavedAndClosing()
    {
        var root = FindRepositoryRoot();
        var viewModel = File.ReadAllText(Path.Combine(root, "reference-target-app", "src", "ReferenceTargetApp.Wpf", "UI", "ViewModels", "EditorWindowViewModel.cs"));
        var coordinator = File.ReadAllText(Path.Combine(root, "reference-target-app", "src", "ReferenceTargetApp.Wpf", "UI", "Editor", "EditorWindowCoordinator.cs"));
        var saveAwait = viewModel.IndexOf("if (IsDirty && !await SaveAsync()) return false;", StringComparison.Ordinal);
        var savedDisposition = viewModel.IndexOf("CloseDisposition = EditorCloseDisposition.Saved;", saveAwait, StringComparison.Ordinal);
        var closeGate = coordinator.IndexOf("if (viewModel is not null && !await viewModel.ConfirmCloseAsync()) return;", StringComparison.Ordinal);
        var closePreparation = coordinator.IndexOf("if (prepareTargetClose is not null && !await prepareTargetClose(disposition)) return;", closeGate, StringComparison.Ordinal);
        var windowClose = coordinator.IndexOf("await CloseAsync();", closePreparation, StringComparison.Ordinal);

        Assert.IsGreaterThanOrEqualTo(0, saveAwait);
        Assert.IsGreaterThan(saveAwait, savedDisposition);
        Assert.IsGreaterThanOrEqualTo(0, closeGate);
        Assert.IsGreaterThan(closeGate, closePreparation);
        Assert.IsGreaterThan(closePreparation, windowClose);
    }

    private static Fixture CreateFixture()
    {
        var root = Path.Combine(Path.GetTempPath(), $"ui-editor-m86-23-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        var field = new TextBox { Width = 100, Height = 24 };
        var scope = new Grid { Width = 600, Height = 300 };
        scope.Children.Add(field);
        var registry = new UiElementRegistry([
            new("scope", "scope", null, UiElementKind.Scope, "Bereich", 0, UiCapability.None, scope),
            new("field", "scope", "scope", UiElementKind.InputField, "Inhalt", 10, UiCapability.Width, field,
                ProtocolType: "field", AllowedOperations: [HostAdapterOperations.ResizeWidth]),
        ]);
        var adapter = new WpfHostAdapter(registry);
        var baseline = adapter.GetCurrentLayoutState();
        var store = new AtomicJsonLayoutProfileStore(root, "app");
        var session = new LayoutProfileSession(
            new Dictionary<string, IHostAdapter>(StringComparer.Ordinal) { ["scope"] = adapter },
            new Dictionary<string, LayoutState>(StringComparer.Ordinal) { ["scope"] = baseline },
            store, new ActiveLayoutProfileStore(root), LayoutProfileCatalog.StandardId);
        return new(root, adapter, store, session);
    }

    private static void Resize(WpfHostAdapter adapter, double width)
    {
        var result = adapter.SubmitChangeRequest(new ChangeRequest(
            Guid.NewGuid().ToString("N"), "field", HostAdapterOperations.ResizeWidth,
            new Dictionary<string, object?> { ["width"] = width }, DateTimeOffset.UtcNow, "m86-23-test", "scope"));
        Assert.IsTrue(result.Success, result.Message);
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "reference-target-app"))) return directory.FullName;
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("Repository root not found.");
    }

    private sealed record Fixture(
        string Root,
        WpfHostAdapter Adapter,
        AtomicJsonLayoutProfileStore Store,
        LayoutProfileSession Session) : IDisposable
    {
        public void Dispose()
        {
            if (Directory.Exists(Root)) Directory.Delete(Root, recursive: true);
        }
    }
}
