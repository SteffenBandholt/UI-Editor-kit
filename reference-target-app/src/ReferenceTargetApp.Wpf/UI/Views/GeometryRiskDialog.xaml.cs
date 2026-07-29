using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using ReferenceTargetApp.EditorIntegration.Geometry;

namespace ReferenceTargetApp.UI.Views;

public partial class GeometryRiskDialog : Window
{
    private GeometryRiskDecision decision = GeometryRiskDecision.Cancel;

    internal GeometryRiskDialog(GeometryRiskAssessment risk)
    {
        InitializeComponent();
        TitleText.Text = risk.Title;
        MessageText.Text = risk.Message;
        ModeText.Text = risk.EditMode == GeometryEditModes.Free
            ? "Bearbeitungsmodus: Frei · Überlappungen und das Verlassen von Gruppen sind erlaubt."
            : "Bearbeitungsmodus: Geführt";
        DetailsText.Text = JsonSerializer.Serialize(risk.TechnicalDetails, new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true });
        AddAction(risk, GeometryRiskActions.ClampToGroup, "In der Gruppe halten", GeometryRiskDecision.ClampToGroup, true);
        AddAction(risk, GeometryRiskActions.ClampToArea, "Im Bereich halten", GeometryRiskDecision.ClampToArea, true);
        AddAction(risk, GeometryRiskActions.ApplyAnyway, risk.EditMode == GeometryEditModes.Free ? "Anwenden" : "Trotzdem anwenden", GeometryRiskDecision.ApplyAnyway, true);
        AddAction(risk, GeometryRiskActions.PreserveSpace, "Freien Platz stehen lassen", GeometryRiskDecision.PreserveSpace, true);
        AddAction(risk, GeometryRiskActions.ReflowNeighbors, "Nachbarelemente nachrücken lassen", GeometryRiskDecision.ReflowNeighbors, false);
        AddAction(risk, GeometryRiskActions.ShrinkGroup, "Gruppe entsprechend verkleinern", GeometryRiskDecision.ShrinkGroup, false);
        AddAction(risk, GeometryRiskActions.GoBack, "Zurück", GeometryRiskDecision.GoBack, false);
        AddAction(risk, GeometryRiskActions.Cancel, "Abbrechen", GeometryRiskDecision.Cancel, false);
    }

    internal GeometryRiskDecision ShowDialogDecision()
    {
        ShowDialog();
        return decision;
    }

    internal void CompleteForDiagnostic(GeometryRiskDecision value)
    {
        decision = value;
        DialogResult = value is not GeometryRiskDecision.Cancel and not GeometryRiskDecision.GoBack;
    }

    private void AddAction(GeometryRiskAssessment risk, string action, string label, GeometryRiskDecision value, bool primary)
    {
        if (!risk.SuggestedActions.Contains(action, StringComparer.Ordinal)) return;
        var button = new Button { Content = label, MinWidth = 110, Margin = new Thickness(6, 0, 0, 0), IsDefault = primary && value is GeometryRiskDecision.ApplyAnyway or GeometryRiskDecision.PreserveSpace, IsCancel = value == GeometryRiskDecision.Cancel };
        if (primary) { button.Background = FindResource("PrimaryBrush") as System.Windows.Media.Brush; button.Foreground = System.Windows.Media.Brushes.White; }
        button.Click += (_, _) => { decision = value; DialogResult = value is not GeometryRiskDecision.Cancel and not GeometryRiskDecision.GoBack; };
        Actions.Children.Add(button);
    }
}
