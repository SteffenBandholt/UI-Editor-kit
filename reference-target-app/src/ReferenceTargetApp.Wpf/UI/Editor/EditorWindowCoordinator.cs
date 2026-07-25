using System.Windows;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Process;
using ReferenceTargetApp.EditorIntegration.Session;
using ReferenceTargetApp.UI.ViewModels;
using ReferenceTargetApp.UI.Views;

namespace ReferenceTargetApp.UI.Editor;

internal sealed class EditorWindowCoordinator(
    Window owner,
    IReadOnlyDictionary<string, IHostAdapter> hostAdapters,
    LayoutProfileSession layoutSession,
    TargetAppSelectionService selectionService,
    IEditorDialogService? dialogService = null) : IAsyncDisposable
{
    private readonly SemaphoreSlim lifecycleLock = new(1, 1);
    private CancellationTokenSource? lifetimeCancellation;
    private EditorProcessCoordinator? processCoordinator;
    private EditorWindow? window;
    private EditorWindowViewModel? viewModel;
    private bool closing;
    private bool disposed;

    internal EditorWindowViewModel? ViewModel => viewModel;
    internal EditorWindow? Window => window;
    internal int WindowCreationCount { get; private set; }
    internal int ExistingWindowActivationCount { get; private set; }
    internal bool HasOpenWindow => window is { IsVisible: true };
    internal bool HasActiveProcess => processCoordinator?.ProcessId is not null;
    internal string? SessionId => processCoordinator?.SessionId;

    internal async Task<EditorWindowViewModel> OpenAsync()
    {
        ObjectDisposedException.ThrowIf(disposed, this);
        await lifecycleLock.WaitAsync();
        try
        {
            if (window is { IsVisible: true } existing && viewModel is not null)
            {
                if (existing.WindowState == WindowState.Minimized) existing.WindowState = WindowState.Normal;
                existing.Activate();
                ExistingWindowActivationCount++;
                return viewModel;
            }

            try
            {
                lifetimeCancellation = new CancellationTokenSource();
                processCoordinator = new EditorProcessCoordinator(hostAdapters, EditorProcessPathResolver.ResolveDefault());
                viewModel = new EditorWindowViewModel(
                    processCoordinator,
                    layoutSession,
                    selectionService,
                    dialogService ?? new NativeEditorDialogService(),
                    () => window,
                    CloseAsync,
                    lifetimeCancellation.Token);
                window = new EditorWindow(viewModel, this) { Owner = owner };
                window.Closed += Window_Closed;
                WindowCreationCount++;
                window.Show();
                await viewModel.InitializeAsync();
                return viewModel;
            }
            catch
            {
                if (processCoordinator is not null) await processCoordinator.DisposeAsync();
                lifetimeCancellation?.Cancel();
                if (window is not null) window.CompleteClose();
                ClearCurrentWindow();
                throw;
            }
        }
        finally { lifecycleLock.Release(); }
    }

    internal async Task CloseAsync()
    {
        await lifecycleLock.WaitAsync();
        try
        {
            if (closing) return;
            closing = true;
            var currentWindow = window;
            var currentViewModel = viewModel;
            currentViewModel?.BeginClosing(currentViewModel.IsBusy);
            if (processCoordinator is not null)
                await processCoordinator.DisposeAsync();
            lifetimeCancellation?.Cancel();
            await owner.Dispatcher.InvokeAsync(() =>
            {
                currentViewModel?.MarkClosed();
                if (currentWindow is not null)
                    currentWindow.CompleteClose();
                ClearCurrentWindow();
            });
        }
        finally
        {
            closing = false;
            lifecycleLock.Release();
        }
    }

    internal async Task RequestCloseAsync()
    {
        if (viewModel is not null && !await viewModel.ConfirmCloseAsync()) return;
        await CloseAsync();
    }

    public async ValueTask DisposeAsync()
    {
        if (disposed) return;
        await CloseAsync();
        disposed = true;
        lifecycleLock.Dispose();
    }

    private void Window_Closed(object? sender, EventArgs e) => ClearCurrentWindow();

    private void ClearCurrentWindow()
    {
        if (window is not null) window.Closed -= Window_Closed;
        lifetimeCancellation?.Dispose();
        lifetimeCancellation = null;
        processCoordinator = null;
        viewModel = null;
        window = null;
    }
}
