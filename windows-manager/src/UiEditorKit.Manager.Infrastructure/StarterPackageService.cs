using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Diagnostics;
using UiEditorKit.Manager.Core;
using UiEditorKit.Manager.Domain;

namespace UiEditorKit.Manager.Infrastructure;

public sealed class StarterPackageCatalog(string packageRoot)
{
    private readonly string root = Path.GetFullPath(packageRoot);

    public async Task<(StarterPackageManifest? Package, ManagerResult Result)> LoadAsync(CancellationToken cancellationToken = default)
    {
        var manifestPath = Path.Combine(root, "starter-package.json");
        if (!File.Exists(manifestPath)) return (null, ManagerResult.Fail(ManagerErrorCodes.PackageNotFound, "App-Starterpaket fehlt."));
        try
        {
            await using var stream = File.OpenRead(manifestPath);
            var package = await JsonSerializer.DeserializeAsync<StarterPackageManifest>(stream, StrictJson, cancellationToken);
            if (package is null || package.SchemaVersion != 1 || package.ProductName != StarterTargetContract.ProductName ||
                string.IsNullOrWhiteSpace(package.PackageVersion) || package.ContractVersion != StarterTargetContract.ContractVersion ||
                !StarterFrameworks.Supported.SetEquals(package.SupportedFrameworks))
                return (null, ManagerResult.Fail(ManagerErrorCodes.StarterPackageInvalid, "App-Starterpaketmanifest ist ungueltig."));
            foreach (var file in package.Files)
            {
                if (!ManagerPathRules.IsSafeRelativePath(file.RelativePath) || !ManagerPathRules.IsSafeRelativePath(file.SourcePath))
                    return (null, ManagerResult.Fail(ManagerErrorCodes.StarterPackageInvalid, "App-Starterpaket enthaelt einen unsicheren Pfad."));
                var source = ManagerPathRules.ResolveInside(root, file.SourcePath);
                // Git may materialize the text-only starter payload with CRLF on
                // Windows although the versioned package hash uses canonical LF.
                if (!File.Exists(source) || !string.Equals(await Hashing.NormalizedTextFileAsync(source, cancellationToken), file.Sha256, StringComparison.OrdinalIgnoreCase))
                    return (null, ManagerResult.Fail(ManagerErrorCodes.PackageIntegrityFailed, "App-Starterpaket wurde veraendert: " + file.SourcePath));
            }
            return (package, ManagerResult.Ok("starter_package_valid", $"App-Starterpaket {package.PackageVersion} ist vollstaendig."));
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException or InvalidOperationException)
        {
            return (null, ManagerResult.Fail(ManagerErrorCodes.StarterPackageInvalid, "App-Starterpaket konnte nicht gelesen werden: " + exception.Message));
        }
    }

    public string ResolveSource(StarterPackageFile file) => ManagerPathRules.ResolveInside(root, file.SourcePath);

    private static JsonSerializerOptions StrictJson => new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };
}

public interface IStarterFaultInjector
{
    void BeforeWrite(int index, string relativePath);
}

public interface IStarterInstallationVerifier
{
    Task<ManagerResult> VerifyAsync(string targetRoot, StarterPreparationRequest request, CancellationToken cancellationToken = default);
}

public sealed class StarterInstallationVerifier : IStarterInstallationVerifier
{
    public async Task<ManagerResult> VerifyAsync(string targetRoot, StarterPreparationRequest request, CancellationToken cancellationToken = default)
    {
        if (request.Framework == StarterFrameworks.Wpf)
        {
            var project = Directory.EnumerateFiles(targetRoot, "*.csproj", SearchOption.AllDirectories).FirstOrDefault();
            if (project is null) return ManagerResult.Fail(ManagerErrorCodes.StarterSourceMissing, "WPF-Projektdatei fuer den Build fehlt.");
            return await RunAsync("dotnet", targetRoot, ["build", project, "--nologo"], "WPF-Build", cancellationToken);
        }
        var contractCheck = Path.Combine(targetRoot, ".ui-editor-kit", "starter", "electron", "target-contract-check.cjs");
        if (File.Exists(contractCheck))
            return await RunAsync("node", targetRoot, ["-e", "require('./.ui-editor-kit/starter/electron/target-contract-check.cjs').check()"], "Electron-Vertragscheck", cancellationToken);
        var bbmCheck = Path.Combine(targetRoot, "scripts", "tests", "m82AppStarterPackage.test.cjs");
        if (File.Exists(bbmCheck))
            return await RunAsync("node", targetRoot, ["scripts/tests/m82AppStarterPackage.test.cjs"], "BBM-M82-Vertragscheck", cancellationToken);
        return ManagerResult.Fail(ManagerErrorCodes.ContractCheckFailed, "Electron-Vertragscheck fehlt.");
    }

    private static async Task<ManagerResult> RunAsync(string fileName, string workingDirectory, IReadOnlyList<string> arguments,
        string label, CancellationToken cancellationToken)
    {
        var start = new ProcessStartInfo(fileName)
        {
            WorkingDirectory = workingDirectory,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };
        foreach (var argument in arguments) start.ArgumentList.Add(argument);
        try
        {
            using var process = Process.Start(start) ?? throw new InvalidOperationException(label + " konnte nicht gestartet werden.");
            var standardOutput = process.StandardOutput.ReadToEndAsync(cancellationToken);
            var standardError = process.StandardError.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken);
            var output = (await standardOutput + Environment.NewLine + await standardError).Trim();
            return process.ExitCode == 0
                ? ManagerResult.Ok("starter_post_install_valid", label + " ist gruen.")
                : ManagerResult.Fail(ManagerErrorCodes.ContractCheckFailed, label + " ist fehlgeschlagen: " + output);
        }
        catch (Exception exception) when (exception is InvalidOperationException or System.ComponentModel.Win32Exception)
        {
            return ManagerResult.Fail(ManagerErrorCodes.ContractCheckFailed, label + " konnte nicht ausgefuehrt werden: " + exception.Message);
        }
    }
}

public sealed class StarterPackageService(
    StarterPackageCatalog catalog,
    GitSafetyInspector? gitInspector = null,
    IStarterInstallationVerifier? installationVerifier = null)
{
    private readonly GitSafetyInspector gitInspector = gitInspector ?? new();
    private readonly IStarterInstallationVerifier installationVerifier = installationVerifier ?? new StarterInstallationVerifier();
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    public async Task<(StarterInstallationPlan? Plan, ManagerResult Result)> PreviewAsync(
        StarterPreparationRequest request, CancellationToken cancellationToken = default)
    {
        var validation = ValidateRequest(request);
        if (!validation.Success) return (null, validation);
        var loaded = await catalog.LoadAsync(cancellationToken);
        if (loaded.Package is null) return (null, loaded.Result);
        var root = Path.GetFullPath(request.TargetRoot);
        var equivalent = HasEquivalentExistingIntegration(root, request.Framework);
        var selected = loaded.Package.Files.Where(file =>
            (file.Framework == "all" || file.Framework == request.Framework) &&
            (file.IntegrationMode == "all" || file.IntegrationMode == request.IntegrationMode) &&
            !(equivalent && request.IntegrationMode == StarterIntegrationModes.ExistingApp)).ToArray();
        var state = await LoadStateAsync(root, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var installedAt = state?.InstalledAt ?? now;
        var manifest = await CreateManifestAsync(request, loaded.Package.PackageVersion, selected, equivalent, installedAt, now, cancellationToken);
        var content = new List<(string RelativePath, byte[] Bytes, bool PreserveOnUpdate, bool PreserveOnUninstall)>();
        foreach (var file in selected)
            content.Add((file.RelativePath, await File.ReadAllBytesAsync(catalog.ResolveSource(file), cancellationToken), file.PreserveOnUpdate, file.PreserveOnUninstall));
        var manifestBytes = JsonSerializer.SerializeToUtf8Bytes(manifest, JsonOptions);
        content.Add((StarterTargetContract.ManifestFileName, manifestBytes, false, false));
        var plannedOwned = content.Select(item => new StarterOwnedFile(item.RelativePath, Hashing.Bytes(item.Bytes), item.PreserveOnUninstall)).ToArray();
        var nextState = new StarterInstallationState(1, StarterTargetContract.ProductName, request.ApplicationId, request.Framework,
            request.IntegrationMode, loaded.Package.PackageVersion, installedAt, now, plannedOwned.Append(
                new StarterOwnedFile(StarterTargetContract.OwnershipFileName, string.Empty, false)).ToArray());
        var stateBytes = JsonSerializer.SerializeToUtf8Bytes(nextState, JsonOptions);
        content.Add((StarterTargetContract.OwnershipFileName, stateBytes, false, false));

        var files = new List<StarterPlanFile>();
        var blockers = new List<string>();
        foreach (var item in content.OrderBy(item => item.RelativePath, StringComparer.Ordinal))
        {
            var path = ManagerPathRules.ResolveInside(root, item.RelativePath);
            var exists = File.Exists(path);
            var oldBytes = exists ? await File.ReadAllBytesAsync(path, cancellationToken) : null;
            var oldHash = oldBytes is null ? null : Hashing.Bytes(oldBytes);
            var newHash = Hashing.Bytes(item.Bytes);
            var trackedMutableManifest = item.RelativePath == StarterTargetContract.ManifestFileName &&
                state?.Files.Any(file => file.RelativePath == item.RelativePath) == true;
            var owned = trackedMutableManifest || item.RelativePath == StarterTargetContract.OwnershipFileName && state is not null ||
                        state?.Files.Any(file => file.RelativePath == item.RelativePath &&
                            string.Equals(file.InstalledHash, oldHash, StringComparison.OrdinalIgnoreCase)) == true;
            var preserveChanged = item.PreserveOnUpdate && exists && !string.Equals(oldHash, newHash, StringComparison.OrdinalIgnoreCase);
            var conflict = exists && !owned && !string.Equals(oldHash, newHash, StringComparison.OrdinalIgnoreCase)
                ? preserveChanged ? null : "Vorhandene Fremddatei ist nicht Eigentum des App-Starterpakets."
                : null;
            var action = !exists ? InstallationAction.Create : string.Equals(oldHash, newHash, StringComparison.OrdinalIgnoreCase) || preserveChanged
                ? InstallationAction.Unchanged : conflict is null ? InstallationAction.Update : InstallationAction.Conflict;
            if (conflict is not null) blockers.Add(item.RelativePath + ": " + conflict);
            files.Add(new(item.RelativePath, action, owned, oldHash, newHash,
                oldBytes is null || action is InstallationAction.Unchanged ? null : ExactTextDiff.Create(item.RelativePath, oldBytes, item.Bytes),
                conflict, action == InstallationAction.Update, item.PreserveOnUninstall));
        }
        var affected = files.Where(file => file.Action is InstallationAction.Create or InstallationAction.Update).Select(file => file.RelativePath).ToArray();
        var git = await gitInspector.CheckAsync(root, affected, cancellationToken);
        if (!git.Safe) blockers.Add(ManagerErrorCodes.RegistrationGitDirtyConflict + ": " + git.Message);
        var previewId = StarterTargetContract.PreviewId(root, loaded.Package.PackageVersion, files);
        var warnings = new List<string>();
        if (!git.IsRepository) warnings.Add("Kein Git-Repository; transaktionales Byte-Backup bleibt aktiv.");
        if (equivalent) warnings.Add(ManagerErrorCodes.StarterAlreadyIntegrated + ": vorhandene Integration wird uebernommen; keine zweite Bridge oder Registry wird installiert.");
        return (new(previewId, root, loaded.Package.PackageVersion, now, request, files, git.IsRepository, git.Safe, git.Message, warnings, blockers),
            blockers.Count == 0 ? ManagerResult.Ok("starter_preview_ready", "Vollstaendige App-Starterpaket-Vorschau ist bereit.") :
                ManagerResult.Fail(ManagerErrorCodes.ForeignFileConflict, "App-Starterpaket-Vorschau enthaelt Konflikte."));
    }

    public async Task<ManagerResult> InstallOrUpdateAsync(StarterInstallationPlan plan, bool confirmed,
        IStarterFaultInjector? faultInjector = null, CancellationToken cancellationToken = default)
    {
        if (!confirmed) return ManagerResult.Fail(ManagerErrorCodes.StarterPreviewStale, "Installation benoetigt ausdrueckliche Bestaetigung.");
        if (!plan.CanExecute || !await MatchesPreviewAsync(plan, cancellationToken))
            return ManagerResult.Fail(ManagerErrorCodes.StarterPreviewStale, "App-Starterpaket-Vorschau ist veraltet oder blockiert.");
        var loaded = await catalog.LoadAsync(cancellationToken);
        if (loaded.Package is null) return loaded.Result;
        var writePlan = plan;
        var selected = loaded.Package.Files.Where(file =>
            (file.Framework == "all" || file.Framework == plan.Request.Framework) &&
            (file.IntegrationMode == "all" || file.IntegrationMode == plan.Request.IntegrationMode) &&
            writePlan.Files.Any(item => item.RelativePath == file.RelativePath && item.Action != InstallationAction.Unchanged)).ToDictionary(file => file.RelativePath, StringComparer.Ordinal);
        var backups = new Dictionary<string, byte[]?>(StringComparer.Ordinal);
        var changed = new List<string>();
        try
        {
            for (var index = 0; index < writePlan.Files.Count; index++)
            {
                var file = writePlan.Files[index];
                if (file.Action is not (InstallationAction.Create or InstallationAction.Update)) continue;
                faultInjector?.BeforeWrite(index, file.RelativePath);
                var target = ManagerPathRules.ResolveInside(writePlan.TargetRoot, file.RelativePath);
                backups[file.RelativePath] = File.Exists(target) ? await File.ReadAllBytesAsync(target, cancellationToken) : null;
                byte[] bytes;
                if (file.RelativePath == StarterTargetContract.ManifestFileName)
                    bytes = await ManifestBytesFromPlanAsync(writePlan, cancellationToken);
                else if (file.RelativePath == StarterTargetContract.OwnershipFileName)
                    bytes = await StateBytesFromPlanAsync(writePlan, cancellationToken);
                else bytes = await File.ReadAllBytesAsync(catalog.ResolveSource(selected[file.RelativePath]), cancellationToken);
                await AtomicWriteAsync(target, bytes, cancellationToken);
                changed.Add(file.RelativePath);
            }
            var status = await InspectAsync(writePlan.TargetRoot, cancellationToken);
            if (status.ContractStatus != "valid") throw new InvalidOperationException("Vertragscheck nach Installation ist fehlgeschlagen.");
            var verification = await installationVerifier.VerifyAsync(writePlan.TargetRoot, writePlan.Request, cancellationToken);
            if (!verification.Success) throw new InvalidOperationException(verification.Message);
            return ManagerResult.Ok("starter_install_complete", "App-Starterpaket wurde transaktional installiert oder aktualisiert.", Guid.NewGuid().ToString("N"), changed);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or InvalidOperationException or JsonException)
        {
            var rollback = await RollbackAsync(writePlan.TargetRoot, backups, cancellationToken);
            return ManagerResult.Fail(rollback ? ManagerErrorCodes.StarterInstallFailed : ManagerErrorCodes.StarterRollbackFailed,
                "App-Starterpaket-Installation fehlgeschlagen: " + exception.Message, null, rollback, changed);
        }
    }

    public async Task<(StarterInstallationPlan? Plan, ManagerResult Result)> UninstallPreviewAsync(string targetRoot,
        CancellationToken cancellationToken = default)
    {
        var root = Path.GetFullPath(targetRoot);
        var state = await LoadStateAsync(root, cancellationToken);
        var manifest = await LoadManifestAsync(root, cancellationToken);
        if (state is null || manifest is null) return (null, ManagerResult.Fail(ManagerErrorCodes.TargetManifestNotFound, "App-Starterpaket ist nicht installiert."));
        var files = new List<StarterPlanFile>(); var blockers = new List<string>();
        foreach (var owned in state.Files.OrderBy(item => item.RelativePath, StringComparer.Ordinal))
        {
            var path = ManagerPathRules.ResolveInside(root, owned.RelativePath);
            if (!File.Exists(path)) { files.Add(new(owned.RelativePath, InstallationAction.Unchanged, true, null, null, null, null, false, owned.PreserveOnUninstall)); continue; }
            var current = await Hashing.FileAsync(path, cancellationToken);
            var preserve = owned.PreserveOnUninstall;
            var exact = owned.RelativePath == StarterTargetContract.OwnershipFileName || string.IsNullOrEmpty(owned.InstalledHash) ||
                        string.Equals(current, owned.InstalledHash, StringComparison.OrdinalIgnoreCase);
            var conflict = !preserve && !exact ? "Eigene Datei wurde lokal geaendert." : null;
            if (conflict is not null) blockers.Add(owned.RelativePath + ": " + conflict);
            files.Add(new(owned.RelativePath, preserve ? InstallationAction.Unchanged : exact ? InstallationAction.Remove : InstallationAction.Conflict,
                true, current, null, null, conflict, false, preserve));
        }
        var request = new StarterPreparationRequest(root, manifest.DisplayName, manifest.ApplicationId, manifest.Framework, manifest.IntegrationMode,
            manifest.UiCapability != "unavailable", manifest.PdfCapability != "unavailable", manifest.ProfileRoot);
        var preview = new StarterInstallationPlan(StarterTargetContract.PreviewId(root, state.InstalledPackageVersion, files), root,
            state.InstalledPackageVersion, DateTimeOffset.UtcNow, request, files, false, true, "Deinstallation aendert nur exakt eigene Dateien.", [], blockers);
        return (preview, blockers.Count == 0 ? ManagerResult.Ok("starter_uninstall_preview_ready", "Deinstallationsvorschau ist bereit.") :
            ManagerResult.Fail(ManagerErrorCodes.StarterUninstallConflict, "Deinstallation ist wegen lokaler Aenderungen blockiert."));
    }

    public async Task<ManagerResult> UninstallAsync(StarterInstallationPlan plan, bool confirmed,
        CancellationToken cancellationToken = default)
    {
        if (!confirmed) return ManagerResult.Fail(ManagerErrorCodes.StarterPreviewStale, "Deinstallation benoetigt ausdrueckliche Bestaetigung.");
        if (!plan.CanExecute || !await MatchesPreviewAsync(plan, cancellationToken))
            return ManagerResult.Fail(ManagerErrorCodes.StarterPreviewStale, "Deinstallationsvorschau ist veraltet.");
        var backups = new Dictionary<string, byte[]?>(StringComparer.Ordinal); var changed = new List<string>();
        try
        {
            foreach (var file in plan.Files.Where(item => item.Action == InstallationAction.Remove))
            {
                var path = ManagerPathRules.ResolveInside(plan.TargetRoot, file.RelativePath);
                backups[file.RelativePath] = await File.ReadAllBytesAsync(path, cancellationToken);
                File.Delete(path); changed.Add(file.RelativePath);
            }
            return ManagerResult.Ok("starter_uninstall_complete", "Nur eindeutig eigene App-Starterpaket-Dateien wurden entfernt; Profile und Ziel-App-Gerueste bleiben erhalten.", null, changed);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            var rollback = await RollbackAsync(plan.TargetRoot, backups, cancellationToken);
            return ManagerResult.Fail(ManagerErrorCodes.UninstallFailed, "Deinstallation fehlgeschlagen: " + exception.Message, null, rollback, changed);
        }
    }

    public async Task<StarterTargetStatus> InspectAsync(string targetRoot, CancellationToken cancellationToken = default)
    {
        var root = Path.GetFullPath(targetRoot);
        var loaded = await catalog.LoadAsync(cancellationToken);
        var available = loaded.Package?.PackageVersion ?? "nicht verfuegbar";
        var manifest = await LoadManifestAsync(root, cancellationToken);
        var state = await LoadStateAsync(root, cancellationToken);
        var framework = manifest?.Framework ?? DetectFramework(root);
        var git = await gitInspector.CheckAsync(root, [], cancellationToken);
        var writable = IsWritable(root);
        var errors = StarterTargetContract.Validate(manifest);
        var equivalent = HasEquivalentExistingIntegration(root, framework);
        var adapterStatus = equivalent ? "vorhanden" : manifest is null ? "fehlt" : "Geruest vorhanden";
        var next = manifest is null ? "App-Starterpaket installieren" : errors.Count > 0 ? "Vertrag reparieren" :
            manifest.RegistryStatus is StarterRegistryStatuses.Development ? "Erste UI nach Definition of Done registrieren" :
            manifest.RegistryStatus is StarterRegistryStatuses.RegistrationRequired ? "Bestandsregistrierung starten" :
            manifest.RegistryStatus == StarterRegistryStatuses.Complete ? "UI-/PDF-Editor kann geoeffnet werden" : "Unvollstaendige Scopes vervollstaendigen";
        return new(root, manifest?.DisplayName ?? Path.GetFileName(root), framework,
            manifest?.IntegrationMode ?? "nicht installiert", adapterStatus, errors.Count == 0 ? "valid" : manifest is null ? "missing" : "invalid",
            manifest?.RegistryStatus ?? "notInstalled", manifest?.RegistryVersion ?? 0, manifest?.RegistryFingerprint ?? string.Empty,
            manifest?.UiCapability ?? "unavailable", manifest?.PdfCapability ?? "unavailable", state?.InstalledPackageVersion,
            available, git.IsRepository, git.Safe, writable, next, manifest?.Scopes ?? [], manifest);
    }

    public async Task<StarterTargetManifest?> LoadManifestAsync(string targetRoot, CancellationToken cancellationToken = default)
    {
        var path = Path.Combine(Path.GetFullPath(targetRoot), StarterTargetContract.ManifestFileName);
        if (!File.Exists(path)) return null;
        try
        {
            await using var stream = File.OpenRead(path);
            return await JsonSerializer.DeserializeAsync<StarterTargetManifest>(stream, JsonOptions, cancellationToken);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException) { return null; }
    }

    public async Task<StarterInstallationState?> LoadStateAsync(string targetRoot, CancellationToken cancellationToken = default)
    {
        var path = Path.Combine(Path.GetFullPath(targetRoot), StarterTargetContract.OwnershipFileName.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(path)) return null;
        try
        {
            await using var stream = File.OpenRead(path);
            return await JsonSerializer.DeserializeAsync<StarterInstallationState>(stream, JsonOptions, cancellationToken);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException) { return null; }
    }

    private static ManagerResult ValidateRequest(StarterPreparationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.TargetRoot) || !Directory.Exists(request.TargetRoot))
            return ManagerResult.Fail(ManagerErrorCodes.TargetPathInvalid, "Projektordner existiert nicht.");
        if (!StarterFrameworks.Supported.Contains(request.Framework))
            return ManagerResult.Fail(ManagerErrorCodes.StarterFrameworkUnsupported, "Unterstuetzt werden ausschliesslich WPF und Electron.");
        if (request.IntegrationMode is not (StarterIntegrationModes.NewApp or StarterIntegrationModes.ExistingApp))
            return ManagerResult.Fail(ManagerErrorCodes.TargetContractUnsupported, "Integrationsmodus ist ungueltig.");
        if (request.IntegrationMode == StarterIntegrationModes.ExistingApp && !HasSource(request.TargetRoot, request.Framework))
            return ManagerResult.Fail(ManagerErrorCodes.StarterSourceMissing, "Nachruestung benoetigt Quellcode oder eine offizielle Erweiterungsschnittstelle.");
        if (!ManagerPathRules.IsSafeRelativePath(request.ProfileRoot))
            return ManagerResult.Fail(ManagerErrorCodes.TargetManifestInvalid, "Profilpfad muss relativ und sicher sein.");
        return ManagerResult.Ok("starter_request_valid", "Starterpaketanfrage ist gueltig.");
    }

    private async Task<StarterTargetManifest> CreateManifestAsync(StarterPreparationRequest request, string packageVersion,
        IReadOnlyList<StarterPackageFile> selected, bool equivalent, DateTimeOffset installedAt, DateTimeOffset updatedAt,
        CancellationToken cancellationToken)
    {
        var current = await LoadManifestAsync(request.TargetRoot, cancellationToken);
        var existing = request.IntegrationMode == StarterIntegrationModes.ExistingApp;
        var bbm = equivalent && request.Framework == StarterFrameworks.Electron && File.Exists(Path.Combine(request.TargetRoot, "src", "renderer", "ui-editor", "m80Registry.js"));
        var detectedScopes = bbm
            ? new[]
            {
                new StarterScopeStatus("restarbeiten.header.root", "complete", null, 31, 0),
                new StarterScopeStatus("restarbeiten.list.root", "complete", null, 7, 0),
                new StarterScopeStatus("restarbeiten.edit.root", "complete", null, 50, 0),
                new StarterScopeStatus("bbm.remaining", "blocked", "registration_inventory_pending", 0, 0),
                new StarterScopeStatus("pdf.bbm.protocol", "complete", null, 28, 0),
            }
            : Array.Empty<StarterScopeStatus>();
        var detectedActive = bbm ? new[] { "restarbeiten.header.root", "restarbeiten.list.root", "restarbeiten.edit.root" } : Array.Empty<string>();
        var detectedStatus = bbm ? StarterRegistryStatuses.Incomplete : existing ? StarterRegistryStatuses.RegistrationRequired : StarterRegistryStatuses.Development;
        var registryStatus = current?.RegistryStatus ?? detectedStatus;
        var registryVersion = current?.RegistryVersion ?? (bbm ? 3 : 0);
        var fingerprint = current?.RegistryFingerprint ?? StarterTargetContract.EmptyRegistryFingerprint;
        var active = current?.ActiveScopes ?? detectedActive;
        var scopes = current?.Scopes ?? detectedScopes;
        var adapterVersion = request.Framework == StarterFrameworks.Electron ? "1.2" : "wpf-sdk-dotnet/1.0";
        var owned = selected.Select(item => item.RelativePath).Append(StarterTargetContract.ManifestFileName)
            .Append(StarterTargetContract.OwnershipFileName).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray();
        return new(StarterTargetContract.SchemaVersion, packageVersion, request.ApplicationId, request.DisplayName, request.Framework,
            request.IntegrationMode, StarterTargetContract.ContractVersion, adapterVersion, registryVersion, fingerprint, registryStatus, active,
            current?.UiCapability ?? (request.UiEditorEnabled ? "layout" : "unavailable"),
            current?.PdfCapability ?? (bbm || request.PdfEditorEnabled ? "available" : "unavailable"),
            current?.ProfileRoot ?? request.ProfileRoot,
            current?.SupportedOperations ?? (request.UiEditorEnabled ? ["move", "resize", "resizeWidth", "resizeHeight", "textMove", "textResize", "setVisibility"] : []),
            current?.SelectionCapability ?? "bidirectional", current?.VisibilityCapability ?? true,
            current?.LabelFieldSeparation ?? true, StarterTargetContract.TransportProtocolVersion, scopes, current?.ManagerTarget,
            new(StarterTargetContract.ProductName, StarterTargetContract.OwnershipFileName, owned), installedAt, updatedAt);
    }

    private async Task<byte[]> ManifestBytesFromPlanAsync(StarterInstallationPlan plan, CancellationToken cancellationToken)
    {
        var loaded = await catalog.LoadAsync(cancellationToken);
        var current = await LoadStateAsync(plan.TargetRoot, cancellationToken);
        var equivalent = HasEquivalentExistingIntegration(plan.TargetRoot, plan.Request.Framework);
        var selected = loaded.Package!.Files.Where(file => (file.Framework == "all" || file.Framework == plan.Request.Framework) &&
            (file.IntegrationMode == "all" || file.IntegrationMode == plan.Request.IntegrationMode) &&
            !(equivalent && plan.Request.IntegrationMode == StarterIntegrationModes.ExistingApp)).ToArray();
        var manifest = await CreateManifestAsync(plan.Request, plan.PackageVersion, selected, equivalent, current?.InstalledAt ?? plan.CreatedAt,
            plan.CreatedAt, cancellationToken);
        return JsonSerializer.SerializeToUtf8Bytes(manifest, JsonOptions);
    }

    private async Task<byte[]> StateBytesFromPlanAsync(StarterInstallationPlan plan, CancellationToken cancellationToken)
    {
        var current = await LoadStateAsync(plan.TargetRoot, cancellationToken);
        var files = new List<StarterOwnedFile>();
        foreach (var file in plan.Files.Where(item => item.Action != InstallationAction.Conflict))
        {
            var hash = file.NewHash ?? file.OldHash ?? string.Empty;
            files.Add(new(file.RelativePath, hash, file.PreserveOnUninstall));
        }
        var state = new StarterInstallationState(1, StarterTargetContract.ProductName, plan.Request.ApplicationId, plan.Request.Framework,
            plan.Request.IntegrationMode, plan.PackageVersion, current?.InstalledAt ?? plan.CreatedAt, plan.CreatedAt, files);
        return JsonSerializer.SerializeToUtf8Bytes(state, JsonOptions);
    }

    private static bool HasSource(string root, string framework) => framework switch
    {
        StarterFrameworks.Wpf => Directory.EnumerateFiles(root, "*.csproj", SearchOption.AllDirectories).Any(),
        StarterFrameworks.Electron => File.Exists(Path.Combine(root, "package.json")) && Directory.Exists(Path.Combine(root, "src")),
        _ => false
    };

    public static string DetectFramework(string root)
    {
        if (File.Exists(Path.Combine(root, "package.json")) && Directory.Exists(Path.Combine(root, "src"))) return StarterFrameworks.Electron;
        if (Directory.EnumerateFiles(root, "*.csproj", SearchOption.AllDirectories).Any()) return StarterFrameworks.Wpf;
        return "unsupported";
    }

    public static bool HasEquivalentExistingIntegration(string root, string framework) => framework switch
    {
        StarterFrameworks.Electron => File.Exists(Path.Combine(root, "src", "main", "ui-editor", "electronUiEditorSession.js")) &&
                                       File.Exists(Path.Combine(root, "src", "renderer", "ui-editor", "m80Registry.js")) &&
                                       File.Exists(Path.Combine(root, "src", "renderer", "ui-editor", "m80Refs.js")),
        StarterFrameworks.Wpf => File.Exists(Path.Combine(root, ".ui-editor-kit", "registration-installation.json")),
        _ => false
    };

    private static bool IsWritable(string root)
    {
        var probe = Path.Combine(root, ".ui-editor-kit-write-" + Guid.NewGuid().ToString("N") + ".tmp");
        try { File.WriteAllText(probe, string.Empty); return true; }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException) { return false; }
        finally { try { if (File.Exists(probe)) File.Delete(probe); } catch { } }
    }

    private static async Task<bool> MatchesPreviewAsync(StarterInstallationPlan plan, CancellationToken cancellationToken)
    {
        foreach (var file in plan.Files)
        {
            var target = ManagerPathRules.ResolveInside(plan.TargetRoot, file.RelativePath);
            var current = File.Exists(target) ? await Hashing.FileAsync(target, cancellationToken) : null;
            if (!string.Equals(current, file.OldHash, StringComparison.OrdinalIgnoreCase)) return false;
        }
        return true;
    }

    private static async Task AtomicWriteAsync(string target, byte[] bytes, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
        var temp = target + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await File.WriteAllBytesAsync(temp, bytes, cancellationToken);
            if (File.Exists(target)) File.Replace(temp, target, null, true); else File.Move(temp, target);
        }
        finally { try { if (File.Exists(temp)) File.Delete(temp); } catch { } }
    }

    private static async Task<bool> RollbackAsync(string root, IReadOnlyDictionary<string, byte[]?> backups,
        CancellationToken cancellationToken)
    {
        try
        {
            foreach (var item in backups.Reverse())
            {
                var target = ManagerPathRules.ResolveInside(root, item.Key);
                if (item.Value is null) { if (File.Exists(target)) File.Delete(target); }
                else await AtomicWriteAsync(target, item.Value, cancellationToken);
            }
            return true;
        }
        catch { return false; }
    }
}
