using System.Windows.Threading;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

public sealed class WpfHostAdapter : IHostAdapter
{
    private readonly IUiElementRegistry registry;
    private readonly IWpfLayoutAccess layoutAccess;

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
            snapshot = layoutAccess.Capture(entry);
            layoutAccess.Apply(entry, change);
            var newState = layoutAccess.Read(entry);
            return new ChangeResult(
                true,
                request.ChangeId,
                request.ElementId,
                request.Operation,
                null,
                "Layoutänderung wurde angewandt.",
                previousState,
                newState,
                true);
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
        bool rollbackSucceeded) => new(
            false,
            request.ChangeId,
            request.ElementId,
            request.Operation,
            errorCode,
            message,
            previousState,
            newState,
            rollbackSucceeded);
}
