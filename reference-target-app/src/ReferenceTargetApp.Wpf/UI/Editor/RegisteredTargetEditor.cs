using System.Globalization;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using ReferenceTargetApp.EditorIntegration.HostAdapter;
using ReferenceTargetApp.EditorIntegration.Pdf;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.EditorIntegration.Process;
using ReferenceTargetApp.EditorIntegration.Registry;
using ReferenceTargetApp.Infrastructure.SampleData;
using ReferenceTargetApp.PdfPreview;
using ReferenceTargetApp.PdfRendering;

namespace ReferenceTargetApp.UI.Editor;

/// <summary>
/// Reuses the native M74-M77 editor for a locally registered M79 WPF target.
/// The target remains the only owner of native element references; this process
/// exchanges only registry, layout and validated layout-change DTOs over a local pipe.
/// </summary>
public sealed class RegisteredTargetEditorSession : IAsyncDisposable
{
    private readonly RegisteredTargetPipeHostAdapter adapter;
    private readonly EditorWindowCoordinator coordinator;
    private readonly CancellationTokenSource lifetime;
    private bool disposed;

    internal RegisteredTargetEditorSession(
        RegisteredTargetPipeHostAdapter adapter,
        EditorWindowCoordinator coordinator,
        CancellationTokenSource lifetime)
    {
        this.adapter = adapter;
        this.coordinator = coordinator;
        this.lifetime = lifetime;
    }

    public bool IsOpen => coordinator.HasOpenWindow;
    public string ScopeId => adapter.ScopeId;
    public IReadOnlyList<string> EditableElementIds => adapter.EditableElementIds;

    public void Activate() => coordinator.Window?.Activate();

    public async Task<RegisteredTargetEditorDiagnosticResult> ExerciseUiAndPdfAsync(
        string elementId,
        CancellationToken cancellationToken = default)
    {
        var viewModel = coordinator.ViewModel ?? throw new InvalidOperationException("Registrierter Editor ist nicht geöffnet.");
        await viewModel.SelectScopeAsync(adapter.ScopeId);
        await viewModel.SelectElementAsync(elementId);
        await viewModel.SetLayerForDiagnosticAsync("element");
        await viewModel.SetModeForDiagnosticAsync("width");
        var before = adapter.GetCurrentLayoutState().Elements.Single(item => item.ElementId == elementId);
        await viewModel.ApplyDirectionForDiagnosticAsync("right");
        var after = adapter.GetCurrentLayoutState().Elements.Single(item => item.ElementId == elementId);
        var saved = await viewModel.SaveForDiagnosticAsync();

        viewModel.ActiveWorkspaceIndex = 1;
        await viewModel.Pdf.RenderAsync();
        var pdfReady = viewModel.Pdf.Pages.Count >= 2 && viewModel.Pdf.SelectedPageImage is not null;
        viewModel.ActiveWorkspaceIndex = 0;
        return new(after.Width > before.Width, saved, pdfReady, before.Width, after.Width,
            viewModel.IsDirty, viewModel.Pdf.IsDirty, viewModel.ErrorCode, viewModel.ErrorMessage);
    }

    public async Task<bool> VerifyRestoredWidthAsync(string elementId, double expectedWidth)
    {
        var viewModel = coordinator.ViewModel ?? throw new InvalidOperationException("Registrierter Editor ist nicht geöffnet.");
        await viewModel.SelectScopeAsync(adapter.ScopeId);
        await viewModel.SelectElementAsync(elementId);
        var restored = adapter.GetCurrentLayoutState().Elements.Single(item => item.ElementId == elementId);
        return Math.Abs(restored.Width - expectedWidth) <= 0.000001 && !viewModel.IsDirty;
    }

    public async ValueTask DisposeAsync()
    {
        if (disposed) return;
        disposed = true;
        await coordinator.CloseAsync();
        lifetime.Cancel();
        adapter.Dispose();
        lifetime.Dispose();
    }
}

public sealed record RegisteredTargetEditorDiagnosticResult(
    bool UiChanged,
    bool UiSaved,
    bool PdfRendered,
    double WidthBefore,
    double WidthAfter,
    bool UiDirty,
    bool PdfDirty,
    string ErrorCode,
    string ErrorMessage);

public static class RegisteredTargetEditorLauncher
{
    public static async Task<RegisteredTargetEditorSession> OpenAsync(
        Window owner,
        string pipeName,
        string applicationId,
        string profileRoot,
        string editorRuntimeRoot,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(owner);
        ArgumentException.ThrowIfNullOrWhiteSpace(pipeName);
        ArgumentException.ThrowIfNullOrWhiteSpace(applicationId);
        EnsureEditorResources();
        var lifetime = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        var adapter = await RegisteredTargetPipeHostAdapter.ConnectAsync(pipeName, lifetime.Token);
        try
        {
            var adapters = new Dictionary<string, IHostAdapter>(StringComparer.Ordinal)
            {
                [adapter.ScopeId] = adapter
            };
            var profileStore = new AtomicJsonLayoutProfileStore(profileRoot, applicationId);
            var activeProfileStore = new ActiveLayoutProfileStore(profileRoot);
            var startup = await new LayoutProfileStartupCoordinator(adapters, profileStore, activeProfileStore)
                .RestoreAsync(lifetime.Token);
            if (!startup.Success)
                throw new InvalidOperationException(startup.Message);

            var pdfRegistry = PdfOrderDocumentRegistryFactory.Create();
            var pdfAdapter = new PdfHostAdapter(pdfRegistry);
            var pdfStore = new AtomicJsonPdfLayoutProfileStore(profileRoot);
            var pdfSession = new PdfLayoutSession(pdfAdapter, pdfStore);
            if (File.Exists(pdfStore.FilePath)) await pdfSession.LoadAsync(lifetime.Token);
            var selection = new TargetAppSelectionService([adapter.GetRegistry()]);
            var outputPath = Path.Combine(profileRoot, "pdf-output", "registered-target-preview.pdf");
            var coordinator = new EditorWindowCoordinator(owner, adapters, startup.Session, selection,
                pdfRegistry, pdfAdapter, pdfSession, new ReferenceOrderFactory().CreatePdfDiagnosticOrder(), outputPath,
                editorProcessOptions: EditorProcessOptions.FromRepositoryRoot(editorRuntimeRoot));
            await coordinator.OpenAsync();
            if (coordinator.ViewModel?.CurrentState is null)
            {
                await coordinator.DisposeAsync();
                throw new InvalidOperationException("Der vorhandene native Editor konnte die M79-Registry nicht aktivieren.");
            }
            return new RegisteredTargetEditorSession(adapter, coordinator, lifetime);
        }
        catch
        {
            adapter.Dispose();
            lifetime.Dispose();
            throw;
        }
    }

    private static void EnsureEditorResources()
    {
        if (Application.Current.Resources.Contains("WindowBackgroundBrush")) return;
        Application.Current.Resources.MergedDictionaries.Add(new ResourceDictionary
        {
            Source = new Uri("pack://application:,,,/ReferenceTargetApp;component/UI/Editor/EditorResources.xaml", UriKind.Absolute)
        });
    }
}

internal sealed class RegisteredTargetPipeHostAdapter : IHostAdapter, IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };
    private readonly NamedPipeClientStream pipe;
    private readonly StreamReader reader;
    private readonly StreamWriter writer;
    private readonly object ioLock = new();
    private readonly IReadOnlyDictionary<string, RemoteRegistrationEntry> entries;
    private readonly IUiElementRegistry registry;
    private bool disposed;

    private RegisteredTargetPipeHostAdapter(
        NamedPipeClientStream pipe,
        StreamReader reader,
        StreamWriter writer,
        IReadOnlyList<RemoteRegistrationEntry> remoteEntries)
    {
        this.pipe = pipe;
        this.reader = reader;
        this.writer = writer;
        entries = remoteEntries.ToDictionary(item => item.Id, StringComparer.Ordinal);
        var root = remoteEntries.SingleOrDefault(item => item.Type == "root" && item.ParentId is null)
                   ?? throw new InvalidDataException("M79-Registry besitzt keinen eindeutigen Root-Scope.");
        ScopeId = root.Id;
        registry = new UiElementRegistry(remoteEntries.Select(item => new UiRegistryEntry(
            item.Id,
            ScopeId,
            item.Id == ScopeId ? null : item.ParentId,
            Kind(item),
            item.Name,
            item.Order,
            Capabilities(item),
            new Border { Name = SafeWpfName(item.Id) })));
    }

    internal string ScopeId { get; }
    internal IReadOnlyList<string> EditableElementIds => entries.Values
        .Where(item => item.Editable && Capabilities(item) != UiCapability.None)
        .OrderBy(item => item.Order).Select(item => item.Id).ToArray();

    internal static async Task<RegisteredTargetPipeHostAdapter> ConnectAsync(string pipeName, CancellationToken cancellationToken)
    {
        var pipe = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(15));
            await pipe.ConnectAsync(timeout.Token);
            var reader = new StreamReader(pipe, new UTF8Encoding(false), false, 4096, true);
            var writer = new StreamWriter(pipe, new UTF8Encoding(false), 4096, true) { AutoFlush = true };
            var temporary = new PipeExchange(reader, writer);
            var payload = temporary.Send("getRegistry", null, null);
            var entries = payload.Deserialize<RemoteRegistrationEntry[]>(JsonOptions)
                          ?? throw new InvalidDataException("M79-Registryantwort fehlt.");
            return new(pipe, reader, writer, entries);
        }
        catch
        {
            pipe.Dispose();
            throw;
        }
    }

    public IUiElementRegistry GetRegistry() => registry;

    public LayoutState GetCurrentLayoutState()
    {
        var remote = Send("getLayout", null, null).Deserialize<RemoteLayoutState>(JsonOptions)
                     ?? throw new InvalidDataException("M79-Layoutantwort fehlt.");
        return new LayoutState(ScopeId, remote.CapturedAt,
            remote.Elements.Select(ToLocal).ToArray());
    }

    public ChangeResult SubmitChangeRequest(ChangeRequest changeRequest)
    {
        ArgumentNullException.ThrowIfNull(changeRequest);
        try
        {
            if (!entries.TryGetValue(changeRequest.ElementId, out var entry))
                return Rejected(changeRequest, "unknown_element", "Element ist nicht registriert.");
            var operation = changeRequest.Operation;
            if (operation == HostAdapterOperations.ResizeWidth && entry.AllowedOps.Contains("changeWidth", StringComparer.Ordinal))
                operation = "changeWidth";
            var payload = FlattenPayload(changeRequest.Payload);
            var request = new RemoteChangeRequest(changeRequest.ChangeId, changeRequest.ElementId, operation, payload);
            var remote = Send("submitChange", null, request).Deserialize<RemoteChangeResult>(JsonOptions)
                         ?? throw new InvalidDataException("M79-ChangeResult fehlt.");
            return new(remote.Success, changeRequest.ChangeId, changeRequest.ElementId, changeRequest.Operation,
                remote.ErrorCode, remote.Message,
                remote.PreviousState is null ? null : ToLocal(remote.PreviousState),
                remote.NewState is null ? null : ToLocal(remote.NewState), remote.RollbackSucceeded);
        }
        catch (Exception exception) when (exception is IOException or InvalidDataException or JsonException or InvalidOperationException)
        {
            return Rejected(changeRequest, "target_rejected_change", exception.Message);
        }
    }

    private JsonElement Send(string type, string? elementId, object? payload)
    {
        lock (ioLock)
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            return new PipeExchange(reader, writer).Send(type, elementId, payload);
        }
    }

    public void Dispose()
    {
        if (disposed) return;
        disposed = true;
        try { writer.Dispose(); } catch { }
        try { reader.Dispose(); } catch { }
        pipe.Dispose();
    }

    private static UiElementKind Kind(RemoteRegistrationEntry entry) => entry.Type switch
    {
        "root" => UiElementKind.Scope,
        "field" => UiElementKind.InputField,
        "label" => UiElementKind.StaticText,
        "statusIndicator" => UiElementKind.StatusIndicator,
        "button" => UiElementKind.Button,
        _ => UiElementKind.Group
    };

    private static UiCapability Capabilities(RemoteRegistrationEntry entry)
    {
        if (!entry.Editable) return UiCapability.None;
        var result = UiCapability.None;
        if (entry.AllowedOps.Contains("move", StringComparer.Ordinal)) result |= UiCapability.Position;
        if (entry.AllowedOps.Contains("resize", StringComparer.Ordinal) || entry.AllowedOps.Contains("resizeWidth", StringComparer.Ordinal) ||
            entry.AllowedOps.Contains("changeWidth", StringComparer.Ordinal)) result |= UiCapability.Width;
        if (entry.AllowedOps.Contains("resize", StringComparer.Ordinal) || entry.AllowedOps.Contains("resizeHeight", StringComparer.Ordinal))
            result |= UiCapability.Height;
        if (entry.AllowedOps.Contains("textMove", StringComparer.Ordinal)) result |= UiCapability.TextPosition;
        if (entry.AllowedOps.Contains("textResize", StringComparer.Ordinal)) result |= UiCapability.FontSize;
        return result;
    }

    private static IReadOnlyDictionary<string, double> FlattenPayload(IReadOnlyDictionary<string, object?>? payload)
    {
        var result = new Dictionary<string, double>(StringComparer.Ordinal);
        if (payload is null) return result;
        foreach (var pair in payload)
        {
            if (TryNumber(pair.Value, out var number)) result[pair.Key] = number;
            else if (pair.Value is IReadOnlyDictionary<string, object?> nested)
                foreach (var child in nested)
                    if (TryNumber(child.Value, out number)) result[child.Key] = number;
        }
        return result;
    }

    private static bool TryNumber(object? value, out double result)
    {
        if (value is JsonElement json && json.ValueKind == JsonValueKind.Number) return json.TryGetDouble(out result);
        if (value is IConvertible and not string and not bool)
        {
            try { result = Convert.ToDouble(value, CultureInfo.InvariantCulture); return double.IsFinite(result); }
            catch (Exception exception) when (exception is FormatException or InvalidCastException or OverflowException) { }
        }
        result = 0;
        return false;
    }

    private ElementLayoutState ToLocal(RemoteElementLayoutState state) => new(
        state.ElementId, ScopeId, state.X, state.Y, state.Width, state.Height,
        state.TextOffsetX, state.TextOffsetY, state.FontSize);

    private static string SafeWpfName(string id)
    {
        var characters = id.Select(character => char.IsLetterOrDigit(character) ? character : '_').ToArray();
        var value = new string(characters);
        return value.Length > 0 && (char.IsLetter(value[0]) || value[0] == '_') ? value : "_" + value;
    }

    private static ChangeResult Rejected(ChangeRequest request, string code, string message) => new(
        false, request.ChangeId, request.ElementId, request.Operation, code, message, null, null, true);

    private sealed class PipeExchange(StreamReader reader, StreamWriter writer)
    {
        public JsonElement Send(string type, string? elementId, object? payload)
        {
            var id = Guid.NewGuid().ToString("N");
            writer.WriteLine(JsonSerializer.Serialize(new PipeRequest(id, type, elementId, payload), JsonOptions));
            var line = reader.ReadLine() ?? throw new IOException("M79-Ziel-App hat die lokale Pipe geschlossen.");
            var response = JsonSerializer.Deserialize<PipeResponse>(line, JsonOptions)
                           ?? throw new InvalidDataException("M79-Pipeantwort ist ungültig.");
            if (response.Id != id) throw new InvalidDataException("M79-Pipeantwort besitzt eine falsche Korrelations-ID.");
            if (!response.Success) throw new InvalidOperationException(response.Error ?? "M79-Ziel-App hat die Anfrage abgelehnt.");
            return response.Payload;
        }
    }

    private sealed record PipeRequest(string Id, string Type, string? ElementId, object? Payload);
    private sealed record PipeResponse(string Id, bool Success, string? Error, JsonElement Payload);
    private sealed record RemoteRegistrationEntry(string Id, string Name, string Type, string Role, string? ParentId, int Order,
        bool Editable, IReadOnlyList<string> AllowedOps, IReadOnlyList<string> LockedOps, string? DeclaredName);
    private sealed record RemoteLayoutState(DateTimeOffset CapturedAt, IReadOnlyList<RemoteElementLayoutState> Elements);
    private sealed record RemoteElementLayoutState(string ElementId, double X, double Y, double Width, double Height,
        double? TextOffsetX, double? TextOffsetY, double? FontSize);
    private sealed record RemoteChangeRequest(string ChangeId, string ElementId, string Operation, IReadOnlyDictionary<string, double> Payload);
    private sealed record RemoteChangeResult(bool Success, string ChangeId, string ElementId, string Operation, string? ErrorCode,
        string Message, RemoteElementLayoutState? PreviousState, RemoteElementLayoutState? NewState, bool RollbackSucceeded);
}
