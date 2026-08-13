using System.Windows.Controls;
using System.Windows.Data;
using System.IO;
using ReferenceTargetApp.EditorIntegration.Electron;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Registry;
using ReferenceTargetApp.EditorIntegration.Tables;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class M824TableLayoutTests
{
    [TestMethod]
    public void ElectronPdfHandshakeAcceptsAtomicTableBoundaryResize()
    {
        var contract = new ElectronPdfTargetContract(
            "target", "protocol", "TOP-Liste", "1.0", 1,
            $"sha256:{new string('a', 64)}", "pdf.protocol", [HostAdapterOperations.ResizeColumnBoundary],
            "margins", "nativePdf", "explicit", "document", "available");

        contract.Validate("target");
    }

    [TestMethod]
    public void TableEngineMeasuresViewportAndOverflow()
    {
        var table = Definition();
        var metrics = TableLayoutEngine.Measure(table);
        Assert.AreEqual(600, metrics.ViewportWidth, 0.001);
        Assert.AreEqual(984, metrics.TableWidth, 0.001);
        Assert.AreEqual(384, metrics.Overflow, 0.001);
        CollectionAssert.Contains(metrics.OverflowColumnIds.ToArray(), "table.description");
    }

    [TestMethod]
    public void TableEngineFitsFlexibleColumnsAndPreservesFixedColumn()
    {
        var preview = TableLayoutEngine.Fit(Definition());
        Assert.IsTrue(preview.FullyFitted);
        Assert.AreEqual(80, preview.ColumnWidths["table.number"], 0.001);
        Assert.IsLessThan(700, preview.ColumnWidths["table.description"]);
        Assert.IsGreaterThanOrEqualTo(180, preview.ColumnWidths["table.description"]);
    }

    [TestMethod]
    public void WpfDataGridColumnIsTheSharedHeaderAndDataWidthSource()
    {
        StaTest.Run(() =>
        {
            var setup = CreateAdapter();
            var result = setup.Adapter.SubmitChangeRequest(Request("table.description", HostAdapterOperations.ResizeWidth,
                new Dictionary<string, object?> { ["width"] = 320d }));
            Assert.IsTrue(result.Success, result.Message);
            Assert.AreEqual(320, setup.Description.Width.Value, 0.001);
            Assert.AreEqual(DataGridLengthUnitType.Pixel, setup.Description.Width.UnitType);
            Assert.AreEqual("Beschreibung", setup.Description.Header);
            Assert.IsInstanceOfType<DataGridTextColumn>(setup.Description);
        });
    }

    [TestMethod]
    public void WpfColumnSupportsWidthModeWrapAndEllipsis()
    {
        StaTest.Run(() =>
        {
            var setup = CreateAdapter();
            Assert.IsTrue(setup.Adapter.SubmitChangeRequest(Request("table.description", HostAdapterOperations.SetColumnWidthMode, TablePayload("widthMode", TableWidthModes.Proportional))).Success);
            Assert.AreEqual(DataGridLengthUnitType.Star, setup.Description.Width.UnitType);
            Assert.IsTrue(setup.Adapter.SubmitChangeRequest(Request("table.description", HostAdapterOperations.SetColumnWrapMode, TablePayload("wrapMode", TableWrapModes.WordWrap))).Success);
            Assert.IsTrue(setup.Adapter.SubmitChangeRequest(Request("table.description", HostAdapterOperations.SetColumnOverflowMode, TablePayload("overflowMode", TableOverflowModes.Ellipsis))).Success);
            var state = setup.Adapter.GetCurrentLayoutState().Elements.Single(element => element.ElementId == "table.description");
            Assert.AreEqual(TableWidthModes.Proportional, state.Table!.WidthMode);
            Assert.AreEqual(TableWrapModes.WordWrap, state.Table.WrapMode);
            Assert.AreEqual(TableOverflowModes.Ellipsis, state.Table.OverflowMode);
        });
    }

    [TestMethod]
    public void WpfTableFitRequiresPreviewAndUsesMinimumWidths()
    {
        StaTest.Run(() =>
        {
            var setup = CreateAdapter();
            var rejected = setup.Adapter.SubmitChangeRequest(Request("table", HostAdapterOperations.FitTableToViewport,
                new Dictionary<string, object?> { ["table"] = new Dictionary<string, object?> { ["strategy"] = "proportional" } }));
            Assert.IsFalse(rejected.Success);
            Assert.AreEqual("table_preview_confirmation_required", rejected.ErrorCode);

            var applied = setup.Adapter.SubmitChangeRequest(Request("table", HostAdapterOperations.FitTableToViewport,
                new Dictionary<string, object?> { ["table"] = new Dictionary<string, object?> { ["strategy"] = "proportional", ["previewAccepted"] = true } }));
            Assert.IsTrue(applied.Success, applied.Message);
            Assert.AreEqual(80, setup.Number.Width.Value, 0.001);
            Assert.IsGreaterThanOrEqualTo(180, setup.Description.Width.Value);
            Assert.IsLessThanOrEqualTo(0.5, setup.Adapter.GetCurrentLayoutState().Elements.Single(element => element.ElementId == "table").Table!.Overflow!.Value);
        });
    }

    [TestMethod]
    public void BoundaryResizeChangesExactlyTwoAdjacentColumnsAndPreservesTotal()
    {
        StaTest.Run(() =>
        {
            var setup = CreateAdapter();
            var beforeState = setup.Adapter.GetCurrentLayoutState();
            var beforeDescription = beforeState.Elements.Single(element => element.ElementId == "table.description").Width;
            var beforeMeta = beforeState.Elements.Single(element => element.ElementId == "table.meta").Width;
            var result = setup.Adapter.SubmitChangeRequest(Request("table", HostAdapterOperations.ResizeColumnBoundary,
                new Dictionary<string, object?> { ["table"] = new Dictionary<string, object?>
                {
                    ["leftColumnId"] = "table.description", ["rightColumnId"] = "table.meta", ["delta"] = 20d
                } }));
            Assert.IsTrue(result.Success, result.Message);
            Assert.AreEqual(beforeDescription + 20, setup.Description.Width.Value, 0.001);
            Assert.AreEqual(beforeMeta - 20, setup.Meta.Width.Value, 0.001);
            Assert.AreEqual(DataGridLengthUnitType.Star, setup.Description.Width.UnitType);
            Assert.AreEqual(DataGridLengthUnitType.Pixel, setup.Meta.Width.UnitType);
            CollectionAssert.AreEquivalent(new[] { "table.description", "table.meta" }, result.AffectedStates!.Select(state => state.ElementId).ToArray());
        });
    }

    [TestMethod]
    public void BoundaryUndoTracksTheTwoColumnsInsteadOfAnUnrestorableTableIntent()
    {
        StaTest.Run(() =>
        {
            var root = Path.Combine(Path.GetTempPath(), $"m82-4-boundary-undo-{Guid.NewGuid():N}");
            Directory.CreateDirectory(root);
            try
            {
                var setup = CreateAdapter();
                var scopeAdapters = new Dictionary<string, IHostAdapter>(StringComparer.Ordinal) { ["scope"] = setup.Adapter };
                var session = new LayoutProfileSession(scopeAdapters,
                    new Dictionary<string, LayoutState>(StringComparer.Ordinal) { ["scope"] = setup.Adapter.GetCurrentLayoutState() },
                    new AtomicJsonLayoutProfileStore(root, "app"), new ActiveLayoutProfileStore(root), LayoutProfileCatalog.StandardId);
                session.BeginUndoFrame("Tabellengrenze");
                var changed = setup.Adapter.SubmitChangeRequest(Request("table", HostAdapterOperations.ResizeColumnBoundary,
                    new Dictionary<string, object?> { ["table"] = new Dictionary<string, object?>
                    {
                        ["leftColumnId"] = "table.description", ["rightColumnId"] = "table.meta", ["delta"] = 20d
                    } }));
                Assert.IsTrue(changed.Success, changed.Message);
                foreach (var affected in changed.AffectedStates!)
                {
                    session.RecordExplicitOperation("scope", affected.ElementId, HostAdapterOperations.ResizeWidth);
                    session.RecordExplicitOperation("scope", affected.ElementId, HostAdapterOperations.SetColumnWidthMode);
                }
                session.CommitUndoFrame();

                var undone = session.UndoAsync().GetAwaiter().GetResult();
                Assert.IsTrue(undone.Success, undone.Message);
                Assert.IsFalse(session.GetUndoStatus().CanUndo);
            }
            finally { Directory.Delete(root, true); }
        });
    }

    [TestMethod]
    public void TableResetUndoRestoresEveryAffectedColumnIncludingPreviouslyUneditedColumns()
    {
        StaTest.Run(() =>
        {
            var root = Path.Combine(Path.GetTempPath(), $"m82-4-table-reset-undo-{Guid.NewGuid():N}");
            Directory.CreateDirectory(root);
            try
            {
                var setup = CreateAdapter();
                var scopeAdapters = new Dictionary<string, IHostAdapter>(StringComparer.Ordinal) { ["scope"] = setup.Adapter };
                var session = new LayoutProfileSession(scopeAdapters,
                    new Dictionary<string, LayoutState>(StringComparer.Ordinal) { ["scope"] = setup.Adapter.GetCurrentLayoutState() },
                    new AtomicJsonLayoutProfileStore(root, "app"), new ActiveLayoutProfileStore(root), LayoutProfileCatalog.StandardId);

                Assert.IsTrue(setup.Adapter.SubmitChangeRequest(Request("table.number", HostAdapterOperations.ResizeWidth,
                    new Dictionary<string, object?> { ["width"] = 100d })).Success);
                var beforeReset = setup.Adapter.GetCurrentLayoutState();
                session.AcceptCurrentTargetAsSaved();
                session.BeginUndoFrame("Tabelle Original");
                var reset = setup.Adapter.SubmitChangeRequest(Request("table", HostAdapterOperations.ResetTable,
                    new Dictionary<string, object?> { ["table"] = new Dictionary<string, object?>() }));
                Assert.IsTrue(reset.Success, reset.Message);
                foreach (var columnId in new[] { "table.number", "table.description", "table.meta" })
                {
                    session.RecordPendingUndoOperation("scope", columnId, HostAdapterOperations.ResizeWidth);
                    session.RecordPendingUndoOperation("scope", columnId, HostAdapterOperations.SetColumnWidthMode);
                    session.ClearExplicitOperations("scope", columnId);
                }
                session.CommitUndoFrame();

                var undone = session.UndoAsync().GetAwaiter().GetResult();
                Assert.IsTrue(undone.Success, undone.Message);
                var restored = setup.Adapter.GetCurrentLayoutState();
                foreach (var expected in beforeReset.Elements.Where(element => element.Table?.ColumnId is not null))
                {
                    var actual = restored.Elements.Single(element => element.ElementId == expected.ElementId);
                    Assert.AreEqual(expected.Width, actual.Width, 0.001, expected.ElementId);
                    Assert.AreEqual(expected.Table!.WidthMode, actual.Table!.WidthMode, expected.ElementId);
                }
                Assert.IsFalse(session.GetStatus().IsDirty);
            }
            finally { Directory.Delete(root, true); }
        });
    }

    [TestMethod]
    public void ExplicitCleanBoundaryDiscardsOnlyTheTrackedBoundaryColumns()
    {
        StaTest.Run(() =>
        {
            var root = Path.Combine(Path.GetTempPath(), $"m82-4-boundary-discard-{Guid.NewGuid():N}");
            Directory.CreateDirectory(root);
            try
            {
                var setup = CreateAdapter();
                var scopeAdapters = new Dictionary<string, IHostAdapter>(StringComparer.Ordinal) { ["scope"] = setup.Adapter };
                var session = new LayoutProfileSession(scopeAdapters,
                    new Dictionary<string, LayoutState>(StringComparer.Ordinal) { ["scope"] = setup.Adapter.GetCurrentLayoutState() },
                    new AtomicJsonLayoutProfileStore(root, "app"), new ActiveLayoutProfileStore(root), LayoutProfileCatalog.StandardId);
                session.AcceptCurrentTargetAsSaved();
                var changed = setup.Adapter.SubmitChangeRequest(Request("table", HostAdapterOperations.ResizeColumnBoundary,
                    new Dictionary<string, object?> { ["table"] = new Dictionary<string, object?>
                    {
                        ["leftColumnId"] = "table.description", ["rightColumnId"] = "table.meta", ["delta"] = 20d
                    } }));
                Assert.IsTrue(changed.Success, changed.Message);
                foreach (var affected in changed.AffectedStates!)
                {
                    session.RecordExplicitOperation("scope", affected.ElementId, HostAdapterOperations.ResizeWidth);
                    session.RecordExplicitOperation("scope", affected.ElementId, HostAdapterOperations.SetColumnWidthMode);
                }

                var discarded = session.DiscardAllAsync().GetAwaiter().GetResult();
                Assert.IsTrue(discarded.Success, discarded.Message);
                Assert.IsFalse(session.GetStatus().IsDirty);
            }
            finally { Directory.Delete(root, true); }
        });
    }

    [TestMethod]
    public void TableAndColumnModesArePersistedAndRestored()
    {
        StaTest.Run(() =>
        {
            var root = Path.Combine(Path.GetTempPath(), $"m82-4-wpf-{Guid.NewGuid():N}");
            Directory.CreateDirectory(root);
            try
            {
                var setup = CreateAdapter();
                Assert.IsTrue(setup.Adapter.SubmitChangeRequest(Request("table.description", HostAdapterOperations.SetColumnWrapMode, TablePayload("wrapMode", TableWrapModes.Ellipsis))).Success);
                Assert.IsTrue(setup.Adapter.SubmitChangeRequest(Request("table", HostAdapterOperations.SetHorizontalOverflowMode, TablePayload("horizontalOverflowMode", TableHorizontalOverflowModes.Scroll))).Success);
                var options = new LayoutPersistenceOptions(root, "app", "standard", "scope", "m82-4.json");
                var document = PersistedLayoutDocumentFactory.Create(options, setup.Adapter.GetRegistry(), setup.Adapter.GetCurrentLayoutState(), DateTimeOffset.UtcNow);
                Assert.AreEqual(TableWrapModes.Ellipsis, document.LayoutState.Elements.Single(element => element.ElementId == "table.description").Table!.WrapMode);
                Assert.AreEqual(TableHorizontalOverflowModes.Scroll, document.LayoutState.Elements.Single(element => element.ElementId == "table").Table!.HorizontalOverflowMode);

                setup.DescriptionBinding.Reset();
                setup.TableBinding.Reset();
                var restored = new LayoutRestoreCoordinator(setup.Adapter).Restore(document, options);
                Assert.IsTrue(restored.Success, restored.Message);
                var state = setup.Adapter.GetCurrentLayoutState();
                Assert.AreEqual(TableWrapModes.Ellipsis, state.Elements.Single(element => element.ElementId == "table.description").Table!.WrapMode);
                Assert.AreEqual(TableHorizontalOverflowModes.Scroll, state.Elements.Single(element => element.ElementId == "table").Table!.HorizontalOverflowMode);
            }
            finally { Directory.Delete(root, true); }
        });
    }

    internal static TableLayoutDefinition DefinitionForTopologyTest() => Definition();

    private static TableLayoutDefinition Definition()
    {
        var columns = new[]
        {
            Column("table.number", "Nummer", 80, 80, false, TableWidthModes.Fixed, 1),
            Column("table.description", "Beschreibung", 700, 180, true, TableWidthModes.Proportional, 2),
            Column("table.meta", "Status", 180, 120, true, TableWidthModes.Fixed, 3),
        };
        return new("table", "Aufgabenliste", new(0, 0, 984, 400), new(0, 0, 600, 360), new(0, 0, 984, 400),
            "scope", columns.Select(column => column.ColumnId).ToArray(), "table.row", TableHorizontalOverflowModes.Auto, "auto", "bounded",
            360, 1600, 24, 0, TableRowHeightModes.Bounded, 36, 120, columns,
            BoundaryResizePolicy: TableBoundaryResizePolicies.AdjacentPreserveTotal);
    }

    private static TableColumnLayoutDefinition Column(string id, string name, double width, double minimum, bool resizable, string mode, int order) =>
        new(id, name, $"{id}.header", $"{id}.cells", width, minimum, 900, mode, resizable,
            TableWrapModes.WordWrap, TableOverflowModes.Clip, "stretch", true, order, [], id,
            Flexible: mode == TableWidthModes.Proportional, Priority: mode == TableWidthModes.Proportional ? 100 : 10);

    private static Setup CreateAdapter()
    {
        var scope = new Grid { Width = 800, Height = 500 };
        var grid = new DataGrid { Width = 600, Height = 360, AutoGenerateColumns = false };
        scope.Children.Add(grid);
        var number = new DataGridTextColumn { Header = "Nr.", Binding = new Binding("Number") };
        var description = new DataGridTextColumn { Header = "Beschreibung", Binding = new Binding("Description") };
        var meta = new DataGridTextColumn { Header = "Status", Binding = new Binding("Status") };
        grid.Columns.Add(number); grid.Columns.Add(description); grid.Columns.Add(meta);
        var definition = Definition();
        var numberBinding = new WpfTableColumnBinding(grid, number, definition.Columns[0]);
        var descriptionBinding = new WpfTableColumnBinding(grid, description, definition.Columns[1]);
        var metaBinding = new WpfTableColumnBinding(grid, meta, definition.Columns[2]);
        numberBinding.SetWidth(80); descriptionBinding.SetWidth(700); metaBinding.SetWidth(180);
        numberBinding.SetWidthMode(definition.Columns[0].WidthMode);
        descriptionBinding.SetWidthMode(definition.Columns[1].WidthMode);
        metaBinding.SetWidthMode(definition.Columns[2].WidthMode);
        var tableBinding = new WpfTableBinding(grid, definition, [numberBinding, descriptionBinding, metaBinding]);
        var tableOps = new[] { HostAdapterOperations.FitTableToViewport, HostAdapterOperations.ResizeColumnsProportionally, HostAdapterOperations.ResizeColumnBoundary,
            HostAdapterOperations.SetHorizontalOverflowMode, HostAdapterOperations.SetRowHeightMode, HostAdapterOperations.ResetTable };
        var columnOps = new[] { HostAdapterOperations.ResizeWidth, HostAdapterOperations.SetColumnWidthMode,
            HostAdapterOperations.SetColumnWrapMode, HostAdapterOperations.SetColumnOverflowMode, HostAdapterOperations.ResetTableColumn };
        var registry = new UiElementRegistry([
            new("scope", "scope", null, UiElementKind.Scope, "Bereich", 0, UiCapability.None, scope),
            new("table", "scope", "scope", UiElementKind.Table, "Aufgabenliste", 10, UiCapability.None, grid,
                ProtocolType: "table", AllowedOperations: tableOps, TableLayout: definition, WpfTableBinding: tableBinding),
            new("table.number", "scope", "table", UiElementKind.TableColumn, "Nummer", 11, UiCapability.Width, grid,
                ProtocolType: "tableColumn", AllowedOperations: columnOps, ColumnRole: "structureColumn", TableColumnLayout: definition.Columns[0], WpfTableColumnBinding: numberBinding),
            new("table.description", "scope", "table", UiElementKind.TableColumn, "Beschreibung", 12, UiCapability.Width, grid,
                ProtocolType: "tableColumn", AllowedOperations: columnOps, ColumnRole: "contentColumn", TableColumnLayout: definition.Columns[1], WpfTableColumnBinding: descriptionBinding),
            new("table.meta", "scope", "table", UiElementKind.TableColumn, "Status", 13, UiCapability.Width, grid,
                ProtocolType: "tableColumn", AllowedOperations: columnOps, ColumnRole: "metaColumn", TableColumnLayout: definition.Columns[2], WpfTableColumnBinding: metaBinding),
        ]);
        return new(number, description, meta, descriptionBinding, tableBinding, new WpfHostAdapter(registry));
    }

    private static ChangeRequest Request(string elementId, string operation, IReadOnlyDictionary<string, object?> payload) =>
        new(Guid.NewGuid().ToString("N"), elementId, operation, payload, DateTimeOffset.UtcNow, "m82-4-test", "scope");

    private static IReadOnlyDictionary<string, object?> TablePayload(string field, object value) =>
        new Dictionary<string, object?> { ["table"] = new Dictionary<string, object?> { [field] = value } };

    private sealed record Setup(
        DataGridTextColumn Number,
        DataGridTextColumn Description,
        DataGridTextColumn Meta,
        WpfTableColumnBinding DescriptionBinding,
        WpfTableBinding TableBinding,
        WpfHostAdapter Adapter);
}
