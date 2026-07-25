using System.Windows;
using ReferenceTargetApp.UI.Views;

namespace ReferenceTargetApp.UI.Editor;

internal enum UnsavedChangesDecision { Save, Discard, Cancel }

internal interface IEditorDialogService
{
    UnsavedChangesDecision AskUnsavedChanges(Window owner, string context);
    bool Confirm(Window owner, string title, string message);
}

internal sealed class NativeEditorDialogService : IEditorDialogService
{
    private readonly Queue<UnsavedChangesDecision> diagnosticDecisions;

    internal NativeEditorDialogService(IEnumerable<UnsavedChangesDecision>? diagnosticDecisions = null) =>
        this.diagnosticDecisions = new Queue<UnsavedChangesDecision>(diagnosticDecisions ?? []);

    public UnsavedChangesDecision AskUnsavedChanges(Window owner, string context)
    {
        var dialog = new UnsavedChangesDialog(context) { Owner = owner };
        if (diagnosticDecisions.Count > 0)
            dialog.ContentRendered += (_, _) => dialog.CompleteForDiagnostic(diagnosticDecisions.Dequeue());
        return dialog.ShowDialogDecision();
    }

    public bool Confirm(Window owner, string title, string message) =>
        MessageBox.Show(owner, message, title, MessageBoxButton.YesNo, MessageBoxImage.Warning, MessageBoxResult.No) == MessageBoxResult.Yes;
}
