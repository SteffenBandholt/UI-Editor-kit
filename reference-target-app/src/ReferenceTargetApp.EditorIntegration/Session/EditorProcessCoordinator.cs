using System.IO;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.EditorUi;
using ReferenceTargetApp.EditorIntegration.Process;
using ReferenceTargetApp.EditorIntegration.Protocol;
using ReferenceTargetApp.EditorIntegration.Geometry;

namespace ReferenceTargetApp.EditorIntegration.Session;

public sealed class EditorProcessCoordinator : IAsyncDisposable
{
    private readonly IHostAdapter hostAdapter;
    private readonly IReadOnlyDictionary<string, IHostAdapter> hostAdapters;
    private readonly NodeEditorProcessClient client;
    private readonly EditorProcessTimeouts timeouts;
    private readonly SemaphoreSlim transitionLock = new(1, 1);
    private bool disposed;

    public EditorProcessCoordinator(IHostAdapter hostAdapter, EditorProcessOptions options)
        : this(new Dictionary<string, IHostAdapter>(StringComparer.Ordinal)
        {
            [hostAdapter?.GetCurrentLayoutState().ScopeId ?? throw new ArgumentNullException(nameof(hostAdapter))] = hostAdapter
        }, options)
    {
    }

    public EditorProcessCoordinator(IReadOnlyDictionary<string, IHostAdapter> hostAdapters, EditorProcessOptions options)
    {
        this.hostAdapters = hostAdapters ?? throw new ArgumentNullException(nameof(hostAdapters));
        if (hostAdapters.Count == 0) throw new ArgumentException("Mindestens ein HostAdapter ist erforderlich.", nameof(hostAdapters));
        ActiveScopeId = hostAdapters.ContainsKey("ui.order-header")
            ? "ui.order-header"
            : hostAdapters.OrderBy(pair => pair.Key, StringComparer.Ordinal).First().Key;
        hostAdapter = hostAdapters[ActiveScopeId];
        ArgumentNullException.ThrowIfNull(options);
        timeouts = options.Timeouts;
        client = new NodeEditorProcessClient(options);
        client.UnexpectedlyExited += Client_UnexpectedlyExited;
    }

    public EditorSessionState State { get; private set; } = EditorSessionState.Inactive;
    public string? SessionId { get; private set; }
    public int? ProcessId => client.ProcessId;
    public string ActiveScopeId { get; private set; }
    public IReadOnlyList<string> ScopeIds => hostAdapters.Keys.OrderBy(value => value, StringComparer.Ordinal).ToArray();
    public string ScopeDisplayName(string scopeId) => hostAdapters.TryGetValue(scopeId, out var adapter)
        ? adapter.GetRegistry().FindById(scopeId)?.DisplayName ?? scopeId
        : scopeId;
    public IReadOnlyList<EditorProcessDiagnostic> Diagnostics => client.GetDiagnostics();

    public async Task<EditorSessionResult> ActivateAsync(CancellationToken cancellationToken = default)
    {
        await transitionLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (State is EditorSessionState.Active or EditorSessionState.SessionActive)
                return EditorSessionResult.Ok("already_active", "Editor-Prozess ist bereits aktiviert.", State, SessionId);
            if (State != EditorSessionState.Inactive)
                return EditorSessionResult.Fail("invalid_state", "Aktivierung ist im aktuellen Zustand nicht erlaubt.", State, SessionId);

            State = EditorSessionState.Activating;
            await client.StartAsync(cancellationToken).ConfigureAwait(false);
            await client.SendRequestAsync(EditorMessageTypes.Handshake, new { }, EditorMessageTypes.HandshakeAccepted, timeouts.Handshake, cancellationToken: cancellationToken).ConfigureAwait(false);
            await client.SendRequestAsync(EditorMessageTypes.Activate, new { }, EditorMessageTypes.Activated, timeouts.Activation, cancellationToken: cancellationToken).ConfigureAwait(false);
            State = EditorSessionState.Active;
            return EditorSessionResult.Ok("activated", "Editor-Prozess wurde aktiviert.", State);
        }
        catch (Exception exception) when (exception is EditorProcessException or OperationCanceledException)
        {
            State = EditorSessionState.Faulted;
            await SafeStopClientAsync().ConfigureAwait(false);
            return EditorSessionResult.Fail(ErrorCode(exception), exception.Message, State);
        }
        finally
        {
            transitionLock.Release();
        }
    }

    public async Task<EditorSessionResult> StartSessionAsync(CancellationToken cancellationToken = default)
    {
        await transitionLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (State == EditorSessionState.SessionActive)
                return EditorSessionResult.Fail("session_already_active", "Es ist bereits eine Session aktiv.", State, SessionId);
            if (State != EditorSessionState.Active)
                return EditorSessionResult.Fail("not_activated", "Sessionstart erfordert eine aktive Prozessanbindung.", State);

            State = EditorSessionState.StartingSession;
            var sessionId = $"session-{Guid.NewGuid():N}";
            await client.SendRequestAsync(EditorMessageTypes.StartSession, new { }, EditorMessageTypes.RequestRegistry, timeouts.SessionStart, sessionId, cancellationToken).ConfigureAwait(false);
            await client.SendRequestAsync(
                EditorMessageTypes.Registry,
                hostAdapters.Count == 1
                    ? EditorProtocolPayloadFactory.CreateRegistryPayload(hostAdapter.GetRegistry())
                    : EditorProtocolPayloadFactory.CreateRegistryPayload(hostAdapters),
                EditorMessageTypes.RequestLayoutState,
                timeouts.SessionStart,
                sessionId,
                cancellationToken).ConfigureAwait(false);
            var layoutState = hostAdapter.GetCurrentLayoutState();
            await client.SendRequestAsync(
                EditorMessageTypes.LayoutState,
                hostAdapters.Count == 1
                    ? EditorProtocolPayloadFactory.CreateLayoutStatePayload(layoutState)
                    : EditorProtocolPayloadFactory.CreateLayoutStatePayload(
                        hostAdapters.ToDictionary(pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal),
                        ActiveScopeId),
                EditorMessageTypes.SessionStarted,
                timeouts.SessionStart,
                sessionId,
                cancellationToken).ConfigureAwait(false);
            SessionId = sessionId;
            State = EditorSessionState.SessionActive;
            return EditorSessionResult.Ok("session_started", "Editor-Session wurde gestartet.", State, SessionId);
        }
        catch (Exception exception) when (exception is EditorProcessException or OperationCanceledException or InvalidOperationException)
        {
            State = client.IsRunning ? EditorSessionState.Active : EditorSessionState.Faulted;
            SessionId = null;
            return EditorSessionResult.Fail(ErrorCode(exception), exception.Message, State);
        }
        finally
        {
            transitionLock.Release();
        }
    }

    public async Task<ChangeResult> RunDiagnosticChangeAsync(ChangeRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        await transitionLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (State != EditorSessionState.SessionActive || SessionId is null)
                return ChangeResult.Rejected(request, "session_not_active", "Diagnoseauftrag erfordert eine aktive Session.");

            var submitMessage = await client.SendRequestAsync(
                EditorMessageTypes.Diagnostic,
                new { changeRequest = request },
                EditorMessageTypes.SubmitChangeRequest,
                timeouts.SessionStart,
                SessionId,
                cancellationToken).ConfigureAwait(false);
            ChangeRequest translated;
            try
            {
                translated = ChangeRequestProtocolTranslator.Translate(submitMessage.Payload);
            }
            catch (InvalidDataException exception)
            {
                return ChangeResult.Rejected(request, "invalid_protocol_payload", exception.Message);
            }

            var result = await HostAdapterDispatch.SubmitAsync(ResolveAdapter(translated), translated, cancellationToken).ConfigureAwait(false);
            await client.SendRequestAsync(
                EditorMessageTypes.ChangeResult,
                new { changeResult = result },
                EditorMessageTypes.ChangeResultAccepted,
                timeouts.SessionStart,
                SessionId,
                cancellationToken).ConfigureAwait(false);
            return result;
        }
        catch (Exception exception) when (exception is EditorProcessException or OperationCanceledException)
        {
            return ChangeResult.Rejected(request, ErrorCode(exception), exception.Message);
        }
        finally
        {
            transitionLock.Release();
        }
    }

    public Task<EditorUiState> GetEditorUiStateAsync(CancellationToken cancellationToken = default) =>
        RunEditorUiStateRequestAsync(EditorMessageTypes.GetEditorUiState, new { }, cancellationToken);

    public Task<EditorUiState> SelectEditorElementAsync(string elementId, CancellationToken cancellationToken = default) =>
        RunEditorUiStateRequestAsync(EditorMessageTypes.SelectEditorElement, new { elementId }, cancellationToken);

    public Task<EditorUiState> SetEditorLayerAsync(string layer, CancellationToken cancellationToken = default) =>
        RunEditorUiStateRequestAsync(EditorMessageTypes.SetEditorLayer, new { layer }, cancellationToken);

    public Task<EditorUiState> SetEditorModeAsync(string mode, CancellationToken cancellationToken = default) =>
        RunEditorUiStateRequestAsync(EditorMessageTypes.SetEditorMode, new { mode }, cancellationToken);

    public Task<EditorUiState> SetEditorStepAsync(double stepSize, CancellationToken cancellationToken = default) =>
        RunEditorUiStateRequestAsync(EditorMessageTypes.SetEditorStep, new { stepSize }, cancellationToken);

    public async Task<EditorUiState> SelectEditorScopeAsync(string scopeId, CancellationToken cancellationToken = default)
    {
        if (!hostAdapters.ContainsKey(scopeId)) throw new EditorProcessException("unknown_scope", "Scope ist nicht registriert.");
        var state = await RunEditorUiStateRequestAsync(EditorMessageTypes.SelectEditorScope, new { scopeId }, cancellationToken).ConfigureAwait(false);
        ActiveScopeId = scopeId;
        return state;
    }

    public Task<EditorUiState> RefreshEditorLayoutStatesAsync(CancellationToken cancellationToken = default) =>
        RunEditorUiStateRequestAsync(
            EditorMessageTypes.RefreshEditorLayoutStates,
            EditorProtocolPayloadFactory.CreateLayoutStatePayload(
                hostAdapters.ToDictionary(pair => pair.Key, pair => pair.Value.GetCurrentLayoutState(), StringComparer.Ordinal),
                ActiveScopeId),
            cancellationToken);

    public async Task<EditorUiChangeOutcome> RunEditorDirectionAsync(string direction, CancellationToken cancellationToken = default)
        => await RunEditorDirectionWithRiskAsync(direction, GeometryEditModes.Guided, null, cancellationToken).ConfigureAwait(false);

    public async Task<EditorUiChangeOutcome> RunEditorDirectionWithRiskAsync(
        string direction,
        string editMode,
        GeometryRiskConfirmation? confirmation = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(direction);
        await transitionLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            EnsureActiveSession();
            var submitMessage = await client.SendRequestAsync(
                EditorMessageTypes.ActivateEditorDirection,
                new { direction },
                EditorMessageTypes.SubmitChangeRequest,
                timeouts.SessionStart,
                SessionId,
                cancellationToken).ConfigureAwait(false);
            var request = ChangeRequestProtocolTranslator.Translate(submitMessage.Payload);
            var adapter = ResolveAdapter(request);
            var result = adapter is IGeometryRiskHostAdapter geometryAdapter
                ? await geometryAdapter.SubmitGeometryChangeRequestAsync(request, editMode, confirmation, cancellationToken).ConfigureAwait(false)
                : await HostAdapterDispatch.SubmitAsync(adapter, request, cancellationToken).ConfigureAwait(false);
            await client.SendRequestAsync(
                EditorMessageTypes.ChangeResult,
                new { changeResult = result },
                EditorMessageTypes.ChangeResultAccepted,
                timeouts.SessionStart,
                SessionId,
                cancellationToken).ConfigureAwait(false);
            var state = await RequestEditorUiStateCoreAsync(EditorMessageTypes.GetEditorUiState, new { }, cancellationToken).ConfigureAwait(false);
            return new EditorUiChangeOutcome(state, result);
        }
        finally
        {
            transitionLock.Release();
        }
    }

    public async Task ClearGeometryPreviewAsync(CancellationToken cancellationToken = default)
    {
        if (hostAdapters.TryGetValue(ActiveScopeId, out var adapter) && adapter is IGeometryRiskHostAdapter geometryAdapter)
            await geometryAdapter.ClearGeometryPreviewAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<EditorUiChangeOutcome> SetEditorVisibilityAsync(bool visible, CancellationToken cancellationToken = default)
    {
        await transitionLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            EnsureActiveSession();
            var submitMessage = await client.SendRequestAsync(
                EditorMessageTypes.SetEditorVisibility,
                new { visible },
                EditorMessageTypes.SubmitChangeRequest,
                timeouts.SessionStart,
                SessionId,
                cancellationToken).ConfigureAwait(false);
            var request = ChangeRequestProtocolTranslator.Translate(submitMessage.Payload);
            var result = await HostAdapterDispatch.SubmitAsync(ResolveAdapter(request), request, cancellationToken).ConfigureAwait(false);
            await client.SendRequestAsync(
                EditorMessageTypes.ChangeResult,
                new { changeResult = result },
                EditorMessageTypes.ChangeResultAccepted,
                timeouts.SessionStart,
                SessionId,
                cancellationToken).ConfigureAwait(false);
            var state = await RequestEditorUiStateCoreAsync(EditorMessageTypes.GetEditorUiState, new { }, cancellationToken).ConfigureAwait(false);
            return new EditorUiChangeOutcome(state, result);
        }
        finally
        {
            transitionLock.Release();
        }
    }

    private async Task<EditorUiState> RunEditorUiStateRequestAsync(string messageType, object payload, CancellationToken cancellationToken)
    {
        await transitionLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            EnsureActiveSession();
            return await RequestEditorUiStateCoreAsync(messageType, payload, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            transitionLock.Release();
        }
    }

    private async Task<EditorUiState> RequestEditorUiStateCoreAsync(string messageType, object payload, CancellationToken cancellationToken)
    {
        var response = await client.SendRequestAsync(
            messageType,
            payload,
            EditorMessageTypes.EditorUiState,
            timeouts.SessionStart,
            SessionId,
            cancellationToken).ConfigureAwait(false);
        return EditorUiStateTranslator.Translate(response.Payload);
    }

    private void EnsureActiveSession()
    {
        if (State != EditorSessionState.SessionActive || SessionId is null)
            throw new EditorProcessException("session_not_active", "Editoraktion erfordert eine aktive Session.");
    }

    private IHostAdapter ResolveAdapter(ChangeRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.Scope) && hostAdapters.TryGetValue(request.Scope, out var scoped)) return scoped;
        var matches = hostAdapters.Values.Where(adapter => adapter.GetRegistry().FindById(request.ElementId) is not null).ToArray();
        if (matches.Length == 1) return matches[0];
        throw new EditorProcessException("wrong_scope", "Änderungsauftrag kann keinem eindeutigen Scope zugeordnet werden.");
    }

    public async Task<EditorSessionResult> EndSessionAsync(CancellationToken cancellationToken = default)
    {
        await transitionLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (State == EditorSessionState.Active)
                return EditorSessionResult.Ok("session_not_active", "Es ist keine Session aktiv.", State);
            if (State != EditorSessionState.SessionActive || SessionId is null)
                return EditorSessionResult.Fail("invalid_state", "Sessionende ist im aktuellen Zustand nicht erlaubt.", State, SessionId);

            State = EditorSessionState.EndingSession;
            var endedSessionId = SessionId;
            await client.SendRequestAsync(EditorMessageTypes.EndSession, new { }, EditorMessageTypes.SessionEnded, timeouts.SessionEnd, endedSessionId, cancellationToken).ConfigureAwait(false);
            SessionId = null;
            State = EditorSessionState.Active;
            return EditorSessionResult.Ok("session_ended", "Editor-Session wurde beendet.", State);
        }
        catch (Exception exception) when (exception is EditorProcessException or OperationCanceledException)
        {
            State = client.IsRunning ? EditorSessionState.Active : EditorSessionState.Faulted;
            SessionId = null;
            return EditorSessionResult.Fail(ErrorCode(exception), exception.Message, State);
        }
        finally
        {
            transitionLock.Release();
        }
    }

    public async Task<EditorSessionResult> DeactivateAsync(CancellationToken cancellationToken = default)
    {
        if (State == EditorSessionState.SessionActive)
        {
            var sessionResult = await EndSessionAsync(cancellationToken).ConfigureAwait(false);
            if (!sessionResult.Success) return sessionResult;
        }

        await transitionLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (State == EditorSessionState.Inactive)
                return EditorSessionResult.Ok("already_inactive", "Editor-Prozess ist bereits deaktiviert.", State);
            if (State != EditorSessionState.Active && State != EditorSessionState.Faulted)
                return EditorSessionResult.Fail("invalid_state", "Deaktivierung ist im aktuellen Zustand nicht erlaubt.", State, SessionId);

            State = EditorSessionState.Deactivating;
            if (client.IsRunning)
            {
                await client.SendRequestAsync(EditorMessageTypes.Deactivate, new { }, EditorMessageTypes.Deactivated, timeouts.Deactivation, cancellationToken: cancellationToken).ConfigureAwait(false);
                await client.StopAsync(cancellationToken).ConfigureAwait(false);
            }
            SessionId = null;
            State = EditorSessionState.Inactive;
            return EditorSessionResult.Ok("deactivated", "Editor-Prozess wurde deaktiviert und beendet.", State);
        }
        catch (Exception exception) when (exception is EditorProcessException or OperationCanceledException)
        {
            await SafeStopClientAsync().ConfigureAwait(false);
            SessionId = null;
            State = EditorSessionState.Faulted;
            return EditorSessionResult.Fail(ErrorCode(exception), exception.Message, State);
        }
        finally
        {
            transitionLock.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (disposed) return;
        disposed = true;
        await DeactivateAsync(CancellationToken.None).ConfigureAwait(false);
        client.UnexpectedlyExited -= Client_UnexpectedlyExited;
        await client.DisposeAsync().ConfigureAwait(false);
        transitionLock.Dispose();
    }

    private void Client_UnexpectedlyExited(object? sender, EventArgs e)
    {
        SessionId = null;
        State = EditorSessionState.Faulted;
    }

    private async Task SafeStopClientAsync()
    {
        try { await client.StopAsync(CancellationToken.None).ConfigureAwait(false); }
        catch (Exception exception) when (exception is EditorProcessException or InvalidOperationException) { }
    }

    private static string ErrorCode(Exception exception) => exception is EditorProcessException processException
        ? processException.Code
        : exception is OperationCanceledException ? "cancelled" : "integration_failed";
}
