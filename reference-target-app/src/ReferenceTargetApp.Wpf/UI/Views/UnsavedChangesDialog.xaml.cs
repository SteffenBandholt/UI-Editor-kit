using System.Windows;
using ReferenceTargetApp.UI.Editor;

namespace ReferenceTargetApp.UI.Views;

public partial class UnsavedChangesDialog : Window
{
    private UnsavedChangesDecision decision = UnsavedChangesDecision.Cancel;

    internal UnsavedChangesDialog(string context)
    {
        InitializeComponent();
        ContextText.Text = context;
    }

    internal UnsavedChangesDecision ShowDialogDecision()
    {
        ShowDialog();
        return decision;
    }

    internal void CompleteForDiagnostic(UnsavedChangesDecision selected)
    {
        decision = selected;
        DialogResult = selected != UnsavedChangesDecision.Cancel;
    }

    private void Save_Click(object sender, RoutedEventArgs e) { decision = UnsavedChangesDecision.Save; DialogResult = true; }
    private void Discard_Click(object sender, RoutedEventArgs e) { decision = UnsavedChangesDecision.Discard; DialogResult = true; }
    private void Cancel_Click(object sender, RoutedEventArgs e) { decision = UnsavedChangesDecision.Cancel; DialogResult = false; }
}
