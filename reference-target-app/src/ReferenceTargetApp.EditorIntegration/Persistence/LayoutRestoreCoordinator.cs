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

    public async Task<LayoutRestoreResult> RestoreAsync(
        PersistedLayoutDocument document,
        LayoutPersistenceOptions options,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(document);
        ArgumentNullException.ThrowIfNull(options);
        var registry = hostAdapter.GetRegistry();
        var validation = LayoutDocumentValidator.Validate(document, options, registry);
        if (!validation.Success)
            return LayoutRestoreResult.NotApplied(validation.Errors[0].Code, validation.Errors[0].Message);

        LayoutState originalState;
        try { originalState = hostAdapter.GetCurrentLayoutState(); }
        catch (Exception exception)
        {
            return LayoutRestoreResult.NotApplied("layout_capture_failed", $"Ausgangslayout konnte nicht gesichert werden: {exception.Message}");
        }

        var desiredById = document.LayoutState.Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
        var apply = await ApplyStateAsync(registry, desiredById, "layout-restore", false, cancellationToken).ConfigureAwait(false);
        if (apply.Success)
            return new(true, "layout_restored", "Gespeichertes Layout wurde vollständig angewandt.", apply.AppliedCount, true, []);

        var originalDocument = PersistedLayoutDocumentFactory.Create(options, registry, originalState, DateTimeOffset.UtcNow);
        var originalById = originalDocument.LayoutState.Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
        var rollback = await ApplyStateAsync(registry, originalById, "layout-rollback", true, cancellationToken).ConfigureAwait(false);
        var failures = new List<LayoutApplyFailure> { apply.Failure! };
        failures.AddRange(rollback.Failures);
        return new(false, rollback.Success ? apply.Failure!.Code : "rollback_failed",
            rollback.Success
                ? "Layoutanwendung ist fehlgeschlagen; der vollständige Ausgangszustand wurde wiederhergestellt."
                : "Layoutanwendung und vollständige Wiederherstellung sind fehlgeschlagen.",
            apply.AppliedCount, rollback.Success, failures);
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

    private async Task<ApplyStateResult> ApplyStateAsync(
        IUiElementRegistry registry,
        IReadOnlyDictionary<string, PersistedElementLayout> desiredById,
        string source,
        bool continueAfterFailure,
        CancellationToken cancellationToken)
    {
        var applied = 0;
        var failures = new List<LayoutApplyFailure>();
        var sequence = 1;
        foreach (var entry in registry.Entries.OrderBy(item => item.Order).ThenBy(item => item.ElementId, StringComparer.Ordinal))
        {
            if (!desiredById.TryGetValue(entry.ElementId, out var desired)) continue;
            foreach (var request in CreateRequests(entry, desired, source, ref sequence))
            {
                var result = await HostAdapterDispatch.SubmitAsync(hostAdapter, request, cancellationToken).ConfigureAwait(false);
                if (result.Success) { applied++; continue; }
                failures.Add(new(result.ElementId, result.Operation,
                    result.ErrorCode ?? HostAdapterErrorCodes.TargetRejectedChange, result.Message));
                if (!continueAfterFailure) return new(false, applied, failures[0], failures);
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

        var hasExplicitOperations = entry.AllowedOperations is { Count: > 0 };
        bool Allows(string operation) => !hasExplicitOperations || entry.AllowedOperations!.Contains(operation, StringComparer.Ordinal);

        if (entry.Capabilities.HasFlag(UiCapability.Width) && entry.Capabilities.HasFlag(UiCapability.Height) && Allows(HostAdapterOperations.Resize))
            requests.Add(Request(entry, HostAdapterOperations.Resize, new Dictionary<string, object?>
            {
                ["width"] = desired.Width,
                ["height"] = desired.Height
            }, source, sequence++));
        else
        {
            if (entry.Capabilities.HasFlag(UiCapability.Width) && Allows(HostAdapterOperations.ResizeWidth))
                requests.Add(Request(entry, HostAdapterOperations.ResizeWidth,
                    new Dictionary<string, object?> { ["width"] = desired.Width }, source, sequence++));
            if (entry.Capabilities.HasFlag(UiCapability.Height) && Allows(HostAdapterOperations.ResizeHeight))
                requests.Add(Request(entry, HostAdapterOperations.ResizeHeight,
                    new Dictionary<string, object?> { ["height"] = desired.Height }, source, sequence++));
        }

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
        if (entry.Capabilities.HasFlag(UiCapability.Visibility))
            requests.Add(Request(entry, HostAdapterOperations.SetVisibility, new Dictionary<string, object?>
            {
                ["visible"] = desired.Visible
            }, source, sequence++));
        if (entry.Capabilities.HasFlag(UiCapability.Spacing))
        {
            var desiredSpacing = desired.Spacing ?? new Dictionary<string, double>(StringComparer.Ordinal);
            foreach (var target in entry.SpacingTargets ?? [])
            {
                requests.Add(Request(entry, HostAdapterOperations.SpacingSet, new Dictionary<string, object?>
                {
                    ["spacing"] = new Dictionary<string, object?> { ["target"] = target, ["value"] = desiredSpacing.GetValueOrDefault(target) }
                }, source, sequence++));
            }
        }
        if (desired.Table is { } table)
        {
            if (entry.TableColumnLayout is not null)
            {
                if (Allows(HostAdapterOperations.SetColumnWidthMode) && table.WidthMode is not null)
                    requests.Add(Request(entry, HostAdapterOperations.SetColumnWidthMode, TablePayload("widthMode", table.WidthMode), source, sequence++));
                if (Allows(HostAdapterOperations.SetColumnWrapMode) && table.WrapMode is not null)
                    requests.Add(Request(entry, HostAdapterOperations.SetColumnWrapMode, TablePayload("wrapMode", table.WrapMode), source, sequence++));
                if (Allows(HostAdapterOperations.SetColumnOverflowMode) && table.OverflowMode is not null)
                    requests.Add(Request(entry, HostAdapterOperations.SetColumnOverflowMode, TablePayload("overflowMode", table.OverflowMode), source, sequence++));
            }
            if (entry.TableLayout is not null)
            {
                if (Allows(HostAdapterOperations.SetHorizontalOverflowMode) && table.HorizontalOverflowMode is not null)
                    requests.Add(Request(entry, HostAdapterOperations.SetHorizontalOverflowMode, TablePayload("horizontalOverflowMode", table.HorizontalOverflowMode), source, sequence++));
                if (Allows(HostAdapterOperations.SetRowHeightMode) && table.RowHeightMode is not null)
                    requests.Add(Request(entry, HostAdapterOperations.SetRowHeightMode, TablePayload("rowHeightMode", table.RowHeightMode), source, sequence++));
            }
        }
        return requests;
    }

    private static IReadOnlyDictionary<string, object?> TablePayload(string field, object value) =>
        new Dictionary<string, object?> { ["table"] = new Dictionary<string, object?> { [field] = value } };

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
