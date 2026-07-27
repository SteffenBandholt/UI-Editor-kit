using Microsoft.Win32;
using System.ComponentModel;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using ReferenceTargetApp.UI.Editor;
using UiEditorKit.Manager.Core;
using UiEditorKit.Manager.Domain;
using UiEditorKit.Manager.Infrastructure;

namespace UiEditorKit.Manager.Wpf;

public partial class MainWindow : Window
{
    private readonly ManagerPaths paths = ManagerPaths.ForDefault();
    private readonly TargetAppInspector inspector;
    private readonly KnownTargetAppsStore store;
    private readonly ManagerLogger logger;
    private readonly TargetProcessLauncher launcher = new();
    private readonly TargetInstallationService installer;
    private readonly ExistingAppRegistrationService registrationService;
    private readonly StarterPackageService starterService;
    private TargetCheckResult? check;
    private InstallationPlan? preview;
    private ExistingAppAnalysis? registrationAnalysis;
    private RegistrationPreview? registrationPreview;
    private CancellationTokenSource? analysisCancellation;
    private bool uninstallPreview;
    private bool registrationUninstallPreview;
    private StarterInstallationPlan? starterPreview;
    private bool starterUninstallPreview;
    private bool operationInProgress;
    private RegisteredTargetEditorSession? registeredEditorSession;
    private System.Diagnostics.Process? registeredEditorTargetProcess;

    public MainWindow()
    {
        InitializeComponent(); paths.Ensure(); inspector = new(paths); store = new(paths); logger = new(paths);
        installer = new(paths, inspector, new LocalPackageCatalog(Path.Combine(AppContext.BaseDirectory, "packages", "current")));
        registrationService = new(paths);
        starterService = new(new StarterPackageCatalog(Path.Combine(AppContext.BaseDirectory, "starter-package", "current")));
        Loaded += async (_, _) => await RefreshAsync();
        Closed += async (_, _) => await StopRegisteredEditorAsync();
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        if (operationInProgress) { e.Cancel = true; StatusText.Text = "Die laufende Transaktion muss zuerst abgeschlossen werden."; return; }
        analysisCancellation?.Cancel();
        base.OnClosing(e);
    }

    private async Task RefreshAsync()
    {
        AppsList.ItemsSource = (await store.LoadAsync()).Apps;
        var package = await new LocalPackageCatalog(Path.Combine(AppContext.BaseDirectory, "packages", "current")).LoadAsync();
        PackageVersionText.Text = package.Package?.PackageVersion ?? "nicht verfügbar";
    }
    private async Task SelectAsync(string path)
    {
        RootText.Text = path;
        if (string.IsNullOrWhiteSpace(StarterDisplayNameText.Text)) StarterDisplayNameText.Text = Path.GetFileName(path.TrimEnd(Path.DirectorySeparatorChar));
        if (string.IsNullOrWhiteSpace(StarterApplicationIdText.Text)) StarterApplicationIdText.Text = Slug(StarterDisplayNameText.Text);
        var detected = StarterPackageService.DetectFramework(File.Exists(path) ? Path.GetDirectoryName(path)! : path);
        if (detected is StarterFrameworks.Wpf or StarterFrameworks.Electron) SelectStarterFramework(detected);
        await CheckAsync(path, true);
    }
    private async void SelectFolder_Click(object sender, RoutedEventArgs e) { var dialog = new OpenFolderDialog { Title = "Vorbereitete Ziel-App auswählen", Multiselect = false }; if (dialog.ShowDialog(this) == true) await SelectAsync(dialog.FolderName); }
    private async void SelectProject_Click(object sender, RoutedEventArgs e) { var dialog = new OpenFileDialog { Title = "Deklarierte Projektdatei auswählen", Filter = ".NET-Projekte (*.slnx;*.sln;*.csproj)|*.slnx;*.sln;*.csproj", Multiselect = false }; if (dialog.ShowDialog(this) == true) await SelectAsync(dialog.FileName); }
    private async void Refresh_Click(object sender, RoutedEventArgs e) => await RefreshAsync();
    private async void Check_Click(object sender, RoutedEventArgs e) => await CheckAsync(RootText.Text, true);
    private async Task CheckAsync(string path, bool remember)
    {
        InvalidatePreview(); check = await inspector.CheckAsync(path); ShowCheck();
        if (remember && check.Manifest is not null) { await store.UpsertAsync(ToKnown(check)); await RefreshAsync(); }
        await LogAsync(ManagerOperation.Check, new(check.Success, check.Code, check.Message));
    }
    private async void Preview_Click(object sender, RoutedEventArgs e)
    {
        var result = await installer.PreviewAsync(RootText.Text); check = result.Check; preview = result.Plan; uninstallPreview = false;
        PlanGrid.ItemsSource = preview?.Files; ShowCheck();
        if (preview is null) { Show(result.Result); return; }
        var confirmed = MessageBox.Show(PreviewMessage(preview), "Installationsvorschau ausdrücklich bestätigen", MessageBoxButton.YesNo, preview.CanExecute ? MessageBoxImage.Question : MessageBoxImage.Warning) == MessageBoxResult.Yes;
        InstallButton.IsEnabled = confirmed && preview.CanExecute; StatusText.Text = confirmed ? "Vorschau bestätigt." : "Vorschau nicht bestätigt; keine Änderung erfolgt.";
    }
    private async void Install_Click(object sender, RoutedEventArgs e)
    {
        if (preview is null || uninstallPreview) return;
        operationInProgress = true;
        try { var result = await installer.ExecuteAsync(preview, true); await LogAsync(check?.Installation is null ? ManagerOperation.Install : ManagerOperation.Update, result); await CheckAsync(RootText.Text, true); }
        finally { operationInProgress = false; }
    }
    private async void UninstallPreview_Click(object sender, RoutedEventArgs e)
    {
        var result = await installer.UninstallPreviewAsync(RootText.Text); preview = result.Plan; uninstallPreview = true; PlanGrid.ItemsSource = preview?.Files; ShowCheck();
        if (preview is null) { Show(result.Result); return; }
        var confirmed = MessageBox.Show(PreviewMessage(preview), "Deinstallation ausdrücklich bestätigen", MessageBoxButton.YesNo, preview.CanExecute ? MessageBoxImage.Question : MessageBoxImage.Warning) == MessageBoxResult.Yes;
        UninstallButton.IsEnabled = confirmed && preview.CanExecute;
    }
    private async void Uninstall_Click(object sender, RoutedEventArgs e)
    {
        if (preview is null || !uninstallPreview) return;
        operationInProgress = true;
        try { var result = await installer.UninstallAsync(preview, true); await LogAsync(ManagerOperation.Uninstall, result); await CheckAsync(RootText.Text, true); }
        finally { operationInProgress = false; }
    }
    private async void StartTarget_Click(object sender, RoutedEventArgs e) { if (check?.Manifest is null) return; var result = launcher.Start(check.TargetRoot, check.Manifest.TargetStart, false); Show(result); await LogAsync(ManagerOperation.StartTarget, result); }
    private async void StartEditor_Click(object sender, RoutedEventArgs e) { if (check?.Manifest is null) return; var result = launcher.Start(check.TargetRoot, check.Manifest.EditorStart, true); Show(result); await LogAsync(ManagerOperation.StartEditor, result); }
    private async void Remove_Click(object sender, RoutedEventArgs e) { if (check?.Manifest is null || check.Installation is not null || check.Registration is not null) { Show(ManagerResult.Fail("remove_blocked", "Installierte oder registrierte Apps müssen zuerst deinstalliert werden.")); return; } await store.RemoveAsync(check.Manifest.ApplicationId, check.TargetRoot); await RefreshAsync(); }
    private async void AppsList_SelectionChanged(object sender, System.Windows.Controls.SelectionChangedEventArgs e) { if (AppsList.SelectedItem is KnownTargetApp app) await SelectAsync(app.RootPath); }

    private async void PrepareNewApp_Click(object sender, RoutedEventArgs e) => await PrepareStarterAsync(StarterIntegrationModes.NewApp);

    private async void RetrofitExistingApp_Click(object sender, RoutedEventArgs e)
    {
        if (!await EnsureStarterRootAsync("Bestehende App mit Quellcode auswaehlen")) return;
        var framework = StarterPackageService.DetectFramework(RootText.Text);
        if (framework is not (StarterFrameworks.Wpf or StarterFrameworks.Electron))
        {
            Show(ManagerResult.Fail(ManagerErrorCodes.StarterFrameworkUnsupported, "Nur belegte WPF- und Electron-Adapter werden angeboten."));
            return;
        }
        SelectStarterFramework(framework);
        await PrepareStarterAsync(StarterIntegrationModes.ExistingApp, false);
    }

    private async Task PrepareStarterAsync(string integrationMode, bool selectRoot = true)
    {
        if (selectRoot && !await EnsureStarterRootAsync(integrationMode == StarterIntegrationModes.NewApp ? "Neue oder leere App auswaehlen" : "Bestehende App auswaehlen")) return;
        InvalidateStarterPreview();
        var result = await starterService.PreviewAsync(StarterRequest(integrationMode));
        starterPreview = result.Plan; starterUninstallPreview = false; StarterPlanGrid.ItemsSource = starterPreview?.Files;
        if (starterPreview is null) { Show(result.Result); return; }
        StarterStatusText.Text = StarterPreviewSummary(starterPreview);
        var confirmed = MessageBox.Show(StarterPreviewMessage(starterPreview), "App-Starterpaket-Vorschau ausdruecklich bestaetigen",
            MessageBoxButton.YesNo, starterPreview.CanExecute ? MessageBoxImage.Question : MessageBoxImage.Warning) == MessageBoxResult.Yes;
        StarterInstallButton.IsEnabled = confirmed && starterPreview.CanExecute;
        Show(confirmed ? result.Result : ManagerResult.Ok("starter_preview_not_confirmed", "Vorschau blieb unbestaetigt; keine Datei wurde veraendert."));
    }

    private async void StarterInstall_Click(object sender, RoutedEventArgs e)
    {
        if (starterPreview is null || starterUninstallPreview) return;
        operationInProgress = true;
        try
        {
            var result = await starterService.InstallOrUpdateAsync(starterPreview, true);
            await LogAsync(starterPreview.Files.Any(item => item.Action == InstallationAction.Update) ? ManagerOperation.Update : ManagerOperation.Install, result);
            if (result.Success) { InvalidateStarterPreview(); await ShowStarterStatusAsync(); }
        }
        finally { operationInProgress = false; }
    }

    private async void CheckStarterStatus_Click(object sender, RoutedEventArgs e)
    {
        if (!await EnsureStarterRootAsync("Ziel-App fuer Registrierungsstatus auswaehlen")) return;
        await ShowStarterStatusAsync();
    }

    private async Task ShowStarterStatusAsync()
    {
        var status = await starterService.InspectAsync(RootText.Text);
        SelectStarterFramework(status.Framework);
        StarterDisplayNameText.Text = status.DisplayName;
        if (status.Manifest is not null) StarterApplicationIdText.Text = status.Manifest.ApplicationId;
        StarterStatusText.Text = string.Join(Environment.NewLine,
            $"App: {status.DisplayName}  -  Pfad: {status.TargetRoot}",
            $"Framework: {status.Framework}  -  Integration: {status.IntegrationMode}  -  Adapter: {status.AdapterStatus}",
            $"Vertrag: {status.ContractStatus}  -  Registry: {status.RegistryStatus} v{status.RegistryVersion}  -  Fingerprint: {status.RegistryFingerprint}",
            $"UI: {status.UiCapability}  -  PDF: {status.PdfCapability}",
            $"Starterpaket: installiert {status.InstalledPackageVersion ?? " - "} / verfuegbar {status.AvailablePackageVersion}",
            $"Git: {(status.GitRepository ? status.GitSafe ? "sicher" : "Konflikt" : "kein Repository")}  -  Schreiben: {(status.Writable ? "moeglich" : "blockiert")}",
            "Scopes: " + (status.Scopes.Count == 0 ? "keine vollstaendige Registry" : string.Join(", ", status.Scopes.Select(scope => $"{scope.ScopeId}={scope.Status}"))),
            "Naechste Aktion: " + status.NextAction);
        Show(status.ContractStatus == "valid" ? ManagerResult.Ok("starter_status_valid", status.NextAction) :
            ManagerResult.Fail(ManagerErrorCodes.ContractCheckFailed, status.NextAction));
    }

    private async void OpenStarterEditor_Click(object sender, RoutedEventArgs e)
    {
        if (!await EnsureStarterRootAsync("Ziel-App fuer UI-/PDF-Editor auswaehlen")) return;
        var status = await starterService.InspectAsync(RootText.Text);
        if (status.ContractStatus != "valid" || status.Manifest?.ActiveScopes.Count == 0)
        {
            Show(ManagerResult.Fail(ManagerErrorCodes.RegistrationRegistryInvalid,
                "Der Editor bleibt blockiert: Es ist noch kein vollstaendiger gueltiger Scope freigegeben. " + status.NextAction));
            return;
        }
        if (status.Framework == StarterFrameworks.Wpf && status.IntegrationMode == StarterIntegrationModes.ExistingApp)
        {
            RegistrationStartEditor_Click(sender, e); return;
        }
        if (status.Framework == StarterFrameworks.Electron && StarterPackageService.HasEquivalentExistingIntegration(status.TargetRoot, status.Framework))
        {
            var start = new System.Diagnostics.ProcessStartInfo("npm.cmd") { WorkingDirectory = status.TargetRoot, UseShellExecute = true };
            start.ArgumentList.Add("start"); start.ArgumentList.Add("--"); start.ArgumentList.Add("--open-ui-editor");
            try { System.Diagnostics.Process.Start(start); Show(ManagerResult.Ok("starter_editor_target_started", "Electron-Ziel-App startet und oeffnet ihren vorhandenen lokalen UI-/PDF-Editor.")); }
            catch (Exception exception) when (exception is InvalidOperationException or System.ComponentModel.Win32Exception)
            { Show(ManagerResult.Fail(ManagerErrorCodes.EditorStartFailed, "Electron-Ziel-App konnte nicht gestartet werden: " + exception.Message)); }
            return;
        }
        Show(ManagerResult.Fail(ManagerErrorCodes.EditorStartFailed, "Der Frameworkadapter ist vorhanden, aber die Ziel-App muss ihren lokalen Editorstart noch nach Definition of Done anbinden."));
    }

    private async void StarterUninstallPreview_Click(object sender, RoutedEventArgs e)
    {
        if (!await EnsureStarterRootAsync("Ziel-App fuer Deinstallation auswaehlen")) return;
        var result = await starterService.UninstallPreviewAsync(RootText.Text);
        starterPreview = result.Plan; starterUninstallPreview = true; StarterPlanGrid.ItemsSource = starterPreview?.Files;
        if (starterPreview is null) { Show(result.Result); return; }
        var confirmed = MessageBox.Show(StarterPreviewMessage(starterPreview), "App-Starterpaket-Deinstallation ausdruecklich bestaetigen",
            MessageBoxButton.YesNo, starterPreview.CanExecute ? MessageBoxImage.Question : MessageBoxImage.Warning) == MessageBoxResult.Yes;
        StarterUninstallButton.IsEnabled = confirmed && starterPreview.CanExecute;
        Show(confirmed ? result.Result : ManagerResult.Ok("starter_uninstall_not_confirmed", "Deinstallation blieb unbestaetigt."));
    }

    private async void StarterUninstall_Click(object sender, RoutedEventArgs e)
    {
        if (starterPreview is null || !starterUninstallPreview) return;
        operationInProgress = true;
        try
        {
            var result = await starterService.UninstallAsync(starterPreview, true);
            await LogAsync(ManagerOperation.Uninstall, result);
            if (result.Success) { InvalidateStarterPreview(); await ShowStarterStatusAsync(); }
        }
        finally { operationInProgress = false; }
    }

    private void StarterPlanGrid_SelectionChanged(object sender, SelectionChangedEventArgs e) =>
        StarterExactDiffText.Text = StarterPlanGrid.SelectedItem is StarterPlanFile item ? item.ExactDiff ?? "Keine bestehende Textdateiaenderung." : string.Empty;

    private async Task<bool> EnsureStarterRootAsync(string title)
    {
        var root = File.Exists(RootText.Text) ? Path.GetDirectoryName(RootText.Text)! : RootText.Text;
        if (Directory.Exists(root)) { RootText.Text = Path.GetFullPath(root); return true; }
        var dialog = new OpenFolderDialog { Title = title, Multiselect = false };
        if (dialog.ShowDialog(this) != true) return false;
        await SelectAsync(dialog.FolderName); return true;
    }

    private StarterPreparationRequest StarterRequest(string integrationMode)
    {
        var name = StarterDisplayNameText.Text.Trim();
        var applicationId = StarterApplicationIdText.Text.Trim();
        if (string.IsNullOrWhiteSpace(name)) name = Path.GetFileName(RootText.Text.TrimEnd(Path.DirectorySeparatorChar));
        if (string.IsNullOrWhiteSpace(applicationId)) applicationId = Slug(name);
        StarterDisplayNameText.Text = name; StarterApplicationIdText.Text = applicationId;
        return new(RootText.Text, name, applicationId, SelectedStarterFramework(), integrationMode,
            StarterUiEnabledCheck.IsChecked == true, StarterPdfEnabledCheck.IsChecked == true, StarterProfileRootText.Text.Trim());
    }

    private string SelectedStarterFramework() => StarterFrameworkCombo.SelectedItem is ComboBoxItem item && item.Tag is string value ? value : StarterFrameworks.Wpf;
    private void SelectStarterFramework(string framework)
    {
        foreach (var item in StarterFrameworkCombo.Items.OfType<ComboBoxItem>()) if (string.Equals(item.Tag?.ToString(), framework, StringComparison.Ordinal)) { StarterFrameworkCombo.SelectedItem = item; break; }
    }
    private static string Slug(string value)
    {
        var slug = new string(value.Trim().ToLowerInvariant().Select(character => char.IsLetterOrDigit(character) ? character : '-').ToArray());
        while (slug.Contains("--", StringComparison.Ordinal)) slug = slug.Replace("--", "-", StringComparison.Ordinal);
        slug = slug.Trim('-'); return slug.Length < 3 ? "app." + (slug.Length == 0 ? "neu" : slug) : slug;
    }

    internal void ShowM82DiagnosticState(StarterInstallationPlan? plan, StarterTargetStatus? status, string step)
    {
        if (plan is not null)
        {
            RootText.Text = plan.TargetRoot;
            StarterDisplayNameText.Text = plan.Request.DisplayName;
            StarterApplicationIdText.Text = plan.Request.ApplicationId;
            SelectStarterFramework(plan.Request.Framework);
            StarterPlanGrid.ItemsSource = plan.Files;
            StarterStatusText.Text = step + Environment.NewLine + StarterPreviewSummary(plan);
        }
        else if (status is not null)
        {
            RootText.Text = status.TargetRoot;
            StarterDisplayNameText.Text = status.DisplayName;
            SelectStarterFramework(status.Framework);
            StarterStatusText.Text = string.Join(Environment.NewLine, step,
                $"Framework: {status.Framework} / Modus: {status.IntegrationMode}",
                $"Vertrag: {status.ContractStatus} / Registry: {status.RegistryStatus} v{status.RegistryVersion}",
                $"UI: {status.UiCapability} / PDF: {status.PdfCapability}",
                "Scopes: " + (status.Scopes.Count == 0 ? "keine" : string.Join(", ", status.Scopes.Select(scope => scope.ScopeId + "=" + scope.Status))),
                "Naechste Aktion: " + status.NextAction);
        }
    }
    private static string StarterPreviewSummary(StarterInstallationPlan plan) =>
        $"Modus: {plan.Request.IntegrationMode}  -  Framework: {plan.Request.Framework}  -  Paket: {plan.PackageVersion}  -  " +
        $"Neu {plan.Files.Count(item => item.Action == InstallationAction.Create)}, Aendern {plan.Files.Count(item => item.Action == InstallationAction.Update)}, " +
        $"Unveraendert {plan.Files.Count(item => item.Action == InstallationAction.Unchanged)}, Konflikte {plan.Blockers.Count}  -  Git: {plan.GitStatus}";
    private static string StarterPreviewMessage(StarterInstallationPlan plan) => StarterPreviewSummary(plan) + Environment.NewLine + Environment.NewLine +
        "Ownership, Hashes, exakte Diffs, Backupbedarf und Rollbackplan sind in der Vorschau sichtbar. Fortfahren?";
    private void InvalidateStarterPreview()
    {
        starterPreview = null; starterUninstallPreview = false; StarterPlanGrid.ItemsSource = null; StarterExactDiffText.Clear();
        StarterInstallButton.IsEnabled = false; StarterUninstallButton.IsEnabled = false;
    }

    private async void AnalyzeExisting_Click(object sender, RoutedEventArgs e)
    {
        if (analysisCancellation is not null) return;
        analysisCancellation = new(); AnalyzeExistingButton.IsEnabled = false; CancelAnalysisButton.IsEnabled = true;
        InvalidateRegistrationPreview(); StatusText.Text = "Read-only Analyse läuft; das Zielprojekt wird nicht verändert.";
        try
        {
            var result = await registrationService.AnalyzeAsync(RootText.Text, analysisCancellation.Token);
            if (!result.Result.Success || result.Analysis is null) { Show(result.Result); return; }
            registrationAnalysis = result.Analysis;
            RefreshRegistrationDisplay();
            Show(result.Result);
            await logger.WriteAsync(new(DateTimeOffset.UtcNow, ManagerOperation.Analyze, registrationAnalysis.ApplicationId,
                RootText.Text, true, result.Result.Code, null, registrationAnalysis.AdapterVersion, registrationAnalysis.Proposals.Count));
        }
        finally
        {
            analysisCancellation.Dispose(); analysisCancellation = null;
            AnalyzeExistingButton.IsEnabled = true; CancelAnalysisButton.IsEnabled = false;
        }
    }

    private void CancelAnalysis_Click(object sender, RoutedEventArgs e) => analysisCancellation?.Cancel();

    private async void SaveProposal_Click(object sender, RoutedEventArgs e)
    {
        if (!TryUpdateSelectedProposal(ProposalReviewStatus.Modified)) return;
        await PersistReviewAsync();
    }

    private async void ConfirmProposal_Click(object sender, RoutedEventArgs e)
    {
        if (!TryUpdateSelectedProposal(ProposalReviewStatus.Confirmed)) return;
        await PersistReviewAsync();
    }

    private async void RejectProposal_Click(object sender, RoutedEventArgs e)
    {
        if (registrationAnalysis is null || RegistrationProposalGrid.SelectedItem is not RegistrationProposal selected) return;
        ReplaceProposal(selected with { ReviewStatus = ProposalReviewStatus.Rejected, UserNote = ProposalNoteText.Text });
        await PersistReviewAsync();
    }

    private void ValidateRegistration_Click(object sender, RoutedEventArgs e)
    {
        if (registrationAnalysis is null) { Show(ManagerResult.Fail(ManagerErrorCodes.RegistrationAnalysisFailed, "Zuerst read-only analysieren.")); return; }
        var validation = RegistrationProposalValidator.Validate(registrationAnalysis.Proposals);
        if (!validation.Success)
        {
            Show(ManagerResult.Fail(ManagerErrorCodes.RegistrationRegistryInvalid,
                string.Join(Environment.NewLine, validation.Issues.Take(12).Select(item => $"{item.Code}: {item.Message}"))));
            return;
        }
        RegistrationPreviewButton.IsEnabled = true;
        Show(ManagerResult.Ok("registration_registry_valid", "Alle Vorschläge sind entschieden; Registry, IDs, Parents und Fachaktionssperren sind gültig."));
    }

    private async void RegistrationPreview_Click(object sender, RoutedEventArgs e)
    {
        if (registrationAnalysis is null) return;
        var result = await registrationService.PreviewAsync(RootText.Text, registrationAnalysis);
        registrationPreview = result.Preview; registrationUninstallPreview = false;
        RegistrationPlanGrid.ItemsSource = registrationPreview?.Files; RegistrationDiffText.Clear();
        if (registrationPreview is null) { Show(result.Result); return; }
        var confirmed = MessageBox.Show(RegistrationPreviewMessage(registrationPreview), "M79-Änderungsvorschau ausdrücklich bestätigen",
            MessageBoxButton.YesNo, registrationPreview.CanExecute ? MessageBoxImage.Question : MessageBoxImage.Warning) == MessageBoxResult.Yes;
        RegistrationInstallButton.IsEnabled = confirmed && registrationPreview.CanExecute;
        Show(confirmed ? result.Result : ManagerResult.Ok("registration_preview_not_confirmed", "Vorschau blieb unbestätigt; keine Datei wurde verändert."));
    }

    private async void RegistrationInstall_Click(object sender, RoutedEventArgs e)
    {
        if (registrationPreview is null || registrationUninstallPreview) return;
        operationInProgress = true;
        try
        {
            var result = await registrationService.InstallOrUpdateAsync(registrationPreview, true);
            await LogAsync(result.Code.Contains("update", StringComparison.Ordinal) ? ManagerOperation.Update : ManagerOperation.Install, result);
            if (result.Success) { await CheckAsync(RootText.Text, true); InvalidateRegistrationPreview(); }
        }
        finally { operationInProgress = false; }
    }

    private async void RegistrationUninstallPreview_Click(object sender, RoutedEventArgs e)
    {
        var result = await registrationService.UninstallPreviewAsync(RootText.Text);
        registrationPreview = result.Preview; registrationUninstallPreview = true;
        RegistrationPlanGrid.ItemsSource = registrationPreview?.Files; RegistrationDiffText.Clear();
        if (registrationPreview is null) { Show(result.Result); return; }
        var confirmed = MessageBox.Show(RegistrationPreviewMessage(registrationPreview), "M79-Deinstallation ausdrücklich bestätigen",
            MessageBoxButton.YesNo, registrationPreview.CanExecute ? MessageBoxImage.Question : MessageBoxImage.Warning) == MessageBoxResult.Yes;
        RegistrationUninstallButton.IsEnabled = confirmed && registrationPreview.CanExecute;
        Show(confirmed ? result.Result : ManagerResult.Ok("registration_uninstall_not_confirmed", "Deinstallation blieb unbestätigt; keine Datei wurde verändert."));
    }

    private async void RegistrationUninstall_Click(object sender, RoutedEventArgs e)
    {
        if (registrationPreview is null || !registrationUninstallPreview) return;
        operationInProgress = true;
        try
        {
            var result = await registrationService.UninstallAsync(registrationPreview, true);
            await LogAsync(ManagerOperation.Uninstall, result);
            if (result.Success)
            {
                registrationAnalysis = null; RefreshRegistrationDisplay(); InvalidateRegistrationPreview();
                await CheckAsync(RootText.Text, false);
            }
        }
        finally { operationInProgress = false; }
    }

    private async void RegistrationStartTarget_Click(object sender, RoutedEventArgs e)
    {
        var state = await registrationService.LoadStateAsync(RootText.Text);
        if (state is null) { Show(ManagerResult.Fail(ManagerErrorCodes.RegistrationTargetStartFailed, "M79-Registrierungsstatus fehlt.")); return; }
        var result = registrationService.StartTarget(RootText.Text, state); Show(result); await LogAsync(ManagerOperation.StartTarget, result);
    }

    private async void RegistrationStartEditor_Click(object sender, RoutedEventArgs e)
    {
        var state = await registrationService.LoadStateAsync(RootText.Text);
        if (state is null) { Show(ManagerResult.Fail(ManagerErrorCodes.RegistrationEditorStartFailed, "M79-Registrierungsstatus fehlt.")); return; }
        if (registeredEditorSession is { IsOpen: true }) { registeredEditorSession.Activate(); return; }
        await StopRegisteredEditorAsync();
        var host = registrationService.StartEditorHost(RootText.Text, state);
        if (!host.Result.Success || host.Process is null || host.PipeName is null)
        {
            Show(host.Result); await LogAsync(ManagerOperation.StartEditor, host.Result); return;
        }
        registeredEditorTargetProcess = host.Process;
        try
        {
            var profileRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "UI-Editor-kit", "RegisteredTargets", state.ApplicationId);
            registeredEditorSession = await RegisteredTargetEditorLauncher.OpenAsync(this, host.PipeName, state.ApplicationId,
                profileRoot, Path.Combine(AppContext.BaseDirectory, "editor-runtime"));
            var result = ManagerResult.Ok("editor_started", $"Vorhandener nativer Editor ist mit M79-Zielprozess {host.Process.Id} verbunden.");
            Show(result); await LogAsync(ManagerOperation.StartEditor, result);
        }
        catch (Exception exception) when (exception is IOException or InvalidOperationException or OperationCanceledException)
        {
            await StopRegisteredEditorAsync();
            var result = ManagerResult.Fail(ManagerErrorCodes.RegistrationEditorStartFailed,
                "Registrierter Editor konnte nicht sicher aktiviert werden: " + exception.Message);
            Show(result); await LogAsync(ManagerOperation.StartEditor, result);
        }
    }

    private async Task StopRegisteredEditorAsync()
    {
        if (registeredEditorSession is not null)
        {
            try { await registeredEditorSession.DisposeAsync(); } catch { }
            registeredEditorSession = null;
        }
        if (registeredEditorTargetProcess is not null)
        {
            try
            {
                if (!registeredEditorTargetProcess.HasExited)
                {
                    if (registeredEditorTargetProcess.CloseMainWindow())
                    {
                        using var graceful = new CancellationTokenSource(TimeSpan.FromMilliseconds(2500));
                        try { await registeredEditorTargetProcess.WaitForExitAsync(graceful.Token); }
                        catch (OperationCanceledException) { }
                    }
                    if (!registeredEditorTargetProcess.HasExited)
                    {
                        registeredEditorTargetProcess.Kill(true);
                        using var forced = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                        await registeredEditorTargetProcess.WaitForExitAsync(forced.Token);
                    }
                }
            }
            catch { }
            finally { registeredEditorTargetProcess.Dispose(); registeredEditorTargetProcess = null; }
        }
    }

    private void RegistrationFilter_SelectionChanged(object sender, SelectionChangedEventArgs e) => RefreshRegistrationDisplay();

    private void RegistrationProposalGrid_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (RegistrationProposalGrid.SelectedItem is not RegistrationProposal item) return;
        var finding = registrationAnalysis?.Findings.SingleOrDefault(candidate =>
            candidate.SourceLocation.RelativeFile == item.SourceLocation.RelativeFile &&
            candidate.StructuralPath == item.StructuralPath);
        var sourceBindings = finding is null
            ? Array.Empty<string>()
            : finding.EventBindings.Concat(finding.Bindings).Distinct(StringComparer.Ordinal).ToArray();
        ProposalSourceText.Text = $"{item.SourceLocation.RelativeFile}:{item.SourceLocation.Line}:{item.SourceLocation.Column} – {item.StructuralPath}";
        ProposalEvidenceText.Text = $"{item.ControlType} / {item.Confidence} / Status {item.ReviewStatus}" + Environment.NewLine +
                                    string.Join(Environment.NewLine, item.Warnings) + Environment.NewLine +
                                    "Quellbindung/Handler/Command: " + (sourceBindings.Length == 0 ? "keine" : string.Join("; ", sourceBindings)) + Environment.NewLine +
                                    $"Fachaktionsrisiko: {item.ActionRisk ?? "keines"}" + Environment.NewLine +
                                    "Empfohlene Sperre: " + (item.ActionRisk is null ? "keine Fachaktionsbindung erkannt" :
                                        string.Join(", ", item.LockedOps.Where(operation => operation is "executeTargetAction" or "modifyDomainData")));
        ProposalIdText.Text = item.StableElementId ?? string.Empty; ProposalNameText.Text = item.DisplayName;
        ProposalTypeText.Text = item.ElementType; ProposalRoleText.Text = item.Role; ProposalParentText.Text = item.ParentId ?? string.Empty;
        ProposalOrderText.Text = item.Order.ToString(); ProposalEligibleText.Text = item.EditorEligible.ToString();
        ProposalAllowedText.Text = string.Join(", ", item.AllowedOps); ProposalLockedText.Text = string.Join(", ", item.LockedOps);
        ProposalFieldKindText.Text = item.FieldKind ?? string.Empty; ProposalColumnRoleText.Text = item.ColumnRole ?? string.Empty;
        ProposalActionKindText.Text = item.ActionKind ?? string.Empty; ProposalComponentKindText.Text = item.ComponentKind ?? string.Empty;
        ProposalNoteText.Text = item.UserNote ?? item.Reason;
    }

    private void RegistrationPlanGrid_SelectionChanged(object sender, SelectionChangedEventArgs e) =>
        RegistrationDiffText.Text = RegistrationPlanGrid.SelectedItem is RegistrationPreviewFile item
            ? item.ExactDiff ?? "Neue oder entfernte eigene Datei; kein bestehender Dateidiff." : string.Empty;

    private bool TryUpdateSelectedProposal(ProposalReviewStatus status)
    {
        if (registrationAnalysis is null || RegistrationProposalGrid.SelectedItem is not RegistrationProposal selected) return false;
        if (!int.TryParse(ProposalOrderText.Text, out var order) || !Enum.TryParse<EditorEligibility>(ProposalEligibleText.Text, true, out var eligible))
        { Show(ManagerResult.Fail(ManagerErrorCodes.RegistrationProposalInvalid, "Reihenfolge oder Editorfähig-Wert ist ungültig.")); return false; }
        var allowed = SplitOperations(ProposalAllowedText.Text);
        var locked = SplitOperations(ProposalLockedText.Text).ToList();
        if (selected.ActionRisk is not null)
        {
            if (!locked.Contains("executeTargetAction", StringComparer.Ordinal)) locked.Add("executeTargetAction");
            if (!locked.Contains("modifyDomainData", StringComparer.Ordinal)) locked.Add("modifyDomainData");
            allowed = allowed.Where(item => item is not "executeTargetAction" and not "modifyDomainData" and not "delete").ToArray();
        }
        var changed = selected with
        {
            StableElementId = NullIfWhiteSpace(ProposalIdText.Text), DisplayName = ProposalNameText.Text.Trim(), ElementType = ProposalTypeText.Text.Trim(),
            Role = ProposalRoleText.Text.Trim(), ParentId = NullIfWhiteSpace(ProposalParentText.Text), Order = order, EditorEligible = eligible,
            AllowedOps = allowed, LockedOps = locked.Distinct(StringComparer.Ordinal).ToArray(), FieldKind = NullIfWhiteSpace(ProposalFieldKindText.Text),
            ColumnRole = NullIfWhiteSpace(ProposalColumnRoleText.Text), ActionKind = NullIfWhiteSpace(ProposalActionKindText.Text),
            ComponentKind = NullIfWhiteSpace(ProposalComponentKindText.Text), UserNote = ProposalNoteText.Text.Trim(), ReviewStatus = status
        };
        var validation = RegistrationProposalValidator.Validate(registrationAnalysis.Proposals.Select(item => item.ProposalId == selected.ProposalId ? changed : item).ToArray(), false);
        if (!validation.Success) { Show(ManagerResult.Fail(ManagerErrorCodes.RegistrationProposalInvalid, string.Join(" ", validation.Issues.Select(item => item.Message)))); return false; }
        ReplaceProposal(changed); return true;
    }

    private async Task PersistReviewAsync()
    {
        if (registrationAnalysis is null) return;
        registrationAnalysis = registrationAnalysis with
        {
            UserDecisions = registrationAnalysis.Proposals.Where(item => item.ReviewStatus != ProposalReviewStatus.Unreviewed)
                .Select(item => new RegistrationUserDecision(item.ProposalId, item.ReviewStatus, registrationAnalysis.AnalyzedAt, item.UserNote, item)).ToArray()
        };
        var result = await registrationService.SaveReviewedAnalysisAsync(registrationAnalysis);
        RefreshRegistrationDisplay(); Show(result);
        await logger.WriteAsync(new(DateTimeOffset.UtcNow, ManagerOperation.Review, registrationAnalysis.ApplicationId,
            RootText.Text, result.Success, result.Code, null, registrationAnalysis.AdapterVersion, registrationAnalysis.UserDecisions.Count));
    }

    private void ReplaceProposal(RegistrationProposal changed)
    {
        if (registrationAnalysis is null) return;
        registrationAnalysis = registrationAnalysis with
        { Proposals = registrationAnalysis.Proposals.Select(item => item.ProposalId == changed.ProposalId ? changed : item).ToArray() };
        InvalidateRegistrationPreview(); RefreshRegistrationDisplay(changed.ProposalId);
    }

    private void RefreshRegistrationDisplay(string? selectProposalId = null)
    {
        if (RegistrationProposalGrid is null || AnalysisSummaryText is null) return;
        if (registrationAnalysis is null)
        {
            RegistrationProposalGrid.ItemsSource = null; RegistrationViewsList.ItemsSource = null; RegistrationTree.Items.Clear();
            AnalysisSummaryText.Text = "Noch keine M79-Analyse."; return;
        }
        var items = FilteredProposals(registrationAnalysis.Proposals).ToArray();
        RegistrationProposalGrid.ItemsSource = items;
        RegistrationViewsList.ItemsSource = registrationAnalysis.Findings.Where(item => item.IsView).Select(item => item.ViewId).Distinct(StringComparer.Ordinal).ToArray();
        AnalysisSummaryText.Text = $"{registrationAnalysis.Framework} · {registrationAnalysis.Findings.Count} Fundstellen · {registrationAnalysis.Proposals.Count} Vorschläge · " +
                                   $"ungeprüft/klärungsbedürftig {registrationAnalysis.Proposals.Count(item => item.ReviewStatus is ProposalReviewStatus.Unreviewed or ProposalReviewStatus.ClarificationRequired)} · " +
                                   $"Fachaktionsrisiken {registrationAnalysis.Proposals.Count(item => item.ActionRisk is not null)}";
        BuildRegistrationTree();
        if (selectProposalId is not null) RegistrationProposalGrid.SelectedItem = items.FirstOrDefault(item => item.ProposalId == selectProposalId);
    }

    private IEnumerable<RegistrationProposal> FilteredProposals(IEnumerable<RegistrationProposal> proposals) => RegistrationFilter?.SelectedIndex switch
    {
        1 => proposals.Where(item => item.ReviewStatus == ProposalReviewStatus.Unreviewed),
        2 => proposals.Where(item => item.Confidence == RegistrationConfidence.Low || item.ReviewStatus == ProposalReviewStatus.ClarificationRequired),
        3 => proposals.Where(item => item.ActionRisk is not null),
        4 => proposals.Where(item => item.ReviewStatus is ProposalReviewStatus.Confirmed or ProposalReviewStatus.Modified),
        5 => proposals.Where(item => item.ReviewStatus == ProposalReviewStatus.Rejected),
        6 => proposals.Where(item => item.ReviewStatus == ProposalReviewStatus.Blocked),
        _ => proposals
    };

    private void BuildRegistrationTree()
    {
        RegistrationTree.Items.Clear(); if (registrationAnalysis is null) return;
        var visible = registrationAnalysis.Proposals.Where(item => item.ReviewStatus != ProposalReviewStatus.Rejected).ToArray();
        var nodes = visible.ToDictionary(item => item.ProposalId, item => new TreeViewItem
        { Header = $"{item.DisplayName} [{item.ElementType}] – {item.ReviewStatus}", Tag = item }, StringComparer.Ordinal);
        var byId = visible.Where(item => item.StableElementId is not null)
            .GroupBy(item => item.StableElementId!, StringComparer.Ordinal)
            .Where(group => group.Count() == 1)
            .ToDictionary(group => group.Key, group => nodes[group.Single().ProposalId], StringComparer.Ordinal);
        foreach (var proposal in visible)
        {
            var node = nodes[proposal.ProposalId];
            if (proposal.ParentId is not null && byId.TryGetValue(proposal.ParentId, out var parent)) parent.Items.Add(node);
            else RegistrationTree.Items.Add(node);
        }
    }

    private void InvalidateRegistrationPreview()
    {
        registrationPreview = null; registrationUninstallPreview = false; RegistrationPlanGrid.ItemsSource = null; RegistrationDiffText.Clear();
        RegistrationInstallButton.IsEnabled = false; RegistrationUninstallButton.IsEnabled = false;
        RegistrationPreviewButton.IsEnabled = registrationAnalysis is not null && RegistrationProposalValidator.Validate(registrationAnalysis.Proposals).Success;
    }

    private static IReadOnlyList<string> SplitOperations(string value) => value.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
    private static string? NullIfWhiteSpace(string value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string RegistrationPreviewMessage(RegistrationPreview value) =>
        $"Ziel: {value.TargetRoot}\nErstellen: {value.Files.Count(item => item.Action == RegistrationFileAction.Create)}, Ändern: {value.Files.Count(item => item.Action == RegistrationFileAction.Update)}, Entfernen: {value.Files.Count(item => item.Action == RegistrationFileAction.Remove)}, Konflikte: {value.Blockers.Count}\n\nHashes, Ownership und bestehende Dateidiffs sind vollständig sichtbar. Fortfahren?";

    internal void ShowM79DiagnosticState(string targetRoot, ExistingAppAnalysis analysis, RegistrationPreview? value, string step)
    {
        RootText.Text = targetRoot; registrationAnalysis = analysis; registrationPreview = value;
        registrationUninstallPreview = false; RegistrationPlanGrid.ItemsSource = value?.Files;
        RefreshRegistrationDisplay(); StatusText.Text = "M79-Diagnose: " + step;
    }

    private void ShowCheck()
    {
        if (check is null) return;
        RootText.Text = check.TargetRoot;
        ProjectTypeText.Text = check.Manifest?.ProjectType ?? "–";
        ContractText.Text = check.Success ? "gültig" : $"abgelehnt ({check.Code})";
        InstallText.Text = check.Registration is not null ? "M79 registriert" : check.Status.ToString();
        InstalledVersionText.Text = check.Installation?.InstalledPackageVersion ?? (check.Registration is null ? "–" : check.Registration.AdapterVersion);
        CheckedText.Text = check.CheckedAt.LocalDateTime.ToString("G"); LastActionText.Text = check.Message; StatusText.Text = check.Message;
        var prepared = check.Manifest?.IntegrationMode == "prepared-native-editor";
        PreviewButton.IsEnabled = check.Success && prepared;
        UninstallPreviewButton.IsEnabled = check.Installation is not null && prepared;
        StartTargetButton.IsEnabled = check.Success && check.Installation is not null && prepared && check.Manifest?.InstallationCapabilities.StartTarget == true;
        StartEditorButton.IsEnabled = check.Success && check.Installation is not null && prepared && check.Manifest?.InstallationCapabilities.StartEditor == true;
        RemoveButton.IsEnabled = check.Manifest is not null && check.Installation is null && check.Registration is null;
        RegistrationUninstallPreviewButton.IsEnabled = check.Registration is not null;
        RegistrationStartTargetButton.IsEnabled = check.Registration is not null;
        RegistrationStartEditorButton.IsEnabled = check.Registration is not null;
    }
    private void Show(ManagerResult result) { StatusText.Text = $"{result.Code}: {result.Message}"; LogText.AppendText($"{DateTime.Now:G} {result.Code}: {result.Message}{Environment.NewLine}"); if (!result.Success) MessageBox.Show(result.Message, result.Code, MessageBoxButton.OK, MessageBoxImage.Error); }
    private void InvalidatePreview() { preview = null; uninstallPreview = false; PlanGrid.ItemsSource = null; InstallButton.IsEnabled = false; UninstallButton.IsEnabled = false; }
    private async Task LogAsync(ManagerOperation operation, ManagerResult result) { await logger.WriteAsync(new(DateTimeOffset.UtcNow, operation, check?.Manifest?.ApplicationId, check?.TargetRoot, result.Success, result.Code, result.TransactionId, preview?.PackageVersion, result.AffectedFiles?.Count ?? 0)); Show(result); }
    private static string PreviewMessage(InstallationPlan plan) => $"Ziel: {plan.TargetRoot}\nPaket: {plan.PackageVersion} / Vertrag: {plan.ContractVersion}\nErstellen: {plan.Files.Count(f => f.Action == InstallationAction.Create)}, Ändern: {plan.Files.Count(f => f.Action == InstallationAction.Update)}, Entfernen: {plan.Files.Count(f => f.Action == InstallationAction.Remove)}, Konflikte: {plan.Blockers.Count}\n\nNur die sichtbaren Dateien werden verändert. Fortfahren?";
    private static KnownTargetApp ToKnown(TargetCheckResult value) => new(value.Manifest!.ApplicationId, value.Manifest.DisplayName, value.TargetRoot, value.Manifest.ProjectFile, value.ManifestPath, value.Manifest.SupportedEditorContractVersion, value.Status, value.Installation?.InstalledPackageVersion, value.CheckedAt, null, value.Success ? null : value.Code);
}
