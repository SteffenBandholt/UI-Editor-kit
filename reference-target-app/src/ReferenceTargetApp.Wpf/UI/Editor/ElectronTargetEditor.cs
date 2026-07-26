using System.IO;
using System.Windows;
using ReferenceTargetApp.EditorIntegration.Electron;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Process;
using ReferenceTargetApp.UI.ViewModels;

namespace ReferenceTargetApp.UI.Editor;

/// <summary>
/// Hosts the existing native editor window for a framework-neutral Electron target.
/// No target-specific domain model enters this process.
/// </summary>
public sealed class ElectronTargetEditorSession : IAsyncDisposable
{
    private readonly ElectronTargetSession targetSession;
    private readonly TargetAppSelectionService selectionService;
    private readonly EditorWindowCoordinator coordinator;
    private bool disposed;

    private ElectronTargetEditorSession(
        ElectronTargetSession targetSession,
        TargetAppSelectionService selectionService,
        EditorWindowCoordinator coordinator)
    {
        this.targetSession = targetSession;
        this.selectionService = selectionService;
        this.coordinator = coordinator;
        targetSession.ElementSelected += TargetSession_ElementSelected;
        targetSession.ActivationRequested += TargetSession_ActivationRequested;
        targetSession.ShutdownRequested += TargetSession_ShutdownRequested;
        targetSession.Disconnected += TargetSession_Disconnected;
    }

    public bool IsOpen => coordinator.HasOpenWindow;
    public event EventHandler? Closed;

    public static async Task<ElectronTargetEditorSession> OpenAsync(
        string pipeName,
        string nonce,
        string expectedApplicationId,
        string expectedProfileRoot,
        string editorRuntimeRoot,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(expectedApplicationId);
        ArgumentException.ThrowIfNullOrWhiteSpace(expectedProfileRoot);
        RegisteredTargetEditorLauncher.EnsureEditorResources();
        var target = await ElectronTargetSession.ListenAsync(pipeName, nonce, cancellationToken);
        try
        {
            if (!string.Equals(target.Contract.ApplicationId, expectedApplicationId, StringComparison.Ordinal) ||
                !Path.GetFullPath(target.Contract.ProfileRoot).Equals(Path.GetFullPath(expectedProfileRoot), StringComparison.OrdinalIgnoreCase))
                throw new ElectronEditorException(ElectronEditorErrorCodes.SessionInvalid, "Anwendungs- oder Profilkennung passt nicht zum vertrauenswürdigen Startkontext.");

            var profileStore = new AtomicJsonLayoutProfileStore(expectedProfileRoot, expectedApplicationId);
            var activeProfileStore = new ActiveLayoutProfileStore(expectedProfileRoot);
            var startup = await new LayoutProfileStartupCoordinator(target.HostAdapters, profileStore, activeProfileStore)
                .RestoreAsync(cancellationToken);
            if (!startup.Success)
                throw new ElectronEditorException(ElectronEditorErrorCodes.RestoreFailed, startup.Message);

            var selection = new TargetAppSelectionService(
                target.BeginTargetSelectionAsync,
                target.CancelTargetSelectionAsync,
                target.HighlightAsync);
            var unavailablePdf = new UnavailablePdfEditorWorkspaceViewModel("BBM-PDF noch nicht angebunden – folgt in M81.");
            var coordinator = new EditorWindowCoordinator(
                null,
                target.HostAdapters,
                startup.Session,
                selection,
                null,
                null,
                null,
                null,
                null,
                editorProcessOptions: EditorProcessOptions.FromRepositoryRoot(editorRuntimeRoot),
                pdfWorkspaceOverride: unavailablePdf);
            var session = new ElectronTargetEditorSession(target, selection, coordinator);
            await coordinator.OpenAsync();
            if (coordinator.ViewModel?.CurrentState is null)
            {
                var errorCode = coordinator.ViewModel?.ErrorCode;
                var errorMessage = coordinator.ViewModel?.ErrorMessage;
                var processDiagnostics = coordinator.ProcessDiagnostics
                    .Select(item => $"{item.Source}/{item.Code}: {item.Message}")
                    .ToArray();
                await session.DisposeAsync();
                var detail = string.IsNullOrWhiteSpace(errorCode) && string.IsNullOrWhiteSpace(errorMessage)
                    ? string.Empty
                    : $" ({errorCode}: {errorMessage})";
                if (processDiagnostics.Length > 0)
                    detail += " Prozessdiagnose: " + string.Join(" | ", processDiagnostics);
                throw new ElectronEditorException(ElectronEditorErrorCodes.EditorStartFailed, "Der native Editor konnte die Electron-Registry nicht aktivieren." + detail);
            }
            if (coordinator.Window is not null)
                coordinator.Window.Closed += session.EditorWindow_Closed;
            return session;
        }
        catch
        {
            await target.DisposeAsync();
            throw;
        }
    }

    public void Activate()
    {
        var window = coordinator.Window;
        if (window is null) return;
        if (window.WindowState == WindowState.Minimized) window.WindowState = WindowState.Normal;
        window.Activate();
    }

    private void TargetSession_ElementSelected(object? sender, ElectronTargetElementSelectedEventArgs e) =>
        Application.Current.Dispatcher.Invoke(() => selectionService.NotifyRemoteSelection(e.ScopeId, e.ElementId));

    private void TargetSession_ActivationRequested(object? sender, EventArgs e) =>
        Application.Current.Dispatcher.Invoke(Activate);

    private void TargetSession_ShutdownRequested(object? sender, EventArgs e) =>
        _ = Application.Current.Dispatcher.InvokeAsync(async () => await DisposeAsync());

    private void TargetSession_Disconnected(object? sender, string reason) =>
        _ = Application.Current.Dispatcher.InvokeAsync(async () =>
        {
            if (coordinator.ViewModel is not null)
                coordinator.ViewModel.ShowConnectionLost(ElectronEditorErrorCodes.HandshakeFailed, "Verbindung zur BBM-Ziel-App wurde getrennt.");
            await Task.CompletedTask;
        });

    private void EditorWindow_Closed(object? sender, EventArgs e) => _ = DisposeAsync().AsTask();

    public async ValueTask DisposeAsync()
    {
        if (disposed) return;
        disposed = true;
        targetSession.ElementSelected -= TargetSession_ElementSelected;
        targetSession.ActivationRequested -= TargetSession_ActivationRequested;
        targetSession.ShutdownRequested -= TargetSession_ShutdownRequested;
        targetSession.Disconnected -= TargetSession_Disconnected;
        if (coordinator.Window is not null) coordinator.Window.Closed -= EditorWindow_Closed;
        try { await targetSession.ShutdownTargetSessionAsync(); } catch { }
        await coordinator.DisposeAsync();
        selectionService.Dispose();
        await targetSession.DisposeAsync();
        Closed?.Invoke(this, EventArgs.Empty);
    }
}
