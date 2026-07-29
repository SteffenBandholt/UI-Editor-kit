using System.IO;
using System.Windows.Controls;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Geometry;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class M825SimpleModeTests
{
    [TestMethod]
    public void TableColumnFreedSpaceUsesNormalTableFlowWithoutChangingNeighborWidths()
    {
        Assert.AreEqual(GeometryRiskActions.ReflowNeighbors,
            SimpleModeRiskPolicy.SelectAction(GeometryRiskTypes.FreedSpace, isTableColumn: true));
        Assert.AreEqual(GeometryRiskActions.PreserveSpace,
            SimpleModeRiskPolicy.SelectAction(GeometryRiskTypes.FreedSpace, isTableColumn: false));
    }

    [TestMethod]
    public void SessionUndoRestoresMultipleChangesInReverseOrder()
    {
        StaTest.Run(() =>
        {
            var root = Path.Combine(Path.GetTempPath(), $"ui-editor-m82-5-{Guid.NewGuid():N}");
            Directory.CreateDirectory(root);
            try
            {
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
                var session = new LayoutProfileSession(
                    new Dictionary<string, IHostAdapter>(StringComparer.Ordinal) { ["scope"] = adapter },
                    new Dictionary<string, LayoutState>(StringComparer.Ordinal) { ["scope"] = baseline },
                    new AtomicJsonLayoutProfileStore(root, "app"), new ActiveLayoutProfileStore(root),
                    LayoutProfileCatalog.StandardId);

                ApplyWidth(session, adapter, 120, "Breite 120");
                ApplyWidth(session, adapter, 150, "Breite 150");
                Assert.AreEqual(2, session.GetUndoStatus().Depth);

                var first = session.UndoAsync().GetAwaiter().GetResult();
                Assert.IsTrue(first.Success, first.Message);
                Assert.AreEqual(120, CurrentWidth(adapter), 0.001);
                var second = session.UndoAsync().GetAwaiter().GetResult();
                Assert.IsTrue(second.Success, second.Message);
                Assert.AreEqual(100, CurrentWidth(adapter), 0.001);
                Assert.IsFalse(session.GetUndoStatus().CanUndo);
            }
            finally
            {
                if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
            }
        });
    }

    [TestMethod]
    public void NativeWorkspaceStartsSimpleAndKeepsTechnicalControlsClosed()
    {
        var root = FindRepositoryRoot();
        var xaml = File.ReadAllText(Path.Combine(root, "reference-target-app", "src", "ReferenceTargetApp.Wpf", "UI", "Views", "CompactEditorWorkspaceView.xaml"));
        StringAssert.Contains(xaml, "Text=\"Einfachmodus\"");
        StringAssert.Contains(xaml, "Content=\"{Binding UndoLabel}\"");
        StringAssert.Contains(xaml, "CommandParameter=\"column:-10\"");
        StringAssert.Contains(xaml, "CommandParameter=\"column:10\"");
        StringAssert.Contains(xaml, "Header=\"Erweitert\" IsExpanded=\"False\"");
        Assert.IsGreaterThan(xaml.IndexOf("Erweitert", StringComparison.Ordinal), xaml.IndexOf("Details anzeigen", StringComparison.Ordinal));
        Assert.IsGreaterThan(xaml.IndexOf("Details anzeigen", StringComparison.Ordinal), xaml.IndexOf("SelectedId", StringComparison.Ordinal));

        var viewModel = File.ReadAllText(Path.Combine(root, "reference-target-app", "src", "ReferenceTargetApp.Wpf", "UI", "ViewModels", "EditorWindowViewModel.cs"));
        StringAssert.Contains(viewModel, "SubmitSimpleLayoutChangeAsync(targetElementId, operation, payload");
        StringAssert.Contains(viewModel, "simple: true");

        var processProtocol = File.ReadAllText(Path.Combine(root, "src", "process", "editor-process-protocol.cjs"));
        StringAssert.Contains(processProtocol, "const previousState = previous && previous.editorUiSession.snapshot()");
        StringAssert.Contains(processProtocol, "restoreEditorUiState(created.entry, previousState)");
    }

    private static void ApplyWidth(LayoutProfileSession session, WpfHostAdapter adapter, double width, string description)
    {
        session.BeginUndoFrame(description);
        var result = adapter.SubmitChangeRequest(new ChangeRequest(Guid.NewGuid().ToString("N"), "field",
            HostAdapterOperations.ResizeWidth, new Dictionary<string, object?> { ["width"] = width },
            DateTimeOffset.UtcNow, "m82-5-test", "scope"));
        Assert.IsTrue(result.Success, result.Message);
        session.RecordExplicitOperation("scope", "field", HostAdapterOperations.ResizeWidth);
        session.CommitUndoFrame();
    }

    private static double CurrentWidth(WpfHostAdapter adapter) =>
        adapter.GetCurrentLayoutState().Elements.Single(element => element.ElementId == "field").Width;

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
}
