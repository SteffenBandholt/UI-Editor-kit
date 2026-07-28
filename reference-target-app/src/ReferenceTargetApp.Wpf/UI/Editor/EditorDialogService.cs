using System.Windows;
using ReferenceTargetApp.UI.Views;
using ReferenceTargetApp.EditorIntegration.Geometry;

namespace ReferenceTargetApp.UI.Editor;

internal enum UnsavedChangesDecision { Save, Discard, Cancel }

internal interface IEditorDialogService
{
    UnsavedChangesDecision AskUnsavedChanges(Window owner, string context);
    bool Confirm(Window owner, string title, string message);
    GeometryRiskDecision AskGeometryRisk(Window owner, GeometryRiskAssessment risk);
}

internal sealed class NativeEditorDialogService : IEditorDialogService
{
    private readonly Queue<UnsavedChangesDecision> diagnosticDecisions;
    private readonly Queue<GeometryRiskDecision> diagnosticGeometryDecisions;

    internal NativeEditorDialogService(
        IEnumerable<UnsavedChangesDecision>? diagnosticDecisions = null,
        IEnumerable<GeometryRiskDecision>? diagnosticGeometryDecisions = null)
    {
        this.diagnosticDecisions = new Queue<UnsavedChangesDecision>(diagnosticDecisions ?? []);
        this.diagnosticGeometryDecisions = new Queue<GeometryRiskDecision>(diagnosticGeometryDecisions ?? []);
    }

    public UnsavedChangesDecision AskUnsavedChanges(Window owner, string context)
    {
        var dialog = new UnsavedChangesDialog(context) { Owner = owner };
        if (diagnosticDecisions.Count > 0)
            dialog.ContentRendered += (_, _) => dialog.CompleteForDiagnostic(diagnosticDecisions.Dequeue());
        return dialog.ShowDialogDecision();
    }

    public bool Confirm(Window owner, string title, string message) =>
        MessageBox.Show(owner, message, title, MessageBoxButton.YesNo, MessageBoxImage.Warning, MessageBoxResult.No) == MessageBoxResult.Yes;

    public GeometryRiskDecision AskGeometryRisk(Window owner, GeometryRiskAssessment risk)
    {
        var dialog = new GeometryRiskDialog(risk) { Owner = owner };
        if (diagnosticGeometryDecisions.Count > 0)
            dialog.ContentRendered += (_, _) => dialog.CompleteForDiagnostic(diagnosticGeometryDecisions.Dequeue());
        return dialog.ShowDialogDecision();
    }
}
