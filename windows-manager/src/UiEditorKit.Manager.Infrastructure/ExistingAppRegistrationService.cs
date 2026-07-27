using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using System.Xml;
using UiEditorKit.Manager.Core;
using UiEditorKit.Manager.Domain;

namespace UiEditorKit.Manager.Infrastructure;

public interface IRegistrationBuildVerifier
{
    Task<ManagerResult> BuildAsync(string targetRoot, string projectFile, CancellationToken cancellationToken = default);
}

public interface IRegistrationRuntimeVerifier
{
    Task<ManagerResult> VerifyAsync(string targetRoot, ExistingAppRegistrationState state,
        CancellationToken cancellationToken = default);
}

public sealed record RegistrationEditorHostStart(Process? Process, string? PipeName, ManagerResult Result);

public interface IRegistrationFaultInjector
{
    void BeforeWrite(int index, string relativePath);
}

public sealed class DotNetRegistrationBuildVerifier : IRegistrationBuildVerifier
{
    public async Task<ManagerResult> BuildAsync(string targetRoot, string projectFile, CancellationToken cancellationToken = default)
    {
        try
        {
            var project = ManagerPathRules.ResolveInside(targetRoot, projectFile);
            var start = new ProcessStartInfo("dotnet")
            {
                WorkingDirectory = targetRoot,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };
            start.ArgumentList.Add("build"); start.ArgumentList.Add(project); start.ArgumentList.Add("--nologo");
            using var process = Process.Start(start) ?? throw new InvalidOperationException("dotnet build konnte nicht gestartet werden.");
            var outputTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
            var errorTask = process.StandardError.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken);
            var output = (await outputTask) + Environment.NewLine + (await errorTask);
            return process.ExitCode == 0
                ? ManagerResult.Ok("registration_build_valid", "Zielprojekt wurde nach Registrierung erfolgreich gebaut.")
                : ManagerResult.Fail(ManagerErrorCodes.RegistrationBuildFailed, "Zielprojektbuild fehlgeschlagen: " + LastLines(output, 12));
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or InvalidOperationException or OperationCanceledException)
        {
            return ManagerResult.Fail(ManagerErrorCodes.RegistrationBuildFailed, "Zielprojektbuild fehlgeschlagen: " + exception.Message);
        }
    }

    private static string LastLines(string value, int count) => string.Join(" | ", value.Split(['\r', '\n'],
        StringSplitOptions.RemoveEmptyEntries).TakeLast(count));
}

public sealed class WpfRegistrationRuntimeVerifier : IRegistrationRuntimeVerifier
{
    private static readonly JsonSerializerOptions PipeJson = new(JsonSerializerDefaults.Web);

    public async Task<ManagerResult> VerifyAsync(string targetRoot, ExistingAppRegistrationState state,
        CancellationToken cancellationToken = default)
    {
        var launcher = new TargetProcessLauncher();
        var target = launcher.StartProcess(targetRoot, state.TargetStart, false);
        if (!target.Result.Success || target.Process is null)
            return ManagerResult.Fail(ManagerErrorCodes.RegistrationTargetStartFailed, target.Result.Message);
        try
        {
            await Task.Delay(900, cancellationToken);
            if (target.Process.HasExited)
                return ManagerResult.Fail(ManagerErrorCodes.RegistrationTargetStartFailed,
                    "Ziel-App wurde gestartet, hat sich aber vor dem Laufzeitcheck beendet.");
        }
        finally { await StopAsync(target.Process); }

        var pipeName = "ui-editor-kit-m79-check-" + Guid.NewGuid().ToString("N");
        var hostConfiguration = state.TargetStart with
        {
            Arguments = [.. state.TargetStart.Arguments, "--ui-editor-kit-host-pipe=" + pipeName]
        };
        var host = launcher.StartProcess(targetRoot, hostConfiguration, true);
        if (!host.Result.Success || host.Process is null)
            return ManagerResult.Fail(ManagerErrorCodes.RegistrationEditorStartFailed, host.Result.Message);
        try
        {
            await using var pipe = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(15));
            await pipe.ConnectAsync(timeout.Token);
            using var reader = new StreamReader(pipe, new UTF8Encoding(false), false, 4096, true);
            await using var writer = new StreamWriter(pipe, new UTF8Encoding(false), 4096, true) { AutoFlush = true };
            var registry = await ExchangeAsync(reader, writer, "getRegistry", timeout.Token);
            if (registry.ValueKind != JsonValueKind.Array || registry.GetArrayLength() == 0)
                throw new InvalidDataException("Lokaler Editor-Host hat keine nichtleere Registry geliefert.");
            var expectedElementIds = registry.EnumerateArray()
                .Where(item => item.TryGetProperty("editable", out var editable) && editable.ValueKind == JsonValueKind.True)
                .Select(item => item.GetProperty("id").GetString())
                .Where(id => !string.IsNullOrWhiteSpace(id)).Cast<string>().ToHashSet(StringComparer.Ordinal);
            var layout = await ExchangeAsync(reader, writer, "getLayout", timeout.Token);
            if (layout.ValueKind != JsonValueKind.Object || !layout.TryGetProperty("elements", out var elements) ||
                elements.ValueKind != JsonValueKind.Array ||
                !expectedElementIds.SetEquals(elements.EnumerateArray().Select(item => item.GetProperty("elementId").GetString())
                    .Where(id => !string.IsNullOrWhiteSpace(id)).Cast<string>()))
                throw new InvalidDataException("Lokaler Editor-Host konnte nicht alle editorfähigen Elementreferenzen auflösen.");
            return ManagerResult.Ok("registration_runtime_valid", "Ziel-App-Start und lokaler Editor-Host wurden praktisch geprüft.");
        }
        catch (Exception exception) when (exception is IOException or InvalidDataException or InvalidOperationException or OperationCanceledException or JsonException)
        {
            return ManagerResult.Fail(ManagerErrorCodes.RegistrationEditorStartFailed,
                "Editorstart oder lokaler HostAdapter-Laufzeitcheck fehlgeschlagen: " + exception.Message);
        }
        finally { await StopAsync(host.Process); }
    }

    private static async Task<JsonElement> ExchangeAsync(StreamReader reader, StreamWriter writer, string type,
        CancellationToken cancellationToken)
    {
        var id = Guid.NewGuid().ToString("N");
        await writer.WriteLineAsync(JsonSerializer.Serialize(
            new { id, type, elementId = (string?)null, payload = new { } }, PipeJson));
        var line = await reader.ReadLineAsync(cancellationToken);
        if (line is null) throw new IOException("Lokaler Editor-Host hat keine Antwort geliefert: " + type);
        using var response = JsonDocument.Parse(line);
        var root = response.RootElement;
        var validId = root.TryGetProperty("id", out var responseId) && responseId.GetString() == id;
        var successful = root.TryGetProperty("success", out var success) && success.ValueKind == JsonValueKind.True;
        if (!validId || !successful || !root.TryGetProperty("payload", out var payload))
            throw new InvalidDataException($"Lokaler Editor-Host hat den Vertrag für {type} abgelehnt " +
                                           $"(id={validId}, success={successful}).");
        return payload.Clone();
    }

    private static async Task StopAsync(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                if (process.CloseMainWindow())
                {
                    using var graceful = new CancellationTokenSource(TimeSpan.FromMilliseconds(1500));
                    try { await process.WaitForExitAsync(graceful.Token); }
                    catch (OperationCanceledException) { }
                }
                if (!process.HasExited)
                {
                    process.Kill(true);
                    using var forced = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                    await process.WaitForExitAsync(forced.Token);
                }
            }
        }
        catch (Exception exception) when (exception is InvalidOperationException or System.ComponentModel.Win32Exception or OperationCanceledException) { }
        finally
        {
            try
            {
                if (!process.HasExited)
                {
                    process.Kill(true);
                    await process.WaitForExitAsync();
                }
            }
            catch { }
            process.Dispose();
            await Task.Delay(250);
        }
    }
}

public sealed class ExistingAppRegistrationService
{
    private const string StatePath = ".ui-editor-kit/registration-installation.json";
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> TargetLocks = new(StringComparer.OrdinalIgnoreCase);
    private readonly ManagerPaths paths;
    private readonly IExistingProjectAdapter adapter;
    private readonly IRegistrationArtifactGenerator generator;
    private readonly IRegistrationContractChecker contractChecker;
    private readonly IRegistrationBuildVerifier buildVerifier;
    private readonly IRegistrationRuntimeVerifier runtimeVerifier;
    private readonly GitSafetyInspector gitSafety;
    private readonly ConcurrentDictionary<string, PreviewBundle> previews = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, UninstallBundle> uninstallPreviews = new(StringComparer.Ordinal);

    public ExistingAppRegistrationService(ManagerPaths paths, IExistingProjectAdapter? adapter = null,
        IRegistrationArtifactGenerator? generator = null, IRegistrationContractChecker? contractChecker = null,
        IRegistrationBuildVerifier? buildVerifier = null, GitSafetyInspector? gitSafety = null,
        IRegistrationRuntimeVerifier? runtimeVerifier = null)
    {
        this.paths = paths;
        this.adapter = adapter ?? new WpfExistingProjectAdapter(paths);
        this.generator = generator ?? new ControlledRegistrationArtifactGenerator();
        this.contractChecker = contractChecker ?? new GeneratedRegistrationContractChecker();
        this.buildVerifier = buildVerifier ?? new DotNetRegistrationBuildVerifier();
        this.gitSafety = gitSafety ?? new GitSafetyInspector();
        this.runtimeVerifier = runtimeVerifier ?? new WpfRegistrationRuntimeVerifier();
    }

    public Task<RegistrationAnalysisResult> AnalyzeAsync(string selectedPath, CancellationToken cancellationToken = default) =>
        adapter.AnalyzeAsync(selectedPath, cancellationToken);

    public async Task<ManagerResult> SaveReviewedAnalysisAsync(ExistingAppAnalysis analysis, CancellationToken cancellationToken = default)
    {
        var validation = RegistrationProposalValidator.Validate(analysis.Proposals, requireAllDecided: false);
        if (validation.Issues.Any(item => item.Code != ManagerErrorCodes.RegistrationProposalUnreviewed))
            return ManagerResult.Fail(ManagerErrorCodes.RegistrationProposalInvalid, string.Join(" ", validation.Issues.Select(item => item.Message)));
        await new RegistrationAnalysisStore(paths).SaveAsync(PrepareDecisionLog(analysis), cancellationToken);
        return ManagerResult.Ok("registration_review_saved", "Nutzerentscheidungen wurden ausschließlich im lokalen Managerbereich gespeichert.");
    }

    public async Task<RegistrationPreviewResult> PreviewAsync(string targetRoot, ExistingAppAnalysis analysis,
        CancellationToken cancellationToken = default)
    {
        try
        {
            analysis = PrepareDecisionLog(analysis);
            var root = Path.GetFullPath(targetRoot);
            var currentInventory = await SourceInventoryBuilder.CreateAsync(root, cancellationToken);
            if (currentInventory.RootPathFingerprint != analysis.RootPathFingerprint || currentInventory.InventoryHash != analysis.SourceInventoryHash)
                return new(null, null, ManagerResult.Fail(ManagerErrorCodes.RegistrationAnalysisStale,
                    "Quellinventar weicht von der Analyse ab; erneute read-only Analyse erforderlich."));
            var generation = await generator.GenerateAsync(analysis, cancellationToken);
            if (generation.Registry is null || !generation.Result.Success)
                return new(null, generation.Registry, generation.Result);
            var currentState = await LoadStateAsync(root, cancellationToken);
            var registrationId = currentState?.RegistrationId ?? "m79-" + Hashing.Bytes(Encoding.UTF8.GetBytes(analysis.ApplicationId + "|" + analysis.RootPathFingerprint))[..20];
            var artifacts = generation.Files.ToList();
            var generatedManifestFile = generation.Files.Single(item => item.RelativePath == "ui-editor-target.json");
            var manifest = JsonSerializer.Deserialize<TargetAppManifest>(generatedManifestFile.Content, ManagerJson.Options)!;
            var starterManifestPath = Path.Combine(root, StarterTargetContract.ManifestFileName);
            if (File.Exists(starterManifestPath))
            {
                var starter = JsonSerializer.Deserialize<StarterTargetManifest>(await File.ReadAllBytesAsync(starterManifestPath, cancellationToken), ManagerJson.Options);
                if (starter?.SchemaVersion == StarterTargetContract.SchemaVersion)
                {
                    var scopeId = analysis.ApplicationId + ".ui.root";
                    var merged = starter with
                    {
                        RegistryVersion = Math.Max(1, starter.RegistryVersion + 1),
                        RegistryFingerprint = generation.Registry.Fingerprint,
                        RegistryStatus = StarterRegistryStatuses.Complete,
                        ActiveScopes = [scopeId],
                        Scopes = [new(scopeId, StarterRegistryStatuses.Complete, null, generation.Registry.Elements.Count, 0)],
                        ManagerTarget = manifest,
                        UpdatedAt = DateTimeOffset.UtcNow
                    };
                    artifacts[artifacts.FindIndex(item => item.RelativePath == StarterTargetContract.ManifestFileName)] =
                        generatedManifestFile with { Content = JsonSerializer.SerializeToUtf8Bytes(merged, new JsonSerializerOptions(ManagerJson.Options) { WriteIndented = true }) };
                }
            }
            var projectPath = ManagerPathRules.ResolveInside(root, analysis.ProjectFile);
            var projectOriginal = await File.ReadAllBytesAsync(projectPath, cancellationToken);
            var projectUpdated = StructuredProjectRegistrationEditor.AddRegistrationCompileItem(projectOriginal);
            artifacts.Add(new(analysis.ProjectFile, projectUpdated, "ui-editor-kit-m79", "Additiver strukturierter Compile-Update-Eintrag"));

            var classified = await ClassifyAsync(root, analysis, artifacts, currentState, registrationId, cancellationToken);
            var isUpdate = currentState is not null;
            var state = new ExistingAppRegistrationState(1, registrationId, analysis.ApplicationId, analysis.AnalysisId,
                analysis.SourceInventoryHash, generation.Registry.Fingerprint, analysis.AdapterVersion,
                currentState?.InstalledAt ?? analysis.AnalyzedAt, analysis.AnalyzedAt,
                RegistrationLifecycle.Installed,
                classified.OwnedFiles, manifest.TargetStart, manifest.EditorStart);
            var stateBytes = JsonSerializer.SerializeToUtf8Bytes(state, ManagerJson.Options);
            artifacts.Add(new(StatePath, stateBytes, "ui-editor-kit-m79", "Versionierter M79-Installations- und Ownershipstatus"));
            classified = await ClassifyAsync(root, analysis, artifacts, currentState, registrationId, cancellationToken);
            var git = await gitSafety.CheckAsync(root,
                classified.Files.Where(item => item.Action != RegistrationFileAction.Unchanged).Select(item => item.RelativePath).ToArray(), cancellationToken);
            var blockers = classified.Blockers.ToList();
            if (!git.Safe) blockers.Add(ManagerErrorCodes.RegistrationGitDirtyConflict + ": " + git.Message);
            var previewId = CreatePreviewId(analysis, root, classified.Files);
            var preview = new RegistrationPreview(previewId, analysis.AnalysisId, analysis.ApplicationId, root, analysis.ProjectFile,
                DateTimeOffset.UtcNow, analysis.SourceInventoryHash, classified.Files,
                [git.Message, "Originale bestehender Dateien werden im Manager-Backupbereich gehalten."], blockers);
            previews[previewId] = new(preview, analysis, generation.Registry, artifacts, state, isUpdate);
            return new(preview, generation.Registry, blockers.Count == 0
                ? ManagerResult.Ok("registration_preview_ready", "Vollständige M79-Änderungsvorschau ist aktuell.")
                : ManagerResult.Fail(ManagerErrorCodes.RegistrationForeignChangeConflict, string.Join(" ", blockers)));
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or InvalidOperationException or XmlException or JsonException)
        {
            return new(null, null, ManagerResult.Fail(ManagerErrorCodes.RegistrationAdapterGenerationFailed,
                "Registrierungsvorschau konnte nicht erzeugt werden: " + exception.Message));
        }
    }

    public async Task<ManagerResult> InstallOrUpdateAsync(RegistrationPreview preview, bool confirmed,
        IRegistrationFaultInjector? fault = null, CancellationToken cancellationToken = default)
    {
        if (!confirmed) return ManagerResult.Fail(ManagerErrorCodes.RegistrationPreviewStale, "Registrierung wurde nicht ausdrücklich bestätigt.");
        if (!previews.TryGetValue(preview.PreviewId, out var bundle) || bundle.Preview != preview || !preview.CanExecute)
            return ManagerResult.Fail(ManagerErrorCodes.RegistrationPreviewStale, "Registrierungsvorschau ist nicht mehr verfügbar oder blockiert.");
        var gate = TargetLocks.GetOrAdd(Path.GetFullPath(preview.TargetRoot), _ => new(1, 1));
        if (!await gate.WaitAsync(0, cancellationToken))
            return ManagerResult.Fail(ManagerErrorCodes.RegistrationInstallFailed, "Für diese Ziel-App läuft bereits eine Registrierungstransaktion.");
        var transactionId = Guid.NewGuid().ToString("N");
        var transactionRoot = Path.Combine(paths.Backups, "registration-transactions", transactionId);
        var changed = new List<ChangedFile>();
        var persistentBackupCreated = false;
        try
        {
            var freshness = await VerifyFreshAsync(bundle, cancellationToken);
            if (!freshness.Success) return freshness with { TransactionId = transactionId };
            cancellationToken.ThrowIfCancellationRequested();
            Directory.CreateDirectory(transactionRoot);
            var writeIndex = 0;
            foreach (var item in preview.Files.Where(item => item.Action is RegistrationFileAction.Create or RegistrationFileAction.Update)
                         .OrderBy(item => item.RelativePath == StatePath ? 1 : 0).ThenBy(item => item.RelativePath, StringComparer.Ordinal))
            {
                fault?.BeforeWrite(writeIndex++, item.RelativePath);
                var target = ManagerPathRules.ResolveInside(preview.TargetRoot, item.RelativePath);
                var generated = bundle.Files.Single(file => file.RelativePath == item.RelativePath);
                var backup = File.Exists(target) ? Path.Combine(transactionRoot, item.RelativePath.Replace('/', Path.DirectorySeparatorChar)) : null;
                if (backup is not null) { Directory.CreateDirectory(Path.GetDirectoryName(backup)!); File.Copy(target, backup, true); }
                changed.Add(new(target, backup, backup is null));
                var owned = bundle.State.Files.SingleOrDefault(file => file.RelativePath == item.RelativePath);
                if (owned?.BackupRelativePath is not null)
                {
                    var persistent = PersistentBackupPath(bundle.State.RegistrationId, owned.BackupRelativePath);
                    if (!File.Exists(persistent))
                    {
                        Directory.CreateDirectory(Path.GetDirectoryName(persistent)!);
                        if (backup is null) throw new InvalidOperationException("Originalbackup für bestehende Datei fehlt.");
                        File.Copy(backup, persistent, true); persistentBackupCreated = true;
                    }
                }
                await AtomicWriteBytesAsync(target, generated.Content, CancellationToken.None);
            }
            var build = await buildVerifier.BuildAsync(preview.TargetRoot, preview.ProjectFile, CancellationToken.None);
            if (!build.Success) throw new RegistrationFailure(build.Code, build.Message);
            var contract = await contractChecker.CheckAsync(preview.TargetRoot, bundle.Analysis, bundle.Registry, CancellationToken.None);
            if (!contract.Success) throw new RegistrationFailure(contract.Code, contract.Message);
            var runtime = await runtimeVerifier.VerifyAsync(preview.TargetRoot, bundle.State, CancellationToken.None);
            if (!runtime.Success) throw new RegistrationFailure(runtime.Code, runtime.Message);
            Directory.Delete(transactionRoot, true);
            previews.TryRemove(preview.PreviewId, out _);
            var action = bundle.IsUpdate ? "registration_update_complete" : "registration_install_complete";
            return ManagerResult.Ok(action, "Registrierung, Build und Vertragscheck wurden vollständig abgeschlossen.", transactionId,
                changed.Select(item => Path.GetRelativePath(preview.TargetRoot, item.Path)).ToArray());
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or InvalidOperationException or RegistrationFailure)
        {
            var rollback = Rollback(changed);
            if (persistentBackupCreated && rollback) TryDeletePersistentBackup(bundle.State.RegistrationId);
            var update = bundle.IsUpdate;
            var code = rollback
                ? exception is RegistrationFailure failure ? failure.Code : update ? ManagerErrorCodes.RegistrationUpdateFailed : ManagerErrorCodes.RegistrationInstallFailed
                : update ? ManagerErrorCodes.RegistrationUpdateRollbackFailed : ManagerErrorCodes.RegistrationRollbackFailed;
            return ManagerResult.Fail(code, "Registrierung fehlgeschlagen; Rollback " + (rollback ? "erfolgreich: " : "fehlgeschlagen: ") + exception.Message,
                transactionId, rollback, changed.Select(item => Path.GetRelativePath(preview.TargetRoot, item.Path)).ToArray());
        }
        finally
        {
            try { if (Directory.Exists(transactionRoot)) Directory.Delete(transactionRoot, true); } catch { }
            CleanupEmptyBackupParents();
            gate.Release();
        }
    }

    public async Task<(RegistrationPreview? Preview, ManagerResult Result)> UninstallPreviewAsync(string targetRoot,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var root = Path.GetFullPath(targetRoot);
            var state = await LoadStateAsync(root, cancellationToken);
            if (state is null) return (null, ManagerResult.Fail(ManagerErrorCodes.RegistrationUninstallFailed, "Keine M79-Registrierung gefunden."));
            var files = new List<RegistrationPreviewFile>();
            var restore = new List<RegistrationGeneratedFile>();
            var blockers = new List<string>();
            foreach (var owned in state.Files.OrderBy(item => item.RelativePath, StringComparer.Ordinal))
            {
                var target = ManagerPathRules.ResolveInside(root, owned.RelativePath);
                var current = File.Exists(target) ? await File.ReadAllBytesAsync(target, cancellationToken) : null;
                var currentHash = current is null ? null : Hashing.Bytes(current);
                var conflict = currentHash is not null && currentHash != owned.InstalledHash ? "Eigene Datei wurde nach Installation verändert." : null;
                if (conflict is not null) blockers.Add(owned.RelativePath + ": " + conflict);
                if (owned.Created)
                    files.Add(new(owned.RelativePath, current is null ? RegistrationFileAction.Unchanged : conflict is null ? RegistrationFileAction.Remove : RegistrationFileAction.Conflict,
                        current is not null, true, currentHash, null, current is not null, null, conflict, "M79-eigene Datei entfernen"));
                else
                {
                    if (owned.BackupRelativePath is null) { blockers.Add(owned.RelativePath + ": Originalbackup fehlt."); continue; }
                    var backup = PersistentBackupPath(state.RegistrationId, owned.BackupRelativePath);
                    if (!File.Exists(backup)) { blockers.Add(owned.RelativePath + ": Originalbackup fehlt."); continue; }
                    var original = await File.ReadAllBytesAsync(backup, cancellationToken);
                    restore.Add(new(owned.RelativePath, original, "foreign-original", "Ursprüngliche fremde Datei bytegleich wiederherstellen"));
                    files.Add(new(owned.RelativePath, conflict is null ? RegistrationFileAction.Update : RegistrationFileAction.Conflict,
                        current is not null, true, currentHash, Hashing.Bytes(original), true,
                        current is null ? null : ExactTextDiff.Create(owned.RelativePath, current, original), conflict, "Fremdes Original bytegleich wiederherstellen"));
                }
            }
            var stateTarget = ManagerPathRules.ResolveInside(root, StatePath);
            var stateBytes = File.Exists(stateTarget) ? await File.ReadAllBytesAsync(stateTarget, cancellationToken) : null;
            files.Add(new(StatePath, stateBytes is null ? RegistrationFileAction.Unchanged : RegistrationFileAction.Remove,
                stateBytes is not null, true, stateBytes is null ? null : Hashing.Bytes(stateBytes), null, stateBytes is not null, null, null, "M79-Ownershipstatus entfernen"));
            var previewId = CreatePreviewId(state.ApplicationId, state.AnalysisId, root, files);
            var git = await gitSafety.CheckAsync(root, files.Where(item => item.Action != RegistrationFileAction.Unchanged).Select(item => item.RelativePath).ToArray(), cancellationToken);
            if (!git.Safe) blockers.Add(ManagerErrorCodes.RegistrationGitDirtyConflict + ": " + git.Message);
            var preview = new RegistrationPreview(previewId, state.AnalysisId, state.ApplicationId, root, state.TargetStart.Project,
                DateTimeOffset.UtcNow, state.SourceInventoryHash, files, ["UI-/PDF-Profile und Fachwerte bleiben erhalten.", git.Message], blockers);
            uninstallPreviews[previewId] = new(preview, state, restore);
            return (preview, blockers.Count == 0 ? ManagerResult.Ok("registration_uninstall_preview_ready", "M79-Deinstallationsvorschau ist vollständig.")
                : ManagerResult.Fail(ManagerErrorCodes.RegistrationForeignChangeConflict, string.Join(" ", blockers)));
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or InvalidOperationException)
        {
            return (null, ManagerResult.Fail(ManagerErrorCodes.RegistrationUninstallFailed, "Deinstallationsvorschau fehlgeschlagen: " + exception.Message));
        }
    }

    public async Task<ManagerResult> UninstallAsync(RegistrationPreview preview, bool confirmed,
        IRegistrationFaultInjector? fault = null, CancellationToken cancellationToken = default)
    {
        if (!confirmed) return ManagerResult.Fail(ManagerErrorCodes.RegistrationPreviewStale, "Deinstallation wurde nicht ausdrücklich bestätigt.");
        if (!uninstallPreviews.TryGetValue(preview.PreviewId, out var bundle) || bundle.Preview != preview || !preview.CanExecute)
            return ManagerResult.Fail(ManagerErrorCodes.RegistrationPreviewStale, "Deinstallationsvorschau ist veraltet.");
        var gate = TargetLocks.GetOrAdd(Path.GetFullPath(preview.TargetRoot), _ => new(1, 1));
        if (!await gate.WaitAsync(0, cancellationToken)) return ManagerResult.Fail(ManagerErrorCodes.RegistrationUninstallFailed, "Transaktion läuft bereits.");
        var transactionId = Guid.NewGuid().ToString("N");
        var transactionRoot = Path.Combine(paths.Backups, "registration-transactions", transactionId);
        var changed = new List<ChangedFile>();
        try
        {
            var fresh = await UninstallPreviewAsync(preview.TargetRoot, cancellationToken);
            if (fresh.Preview is null || fresh.Preview.PreviewId != preview.PreviewId || !fresh.Preview.CanExecute)
                return ManagerResult.Fail(ManagerErrorCodes.RegistrationPreviewStale, "Deinstallationsvorschau ist veraltet.", transactionId);
            cancellationToken.ThrowIfCancellationRequested(); Directory.CreateDirectory(transactionRoot);
            var index = 0;
            foreach (var item in preview.Files.Where(item => item.RelativePath != StatePath && item.Action is RegistrationFileAction.Update or RegistrationFileAction.Remove)
                         .OrderBy(item => item.RelativePath, StringComparer.Ordinal))
            {
                fault?.BeforeWrite(index++, item.RelativePath);
                var target = ManagerPathRules.ResolveInside(preview.TargetRoot, item.RelativePath);
                var backup = Path.Combine(transactionRoot, item.RelativePath.Replace('/', Path.DirectorySeparatorChar));
                Directory.CreateDirectory(Path.GetDirectoryName(backup)!); File.Copy(target, backup, true);
                changed.Add(new(target, backup, false));
                if (item.Action == RegistrationFileAction.Remove) File.Delete(target);
                else await AtomicWriteBytesAsync(target, bundle.RestoreFiles.Single(file => file.RelativePath == item.RelativePath).Content, CancellationToken.None);
            }
            var statePath = ManagerPathRules.ResolveInside(preview.TargetRoot, StatePath);
            if (File.Exists(statePath))
            {
                var backup = Path.Combine(transactionRoot, StatePath.Replace('/', Path.DirectorySeparatorChar));
                Directory.CreateDirectory(Path.GetDirectoryName(backup)!); File.Copy(statePath, backup, true);
                changed.Add(new(statePath, backup, false)); File.Delete(statePath);
            }
            var build = await buildVerifier.BuildAsync(preview.TargetRoot, preview.ProjectFile, CancellationToken.None);
            if (!build.Success) throw new RegistrationFailure(build.Code, build.Message);
            Directory.Delete(transactionRoot, true); TryDeletePersistentBackup(bundle.State.RegistrationId);
            CleanupOwnedDirectories(preview.TargetRoot);
            uninstallPreviews.TryRemove(preview.PreviewId, out _);
            return ManagerResult.Ok("registration_uninstall_complete", "Nur M79-eigene Änderungen wurden entfernt; Originalprojekt wurde bytegleich wiederhergestellt.",
                transactionId, changed.Select(item => Path.GetRelativePath(preview.TargetRoot, item.Path)).ToArray());
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or InvalidOperationException or RegistrationFailure)
        {
            var rollback = Rollback(changed);
            return ManagerResult.Fail(rollback ? ManagerErrorCodes.RegistrationUninstallFailed : ManagerErrorCodes.RegistrationUninstallRollbackFailed,
                "Deinstallation fehlgeschlagen; Rollback " + (rollback ? "erfolgreich: " : "fehlgeschlagen: ") + exception.Message,
                transactionId, rollback);
        }
        finally { try { if (Directory.Exists(transactionRoot)) Directory.Delete(transactionRoot, true); } catch { } CleanupEmptyBackupParents(); gate.Release(); }
    }

    public async Task<ExistingAppRegistrationState?> LoadStateAsync(string targetRoot, CancellationToken cancellationToken = default)
    {
        var path = ManagerPathRules.ResolveInside(targetRoot, StatePath);
        if (!File.Exists(path)) return null;
        await using var stream = File.OpenRead(path);
        var state = await JsonSerializer.DeserializeAsync<ExistingAppRegistrationState>(stream, ManagerJson.Options, cancellationToken);
        return state is { SchemaVersion: 1 } ? state : null;
    }

    public ManagerResult StartTarget(string targetRoot, ExistingAppRegistrationState state) =>
        RecodeStart(new TargetProcessLauncher().Start(targetRoot, state.TargetStart, false), false);

    public ManagerResult StartEditor(string targetRoot, ExistingAppRegistrationState state) =>
        RecodeStart(new TargetProcessLauncher().Start(targetRoot, state.EditorStart, true), true);

    public RegistrationEditorHostStart StartEditorHost(string targetRoot, ExistingAppRegistrationState state)
    {
        var pipeName = "ui-editor-kit-m79-" + Guid.NewGuid().ToString("N");
        var configuration = state.TargetStart with
        {
            Arguments = [.. state.TargetStart.Arguments, "--ui-editor-kit-host-pipe=" + pipeName]
        };
        var started = new TargetProcessLauncher().StartProcess(targetRoot, configuration, true);
        var result = RecodeStart(started.Result, true);
        return new(started.Process, result.Success ? pipeName : null, result);
    }

    private static ManagerResult RecodeStart(ManagerResult result, bool editor) => result.Success ? result : result with
    { Code = editor ? ManagerErrorCodes.RegistrationEditorStartFailed : ManagerErrorCodes.RegistrationTargetStartFailed };

    private static ExistingAppAnalysis PrepareDecisionLog(ExistingAppAnalysis analysis)
    {
        var decisions = analysis.Proposals.Where(item => item.ReviewStatus != ProposalReviewStatus.Unreviewed)
            .Select(item => new RegistrationUserDecision(item.ProposalId, item.ReviewStatus, analysis.AnalyzedAt, item.UserNote, item)).ToArray();
        return analysis with { UserDecisions = decisions };
    }

    private async Task<ManagerResult> VerifyFreshAsync(PreviewBundle bundle, CancellationToken cancellationToken)
    {
        var inventory = await SourceInventoryBuilder.CreateAsync(bundle.Preview.TargetRoot, cancellationToken);
        if (inventory.InventoryHash != bundle.Analysis.SourceInventoryHash)
            return ManagerResult.Fail(ManagerErrorCodes.RegistrationAnalysisStale, "Quellinventar ist nicht mehr aktuell.");
        foreach (var item in bundle.Preview.Files)
        {
            var path = ManagerPathRules.ResolveInside(bundle.Preview.TargetRoot, item.RelativePath);
            var hash = File.Exists(path) ? await Hashing.FileAsync(path, cancellationToken) : null;
            if (!string.Equals(hash, item.OldHash, StringComparison.OrdinalIgnoreCase))
                return ManagerResult.Fail(ManagerErrorCodes.RegistrationPreviewStale, "Dateizustand weicht von der Vorschau ab: " + item.RelativePath);
        }
        var git = await gitSafety.CheckAsync(bundle.Preview.TargetRoot,
            bundle.Preview.Files.Where(item => item.Action != RegistrationFileAction.Unchanged).Select(item => item.RelativePath).ToArray(), cancellationToken);
        return git.Safe ? ManagerResult.Ok("registration_preview_current", "Vorschau und Git-Zustand sind aktuell.")
            : ManagerResult.Fail(ManagerErrorCodes.RegistrationGitDirtyConflict, git.Message);
    }

    private async Task<ClassifiedFiles> ClassifyAsync(string root, ExistingAppAnalysis analysis,
        IReadOnlyList<RegistrationGeneratedFile> artifacts, ExistingAppRegistrationState? state, string registrationId,
        CancellationToken cancellationToken)
    {
        var files = new List<RegistrationPreviewFile>();
        var ownedFiles = new List<RegistrationOwnedFile>();
        var blockers = new List<string>();
        var starterState = await LoadStarterStateAsync(root, cancellationToken);
        foreach (var artifact in artifacts.OrderBy(item => item.RelativePath, StringComparer.Ordinal))
        {
            var target = ManagerPathRules.ResolveInside(root, artifact.RelativePath);
            var oldBytes = File.Exists(target) ? await File.ReadAllBytesAsync(target, cancellationToken) : null;
            var oldHash = oldBytes is null ? null : Hashing.Bytes(oldBytes);
            var newHash = Hashing.Bytes(artifact.Content);
            var previous = state?.Files.SingleOrDefault(item => item.RelativePath == artifact.RelativePath);
            var isState = artifact.RelativePath == StatePath && state is not null;
            var starterManifestHandoff = state is null && artifact.RelativePath == StarterTargetContract.ManifestFileName &&
                starterState?.Files.Any(item => item.RelativePath == StarterTargetContract.ManifestFileName) == true;
            var managerOwned = previous is not null && oldHash == previous.InstalledHash || isState || starterManifestHandoff;
            string? conflict = null;
            RegistrationFileAction action;
            if (oldHash is null) action = RegistrationFileAction.Create;
            else if (oldHash == newHash) action = RegistrationFileAction.Unchanged;
            else if (artifact.RelativePath == analysis.ProjectFile && state is null &&
                     analysis.Inventory.Files.SingleOrDefault(item => item.RelativePath == artifact.RelativePath)?.Sha256 == oldHash)
                action = RegistrationFileAction.Update;
            else if (managerOwned) action = RegistrationFileAction.Update;
            else { action = RegistrationFileAction.Conflict; conflict = "Vorhandene Datei ist nicht unverändertes M79-Eigentum."; blockers.Add(artifact.RelativePath + ": " + conflict); }
            files.Add(new(artifact.RelativePath, action, oldBytes is not null, managerOwned, oldHash, newHash,
                action == RegistrationFileAction.Update, oldBytes is null ? null : ExactTextDiff.Create(artifact.RelativePath, oldBytes, artifact.Content),
                conflict, artifact.Description));
            if (artifact.RelativePath == StatePath) continue;
            var created = previous?.Created ?? oldBytes is null;
            var originalHash = previous?.OriginalHash ?? (created ? null : oldHash);
            var backupRelative = previous?.BackupRelativePath ?? (created ? null : Path.Combine(registrationId, artifact.RelativePath).Replace('\\', '/'));
            ownedFiles.Add(new(artifact.RelativePath, newHash, artifact.Ownership, created, originalHash, backupRelative));
        }
        return new(files, ownedFiles, blockers);
    }

    private static async Task<StarterInstallationState?> LoadStarterStateAsync(string root, CancellationToken cancellationToken)
    {
        var path = ManagerPathRules.ResolveInside(root, StarterTargetContract.OwnershipFileName);
        if (!File.Exists(path)) return null;
        await using var stream = File.OpenRead(path);
        var state = await JsonSerializer.DeserializeAsync<StarterInstallationState>(stream, ManagerJson.Options, cancellationToken);
        return state is { SchemaVersion: 1, ProductName: StarterTargetContract.ProductName } ? state : null;
    }

    private static string CreatePreviewId(ExistingAppAnalysis analysis, string root, IReadOnlyList<RegistrationPreviewFile> files) =>
        CreatePreviewId(analysis.ApplicationId, analysis.AnalysisId, root, files);

    private static string CreatePreviewId(string applicationId, string analysisId, string root, IReadOnlyList<RegistrationPreviewFile> files)
    {
        var canonical = string.Join("\n", new[] { applicationId, analysisId, Path.GetFullPath(root) }.Concat(files.OrderBy(item => item.RelativePath, StringComparer.Ordinal)
            .Select(item => $"{item.RelativePath}|{item.Action}|{item.OldHash}|{item.NewHash}|{item.ManagerOwned}")));
        return Hashing.Bytes(Encoding.UTF8.GetBytes(canonical));
    }

    private string PersistentBackupPath(string registrationId, string backupRelativePath) =>
        Path.GetFullPath(Path.Combine(paths.Backups, "registration-owners", backupRelativePath.Replace('/', Path.DirectorySeparatorChar)));

    private void TryDeletePersistentBackup(string registrationId)
    {
        var root = Path.Combine(paths.Backups, "registration-owners", registrationId);
        try { if (Directory.Exists(root)) Directory.Delete(root, true); } catch { }
    }

    private void CleanupEmptyBackupParents()
    {
        foreach (var directory in new[]
                 {
                     Path.Combine(paths.Backups, "registration-transactions"),
                     Path.Combine(paths.Backups, "registration-owners")
                 })
            try { if (Directory.Exists(directory) && !Directory.EnumerateFileSystemEntries(directory).Any()) Directory.Delete(directory); } catch { }
    }

    private static async Task AtomicWriteBytesAsync(string target, byte[] content, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
        var temp = target + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920,
                             FileOptions.Asynchronous | FileOptions.WriteThrough))
            { await stream.WriteAsync(content, cancellationToken); await stream.FlushAsync(cancellationToken); stream.Flush(true); }
            if (File.Exists(target)) File.Replace(temp, target, null, true); else File.Move(temp, target);
        }
        finally { try { if (File.Exists(temp)) File.Delete(temp); } catch { } }
    }

    private static bool Rollback(IEnumerable<ChangedFile> changed)
    {
        var success = true;
        foreach (var item in changed.Reverse())
        {
            try
            {
                if (item.Backup is not null && File.Exists(item.Backup))
                { Directory.CreateDirectory(Path.GetDirectoryName(item.Path)!); File.Copy(item.Backup, item.Path, true); }
                else if (item.Created && File.Exists(item.Path)) File.Delete(item.Path);
            }
            catch { success = false; }
        }
        return success;
    }

    private static void CleanupOwnedDirectories(string targetRoot)
    {
        var generated = Path.Combine(targetRoot, ".ui-editor-kit", "generated");
        var integration = Path.Combine(targetRoot, ".ui-editor-kit");
        foreach (var directory in new[] { generated, integration })
            try { if (Directory.Exists(directory) && !Directory.EnumerateFileSystemEntries(directory).Any()) Directory.Delete(directory); } catch { }
    }

    private sealed record PreviewBundle(RegistrationPreview Preview, ExistingAppAnalysis Analysis,
        GeneratedRegistrationRegistry Registry, IReadOnlyList<RegistrationGeneratedFile> Files, ExistingAppRegistrationState State,
        bool IsUpdate);
    private sealed record UninstallBundle(RegistrationPreview Preview, ExistingAppRegistrationState State,
        IReadOnlyList<RegistrationGeneratedFile> RestoreFiles);
    private sealed record ClassifiedFiles(IReadOnlyList<RegistrationPreviewFile> Files,
        IReadOnlyList<RegistrationOwnedFile> OwnedFiles, IReadOnlyList<string> Blockers);
    private sealed record ChangedFile(string Path, string? Backup, bool Created);
    private sealed class RegistrationFailure(string code, string message) : Exception(message) { public string Code { get; } = code; }
}
