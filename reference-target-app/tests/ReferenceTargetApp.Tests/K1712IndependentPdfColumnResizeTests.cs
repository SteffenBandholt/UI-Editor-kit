using System.IO;
using ReferenceTargetApp.EditorIntegration.Electron;
using ReferenceTargetApp.EditorIntegration.Pdf;
using ReferenceTargetApp.Infrastructure.SampleData;
using ReferenceTargetApp.PdfPreview;
using ReferenceTargetApp.PdfRendering;
using ReferenceTargetApp.UI.ViewModels;

namespace ReferenceTargetApp.Tests;

[TestClass]
[DoNotParallelize]
public sealed class K1712IndependentPdfColumnResizeTests
{
    private const string ColumnA = "pdf.neutral.table.column.a";
    private const string ColumnB = "pdf.neutral.table.column.b";
    private const string ColumnC = "pdf.neutral.table.column.c";

    [TestMethod]
    public async Task NeutralColumnsResizeIndependentlyIgnoreRecommendationsAndPersistZero()
    {
        var root = Path.Combine(Path.GetTempPath(), "ui-editor-k17-12", Guid.NewGuid().ToString("N"));
        try
        {
            var registry = NeutralRegistry();
            var adapter = new PdfHostAdapter(registry);
            var store = new AtomicJsonPdfLayoutProfileStore(root, registry.Document.ApplicationId, registry.Document.DocumentType);
            var session = new PdfLayoutSession(adapter, store);

            AssertSuccess(adapter, Request(registry, ColumnA, 10));
            AssertWidths(adapter, 10, 30, 40);
            Assert.AreEqual(40, StartOf(adapter, ColumnC), 0.001, "C muss nach der verkleinerten A-Spalte aufschliessen.");

            AssertSuccess(adapter, Request(registry, ColumnA, 20));
            AssertSuccess(adapter, Request(registry, ColumnB, 50));
            AssertWidths(adapter, 20, 50, 40);
            Assert.AreEqual(70, StartOf(adapter, ColumnC), 0.001, "Nur B wird breiter; C verschiebt sich.");

            AssertSuccess(adapter, Request(registry, ColumnB, 0));
            AssertWidths(adapter, 20, 0, 40);
            Assert.AreEqual(20, StartOf(adapter, ColumnC), 0.001, "0 mm darf keine Phantomluecke hinterlassen.");
            Assert.IsNotNull(registry.FindById(ColumnB), "Die ausgeblendete Spalte bleibt registriert.");
            Assert.IsTrue((await session.SaveAsync()).Success);

            var restoredAdapter = new PdfHostAdapter(registry);
            var restoredSession = new PdfLayoutSession(restoredAdapter, store);
            Assert.IsTrue((await restoredSession.LoadAsync()).Success);
            AssertWidths(restoredAdapter, 20, 0, 40);
            AssertSuccess(restoredAdapter, Request(registry, ColumnB, 25));
            AssertWidths(restoredAdapter, 20, 25, 40);

            AssertSuccess(restoredAdapter, Request(registry, ColumnA, 0));
            AssertSuccess(restoredAdapter, Request(registry, ColumnB, 0));
            AssertSuccess(restoredAdapter, Request(registry, ColumnC, 180));
            AssertWidths(restoredAdapter, 0, 0, 180);
            Assert.AreEqual(0, StartOf(restoredAdapter, ColumnC), 0.001,
                "Die Seitenprüfung muss die durch ausgeblendete Vorgänger verschobene reale C-Position verwenden.");
            AssertSuccess(restoredAdapter, Request(registry, ColumnC, 40));
            AssertSuccess(restoredAdapter, Request(registry, ColumnA, 20));
            AssertSuccess(restoredAdapter, Request(registry, ColumnB, 25));

            AssertRejected(restoredAdapter, Request(registry, ColumnB, -0.1), PdfErrorCodes.InvalidNumber);
            AssertRejected(restoredAdapter, Request(registry, ColumnB, 150), PdfErrorCodes.InvalidPageZone);
        }
        finally
        {
            if (Directory.Exists(root)) Directory.Delete(root, true);
        }
    }

    [TestMethod]
    public async Task NativeMillimeterInputAndMouseDragUseTheSameSingleColumnOperation()
    {
        var root = Path.Combine(Path.GetTempPath(), "ui-editor-k17-12-vm", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            foreach (var text in new[] { "9", "5", "3,5", "20", "0" })
                Assert.IsTrue(PdfEditorWorkspaceViewModel.TryParseTableColumnWidth(text, out _), text);
            Assert.IsFalse(PdfEditorWorkspaceViewModel.TryParseTableColumnWidth("-1", out _));
            Assert.AreEqual(5, PdfEditorWorkspaceViewModel.TableColumnWidthFromDrag(9, -4), 0.001);
            Assert.AreEqual(0, PdfEditorWorkspaceViewModel.TableColumnWidthFromDrag(5, -12), 0.001);

            var registry = NeutralRegistry();
            var adapter = new PdfHostAdapter(registry);
            var session = new PdfLayoutSession(adapter,
                new AtomicJsonPdfLayoutProfileStore(root, registry.Document.ApplicationId, registry.Document.DocumentType));
            using var viewModel = new PdfEditorWorkspaceViewModel(registry, adapter, session, new PdfOrderDocumentRenderer(),
                new NativePdfPreviewRenderer(), new ReferenceOrderFactory().CreatePdfDiagnosticOrder(), Path.Combine(root, "preview.pdf"), CancellationToken.None);
            viewModel.SelectElement(ColumnA);
            viewModel.TableColumnWidthText = "3,5";
            await viewModel.ApplyTableColumnWidthForDiagnosticAsync();
            AssertWidths(adapter, 3.5, 30, 40);

            await viewModel.ApplyTableColumnDragForDiagnosticAsync(8.25);
            AssertWidths(adapter, 8.25, 30, 40);
            Assert.IsTrue(PdfEditorWorkspaceViewModel.TryParseTableColumnWidth(viewModel.TableColumnWidthText, out var displayedWidth));
            Assert.AreEqual(8.25, displayedWidth, 0.001);
        }
        finally
        {
            if (Directory.Exists(root)) Directory.Delete(root, true);
        }
    }

    [TestMethod]
    public async Task NativeRendererRemovesZeroWidthTrackAndRestoresItWithoutChangingNeighbors()
    {
        var root = Path.Combine(Path.GetTempPath(), "ui-editor-k17-12-render", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var registry = PdfOrderDocumentRegistryFactory.Create();
            var adapter = new PdfHostAdapter(registry);
            var hiddenId = PdfRegistryIds.PositionColumn;
            var nextId = PdfRegistryIds.DescriptionColumn;
            var nextWidth = State(adapter, nextId).Width!.Value;
            AssertSuccess(adapter, Request(registry, hiddenId, 0));
            var result = await new PdfOrderDocumentRenderer().RenderAsync(registry, adapter.GetCurrentLayoutState(),
                new ReferenceOrderFactory().CreatePdfDiagnosticOrder(), Path.Combine(root, "hidden.pdf"));
            Assert.IsTrue(result.Success, result.Message);
            var hidden = result.RenderBounds.First(bound => bound.ElementId == hiddenId && bound.PageNumber == 1);
            var next = result.RenderBounds.First(bound => bound.ElementId == nextId && bound.PageNumber == 1);
            Assert.AreEqual(0, hidden.Box.Width, 0.001);
            Assert.AreEqual(registry.FindById(PdfRegistryIds.Table)!.BaselineLayout.X, next.Box.X, 0.001);
            Assert.AreEqual(nextWidth, next.Box.Width, 0.001);

            AssertSuccess(adapter, Request(registry, hiddenId, registry.FindById(hiddenId)!.BaselineLayout.Width));
            var restored = await new PdfOrderDocumentRenderer().RenderAsync(registry, adapter.GetCurrentLayoutState(),
                new ReferenceOrderFactory().CreatePdfDiagnosticOrder(), Path.Combine(root, "restored.pdf"));
            Assert.IsTrue(restored.Success, restored.Message);
            Assert.AreEqual(registry.FindById(hiddenId)!.BaselineLayout.Width,
                restored.RenderBounds.First(bound => bound.ElementId == hiddenId && bound.PageNumber == 1).Box.Width, 0.001);
        }
        finally
        {
            if (Directory.Exists(root)) Directory.Delete(root, true);
        }
    }

    [TestMethod]
    public void ElectronReadbackRequiresExactWidthAndRejectsForeignAffectedStates()
    {
        var registry = NeutralRegistry();
        var adapter = new PdfHostAdapter(registry);
        var before = adapter.GetCurrentLayoutState();
        var previous = State(adapter, ColumnB);
        var next = previous with { Width = 0 };
        var request = Request(registry, ColumnB, 0);
        var accepted = new PdfChangeResult(true, request.ChangeId, request.ElementId, request.Operation, null, "ok", previous, next, true, [next]);
        Assert.IsNull(ElectronPdfPipeHostAdapter.ValidateSuccessfulChangeReadback(request, accepted, before, registry));

        var foreign = State(adapter, ColumnC) with { Width = 39 };
        var rejected = accepted with { AffectedStates = [next, foreign] };
        Assert.IsNotNull(ElectronPdfPipeHostAdapter.ValidateSuccessfulChangeReadback(request, rejected, before, registry));
    }

    private static PdfElementRegistry NeutralRegistry()
    {
        var source = PdfOrderDocumentRegistryFactory.Create();
        var table = source.FindById(PdfRegistryIds.Table)!;
        var template = source.FindById(PdfRegistryIds.PositionColumn)!;
        var columns = new[]
        {
            Column(template, ColumnA, "A", 20, 15, 130),
            Column(template, ColumnB, "B", 30, 35, 140),
            Column(template, ColumnC, "C", 40, 65, 150),
        };
        var entries = source.Entries.Where(entry => entry.Kind != PdfElementKind.TableColumn).Concat(columns).ToArray();
        var document = source.Document;
        return new(new PdfDocumentDefinition(document.DocumentId, document.ApplicationId, "neutral-columns",
            document.PageFormat, document.Orientation, document.Unit, document.Margins, document.DefaultFont,
            document.PageTemplate, entries));

        PdfElementDefinition Column(PdfElementDefinition basis, string id, string name, double width, double x, int order) => basis with
        {
            ElementId = id,
            Name = name,
            ParentId = table.ElementId,
            Role = PdfElementRole.Content,
            ColumnRole = "contentColumn",
            BaselineLayout = basis.BaselineLayout with { X = x, Width = width },
            StableOrder = order,
            LayoutBounds = new(0, 210, 0, 297, 25, 35, 1, 297),
            RefKey = "neutral.column." + name.ToLowerInvariant(),
            RendererKey = ".neutral-column-" + name.ToLowerInvariant(),
        };
    }

    private static PdfChangeRequest Request(PdfElementRegistry registry, string elementId, double width) => new(
        Guid.NewGuid().ToString("N"), elementId, PdfLayoutOperations.ResizeWidth,
        new Dictionary<string, object?> { ["width"] = width }, DateTimeOffset.UtcNow, "k17-12-test", registry.Document.DocumentId);

    private static PdfElementLayoutState State(IPdfHostAdapter adapter, string elementId) =>
        adapter.GetCurrentLayoutState().Elements.Single(entry => entry.ElementId == elementId);

    private static double StartOf(IPdfHostAdapter adapter, string elementId)
    {
        var registry = adapter.GetRegistry();
        var target = registry.FindById(elementId)!;
        return registry.Entries.Where(entry => entry.Kind == PdfElementKind.TableColumn && entry.ParentId == target.ParentId && entry.StableOrder < target.StableOrder)
            .OrderBy(entry => entry.StableOrder).Sum(entry => State(adapter, entry.ElementId).Width!.Value);
    }

    private static void AssertWidths(IPdfHostAdapter adapter, double a, double b, double c)
    {
        Assert.AreEqual(a, State(adapter, ColumnA).Width!.Value, 0.001);
        Assert.AreEqual(b, State(adapter, ColumnB).Width!.Value, 0.001);
        Assert.AreEqual(c, State(adapter, ColumnC).Width!.Value, 0.001);
    }

    private static void AssertSuccess(IPdfHostAdapter adapter, PdfChangeRequest request)
    {
        var result = adapter.SubmitChangeRequest(request);
        Assert.IsTrue(result.Success, $"{result.ErrorCode}: {result.Message}");
    }

    private static void AssertRejected(IPdfHostAdapter adapter, PdfChangeRequest request, string code)
    {
        var result = adapter.SubmitChangeRequest(request);
        Assert.IsFalse(result.Success);
        Assert.AreEqual(code, result.ErrorCode);
    }
}
