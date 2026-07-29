using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Tables;

namespace ReferenceTargetApp.EditorIntegration.Persistence;

public sealed record LayoutOperationResult(
    bool Success,
    string Code,
    string Message,
    bool RollbackSucceeded = true,
    IReadOnlyList<LayoutApplyFailure>? Failures = null);

public sealed record LayoutProfileSessionStatus(
    string ActiveProfileId,
    bool IsDirty,
    IReadOnlyList<string> DirtyElementIds,
    IReadOnlyDictionary<string, LayoutState> Working,
    IReadOnlyDictionary<string, LayoutState> Saved,
    IReadOnlyDictionary<string, LayoutState> Baseline);

public sealed class LayoutProfileSession
{
    // Browser/WPF round-trips can quantize CSS/DIP geometry by a few hundredths
    // without a user-visible layout change. Keep this far below the minimum
    // supported editor step (1 DIP), so real edits still become dirty.
    private const double LayoutComparisonTolerance = 0.05;
    private readonly IReadOnlyDictionary<string, IHostAdapter> adapters;
    private readonly AtomicJsonLayoutProfileStore profileStore;
    private readonly ActiveLayoutProfileStore activeProfileStore;
    private readonly SemaphoreSlim operationLock = new(1, 1);
    private readonly IReadOnlyDictionary<string, LayoutState> baseline;
    private IReadOnlyDictionary<string, LayoutState> saved;
    private Dictionary<string, HashSet<string>> workingExplicitOperations;
    private Dictionary<string, HashSet<string>> savedExplicitOperations;
    private bool savedHasExplicitOperationMetadata;
    private readonly bool allowCompatibleRegistryReconciliation;

    public LayoutProfileSession(
        IReadOnlyDictionary<string, IHostAdapter> adapters,
        IReadOnlyDictionary<string, LayoutState> baseline,
        AtomicJsonLayoutProfileStore profileStore,
        ActiveLayoutProfileStore activeProfileStore,
        string activeProfileId,
        IReadOnlyDictionary<string, LayoutState>? saved = null,
        bool allowCompatibleRegistryReconciliation = false,
        PersistedLayoutProfileDocument? savedDocument = null)
    {
        this.adapters = adapters ?? throw new ArgumentNullException(nameof(adapters));
        this.baseline = CloneStates(baseline ?? throw new ArgumentNullException(nameof(baseline)));
        this.profileStore = profileStore ?? throw new ArgumentNullException(nameof(profileStore));
        this.activeProfileStore = activeProfileStore ?? throw new ArgumentNullException(nameof(activeProfileStore));
        if (adapters.Count == 0) throw new ArgumentException("Mindestens ein Scope ist erforderlich.", nameof(adapters));
        if (LayoutProfileCatalog.Find(activeProfileId) is null) throw new ArgumentException("Unbekanntes Profil.", nameof(activeProfileId));
        ActiveProfileId = activeProfileId;
        this.allowCompatibleRegistryReconciliation = allowCompatibleRegistryReconciliation;
        this.saved = CloneStates(saved ?? baseline);
        workingExplicitOperations = OperationsFromDocument(savedDocument);
        savedExplicitOperations = CloneOperations(workingExplicitOperations);
        savedHasExplicitOperationMetadata = HasExplicitOperationMetadata(savedDocument);
    }

    public string ActiveProfileId { get; private set; }
    public string ProfileRoot => profileStore.RootDirectory;
    public string ApplicationId => profileStore.DocumentApplicationId;
    public bool IsOperationRunning => operationLock.CurrentCount == 0;

    public void RecordExplicitOperation(string scopeId, string elementId, string operation)
    {
        if (!adapters.TryGetValue(scopeId, out var adapter)) return;
        var entry = adapter.GetRegistry().FindById(elementId);
        if (entry?.AllowedOperations?.Contains(operation, StringComparer.Ordinal) != true) return;
        if (!workingExplicitOperations.TryGetValue(scopeId, out var scopeOperations))
            workingExplicitOperations[scopeId] = scopeOperations = new(StringComparer.Ordinal);
        scopeOperations.Add($"{elementId}\u001f{operation}");
    }

    public void ClearExplicitOperations(string scopeId, string elementId) => RemoveElementOperations(scopeId, elementId);

    public async Task InitializeSavedStateAsync(CancellationToken cancellationToken = default)
    {
        var load = await profileStore.LoadAsync(ActiveProfileId, adapters, cancellationToken, allowCompatibleRegistryReconciliation).ConfigureAwait(false);
        saved = load.Success && load.Found && load.Document is not null
            ? StatesFromDocument(load.Document)
            : CloneStates(baseline);
        workingExplicitOperations = OperationsFromDocument(load.Document);
        savedExplicitOperations = CloneOperations(workingExplicitOperations);
        savedHasExplicitOperationMetadata = HasExplicitOperationMetadata(load.Document);
    }

    public LayoutProfileSessionStatus GetStatus()
    {
        var working = CaptureWorking();
        var dirtyIds = DirtyElementIds(working, saved);
        return new(ActiveProfileId, dirtyIds.Count > 0, dirtyIds, CloneStates(working), CloneStates(saved), CloneStates(baseline));
    }

    public void AcceptCurrentTargetAsSaved() => saved = CloneStates(CaptureWorking());

    public void AcceptCurrentTargetElementAsSaved(string scopeId, string elementId) => NormalizeSavedElement(scopeId, elementId);

    public async Task<LayoutOperationResult> SaveAsync(CancellationToken cancellationToken = default) =>
        await ExclusiveAsync(async () =>
        {
            var working = CaptureWorking();
            if (workingExplicitOperations.Values.Sum(values => values.Count) == 0)
                workingExplicitOperations = InferOperations(saved, working);
            var result = await profileStore.SaveAsync(ActiveProfileId, adapters, working, cancellationToken, OperationsForDocument(workingExplicitOperations, adapters.Keys)).ConfigureAwait(false);
            if (!result.Success) return Fail(result.Code, result.Message);
            saved = CloneStates(working);
            savedExplicitOperations = CloneOperations(workingExplicitOperations);
            savedHasExplicitOperationMetadata = true;
            return Ok("layout_saved", "Änderungen gespeichert.");
        }, cancellationToken).ConfigureAwait(false);

    public async Task<LayoutOperationResult> LoadAsync(CancellationToken cancellationToken = default) =>
        await ExclusiveAsync(async () =>
        {
            var load = await profileStore.LoadAsync(ActiveProfileId, adapters, cancellationToken, allowCompatibleRegistryReconciliation).ConfigureAwait(false);
            if (!load.Success || !load.Found || load.Document is null)
                return Fail(load.Code, load.Message);
            var desired = StatesFromDocument(load.Document);
            var loadedOperations = OperationsFromDocument(load.Document);
            var hasExplicitOperations = HasExplicitOperationMetadata(load.Document);
            var restoreOperations = MergeOperations(workingExplicitOperations, loadedOperations, InferOperations(CaptureWorking(), desired));
            var applied = hasExplicitOperations
                ? await ApplyTrackedOperationsAsync(desired, restoreOperations, "m75-load", cancellationToken).ConfigureAwait(false)
                : await ApplyAllAsync(desired, "m75-load", cancellationToken).ConfigureAwait(false);
            if (!applied.Success) return applied;
            // A remote target may normalize valid persisted values while applying them
            // (for example to the effective DOM pixel grid). The successfully applied
            // target state is the clean session boundary; the profile file itself is
            // deliberately not rewritten during restore.
            saved = CloneStates(CaptureWorking());
            workingExplicitOperations = loadedOperations;
            savedExplicitOperations = CloneOperations(workingExplicitOperations);
            savedHasExplicitOperationMetadata = hasExplicitOperations;
            return Ok("layout_loaded", "Gespeichertes Profil wurde vom Datenträger geladen.");
        }, cancellationToken).ConfigureAwait(false);

    public async Task<LayoutOperationResult> DiscardElementAsync(string scopeId, string elementId, CancellationToken cancellationToken = default) =>
        await ExclusiveAsync(async () =>
        {
            var discardOperations = MergeOperations(workingExplicitOperations, savedExplicitOperations, InferOperations(CaptureWorking(), saved));
            var result = savedHasExplicitOperationMetadata
                ? await ApplyTrackedOperationsAsync(saved, OperationsForElement(discardOperations, scopeId, elementId), "m75-discard-element", cancellationToken).ConfigureAwait(false)
                : await ApplyElementAsync(saved, scopeId, elementId, "m75-discard-element", cancellationToken).ConfigureAwait(false);
            if (result.Success)
            {
                NormalizeSavedElement(scopeId, elementId);
                RestoreElementOperations(scopeId, elementId, savedExplicitOperations);
            }
            return result;
        }, cancellationToken).ConfigureAwait(false);

    public async Task<LayoutOperationResult> DiscardAllAsync(CancellationToken cancellationToken = default) =>
        await ExclusiveAsync(async () =>
        {
            var discardOperations = MergeOperations(workingExplicitOperations, savedExplicitOperations, InferOperations(CaptureWorking(), saved));
            var result = savedHasExplicitOperationMetadata
                ? await ApplyTrackedOperationsAsync(saved, discardOperations, "m75-discard-all", cancellationToken).ConfigureAwait(false)
                : await ApplyAllAsync(saved, "m75-discard-all", cancellationToken).ConfigureAwait(false);
            if (result.Success)
            {
                saved = CloneStates(CaptureWorking());
                workingExplicitOperations = CloneOperations(savedExplicitOperations);
            }
            return result;
        }, cancellationToken).ConfigureAwait(false);

    public async Task<LayoutOperationResult> ResetElementAsync(string scopeId, string elementId, CancellationToken cancellationToken = default) =>
        await ExclusiveAsync(async () =>
        {
            var resetOperations = MergeOperations(workingExplicitOperations, savedExplicitOperations, InferOperations(CaptureWorking(), baseline));
            var result = savedHasExplicitOperationMetadata
                ? await ApplyTrackedOperationsAsync(baseline, OperationsForElement(resetOperations, scopeId, elementId), "m75-reset-element", cancellationToken).ConfigureAwait(false)
                : await ApplyElementAsync(baseline, scopeId, elementId, "m75-reset-element", cancellationToken).ConfigureAwait(false);
            if (result.Success) RemoveElementOperations(scopeId, elementId);
            return result;
        }, cancellationToken).ConfigureAwait(false);

    public async Task<LayoutOperationResult> ResetAllAsync(CancellationToken cancellationToken = default) =>
        await ExclusiveAsync(async () =>
        {
            var resetOperations = MergeOperations(workingExplicitOperations, savedExplicitOperations, InferOperations(CaptureWorking(), baseline));
            var result = savedHasExplicitOperationMetadata
                ? await ApplyTrackedOperationsAsync(baseline, resetOperations, "m75-reset-all", cancellationToken).ConfigureAwait(false)
                : await ApplyAllAsync(baseline, "m75-reset-all", cancellationToken).ConfigureAwait(false);
            if (result.Success) workingExplicitOperations.Clear();
            return result;
        }, cancellationToken).ConfigureAwait(false);

    public async Task<LayoutOperationResult> SwitchProfileAsync(string profileId, CancellationToken cancellationToken = default) =>
        await ExclusiveAsync(async () =>
        {
            if (LayoutProfileCatalog.Find(profileId) is null) return Fail("profile_selection_failed", "Unbekanntes Layoutprofil.");
            if (string.Equals(profileId, ActiveProfileId, StringComparison.Ordinal)) return Ok("profile_already_active", "Profil ist bereits aktiv.");

            var original = CaptureWorking();
            var load = await profileStore.LoadAsync(profileId, adapters, cancellationToken, allowCompatibleRegistryReconciliation).ConfigureAwait(false);
            if (!load.Success) return Fail(load.Code, load.Message);
            var desired = load.Found && load.Document is not null ? StatesFromDocument(load.Document) : CloneStates(baseline);
            var loadedOperations = OperationsFromDocument(load.Document);
            var hasExplicitOperations = HasExplicitOperationMetadata(load.Document);
            var switchOperations = MergeOperations(workingExplicitOperations, loadedOperations, InferOperations(CaptureWorking(), desired));
            var applied = hasExplicitOperations
                ? await ApplyTrackedOperationsAsync(desired, switchOperations, "m75-profile-switch", cancellationToken).ConfigureAwait(false)
                : await ApplyAllAsync(desired, "m75-profile-switch", cancellationToken).ConfigureAwait(false);
            if (!applied.Success) return applied;
            bool profileSelectionSaved;
            try { profileSelectionSaved = await activeProfileStore.SaveAsync(profileId, cancellationToken).ConfigureAwait(false); }
            catch (OperationCanceledException)
            {
                var cancelledRollback = await ApplyAllAsync(original, "m75-profile-selection-cancelled-rollback", CancellationToken.None).ConfigureAwait(false);
                return new(false, cancelledRollback.Success ? "cancelled" : "rollback_failed",
                    cancelledRollback.Success ? "Profilwechsel wurde abgebrochen; Layout wurde zurückgerollt." : "Profilwechsel wurde abgebrochen und der Rollback ist fehlgeschlagen.",
                    cancelledRollback.Success, cancelledRollback.Failures);
            }
            if (!profileSelectionSaved)
            {
                var rollback = await ApplyAllAsync(original, "m75-profile-selection-rollback", CancellationToken.None).ConfigureAwait(false);
                return new(false, rollback.Success ? "profile_selection_failed" : "rollback_failed",
                    rollback.Success ? "Aktive Profilwahl konnte nicht gespeichert werden; Layout wurde zurückgerollt." : "Profilwahl und Rollback sind fehlgeschlagen.",
                    rollback.Success, rollback.Failures);
            }
            ActiveProfileId = profileId;
            saved = CloneStates(CaptureWorking());
            workingExplicitOperations = loadedOperations;
            savedExplicitOperations = CloneOperations(workingExplicitOperations);
            savedHasExplicitOperationMetadata = hasExplicitOperations;
            return Ok(load.Found ? "profile_loaded" : "profile_started_from_baseline",
                load.Found ? "Profil wurde geladen." : "Profil besitzt noch keine Datei und startet von der Baseline.");
        }, cancellationToken).ConfigureAwait(false);

    private async Task<LayoutOperationResult> ExclusiveAsync(
        Func<Task<LayoutOperationResult>> action,
        CancellationToken cancellationToken)
    {
        if (!await operationLock.WaitAsync(0, cancellationToken).ConfigureAwait(false))
            return Fail("operation_in_progress", "Eine Layoutoperation wird bereits ausgeführt.");
        try { return await action().ConfigureAwait(false); }
        catch (OperationCanceledException) { return Fail("cancelled", "Layoutoperation wurde abgebrochen."); }
        catch (Exception exception) when (exception is InvalidOperationException or ArgumentException)
        {
            return Fail("layout_operation_failed", exception.Message);
        }
        finally { operationLock.Release(); }
    }

    private async Task<LayoutOperationResult> ApplyElementAsync(
        IReadOnlyDictionary<string, LayoutState> source,
        string scopeId,
        string elementId,
        string operationSource,
        CancellationToken cancellationToken)
    {
        if (!adapters.TryGetValue(scopeId, out var adapter) || !source.TryGetValue(scopeId, out var state))
            return Fail("unknown_scope", "Scope ist nicht registriert.");
        var registryEntry = adapter.GetRegistry().FindById(elementId);
        var desired = state.Elements.FirstOrDefault(element => string.Equals(element.ElementId, elementId, StringComparison.Ordinal));
        if (registryEntry is null || desired is null) return Fail("unknown_element", "Element ist nicht registriert.");
        var original = adapter.GetCurrentLayoutState().Elements.Single(element => element.ElementId == elementId);
        var sequence = 1;
        foreach (var request in LayoutRestoreCoordinator.CreateRequests(registryEntry, Persisted(desired, registryEntry), operationSource, ref sequence))
        {
            var result = await HostAdapterDispatch.SubmitAsync(adapter, request, cancellationToken).ConfigureAwait(false);
            if (result.Success) continue;
            var rollbackSequence = 1;
            var rollbackFailures = new List<LayoutApplyFailure>();
            foreach (var rollbackRequest in LayoutRestoreCoordinator.CreateRequests(registryEntry, Persisted(original, registryEntry), $"{operationSource}-rollback", ref rollbackSequence))
            {
                var rollbackResult = await HostAdapterDispatch.SubmitAsync(adapter, rollbackRequest, CancellationToken.None).ConfigureAwait(false);
                if (!rollbackResult.Success)
                    rollbackFailures.Add(new(rollbackResult.ElementId, rollbackResult.Operation,
                        rollbackResult.ErrorCode ?? "target_rejected_change", rollbackResult.Message));
            }
            return new(false, rollbackFailures.Count == 0 ? "batch_apply_failed" : "rollback_failed",
                rollbackFailures.Count == 0 ? "Elementänderung ist fehlgeschlagen; Ausgangszustand wurde wiederhergestellt." : "Elementänderung und Rollback sind fehlgeschlagen.",
                rollbackFailures.Count == 0, rollbackFailures);
        }
        return Ok("element_layout_applied", "Elementzustand wurde angewandt.");
    }

    private async Task<LayoutOperationResult> ApplyAllAsync(
        IReadOnlyDictionary<string, LayoutState> desired,
        string source,
        CancellationToken cancellationToken)
    {
        var missingScope = adapters.Keys.OrderBy(value => value, StringComparer.Ordinal).FirstOrDefault(scopeId => !desired.ContainsKey(scopeId));
        if (missingScope is not null) return Fail("missing_scope", $"Scope '{missingScope}' fehlt.");
        var unknownScope = desired.Keys.OrderBy(value => value, StringComparer.Ordinal).FirstOrDefault(scopeId => !adapters.ContainsKey(scopeId));
        if (unknownScope is not null) return Fail("unknown_scope", $"Scope '{unknownScope}' ist nicht registriert.");
        var original = CaptureWorking();
        var failures = new List<LayoutApplyFailure>();
        foreach (var pair in adapters.OrderBy(pair => pair.Key, StringComparer.Ordinal))
        {
            var state = desired[pair.Key];
            var document = ScopeDocument(pair.Key, state, source);
            var restored = await new LayoutRestoreCoordinator(pair.Value).RestoreAsync(document,
                LayoutProfileDocumentFactory.ScopeOptions(profileStore.DocumentApplicationId, ActiveProfileId, pair.Key),
                cancellationToken).ConfigureAwait(false);
            if (restored.Success) continue;
            failures.AddRange(restored.Failures);
            var rollbackFailures = await RollbackAllAsync(original, $"{source}-rollback").ConfigureAwait(false);
            failures.AddRange(rollbackFailures);
            return new(false, rollbackFailures.Count == 0 ? "batch_apply_failed" : "rollback_failed",
                rollbackFailures.Count == 0 ? "Batch-Anwendung ist fehlgeschlagen; vollständiger Ausgangszustand wurde wiederhergestellt." : "Batch-Anwendung und Rollback sind fehlgeschlagen.",
                rollbackFailures.Count == 0, failures);
        }
        return Ok("batch_applied", "Alle Scope-Zustände wurden atomar angewandt.");
    }

    private async Task<LayoutOperationResult> ApplyTrackedOperationsAsync(
        IReadOnlyDictionary<string, LayoutState> desired,
        Dictionary<string, HashSet<string>> operations,
        string source,
        CancellationToken cancellationToken)
    {
        var original = CaptureWorking();
        var applied = new List<(string ScopeId, string ElementId, string Operation, string? SpacingTarget)>();
        var failures = new List<LayoutApplyFailure>();
        var sequence = 1;
        foreach (var scopePair in operations.OrderBy(pair => pair.Key, StringComparer.Ordinal))
        {
            if (!adapters.TryGetValue(scopePair.Key, out var adapter) || !desired.TryGetValue(scopePair.Key, out var desiredScope))
                return Fail("unknown_scope", $"Scope '{scopePair.Key}' ist nicht registriert.");
            var desiredById = desiredScope.Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
            foreach (var token in scopePair.Value.OrderBy(value => value, StringComparer.Ordinal))
            {
                var parts = token.Split('\u001f', 2);
                var elementId = parts[0];
                var operation = parts.Length == 2 ? parts[1] : string.Empty;
                var entry = adapter.GetRegistry().FindById(elementId);
                if (entry is null || !desiredById.TryGetValue(elementId, out var desiredElement))
                    return Fail("unknown_element", $"Element '{elementId}' ist nicht registriert.");
                var requests = LayoutRestoreCoordinator.CreateRequests(entry, Persisted(desiredElement, entry), source, ref sequence)
                    .Where(candidate => string.Equals(candidate.Operation, operation, StringComparison.Ordinal)).ToArray();
                if (requests.Length == 0)
                    return Fail("operation_not_restorable", $"Operation '{operation}' für '{elementId}' kann nicht wiederhergestellt werden.");
                foreach (var request in requests)
                {
                    var result = await HostAdapterDispatch.SubmitAsync(adapter, request, cancellationToken).ConfigureAwait(false);
                    if (result.Success)
                    {
                        applied.Add((scopePair.Key, elementId, operation, SpacingTargetOf(request)));
                        continue;
                    }
                    failures.Add(new(result.ElementId, result.Operation, result.ErrorCode ?? "target_rejected_change", result.Message));
                    break;
                }
                if (failures.Count > 0) break;
            }
            if (failures.Count > 0) break;
        }
        if (failures.Count == 0)
            return Ok("tracked_layout_applied", "Explizite Layoutoperationen wurden atomar angewandt.");

        var rollbackSequence = 1;
        var rollbackFailures = new List<LayoutApplyFailure>();
        foreach (var item in applied.AsEnumerable().Reverse())
        {
            var adapter = adapters[item.ScopeId];
            var entry = adapter.GetRegistry().FindById(item.ElementId)!;
            var originalElement = original[item.ScopeId].Elements.Single(element => element.ElementId == item.ElementId);
            var request = LayoutRestoreCoordinator.CreateRequests(entry, Persisted(originalElement, entry), $"{source}-rollback", ref rollbackSequence)
                .First(candidate => string.Equals(candidate.Operation, item.Operation, StringComparison.Ordinal) &&
                    (item.SpacingTarget is null || string.Equals(SpacingTargetOf(candidate), item.SpacingTarget, StringComparison.Ordinal)));
            var result = await HostAdapterDispatch.SubmitAsync(adapter, request, CancellationToken.None).ConfigureAwait(false);
            if (!result.Success)
                rollbackFailures.Add(new(result.ElementId, result.Operation, result.ErrorCode ?? "target_rejected_change", result.Message));
        }
        failures.AddRange(rollbackFailures);
        return new(false, rollbackFailures.Count == 0 ? "batch_apply_failed" : "rollback_failed",
            rollbackFailures.Count == 0 ? "Explizite Layoutoperation ist fehlgeschlagen; Ausgangszustand wurde wiederhergestellt." : "Explizite Layoutoperation und Rollback sind fehlgeschlagen.",
            rollbackFailures.Count == 0, failures);
    }

    private static string? SpacingTargetOf(ChangeRequest request)
    {
        if (!string.Equals(request.Operation, HostAdapterOperations.SpacingSet, StringComparison.Ordinal) ||
            request.Payload is null || !request.Payload.TryGetValue("spacing", out var raw) || raw is not IReadOnlyDictionary<string, object?> spacing ||
            !spacing.TryGetValue("target", out var target)) return null;
        return target as string;
    }

    private async Task<IReadOnlyList<LayoutApplyFailure>> RollbackAllAsync(IReadOnlyDictionary<string, LayoutState> original, string source)
    {
        var failures = new List<LayoutApplyFailure>();
        foreach (var pair in adapters.OrderBy(pair => pair.Key, StringComparer.Ordinal))
        {
            var document = ScopeDocument(pair.Key, original[pair.Key], source);
            var result = await new LayoutRestoreCoordinator(pair.Value).RestoreAsync(document,
                LayoutProfileDocumentFactory.ScopeOptions(profileStore.DocumentApplicationId, ActiveProfileId, pair.Key),
                CancellationToken.None).ConfigureAwait(false);
            failures.AddRange(result.Failures);
        }
        return failures;
    }

    private PersistedLayoutDocument ScopeDocument(string scopeId, LayoutState state, string source)
    {
        var adapter = adapters[scopeId];
        return PersistedLayoutDocumentFactory.Create(
            LayoutProfileDocumentFactory.ScopeOptions(profileStore.DocumentApplicationId, ActiveProfileId, scopeId),
            adapter.GetRegistry(), state, DateTimeOffset.UtcNow);
    }

    private IReadOnlyDictionary<string, LayoutState> StatesFromDocument(PersistedLayoutProfileDocument document)
    {
        var result = new Dictionary<string, LayoutState>(StringComparer.Ordinal);
        foreach (var persistedScope in document.Scopes)
        {
            var baselineById = baseline[persistedScope.ScopeId].Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
            var elements = persistedScope.LayoutState.Elements.Select(element =>
            {
                var fallback = baselineById[element.ElementId];
                return new ElementLayoutState(element.ElementId, element.ScopeId,
                    element.X ?? fallback.X, element.Y ?? fallback.Y, element.Width ?? fallback.Width, element.Height ?? fallback.Height,
                    element.TextOffsetX ?? fallback.TextOffsetX, element.TextOffsetY ?? fallback.TextOffsetY, element.FontSize ?? fallback.FontSize,
                    element.Visible ?? fallback.Visible, element.Spacing ?? fallback.Spacing, element.Table ?? fallback.Table);
            }).ToArray();
            result[persistedScope.ScopeId] = new LayoutState(persistedScope.ScopeId, document.SavedAt, elements);
        }
        return result;
    }

    private IReadOnlyDictionary<string, LayoutState> CaptureWorking() => adapters.ToDictionary(
        pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal);

    private IReadOnlyList<string> DirtyElementIds(
        IReadOnlyDictionary<string, LayoutState> working,
        IReadOnlyDictionary<string, LayoutState> saved)
    {
        var dirty = new List<string>();
        foreach (var pair in working.OrderBy(pair => pair.Key, StringComparer.Ordinal))
        {
            var savedById = saved[pair.Key].Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
            var registry = adapters[pair.Key].GetRegistry();
            dirty.AddRange(pair.Value.Elements.Where(element =>
            {
                var entry = registry.FindById(element.ElementId);
                return entry is not null && !Equivalent(element, savedById[element.ElementId], entry.Capabilities);
            }).Select(element => element.ElementId));
        }
        return dirty.OrderBy(value => value, StringComparer.Ordinal).ToArray();
    }

    private static bool Equivalent(ElementLayoutState left, ElementLayoutState right, Registry.UiCapability capabilities) =>
        (!capabilities.HasFlag(Registry.UiCapability.Position) || Same(left.X, right.X) && Same(left.Y, right.Y)) &&
        (!capabilities.HasFlag(Registry.UiCapability.Width) || Same(left.Width, right.Width)) &&
        (!capabilities.HasFlag(Registry.UiCapability.Height) || Same(left.Height, right.Height)) &&
        (!capabilities.HasFlag(Registry.UiCapability.TextPosition) || Same(left.TextOffsetX, right.TextOffsetX) && Same(left.TextOffsetY, right.TextOffsetY)) &&
        (!capabilities.HasFlag(Registry.UiCapability.FontSize) || Same(left.FontSize, right.FontSize)) &&
        (!capabilities.HasFlag(Registry.UiCapability.Visibility) || left.Visible == right.Visible) &&
        (!capabilities.HasFlag(Registry.UiCapability.Spacing) || SameSpacing(left.Spacing, right.Spacing)) && SameTable(left.Table, right.Table);

    private static bool SameTable(TableElementLayoutState? left, TableElementLayoutState? right) =>
        left is null && right is null || left is not null && right is not null &&
        left.TableId == right.TableId && left.ColumnId == right.ColumnId && left.WidthMode == right.WidthMode &&
        left.WrapMode == right.WrapMode && left.OverflowMode == right.OverflowMode &&
        left.HorizontalOverflowMode == right.HorizontalOverflowMode && left.RowHeightMode == right.RowHeightMode;

    private static bool SameSpacing(IReadOnlyDictionary<string, double>? left, IReadOnlyDictionary<string, double>? right)
    {
        var keys = new HashSet<string>((left ?? new Dictionary<string, double>()).Keys, StringComparer.Ordinal);
        keys.UnionWith((right ?? new Dictionary<string, double>()).Keys);
        return keys.All(key => Same(left?.GetValueOrDefault(key) ?? 0, right?.GetValueOrDefault(key) ?? 0));
    }

    private static bool Same(double? left, double? right) => left is null && right is null || left is not null && right is not null && Math.Abs(left.Value - right.Value) <= LayoutComparisonTolerance;

    private static PersistedElementLayout Persisted(ElementLayoutState state, Registry.UiRegistryEntry entry) => new(
        state.ElementId, state.ScopeId,
        entry.Capabilities.HasFlag(Registry.UiCapability.Position) ? state.X : null,
        entry.Capabilities.HasFlag(Registry.UiCapability.Position) ? state.Y : null,
        entry.Capabilities.HasFlag(Registry.UiCapability.Width) ? state.Width : null,
        entry.Capabilities.HasFlag(Registry.UiCapability.Height) ? state.Height : null,
        entry.Capabilities.HasFlag(Registry.UiCapability.TextPosition) ? state.TextOffsetX : null,
        entry.Capabilities.HasFlag(Registry.UiCapability.TextPosition) ? state.TextOffsetY : null,
        entry.Capabilities.HasFlag(Registry.UiCapability.FontSize) ? state.FontSize : null,
        entry.Capabilities.HasFlag(Registry.UiCapability.Visibility) ? state.Visible : null,
        entry.Capabilities.HasFlag(Registry.UiCapability.Spacing) ? state.Spacing ?? new Dictionary<string, double>(StringComparer.Ordinal) : null,
        PersistedLayoutDocumentFactory.PersistentTableState(entry, state.Table));

    private static IReadOnlyDictionary<string, LayoutState> CloneStates(IReadOnlyDictionary<string, LayoutState> states) =>
        states.ToDictionary(pair => pair.Key,
            pair => new LayoutState(pair.Value.ScopeId, pair.Value.CapturedAt, pair.Value.Elements.Select(element => element with { })),
            StringComparer.Ordinal);

    private static Dictionary<string, HashSet<string>> OperationsFromDocument(PersistedLayoutProfileDocument? document)
    {
        var result = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        if (document?.Scopes is null) return result;
        foreach (var scope in document.Scopes)
        {
            if (scope.ExplicitOperations is null) continue;
            result[scope.ScopeId] = new(scope.ExplicitOperations.SelectMany(pair => pair.Value.Select(operation => $"{pair.Key}\u001f{operation}")), StringComparer.Ordinal);
        }
        return result;
    }

    private static Dictionary<string, HashSet<string>> CloneOperations(Dictionary<string, HashSet<string>> source) =>
        source.ToDictionary(pair => pair.Key, pair => new HashSet<string>(pair.Value, StringComparer.Ordinal), StringComparer.Ordinal);

    private static IReadOnlyDictionary<string, IReadOnlyDictionary<string, IReadOnlyList<string>>> OperationsForDocument(
        Dictionary<string, HashSet<string>> source,
        IEnumerable<string> scopeIds) => scopeIds.ToDictionary(scopeId => scopeId,
            scopeId => (IReadOnlyDictionary<string, IReadOnlyList<string>>)(source.TryGetValue(scopeId, out var values) ? values : [])
                .Select(value => value.Split('\u001f', 2))
                .GroupBy(parts => parts[0], StringComparer.Ordinal)
                .ToDictionary(group => group.Key, group => (IReadOnlyList<string>)group.Select(parts => parts[1]).Distinct(StringComparer.Ordinal).OrderBy(value => value, StringComparer.Ordinal).ToArray(), StringComparer.Ordinal),
            StringComparer.Ordinal);

    private static bool HasExplicitOperationMetadata(PersistedLayoutProfileDocument? document) =>
        document?.Scopes.Any(scope => scope.ExplicitOperations is not null) == true;

    private static Dictionary<string, HashSet<string>> MergeOperations(params Dictionary<string, HashSet<string>>[] sources)
    {
        var result = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        foreach (var source in sources)
            foreach (var pair in source)
            {
                if (!result.TryGetValue(pair.Key, out var target)) result[pair.Key] = target = new(StringComparer.Ordinal);
                target.UnionWith(pair.Value);
            }
        return result;
    }

    private static Dictionary<string, HashSet<string>> OperationsForElement(
        Dictionary<string, HashSet<string>> source,
        string scopeId,
        string elementId)
    {
        var result = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        if (!source.TryGetValue(scopeId, out var values)) return result;
        var matches = values.Where(value => value.StartsWith(elementId + "\u001f", StringComparison.Ordinal)).ToHashSet(StringComparer.Ordinal);
        if (matches.Count > 0) result[scopeId] = matches;
        return result;
    }

    private Dictionary<string, HashSet<string>> InferOperations(
        IReadOnlyDictionary<string, LayoutState> current,
        IReadOnlyDictionary<string, LayoutState> desired)
    {
        var result = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        foreach (var scopePair in adapters)
        {
            if (!current.TryGetValue(scopePair.Key, out var currentScope) || !desired.TryGetValue(scopePair.Key, out var desiredScope)) continue;
            var desiredById = desiredScope.Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
            foreach (var element in currentScope.Elements)
            {
                if (!desiredById.TryGetValue(element.ElementId, out var target)) continue;
                var entry = scopePair.Value.GetRegistry().FindById(element.ElementId);
                if (entry is null) continue;
                var allowed = entry.AllowedOperations ?? [];
                // Compatibility geometry inference is only for legacy registries
                // that did not declare operations. Modern targets keep responsive
                // neighbour geometry derived, but an explicit spacing state may be
                // the intentional side effect of a width-flow decision (for example
                // reservedWidth after "Platz stehen lassen"). Restore that spacing
                // intent without inferring any neighbour geometry.
                if (allowed.Count > 0)
                {
                    if (entry.Capabilities.HasFlag(Registry.UiCapability.Spacing) &&
                        allowed.Contains(HostAdapterOperations.SpacingSet, StringComparer.Ordinal) &&
                        !SameSpacing(element.Spacing, target.Spacing))
                    {
                        if (!result.TryGetValue(scopePair.Key, out var modernValues))
                            result[scopePair.Key] = modernValues = new(StringComparer.Ordinal);
                        modernValues.Add($"{element.ElementId}\u001f{HostAdapterOperations.SpacingSet}");
                    }
                    continue;
                }
                var operations = new List<string>();
                if (entry.Capabilities.HasFlag(Registry.UiCapability.Position) && (!Same(element.X, target.X) || !Same(element.Y, target.Y)))
                    operations.Add(HostAdapterOperations.Move);
                var widthChanged = entry.Capabilities.HasFlag(Registry.UiCapability.Width) && !Same(element.Width, target.Width);
                var heightChanged = entry.Capabilities.HasFlag(Registry.UiCapability.Height) && !Same(element.Height, target.Height);
                if ((widthChanged || heightChanged) &&
                    entry.Capabilities.HasFlag(Registry.UiCapability.Width | Registry.UiCapability.Height) &&
                    (allowed.Count == 0 || allowed.Contains(HostAdapterOperations.Resize, StringComparer.Ordinal)))
                    operations.Add(HostAdapterOperations.Resize);
                else
                {
                    if (widthChanged) operations.Add(HostAdapterOperations.ResizeWidth);
                    if (heightChanged) operations.Add(HostAdapterOperations.ResizeHeight);
                }
                if (entry.Capabilities.HasFlag(Registry.UiCapability.TextPosition) &&
                    (!Same(element.TextOffsetX, target.TextOffsetX) || !Same(element.TextOffsetY, target.TextOffsetY)))
                    operations.Add(HostAdapterOperations.TextMove);
                if (entry.Capabilities.HasFlag(Registry.UiCapability.FontSize) && !Same(element.FontSize, target.FontSize))
                    operations.Add(HostAdapterOperations.TextResize);
                if (entry.Capabilities.HasFlag(Registry.UiCapability.Visibility) && element.Visible != target.Visible)
                    operations.Add(HostAdapterOperations.SetVisibility);
                if (entry.Capabilities.HasFlag(Registry.UiCapability.Spacing) && !SameSpacing(element.Spacing, target.Spacing))
                    operations.Add(HostAdapterOperations.SpacingSet);
                foreach (var operation in operations.Where(operation => allowed.Count == 0 || allowed.Contains(operation, StringComparer.Ordinal)))
                {
                    if (!result.TryGetValue(scopePair.Key, out var values)) result[scopePair.Key] = values = new(StringComparer.Ordinal);
                    values.Add($"{element.ElementId}\u001f{operation}");
                }
            }
        }
        return result;
    }

    private void RemoveElementOperations(string scopeId, string elementId)
    {
        if (!workingExplicitOperations.TryGetValue(scopeId, out var values)) return;
        values.RemoveWhere(value => value.StartsWith(elementId + "\u001f", StringComparison.Ordinal));
        if (values.Count == 0) workingExplicitOperations.Remove(scopeId);
    }

    private void RestoreElementOperations(string scopeId, string elementId, Dictionary<string, HashSet<string>> source)
    {
        RemoveElementOperations(scopeId, elementId);
        if (!source.TryGetValue(scopeId, out var values)) return;
        foreach (var value in values.Where(value => value.StartsWith(elementId + "\u001f", StringComparison.Ordinal)))
        {
            if (!workingExplicitOperations.TryGetValue(scopeId, out var target))
                workingExplicitOperations[scopeId] = target = new(StringComparer.Ordinal);
            target.Add(value);
        }
    }

    private void NormalizeSavedElement(string scopeId, string elementId)
    {
        if (!saved.TryGetValue(scopeId, out var savedScope) || !adapters.TryGetValue(scopeId, out var adapter)) return;
        var actual = adapter.GetCurrentLayoutState().Elements.FirstOrDefault(element => element.ElementId == elementId);
        if (actual is null) return;
        saved = saved.ToDictionary(pair => pair.Key, pair => pair.Key == scopeId
            ? new LayoutState(pair.Value.ScopeId, pair.Value.CapturedAt,
                savedScope.Elements.Select(element => element.ElementId == elementId ? actual with { } : element with { }))
            : new LayoutState(pair.Value.ScopeId, pair.Value.CapturedAt, pair.Value.Elements.Select(element => element with { })),
            StringComparer.Ordinal);
    }

    private static LayoutOperationResult Ok(string code, string message) => new(true, code, message);
    private static LayoutOperationResult Fail(string code, string message) => new(false, code, message);
}
