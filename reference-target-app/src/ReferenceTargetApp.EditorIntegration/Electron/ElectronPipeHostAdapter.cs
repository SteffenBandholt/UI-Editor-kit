using System.Globalization;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Registry;

namespace ReferenceTargetApp.EditorIntegration.Electron;

public sealed record ElectronTargetElementSelectedEventArgs(string ScopeId, string ElementId);

public sealed class ElectronTargetSession : IAsyncDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true };
    private readonly LocalTargetPipeConnection connection;
    private readonly IReadOnlyDictionary<string, ElectronPipeHostAdapter> adapters;
    private bool disposed;

    private ElectronTargetSession(
        LocalTargetPipeConnection connection,
        ElectronTargetContract contract,
        IReadOnlyDictionary<string, ElectronPipeHostAdapter> adapters)
    {
        this.connection = connection;
        Contract = contract;
        this.adapters = adapters;
        connection.EventReceived += Connection_EventReceived;
        connection.Disconnected += (_, reason) => Disconnected?.Invoke(this, reason);
    }

    public ElectronTargetContract Contract { get; }
    public IReadOnlyDictionary<string, IHostAdapter> HostAdapters => adapters.ToDictionary(pair => pair.Key, pair => (IHostAdapter)pair.Value, StringComparer.Ordinal);
    public event EventHandler<ElectronTargetElementSelectedEventArgs>? ElementSelected;
    public event EventHandler<string>? Disconnected;
    public event EventHandler? ActivationRequested;
    public event EventHandler? ShutdownRequested;

    public static async Task<ElectronTargetSession> ListenAsync(
        string pipeName,
        string nonce,
        CancellationToken cancellationToken = default)
    {
        var accepted = await LocalTargetPipeConnection.ListenAsync(pipeName, nonce, TimeSpan.FromSeconds(15), cancellationToken).ConfigureAwait(false);
        try
        {
            var contract = ElectronTargetContract.FromHandshake(accepted.Handshake);
            var registryResponse = await accepted.Connection.RequestAsync("getRegistry", timeout: TimeSpan.FromSeconds(10), cancellationToken: cancellationToken).ConfigureAwait(false);
            var registryScopes = RequiredArray<RemoteRegistryScope>(registryResponse, "registryScopes");
            ValidateScopes(contract, registryScopes);
            var layoutResponse = await accepted.Connection.RequestAsync("getLayoutState", timeout: TimeSpan.FromSeconds(10), cancellationToken: cancellationToken).ConfigureAwait(false);
            var scopeStates = RequiredArray<RemoteScopeLayoutState>(layoutResponse, "scopeStates");
            var statesByScope = scopeStates.ToDictionary(item => item.ScopeId, StringComparer.Ordinal);
            Dictionary<string, ElectronPipeHostAdapter> CreateAdapters() => registryScopes.ToDictionary(
                scope => scope.ScopeId,
                scope => new ElectronPipeHostAdapter(accepted.Connection, scope, statesByScope.GetValueOrDefault(scope.ScopeId)
                    ?? throw new ElectronEditorException(ElectronEditorErrorCodes.RegistryInvalid, $"LayoutState für Scope '{scope.ScopeId}' fehlt.")),
                StringComparer.Ordinal);

            Dictionary<string, ElectronPipeHostAdapter> adapters;
            if (Thread.CurrentThread.GetApartmentState() == ApartmentState.STA)
            {
                adapters = CreateAdapters();
            }
            else
            {
                var dispatcher = Application.Current?.Dispatcher
                    ?? throw new ElectronEditorException(ElectronEditorErrorCodes.EditorStartFailed, "Der UI-Thread des Editors ist nicht verfügbar.");
                adapters = await dispatcher.InvokeAsync(CreateAdapters).Task.ConfigureAwait(false);
            }
            return new ElectronTargetSession(accepted.Connection, contract, adapters);
        }
        catch
        {
            await accepted.Connection.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    public Task BeginTargetSelectionAsync(CancellationToken cancellationToken = default) =>
        connection.SendEventAsync("beginTargetSelection", cancellationToken: cancellationToken);

    public Task CancelTargetSelectionAsync(CancellationToken cancellationToken = default) =>
        connection.SendEventAsync("cancelTargetSelection", cancellationToken: cancellationToken);

    public Task HighlightAsync(string scopeId, string elementId, CancellationToken cancellationToken = default) =>
        connection.SendEventAsync("highlightElement", new { scopeId, elementId }, cancellationToken);

    public Task ActivateTargetAsync(CancellationToken cancellationToken = default) =>
        connection.SendEventAsync("activateTarget", cancellationToken: cancellationToken);

    public Task ShutdownTargetSessionAsync(CancellationToken cancellationToken = default) =>
        connection.SendEventAsync("editorClosed", cancellationToken: cancellationToken);

    private void Connection_EventReceived(object? sender, LocalTargetRequest request)
    {
        if (request.Action == "activateEditor") { ActivationRequested?.Invoke(this, EventArgs.Empty); return; }
        if (request.Action == "shutdownEditor") { ShutdownRequested?.Invoke(this, EventArgs.Empty); return; }
        if (request.Action != "targetSelectionChanged") return;
        var scopeId = Text(request.Payload, "scopeId");
        var elementId = Text(request.Payload, "elementId");
        if (scopeId is null || elementId is null || !adapters.TryGetValue(scopeId, out var adapter) || adapter.GetRegistry().FindById(elementId) is null) return;
        ElementSelected?.Invoke(this, new(scopeId, elementId));
    }

    private static void ValidateScopes(ElectronTargetContract contract, IReadOnlyList<RemoteRegistryScope> scopes)
    {
        if (scopes.Count != contract.ActiveScopes.Count || contract.ActiveScopes.Any(scopeId => scopes.All(scope => scope.ScopeId != scopeId)))
            throw new ElectronEditorException(ElectronEditorErrorCodes.RegistryInvalid, "Aktive Scopes und Registry stimmen nicht überein.");
        foreach (var scope in scopes) ValidateScope(scope);
    }

    private static void ValidateScope(RemoteRegistryScope scope)
    {
        if (string.IsNullOrWhiteSpace(scope.ScopeId) || scope.Elements.Count == 0)
            throw new ElectronEditorException(ElectronEditorErrorCodes.RegistryInvalid, "Registry-Scope ist leer.");
        var byId = new Dictionary<string, RemoteRegistrationEntry>(StringComparer.Ordinal);
        foreach (var element in scope.Elements)
        {
            if (string.IsNullOrWhiteSpace(element.Id) || !byId.TryAdd(element.Id, element) ||
                string.IsNullOrWhiteSpace(element.Name) || string.IsNullOrWhiteSpace(element.Type) || string.IsNullOrWhiteSpace(element.Role) ||
                element.AllowedOps.Intersect(element.LockedOps, StringComparer.Ordinal).Any())
                throw new ElectronEditorException(ElectronEditorErrorCodes.RegistryInvalid, "Registryelement ist ungültig oder doppelt.");
            var supported = new HashSet<string>(["move", "resize", "resizeWidth", "resizeHeight", "textMove", "textResize", "setVisibility"], StringComparer.Ordinal);
            if (element.AllowedOps.Any(operation => !supported.Contains(operation)) ||
                element.LockedOps.Any(operation => operation is not ("executeTargetAction" or "modifyDomainData" or "createRecord" or "deleteRecord")))
                throw new ElectronEditorException(ElectronEditorErrorCodes.RegistryInvalid, "Registry enthält unzulässige Operationen.");
        }
        var roots = scope.Elements.Where(element => element.Type == "root" && element.ParentId is null).ToArray();
        if (roots.Length != 1 || roots[0].Id != scope.ScopeId)
            throw new ElectronEditorException(ElectronEditorErrorCodes.RegistryInvalid, "Registry-Scope braucht einen eindeutigen Root.");
        foreach (var element in scope.Elements.Where(element => element.Type != "root"))
        {
            if (string.IsNullOrWhiteSpace(element.ParentId) || !byId.ContainsKey(element.ParentId))
                throw new ElectronEditorException(ElectronEditorErrorCodes.RegistryInvalid, $"Parent von '{element.Id}' fehlt.");
            if (element.Type == "field" && byId[element.ParentId].Type == "label")
                throw new ElectronEditorException(ElectronEditorErrorCodes.RegistryInvalid, "Label darf nicht Parent eines Feldes sein.");
            if (element.Type == "tableColumn" && (byId[element.ParentId].Type != "table" || string.IsNullOrWhiteSpace(element.ColumnRole)))
                throw new ElectronEditorException(ElectronEditorErrorCodes.RegistryInvalid, "Tabellenspalte braucht Tabelle und Spaltenrolle.");
        }
        foreach (var group in scope.Elements.Where(element => element.Type == "fieldGroup"))
        {
            var children = scope.Elements.Where(element => element.ParentId == group.Id).ToArray();
            if (!children.Any(element => element.Type == "label") || !children.Any(element => element.Type == "field"))
                throw new ElectronEditorException(ElectronEditorErrorCodes.RegistryInvalid, "fieldGroup braucht Label und Feld als Geschwister.");
        }
    }

    private static IReadOnlyList<T> RequiredArray<T>(JsonElement payload, string name)
    {
        if (!payload.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.Array)
            throw new ElectronEditorException(ElectronEditorErrorCodes.MessageInvalid, $"Antwortfeld '{name}' fehlt.");
        try { return value.Deserialize<T[]>(JsonOptions) ?? []; }
        catch (JsonException exception) { throw new ElectronEditorException(ElectronEditorErrorCodes.MessageInvalid, $"Antwortfeld '{name}' ist ungültig.", exception); }
    }

    private static string? Text(JsonElement payload, string name) =>
        payload.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    public async ValueTask DisposeAsync()
    {
        if (disposed) return;
        disposed = true;
        connection.EventReceived -= Connection_EventReceived;
        try { await connection.DisconnectAsync("editor_shutdown").ConfigureAwait(false); } catch { }
        await connection.DisposeAsync().ConfigureAwait(false);
    }

    internal sealed record RemoteRegistryScope(string ScopeId, IReadOnlyList<RemoteRegistrationEntry> Elements);
    internal sealed record RemoteRegistrationEntry(
        string Id, string Name, string Type, string Role, string? ParentId, int Order, bool Visible, bool Editable,
        IReadOnlyList<string> AllowedOps, IReadOnlyList<string> LockedOps, string? ColumnRole = null,
        string? FieldKind = null, string? ActionKind = null, string? ComponentKind = null);
    internal sealed record RemoteScopeLayoutState(string ScopeId, DateTimeOffset CapturedAt, IReadOnlyList<RemoteElementLayoutState> Elements);
    internal sealed record RemoteElementLayoutState(
        string ElementId, double X, double Y, double Width, double Height,
        double? TextOffsetX, double? TextOffsetY, double? FontSize, bool Visible);
    internal sealed record RemoteChangeResult(
        bool Success, string ChangeId, string ElementId, string Operation, string? ErrorCode, string Message,
        RemoteElementLayoutState? PreviousState, RemoteElementLayoutState? NewState, bool RollbackSucceeded);

    internal sealed class ElectronPipeHostAdapter : IAsyncHostAdapter
    {
        private readonly LocalTargetPipeConnection connection;
        private readonly IReadOnlyDictionary<string, RemoteRegistrationEntry> entries;
        private readonly UiElementRegistry registry;
        private readonly string scopeId;
        private readonly object stateLock = new();
        private LayoutState state;

        internal ElectronPipeHostAdapter(LocalTargetPipeConnection connection, RemoteRegistryScope scope, RemoteScopeLayoutState remoteState)
        {
            this.connection = connection;
            scopeId = scope.ScopeId;
            entries = scope.Elements.ToDictionary(item => item.Id, StringComparer.Ordinal);
            registry = new UiElementRegistry(scope.Elements.Select(item => new UiRegistryEntry(
                 item.Id, scope.ScopeId, item.ParentId, Kind(item.Type), item.Name, item.Order,
                 Capabilities(item), new Border { Name = SafeName(item.Id) }, item.Type, item.Role,
                 item.AllowedOps.ToArray(), item.LockedOps.ToArray(), item.ColumnRole, item.FieldKind,
                 item.ActionKind, item.ComponentKind)));
            state = ToLocal(remoteState);
        }

        public IUiElementRegistry GetRegistry() => registry;
        public LayoutState GetCurrentLayoutState() { lock (stateLock) return Clone(state); }
        public ChangeResult SubmitChangeRequest(ChangeRequest changeRequest) => ChangeResult.Rejected(
            changeRequest, "async_transport_required", "Electron-Ziel-App-Änderungen werden ausschließlich asynchron übertragen.");

        public async Task<ChangeResult> SubmitChangeRequestAsync(ChangeRequest changeRequest, CancellationToken cancellationToken = default)
        {
            if (!entries.TryGetValue(changeRequest.ElementId, out var entry))
                return Rejected(changeRequest, ElectronEditorErrorCodes.ElementNotFound, "Element ist nicht registriert.");
            if (entry.LockedOps.Contains(changeRequest.Operation, StringComparer.Ordinal))
                return Rejected(changeRequest, ElectronEditorErrorCodes.OperationLocked, "Operation ist gesperrt.");
            if (!entry.AllowedOps.Contains(changeRequest.Operation, StringComparer.Ordinal))
                return Rejected(changeRequest, ElectronEditorErrorCodes.OperationNotAllowed, "Operation ist nicht erlaubt.");
            try
            {
                var response = await connection.RequestAsync("submitChange", new { scopeId, changeRequest },
                    TimeSpan.FromSeconds(10), cancellationToken).ConfigureAwait(false);
                if (!response.TryGetProperty("changeResult", out var resultElement))
                    throw new ElectronEditorException(ElectronEditorErrorCodes.MessageInvalid, "ChangeResult fehlt.");
                var remote = resultElement.Deserialize<RemoteChangeResult>(JsonOptions)
                             ?? throw new ElectronEditorException(ElectronEditorErrorCodes.MessageInvalid, "ChangeResult ist ungültig.");
                var result = new ChangeResult(remote.Success, changeRequest.ChangeId, changeRequest.ElementId, changeRequest.Operation,
                    remote.ErrorCode, remote.Message, remote.PreviousState is null ? null : ToLocal(remote.PreviousState, registry.Entries[0].ScopeId),
                    remote.NewState is null ? null : ToLocal(remote.NewState, registry.Entries[0].ScopeId), remote.RollbackSucceeded);
                if (remote.Success && result.NewState is not null) UpdateState(result.NewState);
                return result;
            }
            catch (ElectronEditorException exception)
            {
                return Rejected(changeRequest, exception.Code, exception.Message);
            }
        }

        private void UpdateState(ElementLayoutState changed)
        {
            lock (stateLock)
                state = new LayoutState(state.ScopeId, DateTimeOffset.UtcNow,
                    state.Elements.Select(element => element.ElementId == changed.ElementId ? changed : element).ToArray());
        }

        private static LayoutState ToLocal(RemoteScopeLayoutState remote) => new(remote.ScopeId, remote.CapturedAt,
            remote.Elements.Select(element => ToLocal(element, remote.ScopeId)).ToArray());
        private static ElementLayoutState ToLocal(RemoteElementLayoutState state, string scopeId) => new(
            state.ElementId, scopeId, state.X, state.Y, state.Width, state.Height,
            state.TextOffsetX, state.TextOffsetY, state.FontSize, state.Visible);
        private static LayoutState Clone(LayoutState source) => new(source.ScopeId, source.CapturedAt, source.Elements.Select(item => item with { }).ToArray());

        private static UiElementKind Kind(string type) => type switch
        {
            "root" => UiElementKind.Scope, "area" => UiElementKind.Area, "group" => UiElementKind.Group,
            "fieldGroup" => UiElementKind.FieldGroup, "label" => UiElementKind.StaticText, "field" => UiElementKind.InputField,
            "button" => UiElementKind.Button, "table" => UiElementKind.Table, "tableColumn" => UiElementKind.TableColumn,
            "statusIndicator" => UiElementKind.StatusIndicator,
            _ => throw new ElectronEditorException(ElectronEditorErrorCodes.RegistryInvalid, $"Elementtyp '{type}' ist nicht erlaubt.")
        };

        private static UiCapability Capabilities(RemoteRegistrationEntry entry)
        {
            if (!entry.Editable) return UiCapability.None;
            var result = UiCapability.None;
            if (entry.AllowedOps.Contains("move", StringComparer.Ordinal)) result |= UiCapability.Position;
            if (entry.AllowedOps.Contains("resize", StringComparer.Ordinal) || entry.AllowedOps.Contains("resizeWidth", StringComparer.Ordinal)) result |= UiCapability.Width;
            if (entry.AllowedOps.Contains("resize", StringComparer.Ordinal) || entry.AllowedOps.Contains("resizeHeight", StringComparer.Ordinal)) result |= UiCapability.Height;
            if (entry.AllowedOps.Contains("textMove", StringComparer.Ordinal)) result |= UiCapability.TextPosition;
            if (entry.AllowedOps.Contains("textResize", StringComparer.Ordinal)) result |= UiCapability.FontSize;
            if (entry.AllowedOps.Contains("setVisibility", StringComparer.Ordinal)) result |= UiCapability.Visibility;
            return result;
        }

        private static string SafeName(string id)
        {
            var value = new string(id.Select(character => char.IsLetterOrDigit(character) ? character : '_').ToArray());
            return value.Length > 0 && (char.IsLetter(value[0]) || value[0] == '_') ? value : "_" + value;
        }

        private static ChangeResult Rejected(ChangeRequest request, string code, string message) => new(
            false, request.ChangeId, request.ElementId, request.Operation, code, message, null, null, true);
    }
}
