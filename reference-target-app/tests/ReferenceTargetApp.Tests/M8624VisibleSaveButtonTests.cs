using System.IO;

namespace ReferenceTargetApp.Tests;

[TestClass]
public sealed class M8624VisibleSaveButtonTests
{
    [TestMethod]
    public void VisibleSaveAndContinueButtonUsesAcknowledgedSaveGateBeforeWindowClose()
    {
        var root = FindRepositoryRoot();
        var dialogXaml = File.ReadAllText(Path.Combine(root, "reference-target-app", "src", "ReferenceTargetApp.Wpf", "UI", "Views", "UnsavedChangesDialog.xaml"));
        var dialogCode = File.ReadAllText(Path.Combine(root, "reference-target-app", "src", "ReferenceTargetApp.Wpf", "UI", "Views", "UnsavedChangesDialog.xaml.cs"));
        var viewModel = File.ReadAllText(Path.Combine(root, "reference-target-app", "src", "ReferenceTargetApp.Wpf", "UI", "ViewModels", "EditorWindowViewModel.cs"));
        var session = File.ReadAllText(Path.Combine(root, "reference-target-app", "src", "ReferenceTargetApp.EditorIntegration", "Persistence", "LayoutProfileSession.cs"));
        var coordinator = File.ReadAllText(Path.Combine(root, "reference-target-app", "src", "ReferenceTargetApp.Wpf", "UI", "Editor", "EditorWindowCoordinator.cs"));

        StringAssert.Contains(dialogXaml, "Content=\"Speichern und fortfahren\" Click=\"Save_Click\"");
        StringAssert.Contains(dialogCode, "Save_Click(object sender, RoutedEventArgs e) { decision = UnsavedChangesDecision.Save; DialogResult = true; }");

        var saveDecision = viewModel.IndexOf("if (IsDirty && !await SaveAsync()) return false;", StringComparison.Ordinal);
        var savedDisposition = viewModel.IndexOf("CloseDisposition = EditorCloseDisposition.Saved;", saveDecision, StringComparison.Ordinal);
        var persistentWrite = session.IndexOf("profileStore.SaveAsync", StringComparison.Ordinal);
        var acknowledgement = session.IndexOf("saveAcknowledger(snapshot", persistentWrite, StringComparison.Ordinal);
        var acceptBoundary = session.IndexOf("saved = CloneStates(working);", acknowledgement, StringComparison.Ordinal);
        var confirmGate = coordinator.IndexOf("if (viewModel is not null && !await viewModel.ConfirmCloseAsync()) return;", StringComparison.Ordinal);
        var prepareClose = coordinator.IndexOf("if (prepareTargetClose is not null && !await prepareTargetClose(disposition)) return;", confirmGate, StringComparison.Ordinal);
        var windowClose = coordinator.IndexOf("await CloseAsync();", prepareClose, StringComparison.Ordinal);

        Assert.IsGreaterThanOrEqualTo(0, saveDecision, "Ein fehlgeschlagener Save muss ConfirmCloseAsync mit false verlassen.");
        Assert.IsGreaterThan(saveDecision, savedDisposition, "saved darf erst nach erfolgreichem Save gesetzt werden.");
        Assert.IsGreaterThanOrEqualTo(0, persistentWrite);
        Assert.IsGreaterThan(persistentWrite, acknowledgement, "Acknowledgement muss nach dem persistenten Schreibabschluss erfolgen.");
        Assert.IsGreaterThan(acknowledgement, acceptBoundary, "Die Sitzungsgrenze darf erst nach dem Acknowledgement aktualisiert werden.");
        Assert.IsGreaterThanOrEqualTo(0, confirmGate);
        Assert.IsGreaterThan(confirmGate, prepareClose);
        Assert.IsGreaterThan(prepareClose, windowClose, "Das Fenster darf erst nach bestätigter Close-Vorbereitung schließen.");
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "reference-target-app"))) return directory.FullName;
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("Repository root not found.");
    }
}
