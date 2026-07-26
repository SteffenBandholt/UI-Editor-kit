using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using UiEditorKit.Manager.Core;
using UiEditorKit.Manager.Domain;

namespace UiEditorKit.Manager.Infrastructure;

public sealed record ManagerPaths(string Root, string App, string Data, string Logs, string Backups, string Packages, string Diagnostics)
{
    public static ManagerPaths ForDefault() => ForRoot(Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "UI-Editor-kit", "Manager"));
    public static ManagerPaths ForRoot(string root)
    {
        var full = Path.GetFullPath(root);
        return new(full, Path.Combine(full, "app"), Path.Combine(full, "data"), Path.Combine(full, "logs"),
            Path.Combine(full, "backups"), Path.Combine(full, "packages"), Path.Combine(full, "diagnostics"));
    }
    public void Ensure() { foreach (var path in new[] { Root, App, Data, Logs, Backups, Packages, Diagnostics }) Directory.CreateDirectory(path); }
}

public sealed class KnownTargetAppsStore(ManagerPaths paths)
{
    private string StorePath => Path.Combine(paths.Data, "known-target-apps.json");

    public async Task<KnownTargetAppsDocument> LoadAsync(CancellationToken token = default)
    {
        if (!File.Exists(StorePath)) return new(1, []);
        try
        {
            await using var stream = File.OpenRead(StorePath);
            var value = await JsonSerializer.DeserializeAsync<KnownTargetAppsDocument>(stream, ManagerJson.Options, token);
            return value is { SchemaVersion: 1 } ? value : new(1, []);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)
        {
            return new(1, []);
        }
    }

    public async Task UpsertAsync(KnownTargetApp app, CancellationToken token = default)
    {
        var document = await LoadAsync(token);
        var apps = document.Apps.Where(item => !(item.ApplicationId == app.ApplicationId &&
            string.Equals(item.RootPath, app.RootPath, StringComparison.OrdinalIgnoreCase))).Append(app)
            .OrderBy(item => item.DisplayName, StringComparer.OrdinalIgnoreCase).ToArray();
        await AtomicWriteAsync(new(1, apps), token);
    }

    public async Task<bool> RemoveAsync(string applicationId, string rootPath, CancellationToken token = default)
    {
        var document = await LoadAsync(token);
        var apps = document.Apps.Where(item => !(item.ApplicationId == applicationId &&
            string.Equals(item.RootPath, rootPath, StringComparison.OrdinalIgnoreCase))).ToArray();
        if (apps.Length == document.Apps.Count) return false;
        await AtomicWriteAsync(new(1, apps), token);
        return true;
    }

    private async Task AtomicWriteAsync(KnownTargetAppsDocument document, CancellationToken token)
    {
        paths.Ensure();
        var temp = StorePath + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096,
                FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await JsonSerializer.SerializeAsync(stream, document, ManagerJson.Options, token);
                await stream.FlushAsync(token);
                stream.Flush(true);
            }
            if (File.Exists(StorePath)) File.Replace(temp, StorePath, null, true); else File.Move(temp, StorePath);
        }
        finally { try { if (File.Exists(temp)) File.Delete(temp); } catch { } }
    }
}

public sealed class ManagerLogger(ManagerPaths paths)
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private static readonly JsonSerializerOptions LogOptions = new(ManagerJson.Options) { WriteIndented = false };
    public async Task WriteAsync(ManagerLogEntry entry, CancellationToken token = default)
    {
        paths.Ensure();
        var line = JsonSerializer.Serialize(entry, LogOptions) + Environment.NewLine;
        await gate.WaitAsync(token);
        try { await File.AppendAllTextAsync(Path.Combine(paths.Logs, "manager.jsonl"), line, token); }
        finally { gate.Release(); }
    }

    public async Task<IReadOnlyList<ManagerLogEntry>> ReadAsync(CancellationToken token = default)
    {
        var path = Path.Combine(paths.Logs, "manager.jsonl");
        if (!File.Exists(path)) return [];
        var result = new List<ManagerLogEntry>();
        foreach (var line in await File.ReadAllLinesAsync(path, token))
            try { if (JsonSerializer.Deserialize<ManagerLogEntry>(line, LogOptions) is { } item) result.Add(item); }
            catch (JsonException) { }
        return result;
    }
}

public sealed class TargetProcessLauncher
{
    public ManagerResult Start(string root, TargetStartConfiguration configuration, bool editor)
        => StartProcess(root, configuration, editor).Result;

    public StartedTargetProcess StartProcess(string root, TargetStartConfiguration configuration, bool editor)
    {
        try
        {
            ProcessStartInfo start;
            if (configuration.Kind == "dotnetProject")
            {
                var project = ManagerPathRules.ResolveInside(root, configuration.Project);
                start = new("dotnet") { WorkingDirectory = root, UseShellExecute = false };
                start.ArgumentList.Add("run"); start.ArgumentList.Add("--project"); start.ArgumentList.Add(project);
                if (configuration.Arguments.Count > 0) start.ArgumentList.Add("--");
                foreach (var argument in configuration.Arguments) start.ArgumentList.Add(argument);
            }
            else
            {
                if (string.IsNullOrWhiteSpace(configuration.Executable)) throw new InvalidOperationException("Executable fehlt.");
                start = new(ManagerPathRules.ResolveInside(root, configuration.Executable)) { WorkingDirectory = root, UseShellExecute = true };
                foreach (var argument in configuration.Arguments) start.ArgumentList.Add(argument);
            }
            var process = Process.Start(start) ?? throw new InvalidOperationException("Prozess wurde nicht gestartet.");
            return new(process, ManagerResult.Ok(editor ? "editor_started" : "target_started", $"Prozess {process.Id} wurde gestartet."));
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or InvalidOperationException)
        {
            return new(null, ManagerResult.Fail(editor ? ManagerErrorCodes.EditorStartFailed : ManagerErrorCodes.TargetStartFailed, exception.Message));
        }
    }
}

public sealed record StartedTargetProcess(Process? Process, ManagerResult Result);

public sealed class DesktopShortcutService
{
    public const string ShortcutName = "UI-Editor Manager.lnk";
    public const string OwnershipDescription = "UI-Editor-kit M78 Manager";

    public string ShortcutPath(string? desktop = null) => Path.Combine(desktop ??
        Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), ShortcutName);

    public ManagerResult Create(string executable, string workingDirectory, string? desktop = null)
    {
        var path = ShortcutPath(desktop);
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            if (File.Exists(path) && !IsOwned(path))
                return ManagerResult.Fail(ManagerErrorCodes.ShortcutCreateFailed, "Eine fremde gleichnamige Desktop-Verknüpfung bleibt unangetastet.");
            var shellType = Type.GetTypeFromProgID("WScript.Shell") ?? throw new InvalidOperationException("Windows Script Host ist nicht verfügbar.");
            dynamic shell = Activator.CreateInstance(shellType)!;
            dynamic shortcut = shell.CreateShortcut(path);
            shortcut.TargetPath = Path.GetFullPath(executable);
            shortcut.WorkingDirectory = Path.GetFullPath(workingDirectory);
            shortcut.Description = OwnershipDescription;
            shortcut.Save();
            return ManagerResult.Ok("shortcut_created", path);
        }
        catch (Exception exception) { return ManagerResult.Fail(ManagerErrorCodes.ShortcutCreateFailed, exception.Message); }
    }

    public ManagerResult Remove(string? desktop = null)
    {
        var path = ShortcutPath(desktop);
        try
        {
            if (!File.Exists(path)) return ManagerResult.Ok("shortcut_absent", "Verknüpfung ist nicht vorhanden.");
            if (!IsOwned(path)) return ManagerResult.Fail(ManagerErrorCodes.ShortcutRemoveFailed, "Fremde Verknüpfung wird nicht entfernt.");
            File.Delete(path);
            return ManagerResult.Ok("shortcut_removed", path);
        }
        catch (Exception exception) { return ManagerResult.Fail(ManagerErrorCodes.ShortcutRemoveFailed, exception.Message); }
    }

    public bool IsOwned(string path)
    {
        if (!File.Exists(path)) return false;
        try
        {
            var shellType = Type.GetTypeFromProgID("WScript.Shell")!;
            dynamic shell = Activator.CreateInstance(shellType)!;
            dynamic shortcut = shell.CreateShortcut(path);
            return string.Equals((string)shortcut.Description, OwnershipDescription, StringComparison.Ordinal);
        }
        catch { return false; }
    }
}

internal static class ManagerJson
{
    internal static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        WriteIndented = true
    };
}

public static class Hashing
{
    public static async Task<string> FileAsync(string path, CancellationToken cancellationToken = default)
    {
        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, FileOptions.Asynchronous);
        return Convert.ToHexString(await SHA256.HashDataAsync(stream, cancellationToken)).ToLowerInvariant();
    }
    public static string Bytes(ReadOnlySpan<byte> bytes) => Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
}

public sealed class TargetAppInspector(ManagerPaths managerPaths)
{
    public async Task<TargetCheckResult> CheckAsync(string selectedPath, CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        try
        {
            if (string.IsNullOrWhiteSpace(selectedPath)) return Fail(ManagerErrorCodes.TargetPathInvalid, "Zielpfad fehlt.", string.Empty, now);
            var selected = Path.GetFullPath(selectedPath);
            var root = File.Exists(selected) ? FindRoot(Path.GetDirectoryName(selected)!) : selected;
            if (!Directory.Exists(root)) return Fail(ManagerErrorCodes.TargetPathInvalid, "Zielpfad existiert nicht.", root, now);
            var unsafeReason = UnsafeRoot(root);
            if (unsafeReason is not null) return Fail(ManagerErrorCodes.TargetPathUnsafe, unsafeReason, root, now);
            if (ContainsReparsePoint(root)) return Fail(ManagerErrorCodes.TargetPathUnsafe, "Zielpfad enthält einen Reparse Point.", root, now);
            var manifestPath = Path.Combine(root, TargetContractValidator.ManifestFileName);
            if (!File.Exists(manifestPath)) return new(false, ManagerErrorCodes.TargetNotM78Compatible,
                "Kein M78-Opt-in-Manifest vorhanden; diese App benötigt M79.", root, manifestPath,
                TargetContractStatus.NotSuitable, null, null, false, now);
            await using var stream = new FileStream(manifestPath, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.Asynchronous);
            var manifest = await JsonSerializer.DeserializeAsync<TargetAppManifest>(stream, ManagerJson.Options, cancellationToken);
            var errors = TargetContractValidator.Validate(manifest);
            if (errors.Count > 0) return new(false, ManagerErrorCodes.TargetManifestInvalid, string.Join(" ", errors), root,
                manifestPath, TargetContractStatus.NotSuitable, manifest, null, false, now);
            var projectPath = ManagerPathRules.ResolveInside(root, manifest!.ProjectFile);
            if (!File.Exists(projectPath)) return new(false, ManagerErrorCodes.TargetProjectNotFound, "Deklarierte Projektdatei fehlt.",
                root, manifestPath, TargetContractStatus.NotSuitable, manifest, null, false, now);
            foreach (var path in manifest.ExpectedFiles) _ = ManagerPathRules.ResolveInside(root, path);
            var writable = await ProbeWritableAsync(root, manifest.IntegrationRoot, cancellationToken);
            if (!writable) return new(false, ManagerErrorCodes.TargetNotWritable, "Integrationsziel ist nicht beschreibbar.", root,
                manifestPath, TargetContractStatus.NotSuitable, manifest, null, false, now);
            var installation = await LoadInstallationAsync(root, cancellationToken);
            var registration = await LoadRegistrationAsync(root, cancellationToken);
            if (manifest.IntegrationMode == "registered-existing-wpf")
            {
                var registrationValidation = await ValidateRegistrationAsync(root, manifest, registration, cancellationToken);
                if (!registrationValidation.Success)
                    return new(false, registrationValidation.Code, registrationValidation.Message, root, manifestPath,
                        TargetContractStatus.RepairRequired, manifest, installation, true, now, registration);
            }
            var status = installation is null && registration is null ? TargetContractStatus.ReadyToInstall : TargetContractStatus.Installed;
            var contractMessage = manifest.IntegrationMode == "registered-existing-wpf"
                ? "M79-Registrierungsvertrag ist gültig."
                : "M78-Opt-in-Vertrag ist gültig.";
            return new(true, "target_contract_valid", contractMessage, root, manifestPath, status,
                manifest, installation, true, now, registration);
        }
        catch (JsonException exception) { return Fail(ManagerErrorCodes.TargetManifestInvalid, "Manifest ist beschädigt: " + exception.Message, selectedPath, now); }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or InvalidOperationException or ArgumentException)
        { return Fail(ManagerErrorCodes.TargetPathUnsafe, "Zielprüfung fehlgeschlagen: " + exception.Message, selectedPath, now); }
    }

    public async Task<InstallationState?> LoadInstallationAsync(string root, CancellationToken cancellationToken = default)
    {
        var path = Path.Combine(root, ".ui-editor-kit", "installation.json");
        if (!File.Exists(path)) return null;
        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.Asynchronous);
        return await JsonSerializer.DeserializeAsync<InstallationState>(stream, ManagerJson.Options, cancellationToken);
    }

    public async Task<ExistingAppRegistrationState?> LoadRegistrationAsync(string root, CancellationToken cancellationToken = default)
    {
        var path = Path.Combine(root, ".ui-editor-kit", "registration-installation.json");
        if (!File.Exists(path)) return null;
        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.Asynchronous);
        return await JsonSerializer.DeserializeAsync<ExistingAppRegistrationState>(stream, ManagerJson.Options, cancellationToken);
    }

    private static async Task<ManagerResult> ValidateRegistrationAsync(string root, TargetAppManifest manifest,
        ExistingAppRegistrationState? registration, CancellationToken cancellationToken)
    {
        if (registration is not { SchemaVersion: 1, Lifecycle: RegistrationLifecycle.Installed } ||
            registration.ApplicationId != manifest.ApplicationId)
            return ManagerResult.Fail(ManagerErrorCodes.RegistrationContractFailed,
                "M79-Installationsstatus fehlt, ist veraltet oder gehört zu einer anderen App.");
        if (registration.Files.Select(item => item.RelativePath).Distinct(StringComparer.Ordinal).Count() != registration.Files.Count)
            return ManagerResult.Fail(ManagerErrorCodes.RegistrationContractFailed, "M79-Ownershipstatus enthält doppelte Pfade.");
        foreach (var expected in manifest.ExpectedFiles)
            if (!File.Exists(ManagerPathRules.ResolveInside(root, expected)))
                return ManagerResult.Fail(ManagerErrorCodes.RegistrationContractFailed, "M79-Vertragsdatei fehlt: " + expected);
        foreach (var owned in registration.Files)
        {
            var path = ManagerPathRules.ResolveInside(root, owned.RelativePath);
            if (!File.Exists(path) || !string.Equals(await Hashing.FileAsync(path, cancellationToken), owned.InstalledHash,
                    StringComparison.OrdinalIgnoreCase))
                return ManagerResult.Fail(ManagerErrorCodes.RegistrationForeignChangeConflict,
                    "M79-eigene oder integrierte Datei wurde lokal verändert: " + owned.RelativePath);
        }
        var registryPath = ManagerPathRules.ResolveInside(root, ".ui-editor-kit/registration-registry.json");
        await using var stream = File.OpenRead(registryPath);
        var registry = await JsonSerializer.DeserializeAsync<GeneratedRegistrationRegistry>(stream, ManagerJson.Options, cancellationToken);
        if (registry is not { SchemaVersion: 1 } || registry.ApplicationId != manifest.ApplicationId ||
            registry.Fingerprint != registration.RegistryFingerprint || registry.Elements.Count == 0)
            return ManagerResult.Fail(ManagerErrorCodes.RegistrationContractFailed,
                "M79-Registry stimmt nicht mit Installationsstatus und Manifest überein.");
        return ManagerResult.Ok("registration_contract_valid", "M79-Manifest, Ownershipstatus und Registry sind unverändert gültig.");
    }

    private static async Task<bool> ProbeWritableAsync(string root, string integrationRoot, CancellationToken cancellationToken)
    {
        var directory = ManagerPathRules.ResolveInside(root, integrationRoot);
        Directory.CreateDirectory(directory);
        var probe = Path.Combine(directory, $".m78-write-probe-{Guid.NewGuid():N}.tmp");
        try { await File.WriteAllTextAsync(probe, string.Empty, cancellationToken); return true; }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { return false; }
        finally { try { if (File.Exists(probe)) File.Delete(probe); } catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { } }
    }

    private string? UnsafeRoot(string root)
    {
        var full = Path.TrimEndingDirectorySeparator(Path.GetFullPath(root));
        if (Path.GetPathRoot(full)?.TrimEnd('\\') == full.TrimEnd('\\')) return "Rootlaufwerke sind nicht erlaubt.";
        foreach (var blocked in new[] { Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                     Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                     Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), managerPaths.Root })
            if (!string.IsNullOrWhiteSpace(blocked) && (string.Equals(full, Path.TrimEndingDirectorySeparator(blocked), StringComparison.OrdinalIgnoreCase) ||
                ManagerPathRules.IsInside(blocked, full))) return "System-, Program-Files- oder Managerpfad ist nicht erlaubt.";
        return null;
    }

    private static bool ContainsReparsePoint(string root)
    {
        var current = new DirectoryInfo(Path.GetFullPath(root));
        while (current is not null)
        {
            if (current.Exists && current.Attributes.HasFlag(FileAttributes.ReparsePoint)) return true;
            current = current.Parent;
        }
        return false;
    }
    private static string FindRoot(string start)
    {
        var current = new DirectoryInfo(start);
        while (current is not null)
        {
            if (File.Exists(Path.Combine(current.FullName, TargetContractValidator.ManifestFileName))) return current.FullName;
            current = current.Parent;
        }
        return Path.GetFullPath(start);
    }
    private static TargetCheckResult Fail(string code, string message, string root, DateTimeOffset now) =>
        new(false, code, message, string.IsNullOrWhiteSpace(root) ? string.Empty : Path.GetFullPath(root),
            string.Empty, TargetContractStatus.NotSuitable, null, null, false, now);
}

public sealed class LocalPackageCatalog(string packageRoot)
{
    public string PackageRoot { get; } = Path.GetFullPath(packageRoot);
    public async Task<(IntegrationPackage? Package, ManagerResult Result)> LoadAsync(CancellationToken cancellationToken = default)
    {
        var manifestPath = Path.Combine(PackageRoot, "package.json");
        if (!File.Exists(manifestPath)) return (null, ManagerResult.Fail(ManagerErrorCodes.PackageNotFound, "Lokales Integrationspaket fehlt."));
        try
        {
            await using var stream = File.OpenRead(manifestPath);
            var package = await JsonSerializer.DeserializeAsync<IntegrationPackage>(stream, ManagerJson.Options, cancellationToken);
            if (package is null || package.SchemaVersion != 1 || package.ContractVersion != TargetContractValidator.ContractVersion || package.Files.Count == 0)
                return (package, ManagerResult.Fail(ManagerErrorCodes.PackageInvalid, "Paketmanifest ist ungültig."));
            foreach (var file in package.Files)
            {
                if (!ManagerPathRules.IsSafeRelativePath(file.RelativePath) || !ManagerPathRules.IsSafeRelativePath(file.SourcePath))
                    return (package, ManagerResult.Fail(ManagerErrorCodes.PackageInvalid, "Paketpfad ist unsicher."));
                var source = ManagerPathRules.ResolveInside(PackageRoot, file.SourcePath);
                if (!File.Exists(source) || !string.Equals(await Hashing.FileAsync(source, cancellationToken), file.Sha256, StringComparison.OrdinalIgnoreCase))
                    return (package, ManagerResult.Fail(ManagerErrorCodes.PackageIntegrityFailed, "Paketintegrität ist verletzt: " + file.SourcePath));
            }
            return (package, ManagerResult.Ok("package_valid", "Lokales Integrationspaket ist gültig."));
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)
        { return (null, ManagerResult.Fail(ManagerErrorCodes.PackageInvalid, "Paket konnte nicht gelesen werden: " + exception.Message)); }
    }
}

public interface IManagerFaultInjector { void BeforeFileWrite(int index, string relativePath); }

public sealed class TargetInstallationService(ManagerPaths managerPaths, TargetAppInspector inspector, LocalPackageCatalog catalog)
{
    private readonly SemaphoreSlim operationLock = new(1, 1);
    public async Task<(InstallationPlan? Plan, TargetCheckResult Check, ManagerResult Result)> PreviewAsync(string selectedPath,
        CancellationToken cancellationToken = default)
    {
        var check = await inspector.CheckAsync(selectedPath, cancellationToken);
        if (!check.Success || check.Manifest is null) return (null, check, ManagerResult.Fail(check.Code, check.Message));
        var loaded = await catalog.LoadAsync(cancellationToken);
        if (loaded.Package is null || !loaded.Result.Success) return (null, check, loaded.Result);
        var hashes = await CurrentHashesAsync(check.TargetRoot, loaded.Package, check.Installation, cancellationToken);
        var plan = InstallationPlanner.Create(check.Manifest, check.TargetRoot, loaded.Package, hashes, check.Installation, DateTimeOffset.UtcNow);
        return (plan, check, plan.CanExecute ? ManagerResult.Ok("install_preview_ready", "Installationsvorschau ist aktuell.") :
            ManagerResult.Fail(ManagerErrorCodes.ForeignFileConflict, string.Join(" ", plan.Blockers)));
    }

    public async Task<ManagerResult> ExecuteAsync(InstallationPlan plan, bool confirmed, IManagerFaultInjector? fault = null,
        CancellationToken cancellationToken = default)
    {
        if (!confirmed) return ManagerResult.Fail(ManagerErrorCodes.InstallPreviewStale, "Installation wurde nicht ausdrücklich bestätigt.");
        if (!await operationLock.WaitAsync(0, cancellationToken)) return ManagerResult.Fail(ManagerErrorCodes.InstallFailed, "Für diese Managerinstanz läuft bereits eine Transaktion.");
        var transactionId = Guid.NewGuid().ToString("N");
        var transactionRoot = Path.Combine(managerPaths.Backups, transactionId);
        var changed = new List<(string Path, string? Backup, bool Created)>();
        try
        {
            var fresh = await PreviewAsync(plan.TargetRoot, cancellationToken);
            if (fresh.Plan is null || fresh.Plan.PreviewId != plan.PreviewId || !fresh.Plan.CanExecute)
                return ManagerResult.Fail(ManagerErrorCodes.InstallPreviewStale, "Installationsvorschau ist veraltet.", transactionId);
            var loaded = await catalog.LoadAsync(cancellationToken);
            if (loaded.Package is null || !loaded.Result.Success) return loaded.Result with { TransactionId = transactionId };
            Directory.CreateDirectory(transactionRoot);
            var affected = new List<string>();
            var index = 0;
            foreach (var item in plan.Files.Where(item => item.Action is InstallationAction.Create or InstallationAction.Update))
            {
                cancellationToken.ThrowIfCancellationRequested();
                fault?.BeforeFileWrite(index++, item.RelativePath);
                var packageFile = loaded.Package.Files.Single(file => file.RelativePath == item.RelativePath);
                var source = ManagerPathRules.ResolveInside(catalog.PackageRoot, packageFile.SourcePath);
                var target = ManagerPathRules.ResolveInside(plan.TargetRoot, item.RelativePath);
                Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                string? backup = null;
                if (File.Exists(target))
                {
                    backup = Path.Combine(transactionRoot, item.RelativePath.Replace('/', Path.DirectorySeparatorChar));
                    Directory.CreateDirectory(Path.GetDirectoryName(backup)!);
                    File.Copy(target, backup, true);
                }
                changed.Add((target, backup, backup is null));
                await AtomicCopyAsync(source, target, cancellationToken);
                affected.Add(item.RelativePath);
            }
            foreach (var item in plan.Files.Where(item => item.Action == InstallationAction.Remove && item.Exists))
            {
                cancellationToken.ThrowIfCancellationRequested();
                fault?.BeforeFileWrite(index++, item.RelativePath);
                var target = ManagerPathRules.ResolveInside(plan.TargetRoot, item.RelativePath);
                var backup = Path.Combine(transactionRoot, item.RelativePath.Replace('/', Path.DirectorySeparatorChar));
                Directory.CreateDirectory(Path.GetDirectoryName(backup)!);
                File.Copy(target, backup, true);
                changed.Add((target, backup, false));
                File.Delete(target);
                affected.Add(item.RelativePath);
            }
            var state = new InstallationState(1, plan.ApplicationId, Guid.NewGuid().ToString("N"), plan.PackageVersion,
                plan.ContractVersion, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow,
                loaded.Package.Files.Select(file => new InstallationFileState(file.RelativePath, file.Sha256, file.Sha256, "ui-editor-kit-manager", null)).ToArray(),
                [], fresh.Check.Manifest!.TargetStart, fresh.Check.Manifest.EditorStart);
            var statePath = Path.Combine(plan.TargetRoot, ".ui-editor-kit", "installation.json");
            string? stateBackup = null;
            if (File.Exists(statePath))
            {
                stateBackup = Path.Combine(transactionRoot, ".ui-editor-kit", "installation.json");
                Directory.CreateDirectory(Path.GetDirectoryName(stateBackup)!);
                File.Copy(statePath, stateBackup, true);
            }
            changed.Add((statePath, stateBackup, stateBackup is null));
            await AtomicJsonAsync(statePath, state, cancellationToken);
            affected.Add(".ui-editor-kit/installation.json");
            var contractCheck = await inspector.CheckAsync(plan.TargetRoot, cancellationToken);
            if (!contractCheck.Success || contractCheck.Installation?.InstalledPackageVersion != plan.PackageVersion)
                throw new InvalidOperationException("Vertragscheck nach Installation ist fehlgeschlagen.");
            Directory.Delete(transactionRoot, true);
            return ManagerResult.Ok("install_completed", "Ziel-App-Integration wurde vollständig installiert.", transactionId, affected);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or InvalidOperationException or OperationCanceledException)
        {
            var rollback = Rollback(changed);
            return ManagerResult.Fail(rollback ? ManagerErrorCodes.InstallFailed : ManagerErrorCodes.InstallRollbackFailed,
                "Installation fehlgeschlagen: " + exception.Message, transactionId, rollback, changed.Select(item => Path.GetRelativePath(plan.TargetRoot, item.Path)).ToArray());
        }
        finally { try { if (Directory.Exists(transactionRoot)) Directory.Delete(transactionRoot, true); } catch { } operationLock.Release(); }
    }

    public async Task<(InstallationPlan? Plan, ManagerResult Result)> UninstallPreviewAsync(string targetRoot,
        CancellationToken cancellationToken = default)
    {
        var check = await inspector.CheckAsync(targetRoot, cancellationToken);
        if (check.Installation is null) return (null, ManagerResult.Fail(ManagerErrorCodes.UninstallConflict, "Keine Managerinstallation gefunden."));
        var files = new List<PlanFile>();
        var blockers = new List<string>();
        foreach (var owned in check.Installation.Files)
        {
            var path = ManagerPathRules.ResolveInside(targetRoot, owned.RelativePath);
            var hash = File.Exists(path) ? await Hashing.FileAsync(path, cancellationToken) : null;
            var conflict = hash is not null && !string.Equals(hash, owned.InstalledHash, StringComparison.OrdinalIgnoreCase) ? "Eigene Datei wurde lokal geändert." : null;
            if (conflict is not null) blockers.Add(owned.RelativePath + ": " + conflict);
            files.Add(new(owned.RelativePath, conflict is null ? InstallationAction.Remove : InstallationAction.Conflict,
                hash is not null, true, hash, null, conflict, hash is not null));
        }
        var preview = InstallationPlanner.PreviewId(check.Manifest!.ApplicationId, targetRoot, check.Installation.InstalledPackageVersion, files);
        return (new(check.Manifest.ApplicationId, targetRoot, check.Manifest.ProjectFile, check.Installation.InstalledPackageVersion,
            check.Installation.ContractVersion, preview, DateTimeOffset.UtcNow, files, ["UI-/PDF-Profile bleiben erhalten."], blockers),
            blockers.Count == 0 ? ManagerResult.Ok("uninstall_preview_ready", "Deinstallationsvorschau ist aktuell.") :
                ManagerResult.Fail(ManagerErrorCodes.UninstallConflict, string.Join(" ", blockers)));
    }

    public async Task<ManagerResult> UninstallAsync(InstallationPlan plan, bool confirmed, CancellationToken cancellationToken = default)
    {
        if (!confirmed) return ManagerResult.Fail(ManagerErrorCodes.InstallPreviewStale, "Deinstallation wurde nicht bestätigt.");
        if (!await operationLock.WaitAsync(0, cancellationToken)) return ManagerResult.Fail(ManagerErrorCodes.UninstallFailed, "Transaktion läuft bereits.");
        var transactionId = Guid.NewGuid().ToString("N");
        var backupRoot = Path.Combine(managerPaths.Backups, transactionId);
        var moved = new List<(string Original, string Backup)>();
        try
        {
            var fresh = await UninstallPreviewAsync(plan.TargetRoot, cancellationToken);
            if (fresh.Plan is null || fresh.Plan.PreviewId != plan.PreviewId || !fresh.Plan.CanExecute)
                return ManagerResult.Fail(ManagerErrorCodes.InstallPreviewStale, "Deinstallationsvorschau ist veraltet.", transactionId);
            foreach (var item in plan.Files.Where(item => item.Action == InstallationAction.Remove && item.Exists))
            {
                var source = ManagerPathRules.ResolveInside(plan.TargetRoot, item.RelativePath);
                var backup = Path.Combine(backupRoot, item.RelativePath.Replace('/', Path.DirectorySeparatorChar));
                Directory.CreateDirectory(Path.GetDirectoryName(backup)!);
                File.Move(source, backup);
                moved.Add((source, backup));
            }
            var state = Path.Combine(plan.TargetRoot, ".ui-editor-kit", "installation.json");
            if (File.Exists(state))
            {
                var backup = Path.Combine(backupRoot, "installation.json");
                Directory.CreateDirectory(backupRoot);
                File.Move(state, backup);
                moved.Add((state, backup));
            }
            foreach (var directory in moved.Select(item => Path.GetDirectoryName(item.Original)!).Distinct().OrderByDescending(path => path.Length))
                if (Directory.Exists(directory) && !Directory.EnumerateFileSystemEntries(directory).Any()) Directory.Delete(directory);
            Directory.Delete(backupRoot, true);
            return ManagerResult.Ok("uninstall_completed", "Nur Managerdateien wurden entfernt; Profile bleiben erhalten.", transactionId,
                moved.Select(item => Path.GetRelativePath(plan.TargetRoot, item.Original)).ToArray());
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or InvalidOperationException)
        {
            var rollback = RollbackMoves(moved);
            return ManagerResult.Fail(rollback ? ManagerErrorCodes.UninstallFailed : ManagerErrorCodes.UninstallRollbackFailed,
                "Deinstallation fehlgeschlagen: " + exception.Message, transactionId, rollback);
        }
        finally { try { if (Directory.Exists(backupRoot)) Directory.Delete(backupRoot, true); } catch { } operationLock.Release(); }
    }

    private static async Task<IReadOnlyDictionary<string, string>> CurrentHashesAsync(string root, IntegrationPackage package, InstallationState? installed, CancellationToken token)
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var relativePath in package.Files.Select(file => file.RelativePath)
                     .Concat(installed?.Files.Select(file => file.RelativePath) ?? []).Distinct(StringComparer.Ordinal))
        {
            var path = ManagerPathRules.ResolveInside(root, relativePath);
            if (File.Exists(path)) result[relativePath] = await Hashing.FileAsync(path, token);
        }
        return result;
    }
    private static async Task AtomicCopyAsync(string source, string target, CancellationToken token)
    {
        var temp = target + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await using (var input = new FileStream(source, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, FileOptions.Asynchronous))
            await using (var output = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, FileOptions.Asynchronous | FileOptions.WriteThrough))
            { await input.CopyToAsync(output, token); await output.FlushAsync(token); output.Flush(true); }
            if (File.Exists(target)) File.Replace(temp, target, null, true); else File.Move(temp, target);
        }
        finally { try { if (File.Exists(temp)) File.Delete(temp); } catch { } }
    }
    private static async Task AtomicJsonAsync<T>(string target, T value, CancellationToken token)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
        var temp = target + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, FileOptions.Asynchronous | FileOptions.WriteThrough))
            { await JsonSerializer.SerializeAsync(stream, value, ManagerJson.Options, token); await stream.FlushAsync(token); stream.Flush(true); }
            if (File.Exists(target)) File.Replace(temp, target, null, true); else File.Move(temp, target);
        }
        finally { try { if (File.Exists(temp)) File.Delete(temp); } catch { } }
    }
    private static bool Rollback(IEnumerable<(string Path, string? Backup, bool Created)> changes)
    {
        var success = true;
        foreach (var change in changes.Reverse()) try
        { if (change.Backup is not null && File.Exists(change.Backup)) File.Copy(change.Backup, change.Path, true); else if (change.Created && File.Exists(change.Path)) File.Delete(change.Path); }
        catch { success = false; }
        return success;
    }
    private static bool RollbackMoves(IEnumerable<(string Original, string Backup)> moves)
    {
        var success = true;
        foreach (var move in moves.Reverse()) try { if (File.Exists(move.Backup)) { Directory.CreateDirectory(Path.GetDirectoryName(move.Original)!); File.Move(move.Backup, move.Original, true); } } catch { success = false; }
        return success;
    }
}
