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

                var commitNotified = false;
                fixture.Session.ConfigureSaveCommitNotification((snapshot, _) =>
                {
                    Assert.IsFalse(File.Exists(fixture.Store.GetFilePath("standard") + ".save-transaction.json"));
                    Assert.AreEqual(snapshot.RequestId, fixture.Session.LastAcknowledgedSaveRequestId);
                    commitNotified = true;
                    return Task.CompletedTask;
                });
                var result = fixture.Session.SaveAsync().GetAwaiter().GetResult();

                Assert.IsTrue(commitNotified);
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
                var commitNotifications = 0;
                fixture.Session.ConfigureSaveCommitNotification((_, _) => { commitNotifications++; return Task.CompletedTask; });
                string? rejectedRequestId = null;
                fixture.Session.ConfigureSaveAcknowledgement((snapshot, _) =>
                {
                    rejectedRequestId = snapshot.RequestId;
                    return Task.FromResult(new LayoutSaveAcknowledgement(false, "layout_save_acknowledgement_failed", "abgelehnt"));
                });

                var rejected = fixture.Session.SaveAsync().GetAwaiter().GetResult();

                Assert.IsFalse(rejected.Success);
                Assert.AreEqual(0, commitNotifications);
                Assert.AreEqual("layout_save_acknowledgement_failed", rejected.Code);
                Assert.IsFalse(File.Exists(fixture.Store.GetFilePath(LayoutProfileCatalog.StandardId)),
                    "Ein abgelehnter erster Save darf kein Startprofil hinterlassen.");
                Assert.IsTrue(fixture.Session.GetStatus().IsDirty, "Ohne Acknowledgement darf der Editor nicht clean werden.");
                Assert.IsNull(fixture.Session.LastAcknowledgedSaveRequestId);

                fixture.Session.ConfigureSaveAcknowledgement((snapshot, _) =>
                    Task.FromResult(new LayoutSaveAcknowledgement(true, "layout_save_acknowledged", "bestätigt")));
                var retry = fixture.Session.SaveAsync().GetAwaiter().GetResult();

                Assert.IsTrue(retry.Success, retry.Message);
                Assert.AreNotEqual(rejectedRequestId, retry.SaveRequestId);
                Assert.AreEqual(1, commitNotifications);
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

    [TestMethod]
    public void MultipleEditsStayTransientAndDiscardRestoresLastExplicitSave()
    {
        StaTest.Run(() =>
        {
            using var fixture = CreateFixture();
            Resize(fixture.Adapter, 120);
            fixture.Session.RecordExplicitOperation("scope", "field", HostAdapterOperations.ResizeWidth);
            Resize(fixture.Adapter, 140);
            Assert.IsTrue(fixture.Session.GetStatus().IsDirty);
            Assert.IsFalse(File.Exists(fixture.Store.GetFilePath("standard")));
            Assert.IsTrue(fixture.Session.DiscardAllAsync().GetAwaiter().GetResult().Success);
            Assert.AreEqual(100, fixture.Adapter.GetCurrentLayoutState().Elements.Single(e => e.ElementId == "field").Width);
            Resize(fixture.Adapter, 160);
            fixture.Session.RecordExplicitOperation("scope", "field", HostAdapterOperations.ResizeWidth);
            Assert.IsTrue(fixture.Session.SaveAsync().GetAwaiter().GetResult().Success);
            var bytes = File.ReadAllBytes(fixture.Store.GetFilePath("standard"));
            Resize(fixture.Adapter, 180);
            Resize(fixture.Adapter, 200);
            Assert.IsTrue(fixture.Session.DiscardAllAsync().GetAwaiter().GetResult().Success);
            Assert.AreEqual(160, fixture.Adapter.GetCurrentLayoutState().Elements.Single(e => e.ElementId == "field").Width);
            CollectionAssert.AreEqual(bytes, File.ReadAllBytes(fixture.Store.GetFilePath("standard")));
            Assert.IsFalse(fixture.Session.GetStatus().IsDirty);
        });
    }

    [TestMethod]
    public void RejectedSaveAndInterruptedSavePreservePreviousProfileBytes()
    {
        StaTest.Run(() =>
        {
            using var fixture = CreateFixture();
            Resize(fixture.Adapter, 130);
            fixture.Session.RecordExplicitOperation("scope", "field", HostAdapterOperations.ResizeWidth);
            Assert.IsTrue(fixture.Session.SaveAsync().GetAwaiter().GetResult().Success);
            var path = fixture.Store.GetFilePath("standard");
            var bytes = File.ReadAllBytes(path);
            Resize(fixture.Adapter, 190);
            fixture.Session.ConfigureSaveAcknowledgement((_, _) => throw new IOException("connection lost"));
            Assert.IsFalse(fixture.Session.SaveAsync().GetAwaiter().GetResult().Success);
            CollectionAssert.AreEqual(bytes, File.ReadAllBytes(path));
            Assert.IsTrue(fixture.Session.GetStatus().IsDirty);
            fixture.Store.BeginSaveTransactionAsync("standard").GetAwaiter().GetResult();
            File.WriteAllText(path, "interrupted candidate");
            var recovered = new AtomicJsonLayoutProfileStore(fixture.Root, "app");
            recovered.RecoverSaveTransactionAsync("standard").GetAwaiter().GetResult();
            CollectionAssert.AreEqual(bytes, File.ReadAllBytes(path));
            Assert.IsTrue(fixture.Session.DiscardAllAsync().GetAwaiter().GetResult().Success);
            Assert.AreEqual(130, fixture.Adapter.GetCurrentLayoutState().Elements.Single(e => e.ElementId == "field").Width);
        });
    }

    [TestMethod]
    public void FailedAtomicWriteKeepsSavedBytesAndCanBeRetried()
    {
        StaTest.Run(() =>
        {
            using var fixture = CreateFixture();
            Assert.IsTrue(fixture.Session.SaveAsync().GetAwaiter().GetResult().Success);
            var path = fixture.Store.GetFilePath("standard");
            var bytes = File.ReadAllBytes(path);
            Resize(fixture.Adapter, 170);
            fixture.Session.RecordExplicitOperation("scope", "field", HostAdapterOperations.ResizeWidth);
            // Windows denies File.Replace while the saved profile has no delete sharing.
            using (var locked = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                var result = fixture.Session.SaveAsync().GetAwaiter().GetResult();
                Assert.IsFalse(result.Success);
                Assert.IsTrue(fixture.Session.GetStatus().IsDirty);
            }
            CollectionAssert.AreEqual(bytes, File.ReadAllBytes(path));
            Assert.IsTrue(fixture.Session.SaveAsync().GetAwaiter().GetResult().Success);
            Assert.IsFalse(fixture.Session.GetStatus().IsDirty);
        });
    }

    [TestMethod]
    public void CancelledAcknowledgementRestoresSavedProfileAndLeavesWorkingDirty()
    {
        StaTest.Run(() =>
        {
            using var fixture = CreateFixture();
            Assert.IsTrue(fixture.Session.SaveAsync().GetAwaiter().GetResult().Success);
            var path = fixture.Store.GetFilePath("standard");
            var bytes = File.ReadAllBytes(path);
            Resize(fixture.Adapter, 175);
            fixture.Session.RecordExplicitOperation("scope", "field", HostAdapterOperations.ResizeWidth);
            using var cancellation = new CancellationTokenSource();
            fixture.Session.ConfigureSaveAcknowledgement((_, token) =>
            {
                cancellation.Cancel();
                token.ThrowIfCancellationRequested();
                throw new InvalidOperationException("Cancellation must stop acknowledgement");
            });
            var result = fixture.Session.SaveAsync(cancellation.Token).GetAwaiter().GetResult();
            Assert.IsFalse(result.Success);
            Assert.AreEqual("cancelled", result.Code);
            CollectionAssert.AreEqual(bytes, File.ReadAllBytes(path));
            Assert.IsTrue(fixture.Session.GetStatus().IsDirty);
            Assert.IsTrue(fixture.Session.DiscardAllAsync().GetAwaiter().GetResult().Success);
            Assert.IsFalse(fixture.Session.GetStatus().IsDirty);
        });
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
