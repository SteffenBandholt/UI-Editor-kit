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

    internal EditorWindow(EditorWindowViewModel viewModel, EditorWindowCoordinator lifecycle)
    {
        InitializeComponent();
        DataContext = viewModel;
        this.lifecycle = lifecycle;
        Closing += EditorWindow_Closing;
    }

    internal void CompleteClose()
    {
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
        if (DataContext is EditorWindowViewModel viewModel && e.NewValue is PdfTreeNodeViewModel node)
            viewModel.Pdf.SelectElement(node.Id);
    }

    private void PdfPageList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (DataContext is EditorWindowViewModel viewModel)
            viewModel.Pdf.SelectPage(PdfPageList.SelectedItem as PdfPageViewModel);
    }

    private void PdfPreviewViewport_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (DataContext is EditorWindowViewModel viewModel)
        {
            var point = e.GetPosition(PdfPreviewViewport);
            viewModel.Pdf.SelectAtPreview(point.X, point.Y, PdfPreviewViewport.ActualWidth, PdfPreviewViewport.ActualHeight);
        }
    }

    private void PdfPreviewViewport_SizeChanged(object sender, SizeChangedEventArgs e)
    {
        if (DataContext is EditorWindowViewModel viewModel)
            viewModel.Pdf.UpdateOverlay(e.NewSize.Width, e.NewSize.Height);
    }
}
