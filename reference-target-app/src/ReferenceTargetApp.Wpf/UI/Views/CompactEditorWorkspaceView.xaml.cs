using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using ReferenceTargetApp.UI.ViewModels;

namespace ReferenceTargetApp.UI.Views;

public partial class CompactEditorWorkspaceView : UserControl
{
    private int columnMode;

    public CompactEditorWorkspaceView()
    {
        InitializeComponent();
        Loaded += (_, _) => ApplyResponsiveLayout(ActualWidth);
    }

    internal int ColumnMode => columnMode;

    private void Workspace_SizeChanged(object sender, SizeChangedEventArgs e) => ApplyResponsiveLayout(e.NewSize.Width);

    private void ApplyResponsiveLayout(double width)
    {
        var mode = width < 860 ? 1 : width < 1260 ? 2 : 3;
        if (mode == columnMode) return;
        columnMode = mode;
        AdaptiveColumns.ColumnDefinitions.Clear();
        AdaptiveColumns.RowDefinitions.Clear();
        if (mode == 1)
        {
            AdaptiveColumns.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            AddRows(3);
            Place(SelectionColumn, 0, 0); Place(GeometryColumn, 1, 0); Place(GroupColumn, 2, 0);
            SelectionColumn.Margin = new Thickness(0, 0, 0, 8); GeometryColumn.Margin = new Thickness(0, 0, 0, 8); GroupColumn.Margin = new Thickness(0);
        }
        else if (mode == 2)
        {
            AddColumns(2); AddRows(2);
            Place(SelectionColumn, 0, 0, 2); Place(GeometryColumn, 0, 1); Place(GroupColumn, 1, 1);
            SelectionColumn.Margin = new Thickness(0, 0, 8, 0); GeometryColumn.Margin = new Thickness(0, 0, 0, 4); GroupColumn.Margin = new Thickness(0, 4, 0, 0);
        }
        else
        {
            AddColumns(3); AddRows(1);
            Place(SelectionColumn, 0, 0); Place(GeometryColumn, 0, 1); Place(GroupColumn, 0, 2);
            SelectionColumn.Margin = new Thickness(0, 0, 8, 0); GeometryColumn.Margin = new Thickness(0, 0, 8, 0); GroupColumn.Margin = new Thickness(0);
        }
        AutomationProperties.SetHelpText(this, $"Kompakter Editor: {mode} Spalte{(mode == 1 ? string.Empty : "n")}");
    }

    private void AddColumns(int count)
    {
        for (var index = 0; index < count; index++) AdaptiveColumns.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star), MinWidth = 250 });
    }

    private void AddRows(int count)
    {
        for (var index = 0; index < count; index++) AdaptiveColumns.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star), MinHeight = 180 });
    }

    private static void Place(UIElement element, int row, int column, int rowSpan = 1)
    {
        Grid.SetRow(element, row); Grid.SetColumn(element, column); Grid.SetRowSpan(element, rowSpan); Grid.SetColumnSpan(element, 1);
    }

    private async void ElementTree_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
    {
        if (CompactElementTree.IsKeyboardFocusWithin && DataContext is EditorWindowViewModel viewModel && !viewModel.IsApplyingState && e.NewValue is EditorTreeNodeViewModel node &&
            !string.Equals(viewModel.SelectedId, node.Id, StringComparison.Ordinal))
            await viewModel.SelectElementAsync(node.Id);
    }

    private async void ScopeSelector_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (DataContext is EditorWindowViewModel viewModel && CompactScopeSelector.SelectedValue is string scopeId)
            await viewModel.SelectScopeAsync(scopeId);
    }

    private async void ProfileSelector_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (DataContext is EditorWindowViewModel viewModel && CompactProfileSelector.SelectedValue is string profileId)
            await viewModel.SelectProfileAsync(profileId);
    }
}
