using System.IO;
using System.Text.Json;
using System.Windows.Controls;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Registry;
using ReferenceTargetApp.UI.Editor;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class M821DirectSelectionTests
{
    [TestMethod]
    public void DiscardAndResetApplyOnlyExplicitUserOperations()
    {
        StaTest.Run(() =>
        {
            var root = Path.Combine(Path.GetTempPath(), "ui-editor-kit-m82-1-tracked-restore", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(root);
            try
            {
                var scope = new Grid { Width = 600, Height = 300 };
                var edited = new TextBox { Width = 200, Height = 30 };
                var derived = new TextBox { Width = 200, Height = 30 };
                var adapter = new WpfHostAdapter(new UiElementRegistry([
                    new("ui.scope", "ui.scope", null, UiElementKind.Scope, "Bereich", 0, UiCapability.None, scope),
                    new("ui.scope.edited", "ui.scope", "ui.scope", UiElementKind.InputField, "Bearbeitet", 10,
                        UiCapability.Width, edited, AllowedOperations: [HostAdapterOperations.ResizeWidth]),
                    new("ui.scope.derived", "ui.scope", "ui.scope", UiElementKind.InputField, "Abgeleitet", 20,
                        UiCapability.Width, derived, AllowedOperations: [HostAdapterOperations.ResizeWidth])
                ]));
                var adapters = new Dictionary<string, IHostAdapter>(StringComparer.Ordinal) { ["ui.scope"] = adapter };
                var baseline = adapters.ToDictionary(pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal);
                var store = new AtomicJsonLayoutProfileStore(root, "app");
                var active = new ActiveLayoutProfileStore(root);
                var session = new LayoutProfileSession(adapters, baseline, store, active, "standard");
                edited.Width = 210;
                session.RecordExplicitOperation("ui.scope", "ui.scope.edited", HostAdapterOperations.ResizeWidth);
                Assert.IsTrue(session.SaveAsync().GetAwaiter().GetResult().Success);

                var load = store.LoadAsync("standard", adapters).GetAwaiter().GetResult();
                Assert.IsTrue(load.Success);
                session = new LayoutProfileSession(adapters, baseline, store, active, "standard",
                    adapters.ToDictionary(pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal),
                    savedDocument: load.Document);
                edited.Width = 220;
                derived.Width = 250;
                session.RecordExplicitOperation("ui.scope", "ui.scope.edited", HostAdapterOperations.ResizeWidth);

                Assert.IsTrue(session.DiscardAllAsync().GetAwaiter().GetResult().Success);
                Assert.AreEqual(210, edited.Width, 0.001);
                Assert.AreEqual(250, derived.Width, 0.001, "Abgeleitete, nicht explizite Geometrie darf nicht zurückgespielt werden.");
                Assert.IsFalse(session.GetStatus().IsDirty);

                Assert.IsTrue(session.ResetAllAsync().GetAwaiter().GetResult().Success);
                Assert.AreEqual(200, edited.Width, 0.001);
                Assert.AreEqual(250, derived.Width, 0.001, "Gesamtreset darf nur explizite Benutzeroperationen auf Baseline setzen.");
            }
            finally
            {
                if (Directory.Exists(root)) Directory.Delete(root, true);
            }
        });
    }

    [TestMethod]
    public void RefreshedTargetCanBecomeCleanBoundaryAfterRestore()
    {
        StaTest.Run(() =>
        {
            var root = Path.Combine(Path.GetTempPath(), "ui-editor-kit-m82-1-refresh-boundary", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(root);
            try
            {
                var scope = new Grid { Width = 600, Height = 300 };
                var field = new TextBox { Width = 200, Height = 30 };
                var adapter = new WpfHostAdapter(new UiElementRegistry([
                    new("ui.scope", "ui.scope", null, UiElementKind.Scope, "Bereich", 0, UiCapability.None, scope),
                    new("ui.scope.field", "ui.scope", "ui.scope", UiElementKind.InputField, "Feld", 10,
                        UiCapability.Width, field, AllowedOperations: [HostAdapterOperations.ResizeWidth])
                ]));
                var adapters = new Dictionary<string, IHostAdapter>(StringComparer.Ordinal) { ["ui.scope"] = adapter };
                var baseline = adapters.ToDictionary(pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal);
                var session = new LayoutProfileSession(adapters, baseline, new AtomicJsonLayoutProfileStore(root, "app"),
                    new ActiveLayoutProfileStore(root), "standard");

                field.Width = 201;
                Assert.IsTrue(session.GetStatus().IsDirty);
                session.AcceptCurrentTargetAsSaved();
                Assert.IsFalse(session.GetStatus().IsDirty, "Der nach Restore aktualisierte Zielzustand muss die saubere Sessiongrenze bilden.");
                field.Width = 202;
                Assert.IsTrue(session.GetStatus().IsDirty, "Eine nachfolgende echte Änderung muss wieder Dirty erzeugen.");
            }
            finally
            {
                if (Directory.Exists(root)) Directory.Delete(root, true);
            }
        });
    }

    [TestMethod]
    public void SubpixelRoundTripDoesNotCreateFalseDirtyButOneDipEditDoes()
    {
        StaTest.Run(() =>
        {
            var root = Path.Combine(Path.GetTempPath(), "ui-editor-kit-m82-1-subpixel", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(root);
            try
            {
                var scope = new Grid { Width = 600, Height = 300 };
                var field = new TextBox { Width = 200, Height = 30 };
                var adapter = new WpfHostAdapter(new UiElementRegistry([
                    new("ui.scope", "ui.scope", null, UiElementKind.Scope, "Bereich", 0, UiCapability.None, scope),
                    new("ui.scope.field", "ui.scope", "ui.scope", UiElementKind.InputField, "Feld", 10,
                        UiCapability.Width, field, AllowedOperations: [HostAdapterOperations.ResizeWidth])
                ]));
                var adapters = new Dictionary<string, IHostAdapter>(StringComparer.Ordinal) { ["ui.scope"] = adapter };
                var baseline = adapters.ToDictionary(pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal);
                var session = new LayoutProfileSession(adapters, baseline, new AtomicJsonLayoutProfileStore(root, "app"),
                    new ActiveLayoutProfileStore(root), "standard");

                field.Width = 200.04;
                Assert.IsFalse(session.GetStatus().IsDirty, "Subpixel-Rundung darf kein falsches Dirty erzeugen.");
                field.Width = 201;
                Assert.IsTrue(session.GetStatus().IsDirty, "Ein echter 1-DIP-Schritt muss Dirty bleiben.");
            }
            finally
            {
                if (Directory.Exists(root)) Directory.Delete(root, true);
            }
        });
    }

    [TestMethod]
    public void SavedProfileCarriesOnlyExplicitUserOperations()
    {
        StaTest.Run(() =>
        {
            var root = Path.Combine(Path.GetTempPath(), "ui-editor-kit-m82-1-operations", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(root);
            try
            {
                var scope = new Grid { Width = 600, Height = 300 };
                var field = new TextBox { Width = 200, Height = 30 };
                var adapter = new WpfHostAdapter(new UiElementRegistry([
                    new("ui.scope", "ui.scope", null, UiElementKind.Scope, "Bereich", 0, UiCapability.None, scope),
                    new("ui.scope.field", "ui.scope", "ui.scope", UiElementKind.InputField, "Feld", 10,
                        UiCapability.Width, field, AllowedOperations: [HostAdapterOperations.ResizeWidth])
                ]));
                var adapters = new Dictionary<string, IHostAdapter>(StringComparer.Ordinal) { ["ui.scope"] = adapter };
                var baseline = adapters.ToDictionary(pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal);
                var session = new LayoutProfileSession(adapters, baseline, new AtomicJsonLayoutProfileStore(root, "app"),
                    new ActiveLayoutProfileStore(root), "standard");

                session.RecordExplicitOperation("ui.scope", "ui.scope.field", HostAdapterOperations.ResizeWidth);
                Assert.IsTrue(session.SaveAsync().GetAwaiter().GetResult().Success);

                using var document = JsonDocument.Parse(File.ReadAllText(Path.Combine(root, "standard.layout-profile.json")));
                var operations = document.RootElement.GetProperty("scopes")[0].GetProperty("explicitOperations");
                Assert.AreEqual(HostAdapterOperations.ResizeWidth, operations.GetProperty("ui.scope.field")[0].GetString());
            }
            finally
            {
                if (Directory.Exists(root)) Directory.Delete(root, true);
            }
        });
    }

    [TestMethod]
    public async Task RemoteEscapeCancellationResetsSelectionStateAndNotifiesEditor()
    {
        using var selection = new TargetAppSelectionService(
            _ => Task.CompletedTask,
            _ => Task.CompletedTask,
            (_, _, _) => Task.CompletedTask);
        var cancelled = false;
        selection.SelectionCancelled += (_, _) => cancelled = true;

        await selection.BeginAsync();
        Assert.IsTrue(selection.IsActive);

        selection.NotifyRemoteCancellation();

        Assert.IsFalse(selection.IsActive);
        Assert.IsTrue(cancelled);
    }
}
