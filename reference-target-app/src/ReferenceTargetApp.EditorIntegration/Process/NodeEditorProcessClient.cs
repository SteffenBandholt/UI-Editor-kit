using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text;
using ReferenceTargetApp.EditorIntegration.Protocol;
using DiagnosticsProcess = System.Diagnostics.Process;

namespace ReferenceTargetApp.EditorIntegration.Process;

public sealed class NodeEditorProcessClient : IAsyncDisposable
{
    private const int MaximumDiagnostics = 100;
    private const int MaximumDiagnosticLength = 512;
    private readonly EditorProcessOptions options;
    private readonly ConcurrentDictionary<string, PendingResponse> pendingResponses = new(StringComparer.Ordinal);
    private readonly SemaphoreSlim writeLock = new(1, 1);
    private readonly object diagnosticsLock = new();
    private readonly List<EditorProcessDiagnostic> diagnostics = [];
    private DiagnosticsProcess? process;
    private CancellationTokenSource? lifetimeCancellation;
    private Task? standardOutputTask;
    private Task? standardErrorTask;
    private Task? processMonitorTask;
    private bool stopping;
    private bool disposed;

    public NodeEditorProcessClient(EditorProcessOptions options) =>
        this.options = options ?? throw new ArgumentNullException(nameof(options));

    public int? ProcessId => process is { HasExited: false } ? process.Id : null;
    public bool IsRunning => process is { HasExited: false };
    public bool ExitedUnexpectedly { get; private set; }
    public event EventHandler? UnexpectedlyExited;

    public IReadOnlyList<EditorProcessDiagnostic> GetDiagnostics()
    {
        lock (diagnosticsLock) return diagnostics.ToArray();
    }

    public async Task StartAsync(CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(disposed, this);
        if (IsRunning) throw new EditorProcessException("process_already_running", "Editor-Prozess läuft bereits.");
        ValidateOptions();

        var startInfo = new ProcessStartInfo
        {
            FileName = options.NodeExecutable,
            WorkingDirectory = options.WorkingDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardInputEncoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false),
            StandardOutputEncoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false),
            StandardErrorEncoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false)
        };
        startInfo.ArgumentList.Add(options.ScriptPath);

        process = new DiagnosticsProcess { StartInfo = startInfo };
        try
        {
            if (!process.Start()) throw new EditorProcessException("process_start_failed", "Node-Prozess konnte nicht gestartet werden.");
        }
        catch (Exception exception) when (exception is not EditorProcessException)
        {
            process.Dispose();
            process = null;
            throw new EditorProcessException("process_start_failed", $"Node-Prozess konnte nicht gestartet werden: {exception.Message}", exception);
        }

        stopping = false;
        ExitedUnexpectedly = false;
        lifetimeCancellation = new CancellationTokenSource();
        standardOutputTask = ReadStandardOutputAsync(process, lifetimeCancellation.Token);
        standardErrorTask = ReadStandardErrorAsync(process, lifetimeCancellation.Token);
        processMonitorTask = MonitorProcessAsync(process, lifetimeCancellation.Token);
        await WaitForStartedProcessAsync(process, cancellationToken).ConfigureAwait(false);
    }

    public async Task<EditorProtocolMessage> SendRequestAsync(
        string messageType,
        object payload,
        string expectedResponseType,
        TimeSpan timeout,
        string? sessionId = null,
        CancellationToken cancellationToken = default)
    {
        if (!IsRunning || process is null) throw new EditorProcessException("process_not_running", "Editor-Prozess läuft nicht.");
        var request = EditorProtocolJson.Create(messageType, payload, sessionId);
        var completion = new TaskCompletionSource<EditorProtocolMessage>(TaskCreationOptions.RunContinuationsAsynchronously);
        var pending = new PendingResponse(expectedResponseType, sessionId, completion);
        if (!pendingResponses.TryAdd(request.MessageId, pending))
            throw new EditorProcessException("duplicate_message_id", "Doppelte ausgehende messageId.");

        try
        {
            await WriteLineAsync(EditorProtocolJson.Serialize(request), cancellationToken).ConfigureAwait(false);
            try
            {
                return await completion.Task.WaitAsync(timeout, cancellationToken).ConfigureAwait(false);
            }
            catch (TimeoutException exception)
            {
                throw new EditorProcessException("timeout", $"Timeout auf Antwort '{expectedResponseType}'.", exception);
            }
        }
        finally
        {
            pendingResponses.TryRemove(request.MessageId, out _);
        }
    }

    public async Task StopAsync(CancellationToken cancellationToken = default)
    {
        if (process is null) return;
        stopping = true;
        if (!process.HasExited)
        {
            try
            {
                await SendRequestAsync(
                    EditorMessageTypes.Shutdown,
                    new { },
                    EditorMessageTypes.ShutdownComplete,
                    options.Timeouts.Shutdown,
                    cancellationToken: cancellationToken).ConfigureAwait(false);
            }
            catch (Exception exception) when (exception is EditorProcessException or OperationCanceledException)
            {
                AddDiagnostic("host", "shutdown_failed", exception.Message);
            }

            if (!process.HasExited)
            {
                try
                {
                    await process.WaitForExitAsync(cancellationToken).WaitAsync(options.Timeouts.Shutdown, cancellationToken).ConfigureAwait(false);
                }
                catch (Exception exception) when (exception is TimeoutException or OperationCanceledException)
                {
                    AddDiagnostic("host", "shutdown_timeout", "Editor-Prozess wurde nach Shutdown-Timeout beendet.");
                    if (!process.HasExited) process.Kill(entireProcessTree: true);
                    await process.WaitForExitAsync(CancellationToken.None).ConfigureAwait(false);
                }
            }
        }

        await CleanupAsync().ConfigureAwait(false);
    }

    public async ValueTask DisposeAsync()
    {
        if (disposed) return;
        disposed = true;
        await StopAsync(CancellationToken.None).ConfigureAwait(false);
        writeLock.Dispose();
    }

    private void ValidateOptions()
    {
        if (string.IsNullOrWhiteSpace(options.NodeExecutable))
            throw new EditorProcessException("node_not_found", "Node-Executable ist nicht konfiguriert.");
        if (!Path.IsPathFullyQualified(options.ScriptPath) || !File.Exists(options.ScriptPath))
            throw new EditorProcessException("script_not_found", "Editor-Prozess-Script fehlt.");
        if (!Path.IsPathFullyQualified(options.WorkingDirectory) || !Directory.Exists(options.WorkingDirectory))
            throw new EditorProcessException("working_directory_not_found", "Arbeitsverzeichnis des Editor-Prozesses fehlt.");
    }

    private async Task WaitForStartedProcessAsync(DiagnosticsProcess startedProcess, CancellationToken cancellationToken)
    {
        var deadline = DateTimeOffset.UtcNow + options.Timeouts.ProcessStart;
        while (DateTimeOffset.UtcNow < deadline)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (startedProcess.HasExited)
                throw new EditorProcessException("process_exited", $"Editor-Prozess endete beim Start mit Code {startedProcess.ExitCode}.");
            if (startedProcess.Id > 0) return;
            await Task.Delay(10, cancellationToken).ConfigureAwait(false);
        }
        throw new EditorProcessException("process_start_timeout", "Timeout beim Start des Editor-Prozesses.");
    }

    private async Task WriteLineAsync(string line, CancellationToken cancellationToken)
    {
        await writeLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (process is null || process.HasExited) throw new EditorProcessException("process_not_running", "Editor-Prozess läuft nicht.");
            await process.StandardInput.WriteLineAsync(line.AsMemory(), cancellationToken).ConfigureAwait(false);
            await process.StandardInput.FlushAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is IOException or InvalidOperationException or ObjectDisposedException)
        {
            throw new EditorProcessException("process_write_failed", $"Nachricht konnte nicht an Node gesendet werden: {exception.Message}", exception);
        }
        finally
        {
            writeLock.Release();
        }
    }

    private async Task ReadStandardOutputAsync(DiagnosticsProcess source, CancellationToken cancellationToken)
    {
        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                var line = await source.StandardOutput.ReadLineAsync(cancellationToken).ConfigureAwait(false);
                if (line is null) break;
                HandleStandardOutputLine(line);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
        catch (Exception exception) when (exception is IOException or ObjectDisposedException)
        {
            AddDiagnostic("stdout", "read_failed", exception.Message);
        }
    }

    private void HandleStandardOutputLine(string line)
    {
        if (!EditorProtocolJson.TryDeserialize(line, out var message) || message is null)
        {
            AddDiagnostic("stdout", "invalid_json", "Ungültige JSON-Zeile vom Editor-Prozess wurde verworfen.");
            return;
        }
        if (!string.Equals(message.ProtocolVersion, EditorProtocol.Version, StringComparison.Ordinal))
        {
            AddDiagnostic("stdout", "incompatible_protocol_version", $"Antwort verwendet Protokollversion {message.ProtocolVersion}.");
            if (!string.IsNullOrWhiteSpace(message.ReplyTo) && pendingResponses.TryRemove(message.ReplyTo, out var incompatiblePending))
                incompatiblePending.Completion.TrySetException(new EditorProcessException(
                    "incompatible_protocol_version",
                    $"Antwort verwendet Protokollversion {message.ProtocolVersion} statt {EditorProtocol.Version}."));
            return;
        }
        if (string.IsNullOrWhiteSpace(message.ReplyTo))
        {
            AddDiagnostic("stdout", "uncorrelated_message", $"Nicht zugeordnete Nachricht '{message.MessageType}' wurde verworfen.");
            return;
        }
        if (!pendingResponses.TryRemove(message.ReplyTo, out var pending))
        {
            AddDiagnostic("stdout", "duplicate_or_unknown_reply", "Doppelte oder unbekannte Antwort wurde verworfen.");
            return;
        }
        if (message.MessageType == EditorMessageTypes.Error)
        {
            pending.Completion.TrySetException(CreateRemoteError(message));
            return;
        }
        if (!string.Equals(message.MessageType, pending.ExpectedMessageType, StringComparison.Ordinal))
        {
            pending.Completion.TrySetException(new EditorProcessException(
                "unexpected_message_type",
                $"Antworttyp '{message.MessageType}' statt '{pending.ExpectedMessageType}'."));
            return;
        }
        if (pending.SessionId is not null && !string.Equals(message.SessionId, pending.SessionId, StringComparison.Ordinal))
        {
            pending.Completion.TrySetException(new EditorProcessException("wrong_session", "Antwort besitzt eine falsche sessionId."));
            return;
        }
        pending.Completion.TrySetResult(message);
    }

    private static EditorProcessException CreateRemoteError(EditorProtocolMessage message)
    {
        var code = message.Payload.TryGetProperty("code", out var codeValue) ? codeValue.GetString() : null;
        var text = message.Payload.TryGetProperty("message", out var messageValue) ? messageValue.GetString() : null;
        var details = message.Payload.TryGetProperty("errors", out var errorsValue) ? $" {errorsValue.GetRawText()}" : string.Empty;
        return new EditorProcessException(code ?? "remote_error", $"{text ?? "Editor-Prozess meldete einen Fehler."}{details}");
    }

    private async Task ReadStandardErrorAsync(DiagnosticsProcess source, CancellationToken cancellationToken)
    {
        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                var line = await source.StandardError.ReadLineAsync(cancellationToken).ConfigureAwait(false);
                if (line is null) break;
                AddDiagnostic("stderr", "node_stderr", line);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
        catch (Exception exception) when (exception is IOException or ObjectDisposedException)
        {
            AddDiagnostic("stderr", "read_failed", exception.Message);
        }
    }

    private async Task MonitorProcessAsync(DiagnosticsProcess monitoredProcess, CancellationToken cancellationToken)
    {
        try
        {
            await monitoredProcess.WaitForExitAsync(cancellationToken).ConfigureAwait(false);
            if (!stopping)
            {
                ExitedUnexpectedly = true;
                AddDiagnostic("process", "unexpected_exit", $"Editor-Prozess endete unerwartet mit Code {monitoredProcess.ExitCode}.");
                FailPending(new EditorProcessException("process_exited", "Editor-Prozess endete unerwartet."));
                UnexpectedlyExited?.Invoke(this, EventArgs.Empty);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
    }

    private void FailPending(Exception exception)
    {
        foreach (var pair in pendingResponses.ToArray())
            if (pendingResponses.TryRemove(pair.Key, out var pending)) pending.Completion.TrySetException(exception);
    }

    private void AddDiagnostic(string source, string code, string message)
    {
        var safeMessage = message.Length <= MaximumDiagnosticLength ? message : message[..MaximumDiagnosticLength];
        lock (diagnosticsLock)
        {
            if (diagnostics.Count == MaximumDiagnostics) diagnostics.RemoveAt(0);
            diagnostics.Add(new EditorProcessDiagnostic(DateTimeOffset.UtcNow, source, code, safeMessage));
        }
    }

    private async Task CleanupAsync()
    {
        lifetimeCancellation?.Cancel();
        FailPending(new EditorProcessException("process_stopped", "Editor-Prozess wurde beendet."));
        var tasks = new[] { standardOutputTask, standardErrorTask, processMonitorTask }.Where(task => task is not null).Cast<Task>().ToArray();
        try { await Task.WhenAll(tasks).WaitAsync(TimeSpan.FromSeconds(1)).ConfigureAwait(false); }
        catch (Exception exception) when (exception is TimeoutException or OperationCanceledException or IOException) { }
        process?.StandardInput.Dispose();
        process?.StandardOutput.Dispose();
        process?.StandardError.Dispose();
        process?.Dispose();
        lifetimeCancellation?.Dispose();
        process = null;
        lifetimeCancellation = null;
        standardOutputTask = null;
        standardErrorTask = null;
        processMonitorTask = null;
    }

    private sealed record PendingResponse(
        string ExpectedMessageType,
        string? SessionId,
        TaskCompletionSource<EditorProtocolMessage> Completion);
}
