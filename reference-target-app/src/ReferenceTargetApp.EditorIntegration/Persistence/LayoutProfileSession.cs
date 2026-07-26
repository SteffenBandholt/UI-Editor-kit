using ReferenceTargetApp.EditorIntegration.HostAdapter;

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
    private readonly IReadOnlyDictionary<string, IHostAdapter> adapters;
    private readonly AtomicJsonLayoutProfileStore profileStore;
    private readonly ActiveLayoutProfileStore activeProfileStore;
    private readonly SemaphoreSlim operationLock = new(1, 1);
    private readonly IReadOnlyDictionary<string, LayoutState> baseline;
    private IReadOnlyDictionary<string, LayoutState> saved;

    public LayoutProfileSession(
        IReadOnlyDictionary<string, IHostAdapter> adapters,
        IReadOnlyDictionary<string, LayoutState> baseline,
        AtomicJsonLayoutProfileStore profileStore,
        ActiveLayoutProfileStore activeProfileStore,
        string activeProfileId,
        IReadOnlyDictionary<string, LayoutState>? saved = null)
    {
        this.adapters = adapters ?? throw new ArgumentNullException(nameof(adapters));
        this.baseline = CloneStates(baseline ?? throw new ArgumentNullException(nameof(baseline)));
        this.profileStore = profileStore ?? throw new ArgumentNullException(nameof(profileStore));
        this.activeProfileStore = activeProfileStore ?? throw new ArgumentNullException(nameof(activeProfileStore));
        if (adapters.Count == 0) throw new ArgumentException("Mindestens ein Scope ist erforderlich.", nameof(adapters));
        if (LayoutProfileCatalog.Find(activeProfileId) is null) throw new ArgumentException("Unbekanntes Profil.", nameof(activeProfileId));
        ActiveProfileId = activeProfileId;
        this.saved = CloneStates(saved ?? baseline);
    }

    public string ActiveProfileId { get; private set; }
    public bool IsOperationRunning => operationLock.CurrentCount == 0;

    public async Task InitializeSavedStateAsync(CancellationToken cancellationToken = default)
    {
        var load = await profileStore.LoadAsync(ActiveProfileId, adapters, cancellationToken).ConfigureAwait(false);
        saved = load.Success && load.Found && load.Document is not null
            ? StatesFromDocument(load.Document)
            : CloneStates(baseline);
    }

    public LayoutProfileSessionStatus GetStatus()
    {
        var working = CaptureWorking();
        var dirtyIds = DirtyElementIds(working, saved);
        return new(ActiveProfileId, dirtyIds.Count > 0, dirtyIds, CloneStates(working), CloneStates(saved), CloneStates(baseline));
    }

    public async Task<LayoutOperationResult> SaveAsync(CancellationToken cancellationToken = default) =>
        await ExclusiveAsync(async () =>
        {
            var working = CaptureWorking();
            var result = await profileStore.SaveAsync(ActiveProfileId, adapters, working, cancellationToken).ConfigureAwait(false);
            if (!result.Success) return Fail(result.Code, result.Message);
            saved = CloneStates(working);
            return Ok("layout_saved", "Änderungen gespeichert.");
        }, cancellationToken).ConfigureAwait(false);

    public async Task<LayoutOperationResult> LoadAsync(CancellationToken cancellationToken = default) =>
        await ExclusiveAsync(async () =>
        {
            var load = await profileStore.LoadAsync(ActiveProfileId, adapters, cancellationToken).ConfigureAwait(false);
            if (!load.Success || !load.Found || load.Document is null)
                return Fail(load.Code, load.Message);
            var desired = StatesFromDocument(load.Document);
            var applied = ApplyAll(desired, "m75-load");
            if (!applied.Success) return applied;
            saved = CloneStates(desired);
            return Ok("layout_loaded", "Gespeichertes Profil wurde vom Datenträger geladen.");
        }, cancellationToken).ConfigureAwait(false);

    public async Task<LayoutOperationResult> DiscardElementAsync(string scopeId, string elementId, CancellationToken cancellationToken = default) =>
        await ExclusiveAsync(() => Task.FromResult(ApplyElement(saved, scopeId, elementId, "m75-discard-element")), cancellationToken).ConfigureAwait(false);

    public async Task<LayoutOperationResult> DiscardAllAsync(CancellationToken cancellationToken = default) =>
        await ExclusiveAsync(() => Task.FromResult(ApplyAll(saved, "m75-discard-all")), cancellationToken).ConfigureAwait(false);

    public async Task<LayoutOperationResult> ResetElementAsync(string scopeId, string elementId, CancellationToken cancellationToken = default) =>
        await ExclusiveAsync(() => Task.FromResult(ApplyElement(baseline, scopeId, elementId, "m75-reset-element")), cancellationToken).ConfigureAwait(false);

    public async Task<LayoutOperationResult> ResetAllAsync(CancellationToken cancellationToken = default) =>
        await ExclusiveAsync(() => Task.FromResult(ApplyAll(baseline, "m75-reset-all")), cancellationToken).ConfigureAwait(false);

    public async Task<LayoutOperationResult> SwitchProfileAsync(string profileId, CancellationToken cancellationToken = default) =>
        await ExclusiveAsync(async () =>
        {
            if (LayoutProfileCatalog.Find(profileId) is null) return Fail("profile_selection_failed", "Unbekanntes Layoutprofil.");
            if (string.Equals(profileId, ActiveProfileId, StringComparison.Ordinal)) return Ok("profile_already_active", "Profil ist bereits aktiv.");

            var original = CaptureWorking();
            var load = await profileStore.LoadAsync(profileId, adapters, cancellationToken).ConfigureAwait(false);
            if (!load.Success) return Fail(load.Code, load.Message);
            var desired = load.Found && load.Document is not null ? StatesFromDocument(load.Document) : CloneStates(baseline);
            var applied = ApplyAll(desired, "m75-profile-switch");
            if (!applied.Success) return applied;
            bool profileSelectionSaved;
            try { profileSelectionSaved = await activeProfileStore.SaveAsync(profileId, cancellationToken).ConfigureAwait(false); }
            catch (OperationCanceledException)
            {
                var cancelledRollback = ApplyAll(original, "m75-profile-selection-cancelled-rollback");
                return new(false, cancelledRollback.Success ? "cancelled" : "rollback_failed",
                    cancelledRollback.Success ? "Profilwechsel wurde abgebrochen; Layout wurde zurückgerollt." : "Profilwechsel wurde abgebrochen und der Rollback ist fehlgeschlagen.",
                    cancelledRollback.Success, cancelledRollback.Failures);
            }
            if (!profileSelectionSaved)
            {
                var rollback = ApplyAll(original, "m75-profile-selection-rollback");
                return new(false, rollback.Success ? "profile_selection_failed" : "rollback_failed",
                    rollback.Success ? "Aktive Profilwahl konnte nicht gespeichert werden; Layout wurde zurückgerollt." : "Profilwahl und Rollback sind fehlgeschlagen.",
                    rollback.Success, rollback.Failures);
            }
            ActiveProfileId = profileId;
            saved = CloneStates(desired);
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

    private LayoutOperationResult ApplyElement(
        IReadOnlyDictionary<string, LayoutState> source,
        string scopeId,
        string elementId,
        string operationSource)
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
            var result = adapter.SubmitChangeRequest(request);
            if (result.Success) continue;
            var rollbackSequence = 1;
            var rollbackFailures = LayoutRestoreCoordinator.CreateRequests(registryEntry, Persisted(original, registryEntry), $"{operationSource}-rollback", ref rollbackSequence)
                .Select(adapter.SubmitChangeRequest).Where(item => !item.Success)
                .Select(item => new LayoutApplyFailure(item.ElementId, item.Operation, item.ErrorCode ?? "target_rejected_change", item.Message)).ToArray();
            return new(false, rollbackFailures.Length == 0 ? "batch_apply_failed" : "rollback_failed",
                rollbackFailures.Length == 0 ? "Elementänderung ist fehlgeschlagen; Ausgangszustand wurde wiederhergestellt." : "Elementänderung und Rollback sind fehlgeschlagen.",
                rollbackFailures.Length == 0, rollbackFailures);
        }
        return Ok("element_layout_applied", "Elementzustand wurde angewandt.");
    }

    private LayoutOperationResult ApplyAll(IReadOnlyDictionary<string, LayoutState> desired, string source)
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
            var restored = new LayoutRestoreCoordinator(pair.Value).Restore(document,
                LayoutProfileDocumentFactory.ScopeOptions(profileStore.DocumentApplicationId, ActiveProfileId, pair.Key));
            if (restored.Success) continue;
            failures.AddRange(restored.Failures);
            var rollbackFailures = RollbackAll(original, $"{source}-rollback");
            failures.AddRange(rollbackFailures);
            return new(false, rollbackFailures.Count == 0 ? "batch_apply_failed" : "rollback_failed",
                rollbackFailures.Count == 0 ? "Batch-Anwendung ist fehlgeschlagen; vollständiger Ausgangszustand wurde wiederhergestellt." : "Batch-Anwendung und Rollback sind fehlgeschlagen.",
                rollbackFailures.Count == 0, failures);
        }
        return Ok("batch_applied", "Alle Scope-Zustände wurden atomar angewandt.");
    }

    private IReadOnlyList<LayoutApplyFailure> RollbackAll(IReadOnlyDictionary<string, LayoutState> original, string source)
    {
        var failures = new List<LayoutApplyFailure>();
        foreach (var pair in adapters.OrderBy(pair => pair.Key, StringComparer.Ordinal))
        {
            var document = ScopeDocument(pair.Key, original[pair.Key], source);
            var result = new LayoutRestoreCoordinator(pair.Value).Restore(document,
                LayoutProfileDocumentFactory.ScopeOptions(profileStore.DocumentApplicationId, ActiveProfileId, pair.Key));
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
                    element.TextOffsetX ?? fallback.TextOffsetX, element.TextOffsetY ?? fallback.TextOffsetY, element.FontSize ?? fallback.FontSize);
            }).ToArray();
            result[persistedScope.ScopeId] = new LayoutState(persistedScope.ScopeId, document.SavedAt, elements);
        }
        return result;
    }

    private IReadOnlyDictionary<string, LayoutState> CaptureWorking() => adapters.ToDictionary(
        pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal);

    private static IReadOnlyList<string> DirtyElementIds(
        IReadOnlyDictionary<string, LayoutState> working,
        IReadOnlyDictionary<string, LayoutState> saved)
    {
        var dirty = new List<string>();
        foreach (var pair in working.OrderBy(pair => pair.Key, StringComparer.Ordinal))
        {
            var savedById = saved[pair.Key].Elements.ToDictionary(element => element.ElementId, StringComparer.Ordinal);
            dirty.AddRange(pair.Value.Elements.Where(element => !Equivalent(element, savedById[element.ElementId])).Select(element => element.ElementId));
        }
        return dirty.OrderBy(value => value, StringComparer.Ordinal).ToArray();
    }

    private static bool Equivalent(ElementLayoutState left, ElementLayoutState right) =>
        Same(left.X, right.X) && Same(left.Y, right.Y) && Same(left.Width, right.Width) && Same(left.Height, right.Height) &&
        Same(left.TextOffsetX, right.TextOffsetX) && Same(left.TextOffsetY, right.TextOffsetY) && Same(left.FontSize, right.FontSize);

    private static bool Same(double? left, double? right) => left is null && right is null || left is not null && right is not null && Math.Abs(left.Value - right.Value) <= 0.000001;

    private static PersistedElementLayout Persisted(ElementLayoutState state, Registry.UiRegistryEntry entry) => new(
        state.ElementId, state.ScopeId,
        entry.Capabilities.HasFlag(Registry.UiCapability.Position) ? state.X : null,
        entry.Capabilities.HasFlag(Registry.UiCapability.Position) ? state.Y : null,
        entry.Capabilities.HasFlag(Registry.UiCapability.Width) ? state.Width : null,
        entry.Capabilities.HasFlag(Registry.UiCapability.Height) ? state.Height : null,
        entry.Capabilities.HasFlag(Registry.UiCapability.TextPosition) ? state.TextOffsetX : null,
        entry.Capabilities.HasFlag(Registry.UiCapability.TextPosition) ? state.TextOffsetY : null,
        entry.Capabilities.HasFlag(Registry.UiCapability.FontSize) ? state.FontSize : null);

    private static IReadOnlyDictionary<string, LayoutState> CloneStates(IReadOnlyDictionary<string, LayoutState> states) =>
        states.ToDictionary(pair => pair.Key,
            pair => new LayoutState(pair.Value.ScopeId, pair.Value.CapturedAt, pair.Value.Elements.Select(element => element with { })),
            StringComparer.Ordinal);

    private static LayoutOperationResult Ok(string code, string message) => new(true, code, message);
    private static LayoutOperationResult Fail(string code, string message) => new(false, code, message);
}
