using System.Windows.Threading;
using System.Windows;
using System.Windows.Documents;
using System.Windows.Media;
using System.Text.Json;
using ReferenceTargetApp.EditorIntegration.Geometry;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

public sealed class WpfHostAdapter : IGeometryRiskHostAdapter
{
    private readonly IUiElementRegistry registry;
    private readonly IWpfLayoutAccess layoutAccess;
    private string? diagnosticFailureElementId;
    private readonly Dictionary<string, (string Signature, GeometryRiskAssessment Risk)> pendingRisks = new(StringComparer.Ordinal);
    private AdornerLayer? previewLayer;
    private WpfGeometryPreviewAdorner? previewAdorner;

    public void ArmDiagnosticFailure(string elementId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(elementId);
        diagnosticFailureElementId = elementId;
    }

    public WpfHostAdapter(IUiElementRegistry registry)
        : this(registry, new WpfLayoutAccess())
    {
    }

    internal WpfHostAdapter(IUiElementRegistry registry, IWpfLayoutAccess layoutAccess)
    {
        this.registry = registry ?? throw new ArgumentNullException(nameof(registry));
        this.layoutAccess = layoutAccess ?? throw new ArgumentNullException(nameof(layoutAccess));
        if (registry.Entries.Count == 0) throw new ArgumentException("Registry darf nicht leer sein.", nameof(registry));
    }

    public IUiElementRegistry GetRegistry() => registry;

    public LayoutState GetCurrentLayoutState()
    {
        var dispatcher = GetRegistryDispatcher();
        return InvokeOnDispatcher(dispatcher, () =>
        {
            EnsureSingleDispatcher(dispatcher);
            var states = registry.Entries.Select(layoutAccess.Read).ToList();
            var scopeId = states.Select(state => state.ScopeId).Distinct(StringComparer.Ordinal).Single();
            return new LayoutState(scopeId, DateTimeOffset.UtcNow, states);
        });
    }

    public ChangeResult SubmitChangeRequest(ChangeRequest changeRequest)
    {
        if (string.Equals(diagnosticFailureElementId, changeRequest.ElementId, StringComparison.Ordinal))
        {
            diagnosticFailureElementId = null;
            return ChangeResult.Rejected(changeRequest, HostAdapterErrorCodes.TargetRejectedChange,
                "Kontrolliert provozierter M75-Adapterfehler.");
        }
        var validation = ChangeRequestValidator.Validate(changeRequest, registry);
        if (!validation.Success)
            return ChangeResult.Rejected(changeRequest, validation.ErrorCode!, validation.Message!);

        var entry = registry.FindById(changeRequest.ElementId)!;
        var dispatcher = entry.NativeElement.Dispatcher;
        if (dispatcher.HasShutdownStarted || dispatcher.HasShutdownFinished)
            return ChangeResult.Rejected(changeRequest, HostAdapterErrorCodes.UiThreadUnavailable, "WPF-Dispatcher ist nicht verfügbar.");

        try
        {
            return InvokeOnDispatcher(dispatcher, () => ExecuteOnUiThread(changeRequest, entry, validation.Change!));
        }
        catch (Exception exception)
        {
            return ChangeResult.Rejected(changeRequest, HostAdapterErrorCodes.UiThreadUnavailable,
                $"WPF-Dispatcher konnte den Auftrag nicht ausführen: {exception.Message}");
        }
    }

    public Task<ChangeResult> SubmitChangeRequestAsync(ChangeRequest changeRequest, CancellationToken cancellationToken = default) =>
        Task.FromResult(SubmitChangeRequest(changeRequest));

    public Task<ChangeResult> SubmitGeometryChangeRequestAsync(
        ChangeRequest request,
        string editMode,
        GeometryRiskConfirmation? confirmation = null,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var validation = ChangeRequestValidator.Validate(request, registry);
        if (!validation.Success) return Task.FromResult(ChangeResult.Rejected(request, validation.ErrorCode!, validation.Message!));
        var entry = registry.FindById(request.ElementId)!;
        var dispatcher = entry.NativeElement.Dispatcher;
        if (dispatcher.HasShutdownStarted || dispatcher.HasShutdownFinished)
            return Task.FromResult(ChangeResult.Rejected(request, HostAdapterErrorCodes.UiThreadUnavailable, "WPF-Dispatcher ist nicht verfügbar."));
        var result = InvokeOnDispatcher(dispatcher, () => ExecuteGeometryChange(request, validation.Change!, editMode, confirmation));
        return Task.FromResult(result);
    }

    public Task ClearGeometryPreviewAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var dispatcher = GetRegistryDispatcher();
        InvokeOnDispatcher(dispatcher, () => { ClearPreview(); return true; });
        return Task.CompletedTask;
    }

    private ChangeResult ExecuteGeometryChange(ChangeRequest originalRequest, ValidatedLayoutChange originalChange, string editMode, GeometryRiskConfirmation? confirmation)
    {
        var entry = registry.FindById(originalRequest.ElementId)!;
        var request = originalRequest;
        var change = originalChange;
        (string Signature, GeometryRiskAssessment Risk)? pending = null;
        if (confirmation is not null && pendingRisks.TryGetValue(confirmation.OperationId, out var cached) && cached.Signature == Signature(originalRequest))
        {
            pending = cached;
            if (confirmation.Action is GeometryRiskActions.ClampToGroup or GeometryRiskActions.ClampToArea)
            {
                var clamped = confirmation.Action == GeometryRiskActions.ClampToGroup ? cached.Risk.ClampedToGroupBounds : cached.Risk.ClampedToAreaBounds;
                if (clamped is null || originalRequest.Operation != HostAdapterOperations.Move)
                    return ChangeResult.Rejected(originalRequest, "invalid_geometry_clamp", "Diese Änderung kann nicht an der gewählten Grenze gehalten werden.");
                var current = layoutAccess.Read(entry);
                var payload = new Dictionary<string, object?>
                {
                    ["x"] = current.X + clamped.Left - cached.Risk.Preview.CurrentBounds.Left,
                    ["y"] = current.Y + clamped.Top - cached.Risk.Preview.CurrentBounds.Top,
                };
                request = new(originalRequest.ChangeId, originalRequest.ElementId, originalRequest.Operation, payload,
                    originalRequest.CreatedAt, originalRequest.Source, originalRequest.Scope, originalRequest.Note, originalRequest.Reason);
                var clampedValidation = ChangeRequestValidator.Validate(request, registry);
                if (!clampedValidation.Success) return ChangeResult.Rejected(request, clampedValidation.ErrorCode!, clampedValidation.Message!);
                change = clampedValidation.Change!;
            }
        }
        var beforeGeometry = CaptureGeometry();
        var targetSnapshot = layoutAccess.Capture(entry);
        var groupEntry = Ancestor(entry, candidate => candidate.ProtocolType is "group" or "fieldGroup");
        var groupSnapshot = groupEntry is null ? null : layoutAccess.Capture(groupEntry);
        var applied = ExecuteOnUiThread(request, entry, change);
        if (!applied.Success) { ClearPreview(); return applied; }
        RefreshLayout(entry);
        if (pending is not null && confirmation?.Action == GeometryRiskActions.PreserveSpace)
        {
            var current = layoutAccess.Read(entry);
            var spacing = current.Spacing?.GetValueOrDefault(SpacingTargets.ReservedWidth) ?? 0;
            layoutAccess.Apply(entry, new(HostAdapterOperations.SpacingSet, SpacingTarget: SpacingTargets.ReservedWidth,
                SpacingValue: spacing + pending.Value.Risk.TechnicalDetails.FreedWidth));
            var spaced = layoutAccess.Read(entry);
            applied = applied with { NewState = spaced, Message = "Elementbreite geändert; frei gewordener Platz bleibt reserviert." };
            RefreshLayout(entry);
        }
        if (pending is not null && confirmation?.Action == GeometryRiskActions.ShrinkGroup && groupEntry is not null)
        {
            var currentGroup = layoutAccess.Read(groupEntry);
            var targetWidth = currentGroup.Width - pending.Value.Risk.TechnicalDetails.FreedWidth;
            if (targetWidth <= 0)
            {
                layoutAccess.Restore(entry, targetSnapshot);
                if (groupSnapshot is not null) layoutAccess.Restore(groupEntry, groupSnapshot);
                RefreshLayout(entry);
                return ChangeResult.Rejected(request, "invalid_group_width", "Die Breite dieser Gruppe kann nicht direkt verändert werden.");
            }
            layoutAccess.Apply(groupEntry, new(HostAdapterOperations.ResizeWidth, Width: targetWidth));
            RefreshLayout(entry);
            applied = applied with
            {
                Message = "Element- und Gruppenbreite wurden getrennt um den bestätigten Betrag verkleinert.",
                AffectedStates = [layoutAccess.Read(groupEntry)]
            };
        }
        var afterGeometry = CaptureGeometry();
        if (pending is not null && confirmation?.Action == GeometryRiskActions.PreserveSpace &&
            beforeGeometry.Any(pair => pair.Key != entry.ElementId && Different(pair.Value, afterGeometry[pair.Key])))
        {
            layoutAccess.Restore(entry, targetSnapshot);
            if (groupEntry is not null && groupSnapshot is not null) layoutAccess.Restore(groupEntry, groupSnapshot);
            RefreshLayout(entry);
            var restored = layoutAccess.Read(entry);
            ClearPreview();
            return new(false, request.ChangeId, request.ElementId, request.Operation, "unexpected_neighbor_change",
                "Die Position weiterer Elemente würde sich unerwartet verändern.", restored, restored, true);
        }
        var risk = BuildRisk(entry, request, editMode, beforeGeometry, afterGeometry);
        if (risk.HasRisks && pending is null)
        {
            layoutAccess.Restore(entry, targetSnapshot);
            pendingRisks[risk.OperationId] = (Signature(originalRequest), risk);
            ShowPreview(entry, risk);
            var restored = layoutAccess.Read(entry);
            return new(false, request.ChangeId, request.ElementId, request.Operation,
                "geometry_risk_confirmation_required", risk.Message, restored, restored, true, risk);
        }
        if (confirmation is not null) pendingRisks.Remove(confirmation.OperationId);
        ClearPreview();
        return applied;
    }

    private static void RefreshLayout(UiRegistryEntry entry)
    {
        entry.NativeElement.UpdateLayout();
        Window.GetWindow(entry.NativeElement)?.UpdateLayout();
    }

    private GeometryRiskAssessment BuildRisk(
        UiRegistryEntry entry,
        ChangeRequest request,
        string editMode,
        IReadOnlyDictionary<string, GeometryBounds> before,
        IReadOnlyDictionary<string, GeometryBounds> after)
    {
        var parent = entry.ParentId is null ? null : registry.FindById(entry.ParentId);
        var group = Ancestor(entry, candidate => candidate.ProtocolType is "group" or "fieldGroup");
        var root = entry;
        while (root.ParentId is not null) root = registry.FindById(root.ParentId)!;
        var neighbors = registry.Entries.Where(candidate => candidate.ElementId != entry.ElementId &&
                !IsAncestor(candidate.ElementId, entry.ElementId) && !IsAncestor(entry.ElementId, candidate.ElementId) && candidate.NativeElement.IsVisible)
            .Select(candidate => new GeometryNeighbor(candidate.ElementId, candidate.DisplayName, candidate.ProtocolType ?? candidate.Kind.ToString(), after[candidate.ElementId],
                GeometryChanged: Different(before[candidate.ElementId], after[candidate.ElementId]), PreviousBounds: before[candidate.ElementId]))
            .ToArray();
        return GeometryRiskEvaluator.Evaluate(editMode, request.ChangeId, entry.ScopeId,
            ToTarget(entry, before[entry.ElementId]), after[entry.ElementId],
            group is null ? null : ToTarget(group, after[group.ElementId]),
            parent is null ? null : ToTarget(parent, after[parent.ElementId]),
            ToTarget(root, after[root.ElementId]), neighbors, $"wpf:{request.ChangeId}", request.Operation,
            group?.Capabilities.HasFlag(UiCapability.Width) == true);
    }

    private IReadOnlyDictionary<string, GeometryBounds> CaptureGeometry()
    {
        var root = Window.GetWindow(registry.Entries[0].NativeElement)?.Content as Visual;
        return registry.Entries.ToDictionary(entry => entry.ElementId, entry => Bounds(entry.NativeElement, root), StringComparer.Ordinal);
    }

    private static GeometryBounds Bounds(FrameworkElement element, Visual? root)
    {
        Point point;
        try { point = root is null || ReferenceEquals(root, element) ? new(0, 0) : element.TransformToAncestor(root).Transform(new Point(0, 0)); }
        catch (InvalidOperationException) { point = new(0, 0); }
        var width = double.IsFinite(element.ActualWidth) && element.ActualWidth > 0 ? element.ActualWidth : element.Width;
        var height = double.IsFinite(element.ActualHeight) && element.ActualHeight > 0 ? element.ActualHeight : element.Height;
        return new(point.X, point.Y, width, height);
    }

    private UiRegistryEntry? Ancestor(UiRegistryEntry entry, Func<UiRegistryEntry, bool> predicate)
    {
        var current = entry.ParentId is null ? null : registry.FindById(entry.ParentId);
        while (current is not null) { if (predicate(current)) return current; current = current.ParentId is null ? null : registry.FindById(current.ParentId); }
        return null;
    }

    private bool IsAncestor(string candidateId, string elementId)
    {
        var current = registry.FindById(elementId);
        while (current?.ParentId is not null) { if (current.ParentId == candidateId) return true; current = registry.FindById(current.ParentId); }
        return false;
    }

    private static bool Different(GeometryBounds left, GeometryBounds right) =>
        Math.Abs(left.Left - right.Left) > 0.75 || Math.Abs(left.Top - right.Top) > 0.75 ||
        Math.Abs(left.Width - right.Width) > 0.75 || Math.Abs(left.Height - right.Height) > 0.75;
    private static GeometryTarget ToTarget(UiRegistryEntry entry, GeometryBounds bounds) =>
        new(entry.ElementId, entry.DisplayName, entry.ProtocolType ?? entry.Kind.ToString(), bounds);
    private static string Signature(ChangeRequest request) => JsonSerializer.Serialize(new { request.ElementId, request.Operation, request.Payload });

    private void ShowPreview(UiRegistryEntry entry, GeometryRiskAssessment risk)
    {
        ClearPreview();
        var root = Window.GetWindow(entry.NativeElement)?.Content as UIElement;
        if (root is null) return;
        previewLayer = AdornerLayer.GetAdornerLayer(root);
        if (previewLayer is null) return;
        previewAdorner = new(root, risk);
        previewLayer.Add(previewAdorner);
    }

    private void ClearPreview()
    {
        if (previewLayer is not null && previewAdorner is not null) previewLayer.Remove(previewAdorner);
        previewAdorner = null;
        previewLayer = null;
    }

    private ChangeResult ExecuteOnUiThread(
        ChangeRequest request,
        UiRegistryEntry entry,
        ValidatedLayoutChange change)
    {
        ElementLayoutState? previousState = null;
        WpfElementSnapshot? snapshot = null;
        try
        {
            previousState = layoutAccess.Read(entry);
            if (change.Operation == HostAdapterOperations.TextResize)
            {
                var expectation = TextResizeContract.VerifyExpectedCurrent(
                    change.FontSize!.Value, change.ExpectedCurrentFontSize, previousState.FontSize);
                if (!expectation.Success)
                    return Failure(request, expectation.ErrorCode!, expectation.Message,
                        previousState, previousState, true, expectation.Readback);
            }
            snapshot = layoutAccess.Capture(entry);
            layoutAccess.Apply(entry, change);
            if (change.Operation == HostAdapterOperations.TextResize) RefreshLayout(entry);
            var newState = layoutAccess.Read(entry);
            TextResizeReadback? textResize = null;
            if (change.Operation == HostAdapterOperations.TextResize)
            {
                var verification = TextResizeContract.VerifyReadback(
                    change.FontSize!.Value, change.ExpectedCurrentFontSize, previousState.FontSize, newState.FontSize);
                textResize = verification.Readback;
                if (!verification.Success)
                {
                    layoutAccess.Restore(entry, snapshot);
                    RefreshLayout(entry);
                    var restoredState = layoutAccess.Read(entry);
                    return Failure(request, verification.ErrorCode!, verification.Message,
                        previousState, restoredState, true, verification.Readback);
                }
            }
            return new ChangeResult(
                true,
                request.ChangeId,
                request.ElementId,
                request.Operation,
                null,
                "Layoutänderung wurde angewandt.",
                previousState,
                newState,
                true,
                TextResize: textResize);
        }
        catch (Exception applyException)
        {
            if (snapshot is null)
                return Failure(request, HostAdapterErrorCodes.TargetRejectedChange, applyException.Message, previousState, previousState, true);

            try
            {
                layoutAccess.Restore(entry, snapshot);
                var restoredState = layoutAccess.Read(entry);
                return Failure(request, HostAdapterErrorCodes.TargetRejectedChange,
                    $"Layoutänderung wurde verworfen und zurückgesetzt: {applyException.Message}",
                    previousState, restoredState, true);
            }
            catch (Exception rollbackException)
            {
                return Failure(request, HostAdapterErrorCodes.RollbackFailed,
                    $"Layoutänderung schlug fehl; Wiederherstellung schlug ebenfalls fehl: {rollbackException.Message}",
                    previousState, null, false);
            }
        }
    }

    private Dispatcher GetRegistryDispatcher()
    {
        var element = registry.Entries[0].NativeElement ?? throw new InvalidOperationException("Native WPF-Referenz fehlt.");
        return element.Dispatcher;
    }

    private void EnsureSingleDispatcher(Dispatcher dispatcher)
    {
        if (registry.Entries.Any(entry => entry.NativeElement is null || entry.NativeElement.Dispatcher != dispatcher))
            throw new InvalidOperationException("Alle registrierten WPF-Elemente müssen demselben Dispatcher gehören.");
    }

    private static T InvokeOnDispatcher<T>(Dispatcher dispatcher, Func<T> action)
    {
        if (dispatcher.CheckAccess()) return action();
        return dispatcher.Invoke(action, DispatcherPriority.Send);
    }

    private static ChangeResult Failure(
        ChangeRequest request,
        string errorCode,
        string message,
        ElementLayoutState? previousState,
        ElementLayoutState? newState,
        bool rollbackSucceeded,
        TextResizeReadback? textResize = null) => new(
            false,
            request.ChangeId,
            request.ElementId,
            request.Operation,
            errorCode,
            message,
            previousState,
            newState,
            rollbackSucceeded,
            TextResize: textResize);
}
