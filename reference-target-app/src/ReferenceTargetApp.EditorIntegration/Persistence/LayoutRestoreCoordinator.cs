using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.EditorIntegration.Persistence;

public sealed class LayoutRestoreCoordinator
{
    private readonly IHostAdapter hostAdapter;

    public LayoutRestoreCoordinator(IHostAdapter hostAdapter) =>
        this.hostAdapter = hostAdapter ?? throw new ArgumentNullException(nameof(hostAdapter));

    public LayoutRestoreResult Restore(
        PersistedLayoutDocument document,
        LayoutPersistenceOptions options)
    {
        ArgumentNullException.ThrowIfNull(document);
        ArgumentNullException.ThrowIfNull(options);
        var registry = hostAdapter.GetRegistry();
        var validation = LayoutDocumentValidator.Validate(document, options, registry);
        if (!validation.Success)
            return LayoutRestoreResult.NotApplied(validation.Errors[0].Code, validation.Errors[0].Message);

        LayoutState originalState;
        try
        {
            originalState = hostAdapter.GetCurrentLayoutState();
        }
        catch (Exception exception)
        {
            return LayoutRestoreResult.NotApplied("layout_capture_failed", $"Ausgangslayout konnte nicht gesichert werden: {exception.Message}");
        }

        var desiredById = document.LayoutState.Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
        var apply = ApplyState(registry, desiredById, "layout-restore");
        if (apply.Success)
            return new(true, "layout_restored", "Gespeichertes Layout wurde vollständig angewandt.", apply.AppliedCount, true, []);

        var originalDocument = PersistedLayoutDocumentFactory.Create(
            options,
            registry,
            originalState,
            DateTimeOffset.UtcNow);
        var originalById = originalDocument.LayoutState.Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
        var rollback = ApplyState(registry, originalById, "layout-rollback", continueAfterFailure: true);
        var failures = new List<LayoutApplyFailure> { apply.Failure! };
        failures.AddRange(rollback.Failures);
        return new(
            false,
            rollback.Success ? apply.Failure!.Code : "rollback_failed",
            rollback.Success
                ? "Layoutanwendung ist fehlgeschlagen; der vollständige Ausgangszustand wurde wiederhergestellt."
                : "Layoutanwendung und vollständige Wiederherstellung sind fehlgeschlagen.",
            apply.AppliedCount,
            rollback.Success,
            failures);
    }

    private ApplyStateResult ApplyState(
        IUiElementRegistry registry,
        IReadOnlyDictionary<string, PersistedElementLayout> desiredById,
        string source,
        bool continueAfterFailure = false)
    {
        var applied = 0;
        var failures = new List<LayoutApplyFailure>();
        var sequence = 1;
        foreach (var entry in registry.Entries.OrderBy(item => item.Order).ThenBy(item => item.ElementId, StringComparer.Ordinal))
        {
            if (!desiredById.TryGetValue(entry.ElementId, out var desired)) continue;
            foreach (var request in CreateRequests(entry, desired, source, ref sequence))
            {
                var result = hostAdapter.SubmitChangeRequest(request);
                if (result.Success)
                {
                    applied++;
                    continue;
                }

                failures.Add(new(
                    result.ElementId,
                    result.Operation,
                    result.ErrorCode ?? HostAdapterErrorCodes.TargetRejectedChange,
                    result.Message));
                if (!continueAfterFailure)
                    return new(false, applied, failures[0], failures);
            }
        }
        return new(failures.Count == 0, applied, failures.FirstOrDefault(), failures);
    }

    internal static IReadOnlyList<ChangeRequest> CreateRequests(
        UiRegistryEntry entry,
        PersistedElementLayout desired,
        string source,
        ref int sequence)
    {
        var requests = new List<ChangeRequest>();
        if (entry.Capabilities.HasFlag(UiCapability.Position))
            requests.Add(Request(entry, HostAdapterOperations.Move, new Dictionary<string, object?>
            {
                ["x"] = desired.X,
                ["y"] = desired.Y
            }, source, sequence++));

        if (entry.Capabilities.HasFlag(UiCapability.Width) && entry.Capabilities.HasFlag(UiCapability.Height))
            requests.Add(Request(entry, HostAdapterOperations.Resize, new Dictionary<string, object?>
            {
                ["width"] = desired.Width,
                ["height"] = desired.Height
            }, source, sequence++));
        else if (entry.Capabilities.HasFlag(UiCapability.Width))
            requests.Add(Request(entry, HostAdapterOperations.ResizeWidth,
                new Dictionary<string, object?> { ["width"] = desired.Width }, source, sequence++));
        else if (entry.Capabilities.HasFlag(UiCapability.Height))
            requests.Add(Request(entry, HostAdapterOperations.ResizeHeight,
                new Dictionary<string, object?> { ["height"] = desired.Height }, source, sequence++));

        if (entry.Capabilities.HasFlag(UiCapability.TextPosition))
            requests.Add(Request(entry, HostAdapterOperations.TextMove, new Dictionary<string, object?>
            {
                ["text"] = new Dictionary<string, object?>
                {
                    ["offsetX"] = desired.TextOffsetX,
                    ["offsetY"] = desired.TextOffsetY
                }
            }, source, sequence++));
        if (entry.Capabilities.HasFlag(UiCapability.FontSize))
            requests.Add(Request(entry, HostAdapterOperations.TextResize, new Dictionary<string, object?>
            {
                ["text"] = new Dictionary<string, object?> { ["fontSize"] = desired.FontSize }
            }, source, sequence++));
        return requests;
    }

    private static ChangeRequest Request(
        UiRegistryEntry entry,
        string operation,
        IReadOnlyDictionary<string, object?> payload,
        string source,
        int sequence) => new(
            $"{source}-{sequence:D3}",
            entry.ElementId,
            operation,
            payload,
            DateTimeOffset.UtcNow,
            source,
            entry.ScopeId,
            reason: "Atomare Layoutwiederherstellung M73.5");

    private sealed record ApplyStateResult(
        bool Success,
        int AppliedCount,
        LayoutApplyFailure? Failure,
        IReadOnlyList<LayoutApplyFailure> Failures);
}
