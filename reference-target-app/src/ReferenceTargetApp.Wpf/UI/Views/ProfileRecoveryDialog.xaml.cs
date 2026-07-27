using System.Windows;
using ReferenceTargetApp.EditorIntegration.Persistence;
using ReferenceTargetApp.UI.Editor;

namespace ReferenceTargetApp.UI.Views;

public partial class ProfileRecoveryDialog : Window
{
    private ProfileRecoveryDecision decision = ProfileRecoveryDecision.Cancel;

    internal ProfileRecoveryDialog(ProfileInspection inspection)
    {
        InitializeComponent();
        MessageText.Text = "Das gespeicherte Layout passt nicht mehr zur aktuellen Version der Ziel-App. " +
                           "Der Editor kann mit dem Standardlayout geöffnet werden. Das bisherige Profil bleibt als Sicherung erhalten.";
        WorkspaceText.Text = inspection.Workspace == "pdf" ? "Betroffen: PDF-Ausgabe" : "Betroffen: Programmoberfläche";
        var details = new List<string>
        {
            $"Status: {inspection.StateValue}",
            $"Technischer Code: {inspection.Code}",
            $"Ursachencode: {inspection.CauseCode ?? "-"}",
            $"Profilpfad: {inspection.FilePath}",
            $"applicationId: {inspection.ApplicationId}",
            $"documentTypeId: {inspection.DocumentTypeId ?? "-"}",
            $"Schema: {inspection.SchemaVersion ?? "-"}",
            $"Gespeicherter Fingerprint: {inspection.StoredFingerprint ?? "-"}",
            $"Aktueller Fingerprint: {inspection.CurrentFingerprint}"
        };
        if (!string.IsNullOrWhiteSpace(inspection.MigrationReport)) details.Add($"Migrationsbericht: {inspection.MigrationReport}");
        DetailsText.Text = string.Join(Environment.NewLine, details);
        MigrateButton.Visibility = inspection.MigrationAvailable ? Visibility.Visible : Visibility.Collapsed;
    }

    internal ProfileRecoveryDecision ShowDecision()
    {
        ShowDialog();
        return decision;
    }

    private void Details_Click(object sender, RoutedEventArgs e)
    {
        var visible = DetailsPanel.Visibility != Visibility.Visible;
        DetailsPanel.Visibility = visible ? Visibility.Visible : Visibility.Collapsed;
        DetailsButton.Content = visible ? "Details ausblenden" : "Details anzeigen";
    }

    private void Baseline_Click(object sender, RoutedEventArgs e) { decision = ProfileRecoveryDecision.Baseline; DialogResult = true; }
    private void Migrate_Click(object sender, RoutedEventArgs e) { decision = ProfileRecoveryDecision.Migrate; DialogResult = true; }
    private void Cancel_Click(object sender, RoutedEventArgs e) { decision = ProfileRecoveryDecision.Cancel; DialogResult = false; }
}
