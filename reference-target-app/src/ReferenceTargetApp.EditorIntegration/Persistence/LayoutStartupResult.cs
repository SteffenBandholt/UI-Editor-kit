namespace ReferenceTargetApp.EditorIntegration.Persistence;

public sealed record LayoutStartupResult(
    bool Success,
    bool Found,
    string Code,
    string Message,
    LayoutLoadResult Load,
    LayoutRestoreResult? Restore);

public sealed class LayoutPersistenceCoordinator
{
    private readonly AtomicJsonLayoutStore store;

    public LayoutPersistenceCoordinator(AtomicJsonLayoutStore store) =>
        this.store = store ?? throw new ArgumentNullException(nameof(store));

    public LayoutStartupResult RestoreAtStartup(HostAdapter.IHostAdapter hostAdapter)
    {
        ArgumentNullException.ThrowIfNull(hostAdapter);
        var load = store.Load(hostAdapter.GetRegistry());
        if (!load.Found)
            return new(true, false, load.Code, load.Message, load, null);
        if (!load.Success || load.Document is null)
            return new(false, true, load.Code, load.Message, load, null);

        var restore = new LayoutRestoreCoordinator(hostAdapter).Restore(load.Document, store.Options);
        return new(restore.Success, true, restore.Code, restore.Message, load, restore);
    }
}
