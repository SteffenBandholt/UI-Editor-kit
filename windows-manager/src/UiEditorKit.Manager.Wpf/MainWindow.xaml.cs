using Microsoft.Win32;
using System.ComponentModel;
using System.IO;
using System.Windows;
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
    private TargetCheckResult? check;
    private InstallationPlan? preview;
    private bool uninstallPreview;
    private bool operationInProgress;

    public MainWindow()
    {
        InitializeComponent(); paths.Ensure(); inspector = new(paths); store = new(paths); logger = new(paths);
        installer = new(paths, inspector, new LocalPackageCatalog(Path.Combine(AppContext.BaseDirectory, "packages", "current")));
        Loaded += async (_, _) => await RefreshAsync();
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        if (operationInProgress) { e.Cancel = true; StatusText.Text = "Die laufende Transaktion muss zuerst abgeschlossen werden."; return; }
        base.OnClosing(e);
    }

    private async Task RefreshAsync()
    {
        AppsList.ItemsSource = (await store.LoadAsync()).Apps;
        var package = await new LocalPackageCatalog(Path.Combine(AppContext.BaseDirectory, "packages", "current")).LoadAsync();
        PackageVersionText.Text = package.Package?.PackageVersion ?? "nicht verfügbar";
    }
    private async Task SelectAsync(string path) { RootText.Text = path; await CheckAsync(path, true); }
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
    private async void Remove_Click(object sender, RoutedEventArgs e) { if (check?.Manifest is null || check.Installation is not null) { Show(ManagerResult.Fail("remove_blocked", "Installierte Apps müssen zuerst deinstalliert werden.")); return; } await store.RemoveAsync(check.Manifest.ApplicationId, check.TargetRoot); await RefreshAsync(); }
    private async void AppsList_SelectionChanged(object sender, System.Windows.Controls.SelectionChangedEventArgs e) { if (AppsList.SelectedItem is KnownTargetApp app) await SelectAsync(app.RootPath); }

    private void ShowCheck() { if (check is null) return; RootText.Text = check.TargetRoot; ProjectTypeText.Text = check.Manifest?.ProjectType ?? "–"; ContractText.Text = check.Success ? "gültig" : $"abgelehnt ({check.Code})"; InstallText.Text = check.Status.ToString(); InstalledVersionText.Text = check.Installation?.InstalledPackageVersion ?? "–"; CheckedText.Text = check.CheckedAt.LocalDateTime.ToString("G"); LastActionText.Text = check.Message; StatusText.Text = check.Message; PreviewButton.IsEnabled = check.Success; UninstallPreviewButton.IsEnabled = check.Installation is not null; StartTargetButton.IsEnabled = check.Success && check.Installation is not null && check.Manifest?.InstallationCapabilities.StartTarget == true; StartEditorButton.IsEnabled = check.Success && check.Installation is not null && check.Manifest?.InstallationCapabilities.StartEditor == true; RemoveButton.IsEnabled = check.Manifest is not null && check.Installation is null; }
    private void Show(ManagerResult result) { StatusText.Text = $"{result.Code}: {result.Message}"; LogText.AppendText($"{DateTime.Now:G} {result.Code}: {result.Message}{Environment.NewLine}"); if (!result.Success) MessageBox.Show(result.Message, result.Code, MessageBoxButton.OK, MessageBoxImage.Error); }
    private void InvalidatePreview() { preview = null; uninstallPreview = false; PlanGrid.ItemsSource = null; InstallButton.IsEnabled = false; UninstallButton.IsEnabled = false; }
    private async Task LogAsync(ManagerOperation operation, ManagerResult result) { await logger.WriteAsync(new(DateTimeOffset.UtcNow, operation, check?.Manifest?.ApplicationId, check?.TargetRoot, result.Success, result.Code, result.TransactionId, preview?.PackageVersion, result.AffectedFiles?.Count ?? 0)); Show(result); }
    private static string PreviewMessage(InstallationPlan plan) => $"Ziel: {plan.TargetRoot}\nPaket: {plan.PackageVersion} / Vertrag: {plan.ContractVersion}\nErstellen: {plan.Files.Count(f => f.Action == InstallationAction.Create)}, Ändern: {plan.Files.Count(f => f.Action == InstallationAction.Update)}, Entfernen: {plan.Files.Count(f => f.Action == InstallationAction.Remove)}, Konflikte: {plan.Blockers.Count}\n\nNur die sichtbaren Dateien werden verändert. Fortfahren?";
    private static KnownTargetApp ToKnown(TargetCheckResult value) => new(value.Manifest!.ApplicationId, value.Manifest.DisplayName, value.TargetRoot, value.Manifest.ProjectFile, value.ManifestPath, value.Manifest.SupportedEditorContractVersion, value.Status, value.Installation?.InstalledPackageVersion, value.CheckedAt, null, value.Success ? null : value.Code);
}
