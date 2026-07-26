using System.Buffers.Binary;
using System.Collections.Concurrent;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;

namespace ReferenceTargetApp.EditorIntegration.Electron;

public static class LocalTargetProtocol
{
    public const string Name = "ui-editor-kit.local-target";
    public const string Version = "2.0";
    public const int MaximumMessageBytes = 1024 * 1024;
}

internal sealed record LocalTargetEnvelope(
    string ProtocolName,
    string ProtocolVersion,
    string MessageId,
    string MessageType,
    string SessionNonce,
    JsonElement Payload,
    string? ReplyTo = null);

public sealed record LocalTargetRequest(string Action, JsonElement Payload);

public sealed class LocalTargetPipeConnection : IAsyncDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly NamedPipeServerStream pipe;
    private readonly string nonce;
    private readonly SemaphoreSlim writeLock = new(1, 1);
    private readonly ConcurrentDictionary<string, PendingRequest> pending = new(StringComparer.Ordinal);
    private readonly HashSet<string> seenMessageIds = new(StringComparer.Ordinal);
    private readonly object seenLock = new();
    private readonly CancellationTokenSource lifetime = new();
    private Task? readLoop;
    private bool disposed;

    private LocalTargetPipeConnection(NamedPipeServerStream pipe, string nonce)
    {
        this.pipe = pipe;
        this.nonce = nonce;
    }

    public event EventHandler<LocalTargetRequest>? EventReceived;
    public event EventHandler<string>? Disconnected;
    public Func<LocalTargetRequest, CancellationToken, Task<object?>>? RequestHandler { get; set; }
    public bool IsConnected => pipe.IsConnected && !disposed;

    public static async Task<(LocalTargetPipeConnection Connection, JsonElement Handshake)> ListenAsync(
        string pipeName,
        string nonce,
        TimeSpan timeout,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(pipeName) || !pipeName.StartsWith("ui-editor-kit-m80-", StringComparison.Ordinal) ||
            pipeName.Any(character => !char.IsLetterOrDigit(character) && character != '-'))
            throw new ElectronEditorException(ElectronEditorErrorCodes.MessageInvalid, "Pipe-Name ist ungültig.");
        if (string.IsNullOrWhiteSpace(nonce) || nonce.Length < 32)
            throw new ElectronEditorException(ElectronEditorErrorCodes.SessionInvalid, "Sitzungs-Nonce ist ungültig.");

        var pipe = new NamedPipeServerStream(pipeName, PipeDirection.InOut, 1, PipeTransmissionMode.Byte,
            PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly, 0, 0);
        try
        {
            using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutSource.CancelAfter(timeout);
            await pipe.WaitForConnectionAsync(timeoutSource.Token).ConfigureAwait(false);
            var connection = new LocalTargetPipeConnection(pipe, nonce);
            var handshake = await connection.ReadEnvelopeAsync(timeoutSource.Token).ConfigureAwait(false);
            connection.ValidateEnvelope(handshake);
            if (handshake.MessageType != "handshake" || !TryAction(handshake.Payload, out var action) || action != "handshake")
                throw new ElectronEditorException(ElectronEditorErrorCodes.HandshakeFailed, "Erste Pipe-Nachricht ist kein Handshake.");
            await connection.WriteEnvelopeAsync(connection.Envelope("handshakeAccepted",
                new { action = "handshakeAccepted", protocolVersion = LocalTargetProtocol.Version }, handshake.MessageId), timeoutSource.Token).ConfigureAwait(false);
            connection.readLoop = connection.ReadLoopAsync(connection.lifetime.Token);
            return (connection, handshake.Payload.Clone());
        }
        catch (OperationCanceledException exception)
        {
            pipe.Dispose();
            throw new ElectronEditorException(ElectronEditorErrorCodes.PipeTimeout, "Zeitüberschreitung beim lokalen Handshake.", exception);
        }
        catch
        {
            pipe.Dispose();
            throw;
        }
    }

    public async Task<JsonElement> RequestAsync(
        string action,
        object? payload = null,
        TimeSpan? timeout = null,
        CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(disposed, this);
        var message = Envelope("request", MergeAction(action, payload));
        var completion = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        var request = new PendingRequest(action, completion);
        if (!pending.TryAdd(message.MessageId, request))
            throw new ElectronEditorException(ElectronEditorErrorCodes.MessageInvalid, "Doppelte Korrelations-ID.");
        try
        {
            await WriteEnvelopeAsync(message, cancellationToken).ConfigureAwait(false);
            using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, lifetime.Token);
            timeoutSource.CancelAfter(timeout ?? TimeSpan.FromSeconds(10));
            return await completion.Task.WaitAsync(timeoutSource.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException exception)
        {
            throw new ElectronEditorException(ElectronEditorErrorCodes.PipeTimeout, $"Zeitüberschreitung bei {action}.", exception);
        }
        finally { pending.TryRemove(message.MessageId, out _); }
    }

    public Task SendEventAsync(string action, object? payload = null, CancellationToken cancellationToken = default) =>
        WriteEnvelopeAsync(Envelope("event", MergeAction(action, payload)), cancellationToken);

    public async Task DisconnectAsync(string reason, CancellationToken cancellationToken = default)
    {
        if (disposed || !pipe.IsConnected) return;
        await WriteEnvelopeAsync(Envelope("disconnect", new { reason }), cancellationToken).ConfigureAwait(false);
    }

    private async Task ReadLoopAsync(CancellationToken cancellationToken)
    {
        var reason = "target_disconnected";
        try
        {
            while (!cancellationToken.IsCancellationRequested && pipe.IsConnected)
            {
                var envelope = await ReadEnvelopeAsync(cancellationToken).ConfigureAwait(false);
                ValidateEnvelope(envelope);
                if (!MarkSeen(envelope.MessageId)) continue;
                if (!string.IsNullOrWhiteSpace(envelope.ReplyTo) && pending.TryGetValue(envelope.ReplyTo, out var pendingRequest))
                {
                    if (envelope.MessageType == "error")
                    {
                        var code = Text(envelope.Payload, "code") ?? ElectronEditorErrorCodes.MessageInvalid;
                        pendingRequest.Completion.TrySetException(new ElectronEditorException(code, Text(envelope.Payload, "message") ?? "Lokale Ziel-App hat abgelehnt."));
                    }
                    else if (!TryAction(envelope.Payload, out var responseAction) ||
                             responseAction != pendingRequest.Action + "Accepted")
                        pendingRequest.Completion.TrySetException(new ElectronEditorException(
                            ElectronEditorErrorCodes.MessageInvalid, "Korrelierte Antwort enthält eine unerwartete Aktion."));
                    else pendingRequest.Completion.TrySetResult(envelope.Payload.Clone());
                    continue;
                }
                if (envelope.MessageType == "heartbeat")
                {
                    await WriteEnvelopeAsync(Envelope("heartbeatAck", new { action = "heartbeatAck" }, envelope.MessageId), cancellationToken).ConfigureAwait(false);
                    continue;
                }
                if (envelope.MessageType == "disconnect")
                {
                    reason = Text(envelope.Payload, "reason") ?? reason;
                    break;
                }
                if (!TryAction(envelope.Payload, out var action))
                    throw new ElectronEditorException(ElectronEditorErrorCodes.MessageInvalid, "Nachrichtenaktion fehlt.");
                var request = new LocalTargetRequest(action, envelope.Payload.Clone());
                if (envelope.MessageType == "event") EventReceived?.Invoke(this, request);
                else if (envelope.MessageType == "request")
                {
                    try
                    {
                        var result = RequestHandler is null ? null : await RequestHandler(request, cancellationToken).ConfigureAwait(false);
                        await WriteEnvelopeAsync(Envelope("response", MergeAction(action + "Accepted", result), envelope.MessageId), cancellationToken).ConfigureAwait(false);
                    }
                    catch (ElectronEditorException exception)
                    {
                        await WriteEnvelopeAsync(Envelope("error", new { code = exception.Code, message = exception.Message }, envelope.MessageId), cancellationToken).ConfigureAwait(false);
                    }
                }
            }
        }
        catch (Exception exception) when (exception is IOException or JsonException or ElectronEditorException or OperationCanceledException)
        {
            reason = exception is ElectronEditorException electron ? electron.Code : "target_disconnected";
        }
        finally
        {
            foreach (var request in pending.Values)
                request.Completion.TrySetException(new ElectronEditorException(ElectronEditorErrorCodes.HandshakeFailed, "Lokale Ziel-App-Verbindung wurde beendet."));
            Disconnected?.Invoke(this, reason);
        }
    }

    private LocalTargetEnvelope Envelope(string messageType, object payload, string? replyTo = null) => new(
        LocalTargetProtocol.Name, LocalTargetProtocol.Version, Guid.NewGuid().ToString("N"), messageType, nonce,
        JsonSerializer.SerializeToElement(payload, JsonOptions), replyTo);

    private async Task<LocalTargetEnvelope> ReadEnvelopeAsync(CancellationToken cancellationToken)
    {
        var header = new byte[4];
        await ReadExactlyAsync(header, cancellationToken).ConfigureAwait(false);
        var length = BinaryPrimitives.ReadInt32LittleEndian(header);
        if (length <= 0 || length > LocalTargetProtocol.MaximumMessageBytes)
            throw new ElectronEditorException(ElectronEditorErrorCodes.MessageTooLarge, "Lokale Nachrichtengröße ist ungültig.");
        var body = new byte[length];
        await ReadExactlyAsync(body, cancellationToken).ConfigureAwait(false);
        try
        {
            return JsonSerializer.Deserialize<LocalTargetEnvelope>(body, JsonOptions)
                   ?? throw new ElectronEditorException(ElectronEditorErrorCodes.MessageInvalid, "Lokale Nachricht fehlt.");
        }
        catch (JsonException exception)
        {
            throw new ElectronEditorException(ElectronEditorErrorCodes.MessageInvalid, "Lokale Nachricht ist ungültig.", exception);
        }
    }

    private async Task ReadExactlyAsync(byte[] buffer, CancellationToken cancellationToken)
    {
        var offset = 0;
        while (offset < buffer.Length)
        {
            var read = await pipe.ReadAsync(buffer.AsMemory(offset), cancellationToken).ConfigureAwait(false);
            if (read == 0) throw new IOException("Lokale Pipe wurde geschlossen.");
            offset += read;
        }
    }

    private async Task WriteEnvelopeAsync(LocalTargetEnvelope envelope, CancellationToken cancellationToken)
    {
        var body = JsonSerializer.SerializeToUtf8Bytes(envelope, JsonOptions);
        if (body.Length > LocalTargetProtocol.MaximumMessageBytes)
            throw new ElectronEditorException(ElectronEditorErrorCodes.MessageTooLarge, "Lokale Nachricht ist zu groß.");
        var header = new byte[4];
        BinaryPrimitives.WriteInt32LittleEndian(header, body.Length);
        await writeLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await pipe.WriteAsync(header, cancellationToken).ConfigureAwait(false);
            await pipe.WriteAsync(body, cancellationToken).ConfigureAwait(false);
            await pipe.FlushAsync(cancellationToken).ConfigureAwait(false);
        }
        finally { writeLock.Release(); }
    }

    private void ValidateEnvelope(LocalTargetEnvelope envelope)
    {
        if (envelope.ProtocolName != LocalTargetProtocol.Name || envelope.ProtocolVersion != LocalTargetProtocol.Version)
            throw new ElectronEditorException(ElectronEditorErrorCodes.ProtocolUnsupported, "Lokale Protokollversion wird nicht unterstützt.");
        if (envelope.SessionNonce != nonce)
            throw new ElectronEditorException(ElectronEditorErrorCodes.SessionInvalid, "Sitzungs-Nonce passt nicht.");
        if (string.IsNullOrWhiteSpace(envelope.MessageId) || envelope.Payload.ValueKind != JsonValueKind.Object)
            throw new ElectronEditorException(ElectronEditorErrorCodes.MessageInvalid, "Lokale Nachricht ist unvollständig.");
    }

    private bool MarkSeen(string messageId)
    {
        lock (seenLock)
        {
            if (!seenMessageIds.Add(messageId)) return false;
            if (seenMessageIds.Count > 2048) seenMessageIds.Remove(seenMessageIds.First());
            return true;
        }
    }

    private static object MergeAction(string action, object? payload)
    {
        var values = new Dictionary<string, object?> { ["action"] = action };
        if (payload is JsonElement json && json.ValueKind == JsonValueKind.Object)
            foreach (var property in json.EnumerateObject()) values[property.Name] = property.Value.Clone();
        else if (payload is not null)
        {
            var serialized = JsonSerializer.SerializeToElement(payload, JsonOptions);
            if (serialized.ValueKind == JsonValueKind.Object)
                foreach (var property in serialized.EnumerateObject()) values[property.Name] = property.Value.Clone();
            else values["value"] = payload;
        }
        return values;
    }

    private static bool TryAction(JsonElement payload, out string action)
    {
        action = string.Empty;
        if (!payload.TryGetProperty("action", out var value) || value.ValueKind != JsonValueKind.String) return false;
        action = value.GetString() ?? string.Empty;
        return action.Length > 0;
    }

    private static string? Text(JsonElement payload, string name) =>
        payload.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    public async ValueTask DisposeAsync()
    {
        if (disposed) return;
        disposed = true;
        lifetime.Cancel();
        try { if (readLoop is not null) await readLoop.ConfigureAwait(false); } catch { }
        pipe.Dispose();
        writeLock.Dispose();
        lifetime.Dispose();
    }

    private sealed record PendingRequest(string Action, TaskCompletionSource<JsonElement> Completion);
}
