using ReferenceTargetApp.EditorIntegration.HostAdapter;

namespace ReferenceTargetApp.EditorIntegration.Persistence;

public sealed record LayoutProfileStartupResult(
    bool Success,
    bool Found,
    string Code,
    string Message,
    string ActiveProfileId,
    bool RollbackSucceeded,
    LayoutProfileSession Session);

public sealed class LayoutProfileStartupCoordinator(
    IReadOnlyDictionary<string, IHostAdapter> adapters,
    AtomicJsonLayoutProfileStore profileStore,
    ActiveLayoutProfileStore activeProfileStore)
{
    public async Task<LayoutProfileStartupResult> RestoreAsync(CancellationToken cancellationToken = default)
    {
        var baseline = adapters.ToDictionary(pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal);
        var profileId = await activeProfileStore.LoadAsync(cancellationToken).ConfigureAwait(false);
        var session = new LayoutProfileSession(adapters, baseline, profileStore, activeProfileStore, profileId);
        var load = await session.LoadAsync(cancellationToken).ConfigureAwait(false);
        if (!load.Success && load.Code == "layout_profile_not_found")
            return new(true, false, load.Code, load.Message, profileId, true, session);
        return new(load.Success, true, load.Code, load.Message, profileId, load.RollbackSucceeded, session);
    }
}
