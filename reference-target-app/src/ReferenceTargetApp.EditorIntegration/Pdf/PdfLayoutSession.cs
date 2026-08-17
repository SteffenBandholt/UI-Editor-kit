namespace ReferenceTargetApp.EditorIntegration.Pdf;

public sealed record PdfLayoutFailure(string ElementId, string Operation, string Code, string Message);
public sealed record PdfLayoutOperationResult(bool Success, string Code, string Message, bool RollbackSucceeded = true,
    IReadOnlyList<PdfLayoutFailure>? Failures = null);
public sealed record PdfLayoutSessionStatus(bool IsDirty, PdfLayoutState Working, PdfLayoutState Saved, PdfLayoutState Baseline)
{
    public IReadOnlyList<string> DirtyElementIds => Working.Elements
        .Where(element => !ElementEquivalent(element, Saved.Elements.Single(saved => saved.ElementId == element.ElementId)))
        .Select(element => element.ElementId).ToArray();

    private static bool ElementEquivalent(PdfElementLayoutState left, PdfElementLayoutState right) =>
        left.ElementId == right.ElementId && Same(left.X, right.X) && Same(left.Y, right.Y) &&
        Same(left.Width, right.Width) && Same(left.Height, right.Height) &&
        Same(left.TextOffsetX, right.TextOffsetX) && Same(left.TextOffsetY, right.TextOffsetY) && Same(left.FontSize, right.FontSize) &&
        left.TextAlignment == right.TextAlignment && Same(left.LineSpacing, right.LineSpacing) && left.Visible == right.Visible &&
        Same(left.MarginTop, right.MarginTop) && Same(left.MarginRight, right.MarginRight) && Same(left.MarginBottom, right.MarginBottom) && Same(left.MarginLeft, right.MarginLeft);

    private static bool Same(double? left, double? right) => left is null && right is null ||
        left.HasValue && right.HasValue && Math.Abs(left.Value - right.Value) <= 0.000001;
}

public sealed class PdfLayoutSession
{
    private const double Epsilon = 0.000001;
    private readonly IPdfHostAdapter adapter;
    private readonly AtomicJsonPdfLayoutProfileStore store;
    private readonly SemaphoreSlim operationLock = new(1, 1);
    private readonly PdfLayoutState baseline;
    private PdfLayoutState saved;
    private readonly Stack<PdfLayoutState> undo = new();

    public PdfLayoutSession(IPdfHostAdapter adapter, AtomicJsonPdfLayoutProfileStore store)
    {
        this.adapter = adapter ?? throw new ArgumentNullException(nameof(adapter));
        this.store = store ?? throw new ArgumentNullException(nameof(store));
        baseline = Clone(adapter.GetCurrentLayoutState());
        saved = Clone(baseline);
    }

    public PdfLayoutSessionStatus GetStatus()
    {
        var working = Clone(adapter.GetCurrentLayoutState());
        return new(!Equivalent(working, saved), working, Clone(saved), Clone(baseline));
    }

    public bool CanUndo => undo.Count > 0;

    public Task<PdfLayoutOperationResult> SaveAsync(CancellationToken cancellationToken = default) => Exclusive(async () =>
    {
        var working = Clone(adapter.GetCurrentLayoutState());
        var result = await store.SaveAsync(adapter.GetRegistry(), working, cancellationToken).ConfigureAwait(false);
        if (!result.Success) return Fail(result.Code, result.Message);
        saved = Clone(working);
        return Ok("pdf_layout_saved", "PDF-Layout gespeichert.");
    }, cancellationToken);

    public Task<PdfLayoutOperationResult> LoadAsync(CancellationToken cancellationToken = default) => Exclusive(async () =>
    {
        var load = await store.LoadAsync(adapter.GetRegistry(), cancellationToken).ConfigureAwait(false);
        if (!load.Success || !load.Found || load.Document is null) return Fail(load.Code, load.Message);
        var applied = await ApplyStateAsync(load.Document.LayoutState, "pdf-load", cancellationToken).ConfigureAwait(false);
        if (!applied.Success) return applied;
        saved = Clone(load.Document.LayoutState);
        undo.Clear();
        return Ok("pdf_layout_loaded", "PDF-Layout vom Datenträger geladen.");
    }, cancellationToken);

    public Task<PdfLayoutOperationResult> DiscardAsync(CancellationToken cancellationToken = default) =>
        Exclusive(() => ApplyStateWithUndoAsync(saved, "pdf-discard", cancellationToken), cancellationToken);

    public Task<PdfLayoutOperationResult> ResetAsync(CancellationToken cancellationToken = default) =>
        Exclusive(() => ApplyStateWithUndoAsync(baseline, "pdf-reset", cancellationToken), cancellationToken);

    public Task<PdfLayoutOperationResult> DiscardElementAsync(string elementId, CancellationToken cancellationToken = default) =>
        ApplyElementAsync(elementId, saved, "pdf-discard-element", cancellationToken);

    public Task<PdfLayoutOperationResult> ResetElementAsync(string elementId, CancellationToken cancellationToken = default) =>
        ApplyElementAsync(elementId, baseline, "pdf-reset-element", cancellationToken);

    public Task<PdfLayoutOperationResult> ResetTableAsync(string tableElementId, CancellationToken cancellationToken = default) =>
        Exclusive(async () =>
        {
            var registry = adapter.GetRegistry();
            var table = registry.FindById(tableElementId);
            if (table?.Kind != PdfElementKind.Table)
                return Fail(PdfErrorCodes.UnknownElement, "PDF-Tabelle ist nicht registriert: " + tableElementId);
            var tableIds = registry.Entries
                .Where(entry => entry.ElementId == tableElementId || entry.ParentId == tableElementId)
                .Select(entry => entry.ElementId)
                .ToHashSet(StringComparer.Ordinal);
            var baselineById = baseline.Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
            var current = adapter.GetCurrentLayoutState();
            var merged = new PdfLayoutState(registry.Document.DocumentId, DateTimeOffset.UtcNow,
                current.Elements.Select(element => tableIds.Contains(element.ElementId)
                    ? baselineById[element.ElementId] with { }
                    : element with { }).ToArray());
            return await ApplyStateWithUndoAsync(merged, "pdf-reset-table", cancellationToken).ConfigureAwait(false);
        }, cancellationToken);

    public Task<PdfLayoutOperationResult> ApplyBatchAsync(IEnumerable<PdfChangeRequest> requests, CancellationToken cancellationToken = default) =>
        Exclusive(async () =>
        {
            var original = Clone(adapter.GetCurrentLayoutState());
            var result = await ApplyRequestsAsync(requests.ToArray(), "pdf-batch", cancellationToken).ConfigureAwait(false);
            if (result.Success && !Equivalent(original, adapter.GetCurrentLayoutState())) undo.Push(original);
            return result;
        }, cancellationToken);

    public Task<PdfLayoutOperationResult> UndoAsync(CancellationToken cancellationToken = default) => Exclusive(async () =>
    {
        if (undo.Count == 0) return Fail("pdf_undo_empty", "Es gibt keine PDF-LayoutÃ¤nderung zum RÃ¼ckgÃ¤ngigmachen.");
        var target = undo.Peek();
        var result = await ApplyStateAsync(target, "pdf-undo", cancellationToken).ConfigureAwait(false);
        if (result.Success) undo.Pop();
        return result.Success ? Ok("pdf_layout_undone", "Letzte PDF-LayoutÃ¤nderung rÃ¼ckgÃ¤ngig gemacht.") : result;
    }, cancellationToken);

    private async Task<PdfLayoutOperationResult> Exclusive(Func<Task<PdfLayoutOperationResult>> operation, CancellationToken cancellationToken)
    {
        if (!await operationLock.WaitAsync(0, cancellationToken).ConfigureAwait(false)) return Fail(PdfErrorCodes.BatchFailed, "PDF-Batchoperation läuft bereits.");
        try { return await operation().ConfigureAwait(false); }
        catch (OperationCanceledException) { return Fail("cancelled", "PDF-Layoutoperation wurde abgebrochen."); }
        finally { operationLock.Release(); }
    }

    private Task<PdfLayoutOperationResult> ApplyElementAsync(string elementId, PdfLayoutState desired, string source,
        CancellationToken cancellationToken)
    {
        return Exclusive(async () =>
        {
            if (adapter.GetRegistry().FindById(elementId) is null)
                return Fail(PdfErrorCodes.UnknownElement, "PDF-Element ist nicht registriert: " + elementId);
            var current = adapter.GetCurrentLayoutState();
            var target = desired.Elements.Single(element => element.ElementId == elementId);
            var merged = new PdfLayoutState(adapter.GetRegistry().Document.DocumentId, DateTimeOffset.UtcNow,
                current.Elements.Select(element => element.ElementId == elementId ? target with { } : element with { }).ToArray());
            return await ApplyStateWithUndoAsync(merged, source, cancellationToken).ConfigureAwait(false);
        }, cancellationToken);
    }

    private async Task<PdfLayoutOperationResult> ApplyStateWithUndoAsync(PdfLayoutState desired, string source, CancellationToken cancellationToken)
    {
        var original = Clone(adapter.GetCurrentLayoutState());
        var result = await ApplyStateAsync(desired, source, cancellationToken).ConfigureAwait(false);
        if (result.Success && !Equivalent(original, adapter.GetCurrentLayoutState())) undo.Push(original);
        return result;
    }

    private async Task<PdfLayoutOperationResult> ApplyStateAsync(PdfLayoutState desired, string source, CancellationToken cancellationToken)
    {
        var validation = PdfLayoutProfileDocumentValidator.Validate(new(
            PdfLayoutProfileDocumentValidator.SchemaVersion, PdfLayoutProfileDocumentValidator.DocumentKind,
            adapter.GetRegistry().Document.ApplicationId, adapter.GetRegistry().Document.DocumentType,
            PdfLayoutProfileDocumentValidator.ProfileId, adapter.GetRegistry().Document.DocumentId, DateTimeOffset.UtcNow,
            PdfRegistryFingerprint.Create(adapter.GetRegistry()), desired), adapter.GetRegistry());
        if (!validation.Success) return Fail(validation.Code, validation.Message);
        return await ApplyRequestsAsync(CreateRequests(adapter.GetCurrentLayoutState(), desired, source, adapter.GetRegistry()), source, cancellationToken).ConfigureAwait(false);
    }

    private async Task<PdfLayoutOperationResult> ApplyRequestsAsync(IReadOnlyList<PdfChangeRequest> requests, string source, CancellationToken cancellationToken)
    {
        var original = Clone(adapter.GetCurrentLayoutState());
        var failures = new List<PdfLayoutFailure>();
        foreach (var request in requests)
        {
            var result = await SubmitAsync(request, cancellationToken).ConfigureAwait(false);
            if (result.Success) continue;
            failures.Add(new(result.ElementId, result.Operation, result.ErrorCode ?? PdfErrorCodes.BatchFailed, result.Message));
            var rollbackFailures = await RollbackAsync(original, source + "-rollback", cancellationToken).ConfigureAwait(false);
            failures.AddRange(rollbackFailures);
            if (rollbackFailures.Count == 0 && requests.Count == 1)
                return new(false, failures[0].Code, failures[0].Message, true, failures);
            return new(false, rollbackFailures.Count == 0 ? PdfErrorCodes.BatchFailed : PdfErrorCodes.RollbackFailed,
                rollbackFailures.Count == 0 ? "PDF-Batch fehlgeschlagen; Ausgangszustand wurde wiederhergestellt." : "PDF-Batch und Rollback sind fehlgeschlagen.",
                rollbackFailures.Count == 0, failures);
        }
        return Ok("pdf_batch_applied", "PDF-Layoutbatch vollständig angewandt.");
    }

    private async Task<IReadOnlyList<PdfLayoutFailure>> RollbackAsync(PdfLayoutState original, string source, CancellationToken cancellationToken)
    {
        var failures = new List<PdfLayoutFailure>();
        foreach (var request in CreateRequests(adapter.GetCurrentLayoutState(), original, source, adapter.GetRegistry()))
        {
            var result = await SubmitAsync(request, cancellationToken).ConfigureAwait(false);
            if (!result.Success) failures.Add(new(result.ElementId, result.Operation, result.ErrorCode ?? PdfErrorCodes.RollbackFailed, result.Message));
        }
        return failures;
    }

    private Task<PdfChangeResult> SubmitAsync(PdfChangeRequest request, CancellationToken cancellationToken) =>
        adapter is IAsyncPdfHostAdapter asyncAdapter
            ? asyncAdapter.SubmitChangeRequestAsync(request, cancellationToken)
            : Task.FromResult(adapter.SubmitChangeRequest(request));

    internal static IReadOnlyList<PdfChangeRequest> CreateRequests(PdfLayoutState current, PdfLayoutState desired, string source, PdfElementRegistry? registry = null)
    {
        var now = DateTimeOffset.UtcNow;
        var currentById = current.Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
        var desiredById = desired.Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
        var requests = new List<(int Phase, int Order, PdfChangeRequest Request)>();
        var boundaryManagedColumnIds = new HashSet<string>(StringComparer.Ordinal);
        var atomicOuterResizeTableIds = new HashSet<string>(StringComparer.Ordinal);
        var order = 0;
        if (registry is not null)
        {
            foreach (var table in registry.Entries.Where(entry => entry.Kind == PdfElementKind.Table &&
                         entry.BoundaryResizePolicy == PdfTableBoundaryResizePolicies.AdjacentPreserveTotal))
            {
                var columns = registry.Entries.Where(entry => entry.Kind == PdfElementKind.TableColumn && entry.ParentId == table.ElementId)
                    .OrderBy(entry => entry.StableOrder).ToArray();
                if (columns.Length < 2 || !currentById.TryGetValue(table.ElementId, out var currentTable) ||
                    !desiredById.TryGetValue(table.ElementId, out var desiredTable) ||
                    columns.Any(column => !currentById.ContainsKey(column.ElementId) || !desiredById.ContainsKey(column.ElementId))) continue;

                var currentWidths = columns.Select(column => currentById[column.ElementId].Width!.Value).ToArray();
                var desiredWidths = columns.Select(column => desiredById[column.ElementId].Width!.Value).ToArray();
                var tableDelta = desiredTable.Width!.Value - currentTable.Width!.Value;
                if (!Same(tableDelta, 0) && Same(desiredWidths[^1] - currentWidths[^1], tableDelta))
                {
                    currentWidths[^1] += tableDelta;
                    atomicOuterResizeTableIds.Add(table.ElementId);
                }
                if (!Same(currentWidths.Sum(), desiredWidths.Sum()) || !Same(desiredWidths.Sum(), desiredTable.Width)) continue;

                var currentPrefix = 0d;
                var desiredPrefix = 0d;
                for (var index = 0; index + 1 < columns.Length; index++)
                {
                    currentPrefix += currentWidths[index];
                    desiredPrefix += desiredWidths[index];
                    var delta = desiredPrefix - currentPrefix;
                    if (Same(delta, 0)) continue;
                    requests.Add((3, order++, new(Guid.NewGuid().ToString("N"), table.ElementId,
                        PdfLayoutOperations.ResizeColumnBoundary, new Dictionary<string, object?>
                        {
                            ["table"] = new Dictionary<string, object?>
                            {
                                ["leftColumnId"] = columns[index].ElementId,
                                ["rightColumnId"] = columns[index + 1].ElementId,
                                ["delta"] = delta,
                            },
                        }, now, source, current.ScopeId)));
                }
                foreach (var column in columns.Where((column, index) => !Same(currentById[column.ElementId].Width, desiredWidths[index])))
                    boundaryManagedColumnIds.Add(column.ElementId);
            }
        }
        foreach (var target in desired.Elements)
        {
            var existing = currentById[target.ElementId];
            if (target.X.HasValue && (!Same(target.X, existing.X) || !Same(target.Y, existing.Y)))
                Add(3, PdfLayoutOperations.Move, new Dictionary<string, object?> { ["x"] = target.X, ["y"] = target.Y });
            if (target.Width.HasValue && !Same(target.Width, existing.Width))
            {
                var definition = registry?.FindById(target.ElementId);
                var isTable = definition?.Kind == PdfElementKind.Table || target.ElementId == PdfRegistryIds.Table;
                var isColumn = definition?.Kind == PdfElementKind.TableColumn || PdfRegistryIds.Columns.Contains(target.ElementId);
                if (isColumn && boundaryManagedColumnIds.Contains(target.ElementId)) continue;
                var phase = isTable ? atomicOuterResizeTableIds.Contains(target.ElementId) || target.Width > existing.Width ? 0 : 5
                    : isColumn ? target.Width < existing.Width ? 1 : 4 : 3;
                Add(phase, PdfLayoutOperations.ResizeWidth, new Dictionary<string, object?> { ["width"] = target.Width });
            }
            if (target.Height.HasValue && !Same(target.Height, existing.Height))
                Add(3, PdfLayoutOperations.ResizeHeight, new Dictionary<string, object?> { ["height"] = target.Height });
            if (target.TextOffsetX.HasValue && (!Same(target.TextOffsetX, existing.TextOffsetX) || !Same(target.TextOffsetY, existing.TextOffsetY)))
                Add(3, PdfLayoutOperations.TextMove, new Dictionary<string, object?> { ["text"] = new Dictionary<string, object?> { ["offsetX"] = target.TextOffsetX, ["offsetY"] = target.TextOffsetY } });
            if (target.FontSize.HasValue && !Same(target.FontSize, existing.FontSize))
                Add(3, PdfLayoutOperations.TextResize, new Dictionary<string, object?> { ["text"] = new Dictionary<string, object?> { ["fontSize"] = target.FontSize } });
            if (target.TextAlignment is not null && target.TextAlignment != existing.TextAlignment)
                Add(3, PdfLayoutOperations.SetTextAlignment, new Dictionary<string, object?> { ["textAlignment"] = target.TextAlignment });
            if (target.LineSpacing.HasValue && !Same(target.LineSpacing, existing.LineSpacing))
                Add(3, PdfLayoutOperations.SetLineSpacing, new Dictionary<string, object?> { ["lineSpacing"] = target.LineSpacing });
            if (target.Visible.HasValue && target.Visible != existing.Visible)
                Add(3, PdfLayoutOperations.SetVisibility, new Dictionary<string, object?> { ["visible"] = target.Visible });
            if (target.MarginTop.HasValue && (!Same(target.MarginTop, existing.MarginTop) || !Same(target.MarginRight, existing.MarginRight) ||
                                             !Same(target.MarginBottom, existing.MarginBottom) || !Same(target.MarginLeft, existing.MarginLeft)))
                Add(3, PdfLayoutOperations.SetPageMargins, new Dictionary<string, object?> { ["marginTop"] = target.MarginTop, ["marginRight"] = target.MarginRight, ["marginBottom"] = target.MarginBottom, ["marginLeft"] = target.MarginLeft });

            void Add(int phase, string operation, IReadOnlyDictionary<string, object?> payload) => requests.Add((phase, order++,
                new(Guid.NewGuid().ToString("N"), target.ElementId, operation, payload, now, source, current.ScopeId)));
        }
        return requests.OrderBy(item => item.Phase).ThenBy(item => item.Order).Select(item => item.Request).ToArray();
    }

    private static bool Equivalent(PdfLayoutState left, PdfLayoutState right)
    {
        var rightById = right.Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
        return left.Elements.All(element => rightById.TryGetValue(element.ElementId, out var other) &&
            Same(element.X, other.X) && Same(element.Y, other.Y) && Same(element.Width, other.Width) && Same(element.Height, other.Height) &&
            Same(element.TextOffsetX, other.TextOffsetX) && Same(element.TextOffsetY, other.TextOffsetY) && Same(element.FontSize, other.FontSize) &&
            element.TextAlignment == other.TextAlignment && Same(element.LineSpacing, other.LineSpacing) && element.Visible == other.Visible &&
            Same(element.MarginTop, other.MarginTop) && Same(element.MarginRight, other.MarginRight) && Same(element.MarginBottom, other.MarginBottom) && Same(element.MarginLeft, other.MarginLeft));
    }

    private static bool Same(double? left, double? right) => left is null && right is null || left.HasValue && right.HasValue && Math.Abs(left.Value - right.Value) <= Epsilon;
    private static PdfLayoutState Clone(PdfLayoutState state) => AtomicJsonPdfLayoutProfileStore.Clone(state);
    private static PdfLayoutOperationResult Ok(string code, string message) => new(true, code, message);
    private static PdfLayoutOperationResult Fail(string code, string message) => new(false, code, message);
}
