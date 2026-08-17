using System.IO;
using ReferenceTargetApp.EditorIntegration.Electron;
using ReferenceTargetApp.EditorIntegration.Pdf;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.UI.ViewModels;

namespace ReferenceTargetApp.Tests;

[TestClass]
[DoNotParallelize]
public sealed class M87PdfPositionReadbackTests
{
    [TestMethod]
    public void InspectorShowsRegisteredGeometryEvenWhenAValueIsNotEditable()
    {
        var registry = PdfOrderDocumentRegistryFactory.Create();
        var column = registry.FindById(PdfRegistryIds.TotalPriceColumn)!;
        var state = new PdfHostAdapter(registry).GetCurrentLayoutState().Elements
            .Single(element => element.ElementId == column.ElementId);

        Assert.IsNull(state.X);
        Assert.IsNull(state.Height);
        var inspected = PdfEditorWorkspaceViewModel.InspectorBoxForDiagnostic(column, state);
        Assert.AreEqual(column.BaselineLayout.X, inspected.X, 0.001);
        Assert.AreEqual(column.BaselineLayout.Width, inspected.Width, 0.001);
        Assert.AreEqual(column.BaselineLayout.Height, inspected.Height, 0.001);
    }

    [TestMethod]
    public void WholeColumnOverlayUnitesHeadingAndAllCellBounds()
    {
        var union = PdfEditorWorkspaceViewModel.UnionBoxesForDiagnostic([
            new PdfBox(157, 91, 41, 8),
            new PdfBox(157, 99, 41, 18),
            new PdfBox(157, 117, 41, 20),
        ]);

        Assert.IsNotNull(union);
        Assert.AreEqual(157, union.X, 0.001);
        Assert.AreEqual(91, union.Y, 0.001);
        Assert.AreEqual(41, union.Width, 0.001);
        Assert.AreEqual(46, union.Height, 0.001);
    }

    [TestMethod]
    public void TableColumnSelectionUsesBoundaryOverviewInsteadOfDirectWidthMode()
    {
        var registry = PdfOrderDocumentRegistryFactory.Create();
        var table = registry.FindById(PdfRegistryIds.Table)!;
        var column = registry.FindById(PdfRegistryIds.TotalPriceColumn)!;

        Assert.IsTrue(PdfEditorWorkspaceViewModel.HasTableOverviewForDiagnostic(column, PdfRegistryIds.Columns.Count));
        Assert.IsTrue(PdfEditorWorkspaceViewModel.HasTableOverviewForDiagnostic(table, PdfRegistryIds.Columns.Count));
        Assert.IsFalse(PdfEditorWorkspaceViewModel.CanUseDirectWidthModeForDiagnostic(column));
        Assert.IsTrue(PdfEditorWorkspaceViewModel.CanUseDirectWidthModeForDiagnostic(table));
    }

    [TestMethod]
    public void TableColumnInspectorUsesHorizontalTrackReadbackButKeepsRegisteredVerticalValue()
    {
        var registry = PdfOrderDocumentRegistryFactory.Create();
        var column = registry.FindById(PdfRegistryIds.TotalPriceColumn)!;
        var state = new PdfHostAdapter(registry).GetCurrentLayoutState().Elements
            .Single(element => element.ElementId == column.ElementId);
        var measured = new ElectronPdfRenderBound(column.ElementId, 1,
            new PdfBox(column.BaselineLayout.X + 1, column.BaselineLayout.Y - 12, column.BaselineLayout.Width - 1, column.BaselineLayout.Height),
            Part: "track");

        Assert.AreEqual(column.BaselineLayout.X + 1,
            PdfEditorWorkspaceViewModel.InspectorHorizontalPositionForDiagnostic(column, state, [measured]), 0.001);
        Assert.AreEqual(column.BaselineLayout.Y,
            PdfEditorWorkspaceViewModel.InspectorBoxForDiagnostic(column, state).Y, 0.001);
    }

    [TestMethod]
    public void ElectronMoveReadbackRequiresMatchingIdentityPreviousStateAndRequestedCoordinates()
    {
        var registry = PdfOrderDocumentRegistryFactory.Create();
        var host = new PdfHostAdapter(registry);
        var before = host.GetCurrentLayoutState();
        var previous = before.Elements.Single(element => element.ElementId == PdfRegistryIds.Title);
        var request = Request(previous.X!.Value + 10, previous.Y!.Value);
        var accepted = host.SubmitChangeRequest(request);
        Assert.IsTrue(accepted.Success, accepted.Message);
        Assert.IsNull(ElectronPdfPipeHostAdapter.ValidateSuccessfulChangeReadback(request, accepted, before));

        var wrongIdentity = accepted with { ChangeId = "wrong-change" };
        Assert.AreEqual(ElectronEditorErrorCodes.ChangeReadbackFailed,
            ElectronPdfPipeHostAdapter.ValidateSuccessfulChangeReadback(request, wrongIdentity, before)!.ErrorCode);

        var missingState = accepted with { NewState = null };
        Assert.AreEqual(ElectronEditorErrorCodes.ChangeReadbackFailed,
            ElectronPdfPipeHostAdapter.ValidateSuccessfulChangeReadback(request, missingState, before)!.ErrorCode);

        var unchanged = accepted with { NewState = accepted.PreviousState };
        Assert.AreEqual(ElectronEditorErrorCodes.ChangeReadbackFailed,
            ElectronPdfPipeHostAdapter.ValidateSuccessfulChangeReadback(request, unchanged, before)!.ErrorCode);
    }

    [TestMethod]
    public void ElectronMoveReadbackAcceptsSingleAxisPayloadAndKeepsOtherAxis()
    {
        var registry = PdfOrderDocumentRegistryFactory.Create();
        var host = new PdfHostAdapter(registry);
        var before = host.GetCurrentLayoutState();
        var previous = before.Elements.Single(element => element.ElementId == PdfRegistryIds.Title);
        var request = new PdfChangeRequest("move-x-only", PdfRegistryIds.Title, PdfLayoutOperations.Move,
            new Dictionary<string, object?> { ["x"] = previous.X!.Value + 10 }, DateTimeOffset.UtcNow,
            "m87-position-readback", registry.Document.DocumentId);
        var accepted = host.SubmitChangeRequest(request);

        Assert.IsTrue(accepted.Success, accepted.Message);
        Assert.AreEqual(previous.Y, accepted.NewState!.Y);
        Assert.IsNull(ElectronPdfPipeHostAdapter.ValidateSuccessfulChangeReadback(request, accepted, before));
    }

    [TestMethod]
    public void RegeneratedPreviewMustConfirmMovedCoordinatesFromRealRendererMetadata()
    {
        var registry = PdfOrderDocumentRegistryFactory.Create();
        var host = new PdfHostAdapter(registry);
        var baseline = host.GetCurrentLayoutState().Elements.Single(element => element.ElementId == PdfRegistryIds.Title);
        var request = Request(baseline.X!.Value + 10, baseline.Y!.Value);
        Assert.IsTrue(host.SubmitChangeRequest(request).Success);
        var moved = host.GetCurrentLayoutState();
        var current = moved.Elements.Single(element => element.ElementId == PdfRegistryIds.Title);
        var valid = Metadata(new ElectronPdfRenderBound(PdfRegistryIds.Title, 1,
            new PdfBox(42, 17, 60, 10), AppliedX: current.X, AppliedY: current.Y));
        Assert.IsNull(ElectronPdfPipeHostAdapter.ValidatePreviewPositionReadback(registry, moved, valid));

        var ignored = Metadata(new ElectronPdfRenderBound(PdfRegistryIds.Title, 1,
            new PdfBox(32, 17, 60, 10), AppliedX: baseline.X, AppliedY: baseline.Y));
        StringAssert.Contains(ElectronPdfPipeHostAdapter.ValidatePreviewPositionReadback(registry, moved, ignored)!, PdfRegistryIds.Title);

        var missing = Metadata();
        StringAssert.Contains(ElectronPdfPipeHostAdapter.ValidatePreviewPositionReadback(registry, moved, missing)!, "fehlt");
    }

    [TestMethod]
    public async Task RejectedMoveLeavesSessionCleanAndCreatesNoUndoEntry()
    {
        var root = Path.Combine(Path.GetTempPath(), "ui-editor-kit-m87", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var adapter = new RejectingAsyncAdapter();
            var session = new PdfLayoutSession(adapter, new AtomicJsonPdfLayoutProfileStore(root));
            var current = adapter.GetCurrentLayoutState().Elements.Single(element => element.ElementId == PdfRegistryIds.Title);
            var result = await session.ApplyBatchAsync([Request(current.X!.Value + 10, current.Y!.Value)]);

            Assert.IsFalse(result.Success);
            Assert.IsFalse(session.GetStatus().IsDirty);
            Assert.IsFalse(session.CanUndo);
            Assert.AreEqual(current.X, session.GetStatus().Working.Elements.Single(element => element.ElementId == PdfRegistryIds.Title).X);
        }
        finally { Directory.Delete(root, true); }
    }

    private static PdfChangeRequest Request(double x, double y) => new(
        "move-title", PdfRegistryIds.Title, PdfLayoutOperations.Move,
        new Dictionary<string, object?> { ["x"] = x, ["y"] = y }, DateTimeOffset.UtcNow,
        "m87-position-readback", PdfRegistryIds.Scope);

    private static ElectronPdfPreviewMetadata Metadata(params ElectronPdfRenderBound[] bounds) => new(
        "current", false, 1, 1, DateTimeOffset.UtcNow, "document", "controlled.pdf", bounds);

    private sealed class RejectingAsyncAdapter : IAsyncPdfHostAdapter
    {
        private readonly PdfHostAdapter inner = new(PdfOrderDocumentRegistryFactory.Create());
        public PdfElementRegistry GetRegistry() => inner.GetRegistry();
        public PdfLayoutState GetCurrentLayoutState() => inner.GetCurrentLayoutState();
        public PdfChangeResult SubmitChangeRequest(PdfChangeRequest request) =>
            PdfChangeResult.Reject(request, ElectronEditorErrorCodes.ChangeReadbackFailed, "Readback abgelehnt.");
        public Task<PdfChangeResult> SubmitChangeRequestAsync(PdfChangeRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(SubmitChangeRequest(request));
    }
}
