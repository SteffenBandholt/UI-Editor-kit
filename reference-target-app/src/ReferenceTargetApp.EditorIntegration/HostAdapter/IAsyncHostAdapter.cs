namespace ReferenceTargetApp.EditorIntegration.HostAdapter;

/// <summary>
/// Additive asynchronous boundary for local process transports. Existing WPF
/// adapters keep the synchronous M73 contract; remote adapters never block a UI thread.
/// </summary>
public interface IAsyncHostAdapter : IHostAdapter
{
    Task<ChangeResult> SubmitChangeRequestAsync(ChangeRequest changeRequest, CancellationToken cancellationToken = default);
}

internal static class HostAdapterDispatch
{
    internal static Task<ChangeResult> SubmitAsync(
        IHostAdapter adapter,
        ChangeRequest request,
        CancellationToken cancellationToken = default) =>
        adapter is IAsyncHostAdapter asynchronous
            ? asynchronous.SubmitChangeRequestAsync(request, cancellationToken)
            : Task.FromResult(adapter.SubmitChangeRequest(request));
}
