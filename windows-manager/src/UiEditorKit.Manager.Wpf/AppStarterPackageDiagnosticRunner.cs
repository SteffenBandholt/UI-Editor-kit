using System.Diagnostics;
using System.IO;
using System.Text.Json;
using ReferenceTargetApp.UI.Editor;
using UiEditorKit.Manager.Core;
using UiEditorKit.Manager.Domain;
using UiEditorKit.Manager.Infrastructure;

namespace UiEditorKit.Manager.Wpf;

internal sealed class AppStarterPackageDiagnosticRunner
{
    private sealed class FirstWriteFault : IStarterFaultInjector
    {
        public void BeforeWrite(int index, string relativePath) => throw new InvalidOperationException("M82 provozierter Transaktionsfehler");
    }

    public async Task<bool> RunAsync(string repositoryRoot, string bbmRoot, MainWindow visibleWindow)
    {
        await Task.Delay(500);
        var repository = Path.GetFullPath(repositoryRoot);
        var bbm = Path.GetFullPath(bbmRoot);
        Require(File.Exists(Path.Combine(repository, "STATUS.md")), "UI-Editor-kit-Repository vorhanden");
        Require(File.Exists(Path.Combine(bbm, "ui-editor-target.json")), "BBM-Referenzmanifest vorhanden");
        var paths = ManagerPaths.ForDefault();
        paths.Ensure();
        Require(ManagerPathRules.IsInside(paths.App, AppContext.BaseDirectory), "Diagnose laeuft aus der publizierten Managerinstallation");
        foreach (var previous in Directory.EnumerateDirectories(paths.Diagnostics, "m82-*", SearchOption.TopDirectoryOnly)) DeleteTree(previous);
        var diagnostic = Path.Combine(paths.Diagnostics, "m82-" + Guid.NewGuid().ToString("N"));
        var newWpf = Path.Combine(diagnostic, "NewWpfApp");
        var newElectron = Path.Combine(diagnostic, "NewElectronApp");
        var failedElectron = Path.Combine(diagnostic, "FailedElectronApp");
        Directory.CreateDirectory(diagnostic);
        var processes = new List<Process>();
        try
        {
            CopyTree(Path.Combine(repository, "windows-manager", "fixtures", "M82NewWpfApp"), newWpf, ["bin", "obj"]);
            CopyTree(Path.Combine(repository, "windows-manager", "fixtures", "M82NewElectronApp"), newElectron, ["node_modules"]);
            CopyTree(Path.Combine(repository, "windows-manager", "fixtures", "M82NewElectronApp"), failedElectron, ["node_modules"]);
            var service = new StarterPackageService(new(Path.Combine(AppContext.BaseDirectory, "starter-package", "current")));

            var wpfRequest = Request(newWpf, "M82 neue WPF-App", "m82.new-wpf", StarterFrameworks.Wpf, StarterIntegrationModes.NewApp);
            var wpfPreview = await PreviewAsync(service, wpfRequest);
            Require(!(await service.InstallOrUpdateAsync(wpfPreview, false)).Success, "WPF-Installation ohne Bestaetigung blockiert");
            visibleWindow.Dispatcher.Invoke(() => visibleWindow.ShowM82DiagnosticState(wpfPreview, null, "Neue WPF-App: vollstaendige Vorschau"));
            Require((await service.InstallOrUpdateAsync(wpfPreview, true)).Success, "WPF-Starterpaket installiert und Build gruen");
            var wpfStatus = await service.InspectAsync(newWpf);
            Require(wpfStatus.RegistryStatus == StarterRegistryStatuses.Development && wpfStatus.Manifest?.ActiveScopes.Count == 0,
                "WPF startet ehrlich in development ohne erfundene Scopes");
            visibleWindow.Dispatcher.Invoke(() => visibleWindow.ShowM82DiagnosticState(null, wpfStatus, "Neue WPF-App: development, Build gruen"));
            await StartVisibleWpfAsync(newWpf, processes);
            var firstUiPath = Path.Combine(newWpf, "MainWindow.xaml");
            var firstUi = await File.ReadAllTextAsync(firstUiPath);
            firstUi = firstUi.Replace("<Grid>", "<Grid x:Name=\"M82Root\">", StringComparison.Ordinal);
            firstUi = firstUi.Replace("<TextBlock Text=\"Noch keine registrierte UI\"",
                "<TextBlock x:Name=\"M82FirstLabel\" Text=\"Erste registrierte Test-UI\"", StringComparison.Ordinal);
            await File.WriteAllTextAsync(firstUiPath, firstUi);
            var registrationPaths = ManagerPaths.ForRoot(Path.Combine(diagnostic, "WpfRegistrationManagerData"));
            registrationPaths.Ensure();
            var registration = new ExistingAppRegistrationService(registrationPaths);
            var analyzed = await registration.AnalyzeAsync(newWpf);
            Require(analyzed.Analysis is not null && analyzed.TargetByteIdentical, "erste kleine WPF-UI read-only analysiert");
            var reviewed = Review(analyzed.Analysis!);
            var proposalValidation = RegistrationProposalValidator.Validate(reviewed.Proposals);
            Require(proposalValidation.Success, "erste kleine WPF-UI einzeln klassifiziert: " +
                string.Join("; ", proposalValidation.Issues.Select(issue => issue.Code + "=" + issue.Message)));
            await registration.SaveReviewedAnalysisAsync(reviewed);
            var registrationPreview = await registration.PreviewAsync(newWpf, reviewed);
            Require(registrationPreview.Preview is { CanExecute: true }, "M79-Registrierungsvorschau uebernimmt das Startermanifest kontrolliert");
            Require((await registration.InstallOrUpdateAsync(registrationPreview.Preview!, true)).Success,
                "erste kleine WPF-UI registriert, Build/Vertrag/Laufzeit gruen");
            wpfStatus = await service.InspectAsync(newWpf);
            Require(wpfStatus.RegistryStatus == StarterRegistryStatuses.Complete && wpfStatus.Manifest?.ManagerTarget is not null,
                "WPF-Starterstatus nach Registrierung complete");
            var state = await registration.LoadStateAsync(newWpf);
            var host = registration.StartEditorHost(newWpf, state!);
            Require(host.Result.Success && host.Process is not null && host.PipeName is not null, "lokalen WPF-Editorhost starten");
            processes.Add(host.Process!);
            var editableId = registrationPreview.Registry!.Elements.Last(element => element.Editable && element.AllowedOps.Contains("resizeWidth", StringComparer.Ordinal)).Id;
            await using (var editor = await RegisteredTargetEditorLauncher.OpenAsync(visibleWindow, host.PipeName!, reviewed.ApplicationId,
                             Path.Combine(diagnostic, "WpfProfiles"), Path.Combine(AppContext.BaseDirectory, "editor-runtime")))
            {
                var exercise = await editor.ExerciseUiAndPdfAsync(editableId);
                Require(exercise.UiChanged && exercise.UiSaved,
                    $"UI-Editor fuer erste WPF-Test-UI geoeffnet (changed={exercise.UiChanged}, saved={exercise.UiSaved}, error={exercise.ErrorCode}:{exercise.ErrorMessage})");
            }
            TryStop(host.Process!); processes.Remove(host.Process!);
            var registrationUninstall = await registration.UninstallPreviewAsync(newWpf);
            Require(registrationUninstall.Preview is { CanExecute: true } &&
                    (await registration.UninstallAsync(registrationUninstall.Preview, true)).Success,
                "WPF-Registrierung deinstalliert und Startermanifest wiederhergestellt");

            var failedBefore = await SourceInventoryBuilder.CreateAsync(failedElectron);
            var failedPreview = await PreviewAsync(service, Request(failedElectron, "M82 Fehler-App", "m82.failed", StarterFrameworks.Electron, StarterIntegrationModes.NewApp));
            var failed = await service.InstallOrUpdateAsync(failedPreview, true, new FirstWriteFault());
            Require(!failed.Success && failed.RollbackSucceeded && (await SourceInventoryBuilder.CreateAsync(failedElectron)).InventoryHash == failedBefore.InventoryHash,
                "provozierter Installationsfehler rollt bytegleich zurueck");

            var electronRequest = Request(newElectron, "M82 neue Electron-App", "m82.new-electron", StarterFrameworks.Electron, StarterIntegrationModes.NewApp);
            var electronPreview = await PreviewAsync(service, electronRequest);
            visibleWindow.Dispatcher.Invoke(() => visibleWindow.ShowM82DiagnosticState(electronPreview, null, "Neue Electron-App: Main/Preload/Renderer-Vorschau"));
            Require((await service.InstallOrUpdateAsync(electronPreview, true)).Success, "Electron-Starterpaket installiert und Vertragscheck gruen");
            var electronStatus = await service.InspectAsync(newElectron);
            Require(electronStatus.RegistryStatus == StarterRegistryStatuses.Development && electronStatus.Manifest?.ActiveScopes.Count == 0,
                "Electron startet ehrlich in development ohne erfundene Scopes");
            visibleWindow.Dispatcher.Invoke(() => visibleWindow.ShowM82DiagnosticState(null, electronStatus, "Neue Electron-App: development, Vertragscheck gruen"));
            await RegisterFirstElectronUiAsync(newElectron, service, electronRequest);
            electronStatus = await service.InspectAsync(newElectron);
            Require(electronStatus.RegistryStatus == StarterRegistryStatuses.Complete && electronStatus.Manifest?.ActiveScopes.SequenceEqual(["m82.electron.root"]) == true,
                "erste kleine Electron-Test-UI explizit registriert und Vertragscheck gruen");
            visibleWindow.Dispatcher.Invoke(() => visibleWindow.ShowM82DiagnosticState(null, electronStatus, "Neue Electron-App: erste Test-UI registriert"));
            await StartVisibleElectronWithEditorAsync(newElectron, repository, bbm, processes);

            var profile = Path.Combine(newElectron, ".ui-editor-kit", "profiles", "diagnostic.json");
            Directory.CreateDirectory(Path.GetDirectoryName(profile)!);
            await File.WriteAllTextAsync(profile, "{\"layout\":true}");
            var profileHash = await Hashing.FileAsync(profile);
            var failedUpdatePreview = await PreviewAsync(service, electronRequest);
            var failedUpdate = await service.InstallOrUpdateAsync(failedUpdatePreview, true, new FirstWriteFault());
            Require(!failedUpdate.Success && failedUpdate.RollbackSucceeded && await Hashing.FileAsync(profile) == profileHash,
                "provozierter Updatefehler rollt zurueck und erhaelt Profile");
            var updatePreview = await PreviewAsync(service, electronRequest);
            Require((await service.InstallOrUpdateAsync(updatePreview, true)).Success, "Starterpaket-Update praktisch geprueft");
            var uninstallPreview = (await service.UninstallPreviewAsync(newElectron)).Plan;
            Require(uninstallPreview is { CanExecute: true }, "Deinstallationsvorschau vollstaendig");
            Require((await service.UninstallAsync(uninstallPreview!, true)).Success, "Deinstallation entfernt nur eigene Regeldateien");
            Require(File.Exists(profile) && await Hashing.FileAsync(profile) == profileHash &&
                    File.Exists(Path.Combine(newElectron, ".ui-editor-kit", "starter", "electron", "registry.cjs")),
                "Profil und ziel-eigenes Registrygeruest bleiben erhalten");

            var bbmPreviewResult = await service.PreviewAsync(Request(bbm, "BBM", "bbm-produktiv", StarterFrameworks.Electron, StarterIntegrationModes.ExistingApp) with
            { PdfEditorEnabled = true });
            Require(bbmPreviewResult.Plan is not null && bbmPreviewResult.Plan.Files.Count == 2 &&
                    bbmPreviewResult.Plan.Files.All(file => !file.RelativePath.Contains("bridge", StringComparison.OrdinalIgnoreCase) && !file.RelativePath.Contains("registry", StringComparison.OrdinalIgnoreCase)),
                "BBM wird ohne zweite Bridge oder Registry uebernommen");
            var bbmStatus = await service.InspectAsync(bbm);
            Require(bbmStatus.RegistryStatus == StarterRegistryStatuses.Incomplete && bbmStatus.Manifest?.ActiveScopes.Count == 3 &&
                    bbmStatus.Scopes.Any(scope => scope.ScopeId == "bbm.remaining" && scope.Status == StarterRegistryStatuses.Blocked) &&
                    bbmStatus.PdfCapability == "available", "BBM-Scopes und PDF-Capability ehrlich dargestellt");
            visibleWindow.Dispatcher.Invoke(() => visibleWindow.ShowM82DiagnosticState(bbmPreviewResult.Plan, bbmStatus, "BBM-Bestand: drei Scopes frei, Rest blockiert, PDF verfuegbar"));
            await StartVisibleBbmAsync(bbm, processes);

            Require(!Directory.EnumerateFiles(diagnostic, "*.tmp", SearchOption.AllDirectories).Any(), "keine temporaeren Transaktionsdateien");
            visibleWindow.Dispatcher.Invoke(() => visibleWindow.ShowM82DiagnosticState(null, bbmStatus, "M82-Diagnose vollstaendig erfolgreich"));
            return true;
        }
        finally
        {
            foreach (var process in processes) TryStop(process);
            await Task.Delay(200);
            try { DeleteTree(diagnostic); } catch { }
            try { if (Directory.Exists(paths.Diagnostics) && !Directory.EnumerateFileSystemEntries(paths.Diagnostics).Any()) Directory.Delete(paths.Diagnostics); } catch { }
        }
    }

    private static StarterPreparationRequest Request(string root, string name, string id, string framework, string mode) =>
        new(root, name, id, framework, mode, true, false, ".ui-editor-kit/profiles");

    private static async Task<StarterInstallationPlan> PreviewAsync(StarterPackageService service, StarterPreparationRequest request)
    {
        var preview = await service.PreviewAsync(request);
        Require(preview.Plan is { CanExecute: true }, "ausfuehrbare Starterpaket-Vorschau: " + preview.Result.Message);
        return preview.Plan!;
    }

    private static ExistingAppAnalysis Review(ExistingAppAnalysis analysis) => analysis with
    {
        Proposals = analysis.Proposals.Select(proposal =>
            proposal.StableElementId is null || proposal.Warnings.Any(warning => warning.Contains("Template-", StringComparison.Ordinal))
                ? proposal with { ReviewStatus = ProposalReviewStatus.Rejected, UserNote = "Unsicheres Element bewusst gesperrt." }
                : proposal with { ReviewStatus = ProposalReviewStatus.Confirmed, UserNote = "Test-UI einzeln geprueft." }).ToArray()
    };

    private static async Task RegisterFirstElectronUiAsync(string target, StarterPackageService service, StarterPreparationRequest request)
    {
        const string scopeId = "m82.electron.root";
        const string fingerprint = "sha256:1111111111111111111111111111111111111111111111111111111111111111";
        var htmlPath = Path.Combine(target, "src", "index.html");
        var html = await File.ReadAllTextAsync(htmlPath);
        html = html.Replace("<main>Noch keine registrierte UI</main>",
            "<main data-ui-inspector-id=\"m82.electron.root\" data-ui-editor-kind=\"root\" data-ui-editor-label=\"Erste Test-UI\" data-ui-editor-parent=\"\" data-ui-editor-editable=\"true\" data-ui-editor-ops=\"resizeWidth,resizeHeight\">Erste registrierte Test-UI</main>", StringComparison.Ordinal);
        await File.WriteAllTextAsync(htmlPath, html);
        var registryPath = Path.Combine(target, ".ui-editor-kit", "starter", "electron", "registry.cjs");
        await File.WriteAllTextAsync(registryPath, "\"use strict\";\nmodule.exports = Object.freeze({ registryVersion: 1, registryFingerprint: \"" + fingerprint +
            "\", registryStatus: \"complete\", activeScopes: Object.freeze([\"" + scopeId +
            "\"]), registryScopes: Object.freeze([{ scopeId: \"" + scopeId +
            "\", status: \"complete\", elements: Object.freeze([{ id: \"" + scopeId +
            "\", parentId: null, editable: true, allowedOps: Object.freeze([\"resizeWidth\", \"resizeHeight\"]), lockedOps: Object.freeze([\"executeTargetAction\"]) }]) }]) });\n");
        var checkPath = Path.Combine(target, ".ui-editor-kit", "starter", "electron", "target-contract-check.cjs");
        await File.WriteAllTextAsync(checkPath,
            "\"use strict\";\nconst registry = require(\"./registry.cjs\");\nfunction check() { if (registry.registryStatus !== \"complete\" || registry.activeScopes.length !== 1 || registry.registryScopes[0].elements.length !== 1) throw new Error(\"Registrierte Test-UI ist unvollstaendig.\"); return true; }\nmodule.exports = Object.freeze({ check });\n");
        var manifestPath = Path.Combine(target, StarterTargetContract.ManifestFileName);
        var manifest = (await service.LoadManifestAsync(target))! with
        {
            RegistryVersion = 1,
            RegistryFingerprint = fingerprint,
            RegistryStatus = StarterRegistryStatuses.Complete,
            ActiveScopes = [scopeId],
            Scopes = [new(scopeId, StarterRegistryStatuses.Complete, null, 1, 0)],
            UpdatedAt = DateTimeOffset.UtcNow
        };
        await File.WriteAllTextAsync(manifestPath, JsonSerializer.Serialize(manifest, new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true }));
        var update = await service.InstallOrUpdateAsync(await PreviewAsync(service, request), true);
        Require(update.Success, "Electron-Ziel-App-Update erhaelt Registry und prueft den Zielvertrag: " + update.Message);
    }

    private static async Task StartVisibleWpfAsync(string root, ICollection<Process> processes)
    {
        var executable = Path.Combine(root, "bin", "Debug", "net10.0-windows", "M82NewWpfApp.exe");
        var process = Process.Start(new ProcessStartInfo(executable) { WorkingDirectory = root, UseShellExecute = false })
            ?? throw new InvalidOperationException("WPF-Test-App konnte nicht gestartet werden.");
        processes.Add(process);
        await WaitForWindowAsync(process, "sichtbares natives WPF-Fenster");
        TryStop(process); processes.Remove(process);
    }

    private static async Task StartVisibleElectronWithEditorAsync(string target, string repositoryRoot, string bbmRoot,
        ICollection<Process> processes)
    {
        await File.WriteAllTextAsync(Path.Combine(target, "src", "main.cjs"), ElectronEditorDiagnosticMain);
        var electron = Path.Combine(bbmRoot, "node_modules", "electron", "dist", "electron.exe");
        Require(File.Exists(electron), "lokale Electron-Runtime vorhanden");
        var existing = Process.GetProcesses().Select(candidate => candidate.Id).ToHashSet();
        var start = new ProcessStartInfo(electron) { WorkingDirectory = target, UseShellExecute = false };
        start.Environment.Remove("ELECTRON_RUN_AS_NODE");
        start.Environment["M82_UI_EDITOR_KIT_ROOT"] = repositoryRoot;
        start.Environment["M82_UI_EDITOR_MANAGER_EXE"] = Environment.ProcessPath
            ?? throw new InvalidOperationException("Manager-Executable ist nicht verfuegbar.");
        start.Environment["M82_UI_EDITOR_RUNTIME_ROOT"] = Path.Combine(AppContext.BaseDirectory, "editor-runtime");
        start.Environment["M82_UI_EDITOR_PROFILE_ROOT"] = Path.Combine(target, ".ui-editor-kit", "profiles");
        start.ArgumentList.Add(target);
        var process = Process.Start(start) ?? throw new InvalidOperationException("Electron-Test-App konnte nicht gestartet werden.");
        processes.Add(process);
        var windowProcesses = await WaitForNewWindowAsync(existing, "M82 Electron Test-App", "sichtbares natives Electron-Fenster");
        IReadOnlyList<Process> managerProcesses;
        try
        {
            managerProcesses = await WaitForNewWindowAsync(existing, string.Empty, "UI-Editor fuer neue Electron-Test-App sichtbar",
                TimeSpan.FromSeconds(30), processName: "UiEditorManager");
        }
        catch (Exception exception)
        {
            var editorDiagnostic = Path.Combine(target, ".ui-editor-kit", "profiles", "diagnostics", "m80-last-error.log");
            var targetDiagnostic = Path.Combine(target, ".ui-editor-kit", "profiles", "diagnostics", "m82-target.log");
            var detail = File.Exists(editorDiagnostic) ? await File.ReadAllTextAsync(editorDiagnostic) : "kein Editorfehlerprotokoll";
            if (File.Exists(targetDiagnostic)) detail += " | Ziel-App: " + await File.ReadAllTextAsync(targetDiagnostic);
            throw new InvalidOperationException($"Electron-Editorfenster fehlt: {detail}", exception);
        }
        foreach (var candidate in managerProcesses) TryStop(candidate);
        foreach (var candidate in windowProcesses) TryStop(candidate);
        TryStop(process); processes.Remove(process);
    }

    private static async Task StartVisibleBbmAsync(string bbmRoot, ICollection<Process> processes)
    {
        var electron = Path.Combine(bbmRoot, "node_modules", "electron", "dist", "electron.exe");
        var existing = Process.GetProcesses().Select(candidate => candidate.Id).ToHashSet();
        var start = new ProcessStartInfo(electron) { WorkingDirectory = bbmRoot, UseShellExecute = false };
        start.Environment.Remove("ELECTRON_RUN_AS_NODE");
        start.ArgumentList.Add(".");
        start.ArgumentList.Add("--bbm-electron-editor-diagnostic");
        start.ArgumentList.Add("--open-ui-editor");
        var process = Process.Start(start) ?? throw new InvalidOperationException("BBM-Diagnose konnte nicht gestartet werden.");
        processes.Add(process);
        var windowProcesses = await WaitForNewWindowAsync(existing, string.Empty, "sichtbares BBM-Fenster mit lokalem Editorstart", TimeSpan.FromSeconds(30));
        await Task.Delay(1500);
        foreach (var candidate in windowProcesses) TryStop(candidate);
        TryStop(process); processes.Remove(process);
    }

    private static async Task WaitForWindowAsync(Process process, string step, TimeSpan? timeout = null)
    {
        var until = DateTime.UtcNow + (timeout ?? TimeSpan.FromSeconds(15));
        while (DateTime.UtcNow < until && !process.HasExited && process.MainWindowHandle == IntPtr.Zero) await Task.Delay(100);
        Require(!process.HasExited && process.MainWindowHandle != IntPtr.Zero, step);
    }

    private static async Task<IReadOnlyList<Process>> WaitForNewWindowAsync(IReadOnlySet<int> existingProcessIds, string expectedTitle,
        string step, TimeSpan? timeout = null, string? processName = null)
    {
        var until = DateTime.UtcNow + (timeout ?? TimeSpan.FromSeconds(15));
        while (DateTime.UtcNow < until)
        {
            var processes = Process.GetProcesses().Where(process => !existingProcessIds.Contains(process.Id)).ToArray();
            var visible = processes.Where(process =>
            {
                try
                {
                    return process.MainWindowHandle != IntPtr.Zero &&
                           (processName is null || process.ProcessName.Equals(processName, StringComparison.OrdinalIgnoreCase)) &&
                           (expectedTitle.Length == 0 || process.MainWindowTitle.Contains(expectedTitle, StringComparison.Ordinal));
                }
                catch { return false; }
            }).ToArray();
            if (visible.Length > 0)
            {
                foreach (var process in processes.Except(visible)) process.Dispose();
                return visible;
            }
            foreach (var process in processes) process.Dispose();
            await Task.Delay(100);
        }
        Require(false, step);
        return [];
    }

    private const string ElectronEditorDiagnosticMain = """
        "use strict";
        const fs = require("node:fs");
        const path = require("node:path");
        const { spawn } = require("node:child_process");
        const { app, BrowserWindow } = require("electron");
        const kit = require(path.join(process.env.M82_UI_EDITOR_KIT_ROOT, "src", "index.cjs"));
        const scopeId = "m82.electron.root";
        const fingerprint = "sha256:1111111111111111111111111111111111111111111111111111111111111111";
        const diagnosticPath = path.join(process.env.M82_UI_EDITOR_PROFILE_ROOT, "diagnostics", "m82-target.log");
        fs.mkdirSync(path.dirname(diagnosticPath), { recursive: true });
        const log = value => fs.appendFileSync(diagnosticPath, `${new Date().toISOString()} ${value}\n`);
        const element = Object.freeze({
          id: scopeId, name: "Erste Test-UI", type: "root", role: "scopeRoot", parentId: null, order: 0,
          visible: true, editable: true, allowedOps: ["resizeWidth", "resizeHeight"],
          lockedOps: ["executeTargetAction"], semanticKey: scopeId, registrationStatus: "editorEnabled",
          refKey: scopeId, referenceResolved: true,
          baseline: { x: 0, y: 0, width: 520, height: 280, textOffsetX: 0, textOffsetY: 0,
            fontSize: 16, visible: true, minWidth: 320, maxWidth: 1200, minHeight: 180, maxHeight: 800 }
        });
        const layoutElement = () => ({ elementId: scopeId, x: 0, y: 0, width: 520, height: 280,
          textOffsetX: 0, textOffsetY: 0, fontSize: 16, visible: true });

        async function connectWithRetry(client, contract) {
          const expiresAt = Date.now() + 15000;
          let lastError;
          while (Date.now() < expiresAt) {
            try { await client.connect({ contract }); return; }
            catch (error) { lastError = error; log(`Connect retry: ${error.code || "unknown"} ${error.message || error}`); await client.close("connect_retry").catch(() => {}); await new Promise(resolve => setTimeout(resolve, 150)); }
          }
          throw lastError || new Error("Editor-Pipe ist nicht erreichbar.");
        }

        app.whenReady().then(async () => {
          log("Electron ready");
          const window = new BrowserWindow({ width: 640, height: 420, title: "M82 Electron Test-App" });
          log("BrowserWindow created");
          void window.loadFile("src/index.html");
          log("loadFile requested");
          const ids = kit.createSessionIdentifiers();
          log("session identifiers created");
          const contract = kit.createElectronTargetContract({
            applicationId: "m82.new-electron", displayName: "M82 neue Electron-App", appVersion: "1.0.0",
            registryVersion: 1, registryFingerprint: fingerprint, registryStatus: "complete", activeScopes: [scopeId],
            profileRoot: process.env.M82_UI_EDITOR_PROFILE_ROOT, supportedOperations: kit.ELECTRON_TARGET_OPERATIONS,
            transportProtocolVersion: kit.LOCAL_TARGET_PROTOCOL_VERSION, sessionId: ids.sessionId, processId: process.pid
          });
          log("target contract created");
          const manager = spawn(process.env.M82_UI_EDITOR_MANAGER_EXE, [
            "--electron-target-editor", `--pipe-name=${ids.pipeName}`, `--session-nonce=${ids.sessionNonce}`,
            "--application-id=m82.new-electron", `--profile-root=${process.env.M82_UI_EDITOR_PROFILE_ROOT}`,
            `--editor-runtime-root=${process.env.M82_UI_EDITOR_RUNTIME_ROOT}`
          ], { cwd: path.dirname(process.env.M82_UI_EDITOR_MANAGER_EXE), windowsHide: false, stdio: "ignore" });
          log(`Manager spawned: ${manager.pid}`);
          manager.once("error", error => log(`Manager error: ${error.stack || error}`));
          manager.once("exit", code => { log(`Manager exit: ${code}`); app.quit(); });
          const client = new kit.NamedPipeTargetClient({ pipeName: ids.pipeName, sessionNonce: ids.sessionNonce, timeoutMs: 2000 });
          client.on("connectionError", error => log(`Connection error: ${error.code || "unknown"} ${error.message || error}`));
          client.on("message", message => {
            const action = String(message?.payload?.action || "");
            if (action === "getRegistry") client.respond(message, { action: "getRegistryAccepted", registryVersion: 1,
              registryFingerprint: fingerprint, registryStatus: "complete", activeScopes: [scopeId],
              registryScopes: [{ scopeId, status: "complete", expectedElementIds: [scopeId], elements: [element] }] });
            else if (action === "getLayoutState") client.respond(message, { action: "getLayoutStateAccepted",
              scopeStates: [{ scopeId, capturedAt: new Date().toISOString(), elements: [layoutElement()] }] });
            else if (action === "submitChange") client.respond(message, { action: "submitChangeAccepted", changeResult: {
              success: false, changeId: String(message.payload?.changeRequest?.changeId || "diagnostic"), elementId: scopeId,
              operation: String(message.payload?.changeRequest?.operation || "resizeWidth"), errorCode: "diagnostic_read_only",
              message: "Diagnoseadapter ist schreibgeschuetzt.", previousState: layoutElement(), newState: null, rollbackSucceeded: true } });
          });
          client.on("disconnect", () => app.quit());
          await new Promise(resolve => setTimeout(resolve, 750));
          await connectWithRetry(client, contract);
          log("Pipe connected");
        }).catch(error => { log(`Target error: ${error.stack || error}`); console.error(error); app.exit(82); });
        app.on("window-all-closed", () => app.quit());
        """;

    private static void TryStop(Process process)
    {
        try
        {
            if (!process.HasExited && (!process.CloseMainWindow() || !process.WaitForExit(3000))) process.Kill(true);
            if (!process.HasExited) process.WaitForExit(5000);
        }
        catch { }
        finally { process.Dispose(); }
    }

    private static void CopyTree(string source, string target, IReadOnlyCollection<string> excludedDirectories)
    {
        Directory.CreateDirectory(target);
        foreach (var file in Directory.EnumerateFiles(source)) File.Copy(file, Path.Combine(target, Path.GetFileName(file)), true);
        foreach (var directory in Directory.EnumerateDirectories(source))
            if (!excludedDirectories.Contains(Path.GetFileName(directory), StringComparer.OrdinalIgnoreCase))
                CopyTree(directory, Path.Combine(target, Path.GetFileName(directory)), excludedDirectories);
    }

    private static void DeleteTree(string path)
    {
        if (!Directory.Exists(path)) return;
        foreach (var file in Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories)) File.SetAttributes(file, FileAttributes.Normal);
        Directory.Delete(path, true);
    }

    private static void Require(bool condition, string step)
    {
        if (!condition) throw new InvalidOperationException("M82-Diagnoseschritt fehlgeschlagen: " + step);
    }
}
