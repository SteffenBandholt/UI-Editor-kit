using System.IO;
using System.Windows;
using System.Windows.Controls;
using ReferenceTargetApp.EditorIntegration.Electron;
using ReferenceTargetApp.EditorIntegration.Geometry;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class M823SpacingTests
{
    [TestMethod]
    public void WidthFlowRiskKeepsThreeDecisionsSeparate()
    {
        var target = new GeometryTarget("field", "Kurztext/Gegenstand", "field", new(0, 0, 150, 24));
        var group = new GeometryTarget("group", "Gruppe Kurztext/Gegenstand", "group", new(0, 0, 500, 40));
        var neighbor = new GeometryNeighbor("counter", "Restzeichenanzeige", "label", new(180, 0, 30, 24), GeometryChanged: true);

        var risk = GeometryRiskEvaluator.Evaluate(GeometryEditModes.Guided, "m82-3", "scope", target,
            new(0, 0, 130, 24), group, group, group, [neighbor], operation: HostAdapterOperations.ResizeWidth, groupWidthEditable: true);

        Assert.AreEqual(GeometryRiskTypes.FreedSpace, risk.RiskType);
        CollectionAssert.AreEqual(new[] { GeometryRiskActions.PreserveSpace, GeometryRiskActions.ReflowNeighbors, GeometryRiskActions.ShrinkGroup, GeometryRiskActions.Cancel }, risk.SuggestedActions.ToArray());
        Assert.AreEqual(20, risk.TechnicalDetails.FreedWidth, 0.001);
        Assert.AreEqual(SpacingTargets.ReservedWidth, risk.TechnicalDetails.SpacingTarget);
    }

    [TestMethod]
    public void GroupShrinkIsHiddenWithoutEditableGroupWidth()
    {
        var target = new GeometryTarget("field", "Feld", "field", new(0, 0, 150, 24));
        var neighbor = new GeometryNeighbor("next", "Nächstes Feld", "field", new(180, 0, 30, 24), GeometryChanged: true);
        var risk = GeometryRiskEvaluator.Evaluate(GeometryEditModes.Free, "m82-3", "scope", target,
            new(0, 0, 130, 24), null, null, null, [neighbor], operation: HostAdapterOperations.ResizeWidth);

        CollectionAssert.DoesNotContain(risk.SuggestedActions.ToArray(), GeometryRiskActions.ShrinkGroup);
    }

    [TestMethod]
    public void WpfAdapterMapsBeforeAfterReservedWidthAndReset()
    {
        StaTest.Run(() =>
        {
            var (_, field, adapter) = CreateAdapter();
            Apply(adapter, "field", HostAdapterOperations.SpacingSet, SpacingTargets.BeforeElement, 10);
            Apply(adapter, "field", HostAdapterOperations.SpacingSet, SpacingTargets.AfterElement, 6);
            Apply(adapter, "field", HostAdapterOperations.SpacingSet, SpacingTargets.ReservedWidth, 20);
            Assert.AreEqual(new Thickness(12, 2, 28, 2), field.Margin);

            Apply(adapter, "field", HostAdapterOperations.SpacingReset, SpacingTargets.AfterElement, null);
            Assert.AreEqual(new Thickness(12, 2, 22, 2), field.Margin);
            Assert.AreEqual(20, adapter.GetCurrentLayoutState().Elements.Single(item => item.ElementId == "field").Spacing![SpacingTargets.ReservedWidth]);
        });
    }

    [TestMethod]
    public void WpfAdapterMapsGroupPaddingWithoutChangingParent()
    {
        StaTest.Run(() =>
        {
            var (group, _, adapter) = CreateAdapter();
            Apply(adapter, "group", HostAdapterOperations.SpacingSet, SpacingTargets.GroupPaddingLeft, 8);
            Apply(adapter, "group", HostAdapterOperations.SpacingSet, SpacingTargets.GroupPaddingRight, 4);

            Assert.AreEqual(new Thickness(11, 3, 7, 3), group.Padding);
            Assert.AreEqual("scope", adapter.GetRegistry().FindById("group")!.ParentId);
            Assert.AreEqual("group", adapter.GetRegistry().FindById("field")!.ParentId);
        });
    }

    [TestMethod]
    public void PersistedDocumentCarriesSpacingIntent()
    {
        StaTest.Run(() =>
        {
            var (_, _, adapter) = CreateAdapter();
            Apply(adapter, "field", HostAdapterOperations.SpacingSet, SpacingTargets.ReservedWidth, 20);
            var options = new LayoutPersistenceOptions(Path.GetTempPath(), "app", "standard", "scope", "m82-3.json");
            var document = PersistedLayoutDocumentFactory.Create(options, adapter.GetRegistry(), adapter.GetCurrentLayoutState(), DateTimeOffset.UtcNow);

            Assert.AreEqual(20, document.LayoutState.Elements.Single(item => item.ElementId == "field").Spacing![SpacingTargets.ReservedWidth]);
        });
    }

    [TestMethod]
    public void ElectronHandshakeAcceptsTheSharedSpacingOperations()
    {
        var contract = new ElectronTargetContract(
            "target", "Ziel-App", "1.0.0", "electron", "1.2", "1.2", 1,
            $"sha256:{new string('a', 64)}", "complete", ["scope"], "profiles",
            [HostAdapterOperations.ResizeWidth, HostAdapterOperations.SpacingIncrease, HostAdapterOperations.SpacingDecrease,
                HostAdapterOperations.SpacingSet, HostAdapterOperations.SpacingReset],
            "bidirectional", "layout", true, true, LocalTargetProtocol.Version, "session", 1, "unavailable", null);

        contract.Validate();
    }

    [TestMethod]
    public void TrackedElementResetRestoresEverySpacingTarget()
    {
        StaTest.Run(() =>
        {
            var root = Path.Combine(Path.GetTempPath(), $"ui-editor-m82-3-{Guid.NewGuid():N}");
            Directory.CreateDirectory(root);
            try
            {
                var (_, _, adapter) = CreateAdapter();
                var baseline = adapter.GetCurrentLayoutState();
                Apply(adapter, "field", HostAdapterOperations.SpacingSet, SpacingTargets.BeforeElement, 10);
                Apply(adapter, "field", HostAdapterOperations.SpacingSet, SpacingTargets.AfterElement, 6);
                Apply(adapter, "field", HostAdapterOperations.SpacingSet, SpacingTargets.ReservedWidth, 20);
                var saved = adapter.GetCurrentLayoutState();
                var options = new LayoutPersistenceOptions(root, "app", LayoutProfileCatalog.StandardId, "scope", "m82-3.json");
                var persisted = PersistedLayoutDocumentFactory.Create(options, adapter.GetRegistry(), saved, DateTimeOffset.UtcNow);
                var document = new PersistedLayoutProfileDocument(1, "app", LayoutProfileCatalog.StandardId, DateTimeOffset.UtcNow,
                [
                    new PersistedLayoutScope("scope", persisted.RegistryFingerprint, persisted.LayoutState,
                        new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
                        {
                            ["field"] = [HostAdapterOperations.SpacingSet]
                        })
                ]);
                var session = new LayoutProfileSession(
                    new Dictionary<string, IHostAdapter>(StringComparer.Ordinal) { ["scope"] = adapter },
                    new Dictionary<string, LayoutState>(StringComparer.Ordinal) { ["scope"] = baseline },
                    new AtomicJsonLayoutProfileStore(root, "app"), new ActiveLayoutProfileStore(root),
                    LayoutProfileCatalog.StandardId,
                    new Dictionary<string, LayoutState>(StringComparer.Ordinal) { ["scope"] = saved },
                    savedDocument: document);

                var result = session.ResetElementAsync("scope", "field").GetAwaiter().GetResult();
                Assert.IsTrue(result.Success, result.Message);
                var spacing = adapter.GetCurrentLayoutState().Elements.Single(item => item.ElementId == "field").Spacing!;
                Assert.AreEqual(0, spacing.GetValueOrDefault(SpacingTargets.BeforeElement));
                Assert.AreEqual(0, spacing.GetValueOrDefault(SpacingTargets.AfterElement));
                Assert.AreEqual(0, spacing.GetValueOrDefault(SpacingTargets.ReservedWidth));
            }
            finally
            {
                if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
            }
        });
    }

    [TestMethod]
    public void TrackedWidthResetAlsoRestoresInferredReservedWidthSideEffect()
    {
        StaTest.Run(() =>
        {
            var root = Path.Combine(Path.GetTempPath(), $"ui-editor-m82-3-{Guid.NewGuid():N}");
            Directory.CreateDirectory(root);
            try
            {
                var (_, _, adapter) = CreateAdapter();
                Apply(adapter, "field", HostAdapterOperations.SpacingSet, SpacingTargets.ReservedWidth, 40);
                var baseline = adapter.GetCurrentLayoutState();
                var widthResult = adapter.SubmitChangeRequest(new ChangeRequest(Guid.NewGuid().ToString("N"), "field",
                    HostAdapterOperations.ResizeWidth, new Dictionary<string, object?> { ["width"] = 90d },
                    DateTimeOffset.UtcNow, "m82-3-test", "scope"));
                Assert.IsTrue(widthResult.Success, widthResult.Message);
                Apply(adapter, "field", HostAdapterOperations.SpacingSet, SpacingTargets.ReservedWidth, 100);
                var saved = adapter.GetCurrentLayoutState();
                var options = new LayoutPersistenceOptions(root, "app", LayoutProfileCatalog.StandardId, "scope", "m82-3.json");
                var persisted = PersistedLayoutDocumentFactory.Create(options, adapter.GetRegistry(), saved, DateTimeOffset.UtcNow);
                var document = new PersistedLayoutProfileDocument(1, "app", LayoutProfileCatalog.StandardId, DateTimeOffset.UtcNow,
                [
                    new PersistedLayoutScope("scope", persisted.RegistryFingerprint, persisted.LayoutState,
                        new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
                        {
                            ["field"] = [HostAdapterOperations.ResizeWidth]
                        })
                ]);
                var session = new LayoutProfileSession(
                    new Dictionary<string, IHostAdapter>(StringComparer.Ordinal) { ["scope"] = adapter },
                    new Dictionary<string, LayoutState>(StringComparer.Ordinal) { ["scope"] = baseline },
                    new AtomicJsonLayoutProfileStore(root, "app"), new ActiveLayoutProfileStore(root),
                    LayoutProfileCatalog.StandardId,
                    new Dictionary<string, LayoutState>(StringComparer.Ordinal) { ["scope"] = saved },
                    savedDocument: document);

                var sessionBaseline = session.GetStatus().Baseline["scope"].Elements.Single(item => item.ElementId == "field");
                Assert.AreEqual(40, sessionBaseline.Spacing!.GetValueOrDefault(SpacingTargets.ReservedWidth), 0.001);
                var sequence = 1;
                var resetRequests = LayoutRestoreCoordinator.CreateRequests(adapter.GetRegistry().FindById("field")!,
                    new PersistedElementLayout(sessionBaseline.ElementId, sessionBaseline.ScopeId,
                        sessionBaseline.X, sessionBaseline.Y, sessionBaseline.Width, sessionBaseline.Height,
                        sessionBaseline.TextOffsetX, sessionBaseline.TextOffsetY, sessionBaseline.FontSize,
                        sessionBaseline.Visible, sessionBaseline.Spacing), "m82-3-test", ref sequence);
                Assert.AreEqual(3, resetRequests.Count(request => request.Operation == HostAdapterOperations.SpacingSet));

                var result = session.ResetElementAsync("scope", "field").GetAwaiter().GetResult();
                Assert.IsTrue(result.Success, result.Message);
                var restored = adapter.GetCurrentLayoutState().Elements.Single(item => item.ElementId == "field");
                Assert.AreEqual(150, restored.Width, 0.001);
                Assert.AreEqual(40, restored.Spacing!.GetValueOrDefault(SpacingTargets.ReservedWidth), 0.001);
            }
            finally
            {
                if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
            }
        });
    }

    [TestMethod]
    public void CompactWorkspaceUsesAvailableWidthAndKeepsToolbarOutsideColumns()
    {
        var root = FindRepositoryRoot();
        var xaml = File.ReadAllText(Path.Combine(root, "reference-target-app", "src", "ReferenceTargetApp.Wpf", "UI", "Views", "CompactEditorWorkspaceView.xaml"));
        var code = File.ReadAllText(Path.Combine(root, "reference-target-app", "src", "ReferenceTargetApp.Wpf", "UI", "Views", "CompactEditorWorkspaceView.xaml.cs"));

        StringAssert.Contains(code, "width < 860 ? 1 : width < 1260 ? 2 : 3");
        Assert.IsLessThan(xaml.IndexOf("AdaptiveColumns", StringComparison.Ordinal), xaml.IndexOf("Speichern", StringComparison.Ordinal));
        StringAssert.Contains(xaml, "ScrollViewer.VerticalScrollBarVisibility=\"Auto\"");
        StringAssert.Contains(xaml, "Expander Header=\"Technische Details\"");
    }

    private static (Border Group, TextBox Field, WpfHostAdapter Adapter) CreateAdapter()
    {
        var scope = new Grid { Width = 800, Height = 400 };
        var group = new Border { Width = 500, Height = 60, Padding = new Thickness(3) };
        var field = new TextBox { Width = 150, Height = 24, Margin = new Thickness(2) };
        group.Child = field;
        scope.Children.Add(group);
        var spacingOps = new[] { HostAdapterOperations.SpacingSet, HostAdapterOperations.SpacingIncrease, HostAdapterOperations.SpacingDecrease, HostAdapterOperations.SpacingReset };
        var registry = new UiElementRegistry([
            new("scope", "scope", null, UiElementKind.Scope, "Bereich", 0, UiCapability.None, scope),
            new("group", "scope", "scope", UiElementKind.Group, "Gruppe", 10, UiCapability.Width | UiCapability.Spacing, group,
                ProtocolType: "group", AllowedOperations: [HostAdapterOperations.ResizeWidth, .. spacingOps],
                SpacingTargets: [SpacingTargets.GroupPaddingLeft, SpacingTargets.GroupPaddingRight]),
            new("field", "scope", "group", UiElementKind.InputField, "Feld", 20, UiCapability.Width | UiCapability.Spacing, field,
                ProtocolType: "field", AllowedOperations: [HostAdapterOperations.ResizeWidth, .. spacingOps],
                SpacingTargets: [SpacingTargets.BeforeElement, SpacingTargets.AfterElement, SpacingTargets.ReservedWidth])
        ]);
        return (group, field, new WpfHostAdapter(registry));
    }

    private static void Apply(WpfHostAdapter adapter, string elementId, string operation, string target, double? value)
    {
        var spacing = new Dictionary<string, object?> { ["target"] = target };
        if (value is not null) spacing["value"] = value.Value;
        var result = adapter.SubmitChangeRequest(new ChangeRequest(Guid.NewGuid().ToString("N"), elementId, operation,
            new Dictionary<string, object?> { ["spacing"] = spacing }, DateTimeOffset.UtcNow, "m82-3-test", "scope"));
        Assert.IsTrue(result.Success, result.Message);
    }

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "UIEditorKit.slnx"))) current = current.Parent;
        return current?.FullName ?? throw new DirectoryNotFoundException();
    }
}
