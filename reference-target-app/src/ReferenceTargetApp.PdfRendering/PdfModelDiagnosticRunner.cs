using System.IO;
using ReferenceTargetApp.Domain.Models;
using ReferenceTargetApp.EditorIntegration.Pdf;

namespace ReferenceTargetApp.PdfRendering;

public sealed record PdfModelDiagnosticResult(bool Success, string Code, string Message, int BaselinePages, int ChangedPages,
    int LoadedPages, bool LayoutChangesProven, bool RollbackProven, bool BusinessDataUnchanged, bool CleanupSucceeded);

public sealed class PdfModelDiagnosticRunner
{
    public async Task<PdfModelDiagnosticResult> RunAsync(string rootDirectory, Order order, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(rootDirectory);
        ArgumentNullException.ThrowIfNull(order);
        var root = Path.GetFullPath(rootDirectory);
        var baselinePages = 0;
        var changedPages = 0;
        var loadedPages = 0;
        var changesProven = false;
        var rollbackProven = false;
        var businessBefore = BusinessSnapshot(order);
        try
        {
            Directory.CreateDirectory(root);
            var registry = PdfOrderDocumentRegistryFactory.Create();
            if (!PdfRegistryValidator.Validate(registry.Document).Success) return Fail("pdf_registry_invalid", "PDF-Registry ist ungültig.");
            var adapter = new PdfHostAdapter(registry);
            var store = new AtomicJsonPdfLayoutProfileStore(root);
            var session = new PdfLayoutSession(adapter, store);
            var renderer = new PdfOrderDocumentRenderer();
            var baselinePath = Path.Combine(root, "baseline.pdf");
            var changedPath = Path.Combine(root, "changed.pdf");
            var loadedPath = Path.Combine(root, "loaded.pdf");

            var baseline = await renderer.RenderAsync(registry, adapter.GetCurrentLayoutState(), order, baselinePath, null, cancellationToken).ConfigureAwait(false);
            if (!baseline.Success || baseline.PageCount < 2) return Fail(baseline.Code, baseline.Message);
            baselinePages = baseline.PageCount;
            if (!RepeatedMarkers(baseline, "header") || !RepeatedMarkers(baseline, "footer") || !RepeatedMarkers(baseline, "table-header") ||
                !baseline.Traces.Any(trace => trace.Marker == "summary") || !baseline.Traces.Any(trace => trace.Marker == "logo"))
                return Fail(PdfErrorCodes.RenderFailed, "Baseline-PDF enthält nicht alle wiederholten Bereiche.");

            var changes = new[]
            {
                Request(PdfRegistryIds.Title, PdfLayoutOperations.Move, new Dictionary<string, object?> { ["x"] = 123d, ["y"] = 18d }),
                Request(PdfRegistryIds.Title, PdfLayoutOperations.TextResize, Text("fontSize", 5.5d)),
                Request(PdfRegistryIds.Sender, PdfLayoutOperations.TextMove, new Dictionary<string, object?> { ["text"] = new Dictionary<string, object?> { ["offsetX"] = 2d, ["offsetY"] = 1.5d } }),
                Request(PdfRegistryIds.Logo, PdfLayoutOperations.ResizeHeight, new Dictionary<string, object?> { ["height"] = 16d }),
                Request(PdfRegistryIds.DescriptionColumn, PdfLayoutOperations.ResizeWidth, new Dictionary<string, object?> { ["width"] = 65d }),
                Request(PdfRegistryIds.Header, PdfLayoutOperations.ResizeHeight, new Dictionary<string, object?> { ["height"] = 48d }),
                Request(PdfRegistryIds.Footer, PdfLayoutOperations.ResizeHeight, new Dictionary<string, object?> { ["height"] = 19d })
            };
            var batch = await session.ApplyBatchAsync(changes, cancellationToken).ConfigureAwait(false);
            if (!batch.Success || !session.GetStatus().IsDirty) return Fail(batch.Code, batch.Message);
            var changedState = adapter.GetCurrentLayoutState();
            var changed = await renderer.RenderAsync(registry, changedState, order, changedPath, null, cancellationToken).ConfigureAwait(false);
            if (!changed.Success) return Fail(changed.Code, changed.Message);
            changedPages = changed.PageCount;
            var baselineTitle = baseline.Traces.First(trace => trace.ElementId == PdfRegistryIds.Title);
            var changedTitle = changed.Traces.First(trace => trace.ElementId == PdfRegistryIds.Title);
            var baselineLogo = baseline.Traces.First(trace => trace.ElementId == PdfRegistryIds.Logo);
            var changedLogo = changed.Traces.First(trace => trace.ElementId == PdfRegistryIds.Logo);
            var baselineSender = baseline.Traces.First(trace => trace.ElementId == PdfRegistryIds.Sender);
            var changedSender = changed.Traces.First(trace => trace.ElementId == PdfRegistryIds.Sender);
            var baselineHeader = baseline.Traces.First(trace => trace.ElementId == PdfRegistryIds.Header);
            var changedHeader = changed.Traces.First(trace => trace.ElementId == PdfRegistryIds.Header);
            var baselineFooter = baseline.Traces.First(trace => trace.ElementId == PdfRegistryIds.Footer);
            var changedFooter = changed.Traces.First(trace => trace.ElementId == PdfRegistryIds.Footer);
            changesProven = changedTitle.Box.X != baselineTitle.Box.X && changedTitle.Box.FontSize != baselineTitle.Box.FontSize &&
                            changedLogo.Box.Height != baselineLogo.Box.Height && changedSender.Box.X != baselineSender.Box.X &&
                            changedHeader.Box.Height != baselineHeader.Box.Height && changedFooter.Box.Height != baselineFooter.Box.Height &&
                            changed.Traces.Any(trace => trace.Marker == "table-header" && trace.Box.Width < 180);
            if (!changesProven || changedPages != baselinePages) return Fail(PdfErrorCodes.RenderFailed, "Layoutänderungen oder reproduzierbare Seitenzahl sind nicht nachgewiesen.");

            var save = await session.SaveAsync(cancellationToken).ConfigureAwait(false);
            if (!save.Success || session.GetStatus().IsDirty || !store.FilePath.Contains("pdf-layouts", StringComparison.Ordinal)) return Fail(save.Code, save.Message);
            var savedTitleX = State(adapter, PdfRegistryIds.Title).X;
            if (!adapter.SubmitChangeRequest(Request(PdfRegistryIds.Title, PdfLayoutOperations.Move, new Dictionary<string, object?> { ["x"] = 121d })).Success)
                return Fail(PdfErrorCodes.BatchFailed, "Working-State konnte nicht für Discard geändert werden.");
            if (!(await session.DiscardAsync(cancellationToken).ConfigureAwait(false)).Success || State(adapter, PdfRegistryIds.Title).X != savedTitleX)
                return Fail(PdfErrorCodes.BatchFailed, "Discard stellte SAVED nicht wieder her.");
            if (!(await session.ResetAsync(cancellationToken).ConfigureAwait(false)).Success || State(adapter, PdfRegistryIds.Title).X != 125d || !session.GetStatus().IsDirty)
                return Fail(PdfErrorCodes.BatchFailed, "Reset stellte BASELINE nicht wieder her.");
            if (!(await session.LoadAsync(cancellationToken).ConfigureAwait(false)).Success || State(adapter, PdfRegistryIds.Title).X != savedTitleX || session.GetStatus().IsDirty)
                return Fail(PdfErrorCodes.LoadFailed, "Load stellte den Datenträgerzustand nicht wieder her.");
            var loaded = await renderer.RenderAsync(registry, adapter.GetCurrentLayoutState(), order, loadedPath, null, cancellationToken).ConfigureAwait(false);
            if (!loaded.Success || loaded.PageCount != baselinePages) return Fail(loaded.Code, loaded.Message);
            loadedPages = loaded.PageCount;

            var beforeFailure = AtomicJsonPdfLayoutProfileStore.Clone(adapter.GetCurrentLayoutState());
            var faulting = new FailingPdfHostAdapter(adapter, PdfRegistryIds.Logo);
            var rollbackSession = new PdfLayoutSession(faulting, store);
            var failedBatch = await rollbackSession.ApplyBatchAsync([
                Request(PdfRegistryIds.Title, PdfLayoutOperations.Move, new Dictionary<string, object?> { ["x"] = 122d }),
                Request(PdfRegistryIds.Logo, PdfLayoutOperations.ResizeWidth, new Dictionary<string, object?> { ["width"] = 17d })
            ], cancellationToken).ConfigureAwait(false);
            rollbackProven = !failedBatch.Success && failedBatch.RollbackSucceeded && Equivalent(beforeFailure, adapter.GetCurrentLayoutState());
            if (!rollbackProven) return Fail(PdfErrorCodes.RollbackFailed, "Kontrollierter PDF-Batchrollback ist fehlgeschlagen.");

            var validBytes = await File.ReadAllBytesAsync(loadedPath, cancellationToken).ConfigureAwait(false);
            var renderFailure = await renderer.RenderAsync(registry, adapter.GetCurrentLayoutState(), order, loadedPath,
                new ThrowingRenderFault(), cancellationToken).ConfigureAwait(false);
            var bytesAfterRenderFailure = await File.ReadAllBytesAsync(loadedPath, cancellationToken).ConfigureAwait(false);
            if (renderFailure.Success || renderFailure.Code != PdfErrorCodes.RenderFailed ||
                !validBytes.SequenceEqual(bytesAfterRenderFailure))
                return Fail(PdfErrorCodes.RenderFailed, "Vorherige gültige PDF blieb bei Renderfehler nicht unverändert.");

            var businessUnchanged = businessBefore.SequenceEqual(BusinessSnapshot(order), StringComparer.Ordinal);
            if (!businessUnchanged) return Fail(PdfErrorCodes.RenderFailed, "Fachdaten wurden verändert.");
            return new(true, "pdf_model_diagnostic_ok", "M76 PDF-Diagnose vollständig erfolgreich.", baselinePages,
                changedPages, loadedPages, changesProven, rollbackProven, true, true);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or InvalidOperationException or ArgumentException)
        {
            return Fail(PdfErrorCodes.RenderFailed, exception.Message);
        }
        finally
        {
            try { if (Directory.Exists(root)) Directory.Delete(root, true); }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { }
        }

        PdfModelDiagnosticResult Fail(string code, string message) => new(false, code, message, baselinePages, changedPages,
            loadedPages, changesProven, rollbackProven, businessBefore.SequenceEqual(BusinessSnapshot(order), StringComparer.Ordinal), false);
    }

    private static bool RepeatedMarkers(PdfRenderResult result, string marker) =>
        result.Traces.Count(trace => trace.Marker == marker) == result.PageCount;

    private static PdfElementLayoutState State(IPdfHostAdapter adapter, string id) =>
        adapter.GetCurrentLayoutState().Elements.Single(element => element.ElementId == id);

    private static PdfChangeRequest Request(string elementId, string operation, IReadOnlyDictionary<string, object?> payload) =>
        new(Guid.NewGuid().ToString("N"), elementId, operation, payload, DateTimeOffset.UtcNow, "m76-diagnostic", PdfRegistryIds.Scope);

    private static IReadOnlyDictionary<string, object?> Text(string key, double value) =>
        new Dictionary<string, object?> { ["text"] = new Dictionary<string, object?> { [key] = value } };

    private static string[] BusinessSnapshot(Order order) =>
        [order.OrderNumber, order.OrderDate.ToString("O"), order.DueDate.ToString("O"), order.Subject, order.ResponsiblePerson,
            order.Customer.CompanyName, order.Customer.ContactName, order.Customer.Street, order.Customer.PostalCode,
            order.Customer.City, order.Customer.Email, order.NetTotal.ToString(), order.TaxAmount.ToString(), order.GrossTotal.ToString(),
            .. order.Positions.Select(position => $"{position.PositionNumber}|{position.Description}|{position.Quantity}|{position.Unit}|{position.UnitPrice}|{position.NetAmount}")];

    private static bool Equivalent(PdfLayoutState left, PdfLayoutState right) =>
        left.Elements.SequenceEqual(right.Elements, new LayoutComparer());

    private sealed class LayoutComparer : IEqualityComparer<PdfElementLayoutState>
    {
        public bool Equals(PdfElementLayoutState? x, PdfElementLayoutState? y) => x == y;
        public int GetHashCode(PdfElementLayoutState obj) => obj.GetHashCode();
    }

    private sealed class FailingPdfHostAdapter(IPdfHostAdapter inner, string failElementId) : IPdfHostAdapter
    {
        private bool failed;
        public PdfElementRegistry GetRegistry() => inner.GetRegistry();
        public PdfLayoutState GetCurrentLayoutState() => inner.GetCurrentLayoutState();
        public PdfChangeResult SubmitChangeRequest(PdfChangeRequest request)
        {
            if (!failed && request.ElementId == failElementId && !request.Source.EndsWith("rollback", StringComparison.Ordinal))
            {
                failed = true;
                return PdfChangeResult.Reject(request, PdfErrorCodes.BatchFailed, "Absichtlich provozierter PDF-Adapterfehler.");
            }
            return inner.SubmitChangeRequest(request);
        }
    }

    private sealed class ThrowingRenderFault : IPdfRenderFaultInjector
    {
        public void BeforeSerialization(int pageCount) => throw new InvalidOperationException("Absichtlich provozierter PDF-Renderfehler.");
    }
}
