using System.IO;
using System.Windows;
using ReferenceTargetApp.EditorIntegration.Electron;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Pdf;
using ReferenceTargetApp.EditorIntegration.Process;
using ReferenceTargetApp.PdfPreview;
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
            var recoveryWorkflow = new ProfileRecoveryWorkflow(new NativeProfileRecoveryPrompt());
            var uiRecoveryContext = new ProfileRecoveryContext(
                expectedApplicationId,
                "ui",
                target.Contract.ContractVersion,
                target.Contract.RegistryVersion.ToString(),
                target.Contract.RegistryFingerprint);
            var uiPreparation = await recoveryWorkflow.PrepareUiAsync(
                target.HostAdapters, profileStore, activeProfileStore, uiRecoveryContext, cancellationToken);
            var startup = uiPreparation.Startup;

            var selection = new TargetAppSelectionService(
                target.BeginTargetSelectionAsync,
                target.CancelTargetSelectionAsync,
                target.HighlightAsync);
            IPdfEditorWorkspace pdfWorkspace;
            if (target.Contract.PdfCapability == "available" && target.Contract.PdfContract is { PdfRegistryStatus: "available" } pdfContract)
            {
                var pdfAdapter = await target.CreatePdfHostAdapterAsync(cancellationToken);
                var pdfStore = new AtomicJsonPdfLayoutProfileStore(expectedProfileRoot, pdfContract.ApplicationId, pdfContract.DocumentTypeId,
                    allowCompatibleRegistryReconciliation: false);
                var pdfRecoveryContext = new ProfileRecoveryContext(
                    pdfContract.ApplicationId,
                    "pdf",
                    pdfContract.ContractVersion,
                    pdfContract.RegistryVersion.ToString(),
                    pdfContract.RegistryFingerprint,
                    pdfContract.DocumentTypeId);
                var pdfPreparation = await recoveryWorkflow.PreparePdfAsync(
                    pdfAdapter, pdfStore, pdfRecoveryContext, cancellationToken);
                var pdfSession = pdfPreparation.Session;
                pdfWorkspace = new PdfEditorWorkspaceViewModel(pdfAdapter.GetRegistry(), pdfAdapter, pdfSession,
                    new NativePdfPreviewRenderer(), cancellationToken);
            }
            else
            {
                pdfWorkspace = new UnavailablePdfEditorWorkspaceViewModel("Die Ziel-App stellt fuer das aktive Dokument keine PDF-Registry bereit.");
            }
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
                pdfWorkspaceOverride: pdfWorkspace);
            var session = new ElectronTargetEditorSession(target, selection, coordinator);
            target.ConfigureRegistryRefreshStatus(() =>
            {
                var status = startup.Session.GetStatus();
                return new(status.IsDirty, status.DirtyElementIds);
            });
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
