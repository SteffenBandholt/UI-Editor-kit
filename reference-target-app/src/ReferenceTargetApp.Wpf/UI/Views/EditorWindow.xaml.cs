using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using ReferenceTargetApp.UI.Editor;
using ReferenceTargetApp.UI.ViewModels;

namespace ReferenceTargetApp.UI.Views;

public partial class EditorWindow : Window
{
    private readonly EditorWindowCoordinator lifecycle;
    private bool closeAllowed;
    private int pdfColumnMode;

    internal EditorWindow(EditorWindowViewModel viewModel, EditorWindowCoordinator lifecycle)
    {
        InitializeComponent();
        DataContext = viewModel;
        this.lifecycle = lifecycle;
        Closing += EditorWindow_Closing;
    }

    internal void CompleteClose()
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.Invoke(CompleteClose);
            return;
        }
        closeAllowed = true;
        Close();
    }

    private async void EditorWindow_Closing(object? sender, CancelEventArgs e)
    {
        if (closeAllowed) return;
        e.Cancel = true;
        await lifecycle.RequestCloseAsync();
    }

    private async void ElementTree_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
    {
        if (ElementTree.IsKeyboardFocusWithin && DataContext is EditorWindowViewModel viewModel && !viewModel.IsApplyingState && e.NewValue is EditorTreeNodeViewModel node &&
            !string.Equals(viewModel.SelectedId, node.Id, StringComparison.Ordinal))
            await viewModel.SelectElementAsync(node.Id);
    }

    private async void ScopeSelector_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (DataContext is EditorWindowViewModel viewModel && ScopeSelector.SelectedValue is string scopeId)
            await viewModel.SelectScopeAsync(scopeId);
    }

    private async void ProfileSelector_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (DataContext is EditorWindowViewModel viewModel && ProfileSelector.SelectedValue is string profileId)
            await viewModel.SelectProfileAsync(profileId);
    }

    private void PdfElementTree_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
    {
        if (DataContext is EditorWindowViewModel viewModel && viewModel.PdfBinding is PdfEditorWorkspaceViewModel pdf && e.NewValue is PdfTreeNodeViewModel node)
            pdf.SelectElement(node.Id);
    }

    private void PdfPageList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (DataContext is EditorWindowViewModel viewModel && viewModel.PdfBinding is PdfEditorWorkspaceViewModel pdf)
            pdf.SelectPage(PdfPageList.SelectedItem as PdfPageViewModel);
    }

    private void PdfPreviewViewport_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (DataContext is EditorWindowViewModel viewModel && viewModel.PdfBinding is PdfEditorWorkspaceViewModel pdf)
        {
            var point = e.GetPosition(PdfPreviewViewport);
            pdf.SelectAtPreview(point.X, point.Y, PdfPreviewViewport.ActualWidth, PdfPreviewViewport.ActualHeight);
        }
    }

    private void PdfPreviewViewport_SizeChanged(object sender, SizeChangedEventArgs e)
    {
        if (DataContext is EditorWindowViewModel viewModel && viewModel.PdfBinding is PdfEditorWorkspaceViewModel pdf)
            pdf.UpdateOverlay(e.NewSize.Width, e.NewSize.Height);
    }

    internal int UiColumnMode => CompactUiWorkspace.ColumnMode;
    internal int PdfColumnMode => pdfColumnMode;

    private void PdfAdaptiveGrid_SizeChanged(object sender, SizeChangedEventArgs e)
    {
        var mode = e.NewSize.Width < 860 ? 1 : e.NewSize.Width < 1260 ? 2 : 3;
        if (mode == pdfColumnMode) return;
        pdfColumnMode = mode;
        PdfAdaptiveGrid.ColumnDefinitions.Clear();
        PdfAdaptiveGrid.RowDefinitions.Clear();
        if (mode == 1)
        {
            PdfAdaptiveGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            AddPdfRows(3);
            PlacePdf(PdfSelectionColumn, 0, 0); PlacePdf(PdfPreviewColumn, 1, 0); PlacePdf(PdfPropertyColumn, 2, 0);
            PdfSelectionColumn.Margin = new Thickness(0, 0, 0, 8); PdfPreviewColumn.Margin = new Thickness(0, 0, 0, 8); PdfPropertyColumn.Margin = new Thickness(0);
        }
        else if (mode == 2)
        {
            AddPdfColumns(2); AddPdfRows(2);
            PlacePdf(PdfSelectionColumn, 0, 0, 2); PlacePdf(PdfPreviewColumn, 0, 1); PlacePdf(PdfPropertyColumn, 1, 1);
            PdfSelectionColumn.Margin = new Thickness(0, 0, 8, 0); PdfPreviewColumn.Margin = new Thickness(0, 0, 0, 4); PdfPropertyColumn.Margin = new Thickness(0, 4, 0, 0);
        }
        else
        {
            AddPdfColumns(3); AddPdfRows(1);
            PlacePdf(PdfSelectionColumn, 0, 0); PlacePdf(PdfPreviewColumn, 0, 1); PlacePdf(PdfPropertyColumn, 0, 2);
            PdfSelectionColumn.Margin = new Thickness(0, 0, 8, 0); PdfPreviewColumn.Margin = new Thickness(0, 0, 8, 0); PdfPropertyColumn.Margin = new Thickness(0);
        }
    }

    private void AddPdfColumns(int count)
    {
        for (var index = 0; index < count; index++) PdfAdaptiveGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star), MinWidth = 250 });
    }

    private void AddPdfRows(int count)
    {
        for (var index = 0; index < count; index++) PdfAdaptiveGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star), MinHeight = 180 });
    }

    private static void PlacePdf(UIElement element, int row, int column, int rowSpan = 1)
    {
        Grid.SetRow(element, row); Grid.SetColumn(element, column); Grid.SetRowSpan(element, rowSpan); Grid.SetColumnSpan(element, 1);
    }
}
