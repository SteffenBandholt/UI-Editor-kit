namespace ReferenceTargetApp.EditorIntegration.Pdf;

public sealed record PdfLayoutFailure(string ElementId, string Operation, string Code, string Message);
public sealed record PdfLayoutOperationResult(bool Success, string Code, string Message, bool RollbackSucceeded = true,
    IReadOnlyList<PdfLayoutFailure>? Failures = null);
public sealed record PdfLayoutSessionStatus(bool IsDirty, PdfLayoutState Working, PdfLayoutState Saved, PdfLayoutState Baseline);

public sealed class PdfLayoutSession
{
    private const double Epsilon = 0.000001;
    private readonly IPdfHostAdapter adapter;
    private readonly AtomicJsonPdfLayoutProfileStore store;
    private readonly SemaphoreSlim operationLock = new(1, 1);
    private readonly PdfLayoutState baseline;
    private PdfLayoutState saved;

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
        var applied = ApplyState(load.Document.LayoutState, "pdf-load");
        if (!applied.Success) return applied;
        saved = Clone(load.Document.LayoutState);
        return Ok("pdf_layout_loaded", "PDF-Layout vom Datenträger geladen.");
    }, cancellationToken);

    public Task<PdfLayoutOperationResult> DiscardAsync(CancellationToken cancellationToken = default) =>
        Exclusive(() => Task.FromResult(ApplyState(saved, "pdf-discard")), cancellationToken);

    public Task<PdfLayoutOperationResult> ResetAsync(CancellationToken cancellationToken = default) =>
        Exclusive(() => Task.FromResult(ApplyState(baseline, "pdf-reset")), cancellationToken);

    public Task<PdfLayoutOperationResult> ApplyBatchAsync(IEnumerable<PdfChangeRequest> requests, CancellationToken cancellationToken = default) =>
        Exclusive(() => Task.FromResult(ApplyRequests(requests.ToArray(), "pdf-batch")), cancellationToken);

    private async Task<PdfLayoutOperationResult> Exclusive(Func<Task<PdfLayoutOperationResult>> operation, CancellationToken cancellationToken)
    {
        if (!await operationLock.WaitAsync(0, cancellationToken).ConfigureAwait(false)) return Fail(PdfErrorCodes.BatchFailed, "PDF-Batchoperation läuft bereits.");
        try { return await operation().ConfigureAwait(false); }
        catch (OperationCanceledException) { return Fail("cancelled", "PDF-Layoutoperation wurde abgebrochen."); }
        finally { operationLock.Release(); }
    }

    private PdfLayoutOperationResult ApplyState(PdfLayoutState desired, string source)
    {
        var validation = PdfLayoutProfileDocumentValidator.Validate(new(
            PdfLayoutProfileDocumentValidator.SchemaVersion, PdfLayoutProfileDocumentValidator.DocumentKind,
            PdfOrderDocumentRegistryFactory.ApplicationId, PdfOrderDocumentRegistryFactory.DocumentType,
            PdfLayoutProfileDocumentValidator.ProfileId, PdfRegistryIds.Scope, DateTimeOffset.UtcNow,
            PdfRegistryFingerprint.Create(adapter.GetRegistry()), desired), adapter.GetRegistry());
        if (!validation.Success) return Fail(validation.Code, validation.Message);
        return ApplyRequests(CreateRequests(adapter.GetCurrentLayoutState(), desired, source), source);
    }

    private PdfLayoutOperationResult ApplyRequests(IReadOnlyList<PdfChangeRequest> requests, string source)
    {
        var original = Clone(adapter.GetCurrentLayoutState());
        var failures = new List<PdfLayoutFailure>();
        foreach (var request in requests)
        {
            var result = adapter.SubmitChangeRequest(request);
            if (result.Success) continue;
            failures.Add(new(result.ElementId, result.Operation, result.ErrorCode ?? PdfErrorCodes.BatchFailed, result.Message));
            var rollbackFailures = Rollback(original, source + "-rollback");
            failures.AddRange(rollbackFailures);
            return new(false, rollbackFailures.Count == 0 ? PdfErrorCodes.BatchFailed : PdfErrorCodes.RollbackFailed,
                rollbackFailures.Count == 0 ? "PDF-Batch fehlgeschlagen; Ausgangszustand wurde wiederhergestellt." : "PDF-Batch und Rollback sind fehlgeschlagen.",
                rollbackFailures.Count == 0, failures);
        }
        return Ok("pdf_batch_applied", "PDF-Layoutbatch vollständig angewandt.");
    }

    private IReadOnlyList<PdfLayoutFailure> Rollback(PdfLayoutState original, string source)
    {
        var failures = new List<PdfLayoutFailure>();
        foreach (var request in CreateRequests(adapter.GetCurrentLayoutState(), original, source))
        {
            var result = adapter.SubmitChangeRequest(request);
            if (!result.Success) failures.Add(new(result.ElementId, result.Operation, result.ErrorCode ?? PdfErrorCodes.RollbackFailed, result.Message));
        }
        return failures;
    }

    internal static IReadOnlyList<PdfChangeRequest> CreateRequests(PdfLayoutState current, PdfLayoutState desired, string source)
    {
        var now = DateTimeOffset.UtcNow;
        var currentById = current.Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
        var requests = new List<(int Phase, int Order, PdfChangeRequest Request)>();
        var order = 0;
        foreach (var target in desired.Elements)
        {
            var existing = currentById[target.ElementId];
            if (target.X.HasValue && (!Same(target.X, existing.X) || !Same(target.Y, existing.Y)))
                Add(3, PdfLayoutOperations.Move, new Dictionary<string, object?> { ["x"] = target.X, ["y"] = target.Y });
            if (target.Width.HasValue && !Same(target.Width, existing.Width))
            {
                var phase = target.ElementId == PdfRegistryIds.Table ? target.Width > existing.Width ? 0 : 5
                    : PdfRegistryIds.Columns.Contains(target.ElementId) ? target.Width < existing.Width ? 1 : 4 : 3;
                Add(phase, PdfLayoutOperations.ResizeWidth, new Dictionary<string, object?> { ["width"] = target.Width });
            }
            if (target.Height.HasValue && !Same(target.Height, existing.Height))
                Add(3, PdfLayoutOperations.ResizeHeight, new Dictionary<string, object?> { ["height"] = target.Height });
            if (target.TextOffsetX.HasValue && (!Same(target.TextOffsetX, existing.TextOffsetX) || !Same(target.TextOffsetY, existing.TextOffsetY)))
                Add(3, PdfLayoutOperations.TextMove, new Dictionary<string, object?> { ["text"] = new Dictionary<string, object?> { ["offsetX"] = target.TextOffsetX, ["offsetY"] = target.TextOffsetY } });
            if (target.FontSize.HasValue && !Same(target.FontSize, existing.FontSize))
                Add(3, PdfLayoutOperations.TextResize, new Dictionary<string, object?> { ["text"] = new Dictionary<string, object?> { ["fontSize"] = target.FontSize } });

            void Add(int phase, string operation, IReadOnlyDictionary<string, object?> payload) => requests.Add((phase, order++,
                new(Guid.NewGuid().ToString("N"), target.ElementId, operation, payload, now, source, PdfRegistryIds.Scope)));
        }
        return requests.OrderBy(item => item.Phase).ThenBy(item => item.Order).Select(item => item.Request).ToArray();
    }

    private static bool Equivalent(PdfLayoutState left, PdfLayoutState right)
    {
        var rightById = right.Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
        return left.Elements.All(element => rightById.TryGetValue(element.ElementId, out var other) &&
            Same(element.X, other.X) && Same(element.Y, other.Y) && Same(element.Width, other.Width) && Same(element.Height, other.Height) &&
            Same(element.TextOffsetX, other.TextOffsetX) && Same(element.TextOffsetY, other.TextOffsetY) && Same(element.FontSize, other.FontSize));
    }

    private static bool Same(double? left, double? right) => left is null && right is null || left.HasValue && right.HasValue && Math.Abs(left.Value - right.Value) <= Epsilon;
    private static PdfLayoutState Clone(PdfLayoutState state) => AtomicJsonPdfLayoutProfileStore.Clone(state);
    private static PdfLayoutOperationResult Ok(string code, string message) => new(true, code, message);
    private static PdfLayoutOperationResult Fail(string code, string message) => new(false, code, message);
}
